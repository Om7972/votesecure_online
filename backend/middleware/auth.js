const jwt = require('jsonwebtoken');
const { verifyIdToken, getUser, isFirebaseError, getFirebaseErrorMessage } = require('../services/firebase');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const logger = require('../services/logger');

// Firebase Authentication Middleware
const firebaseAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    const idToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify Firebase ID token
    const decodedToken = await verifyIdToken(idToken);
    
    // Get user from database
    let user = await User.findByFirebaseUid(decodedToken.uid);
    
    if (!user) {
      // Create user if they don't exist (for new registrations)
      user = await createUserFromFirebase(decodedToken);
    } else {
      // Update last login info
      user.securityInfo.lastLoginAt = new Date();
      user.securityInfo.lastLoginIp = getClientIp(req);
      await user.save();
    }
    
    // Check if user is active
    if (user.status !== 'active' && user.status !== 'pending_verification') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active. Please contact support.',
        code: 'ACCOUNT_INACTIVE'
      });
    }
    
    // Add user to request object
    req.user = user;
    req.firebaseToken = decodedToken;
    
    // Log authentication
    await AuditLog.logAction({
      action: 'user_login',
      entityType: 'user',
      entityId: user._id,
      userId: user._id,
      userInfo: {
        email: user.email,
        role: user.role,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        sessionId: req.sessionID
      },
      details: {
        description: 'User authenticated successfully',
        severity: 'low'
      },
      security: {
        riskLevel: 'low',
        requiresReview: false
      },
      location: {
        ipAddress: getClientIp(req)
      },
      device: {
        userAgent: req.headers['user-agent'],
        browser: getBrowserInfo(req),
        os: getOSInfo(req)
      },
      response: {
        success: true,
        statusCode: 200
      }
    });
    
    next();
    
  } catch (error) {
    logger.error('Firebase authentication error:', error);
    
    // Log failed authentication
    await AuditLog.logAction({
      action: 'failed_login_attempt',
      entityType: 'user',
      userId: null,
      userInfo: {
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent']
      },
      details: {
        description: 'Failed authentication attempt',
        severity: 'medium'
      },
      security: {
        riskLevel: 'medium',
        requiresReview: true,
        isSuspicious: true
      },
      response: {
        success: false,
        statusCode: 401,
        errorMessage: error.message
      }
    });
    
    if (isFirebaseError(error)) {
      return res.status(401).json({
        success: false,
        message: getFirebaseErrorMessage(error),
        code: error.code
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Authentication failed. Please try again.',
      code: 'AUTH_ERROR'
    });
  }
};

// JWT Authentication Middleware (for API tokens)
const jwtAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.substring(7);
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active.',
        code: 'ACCOUNT_INACTIVE'
      });
    }
    
    // Add user to request object
    req.user = user;
    req.jwtPayload = decoded;
    
    next();
    
  } catch (error) {
    logger.error('JWT authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Authentication failed.',
      code: 'AUTH_ERROR'
    });
  }
};

// Role-based Authorization Middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
        code: 'AUTH_REQUIRED'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions.',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }
    
    next();
  };
};

// Permission-based Authorization Middleware
const hasPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
        code: 'AUTH_REQUIRED'
      });
    }
    
    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: `Permission '${permission}' required.`,
        code: 'PERMISSION_DENIED'
      });
    }
    
    next();
  };
};

// Admin Authorization Middleware
const adminAuth = authorize('admin', 'super_admin');

// Super Admin Authorization Middleware
const superAdminAuth = authorize('super_admin');

// Voter Authorization Middleware
const voterAuth = authorize('voter');

// Optional Authentication Middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.substring(7);
      const decodedToken = await verifyIdToken(idToken);
      const user = await User.findByFirebaseUid(decodedToken.uid);
      
      if (user && user.status === 'active') {
        req.user = user;
        req.firebaseToken = decodedToken;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Rate Limiting for Authentication Endpoints
const authRateLimit = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Helper function to create user from Firebase token
const createUserFromFirebase = async (decodedToken) => {
  try {
    const userData = {
      firebaseUid: decodedToken.uid,
      email: decodedToken.email,
      personalInfo: {
        firstName: decodedToken.name?.split(' ')[0] || '',
        lastName: decodedToken.name?.split(' ').slice(1).join(' ') || '',
        dateOfBirth: new Date('1990-01-01') // Default date, should be updated
      },
      profile: {
        avatar: decodedToken.picture || null
      },
      status: 'pending_verification',
      role: 'voter',
      permissions: ['vote']
    };
    
    const user = new User(userData);
    await user.save();
    
    logger.info('User created from Firebase token', { uid: decodedToken.uid });
    
    return user;
  } catch (error) {
    logger.error('Failed to create user from Firebase token:', error);
    throw error;
  }
};

// Helper function to get client IP
const getClientIp = (req) => {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         req.ip ||
         '127.0.0.1';
};

// Helper function to get browser info
const getBrowserInfo = (req) => {
  const userAgent = req.headers['user-agent'] || '';
  
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  
  return 'Unknown';
};

// Helper function to get OS info
const getOSInfo = (req) => {
  const userAgent = req.headers['user-agent'] || '';
  
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS')) return 'iOS';
  
  return 'Unknown';
};

// Middleware to check if user has voted in specific election
const checkVoteStatus = (electionIdParam = 'electionId') => {
  return async (req, res, next) => {
    try {
      const electionId = req.params[electionIdParam];
      
      if (!electionId) {
        return res.status(400).json({
          success: false,
          message: 'Election ID is required.',
          code: 'ELECTION_ID_REQUIRED'
        });
      }
      
      if (req.user.hasVotedInElection(electionId)) {
        return res.status(409).json({
          success: false,
          message: 'You have already voted in this election.',
          code: 'ALREADY_VOTED'
        });
      }
      
      next();
    } catch (error) {
      logger.error('Vote status check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to check vote status.',
        code: 'VOTE_STATUS_ERROR'
      });
    }
  };
};

module.exports = {
  firebaseAuth,
  jwtAuth,
  authorize,
  hasPermission,
  adminAuth,
  superAdminAuth,
  voterAuth,
  optionalAuth,
  authRateLimit,
  checkVoteStatus
};
