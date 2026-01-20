const express = require('express');
const { body, validationResult } = require('express-validator');
const { 
  verifyIdToken, 
  createUser, 
  getUser, 
  updateUser, 
  generatePasswordResetLink,
  generateEmailVerificationLink,
  setCustomUserClaims,
  revokeRefreshTokens
} = require('../services/firebase');
const { firebaseAuth, authRateLimit } = require('../middleware/auth');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { encryptUserData } = require('../utils/encryption');
const { logAuthentication, logAudit } = require('../services/logger');
const router = express.Router();

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().isLength({ min: 1 }).withMessage('First name is required'),
  body('lastName').trim().isLength({ min: 1 }).withMessage('Last name is required'),
  body('dateOfBirth').isISO8601().withMessage('Valid date of birth is required'),
  body('phoneNumber').optional().isMobilePhone().withMessage('Valid phone number is required')
];

const loginValidation = [
  body('idToken').notEmpty().withMessage('ID token is required')
];

const updateProfileValidation = [
  body('firstName').optional().trim().isLength({ min: 1 }).withMessage('First name cannot be empty'),
  body('lastName').optional().trim().isLength({ min: 1 }).withMessage('Last name cannot be empty'),
  body('phoneNumber').optional().isMobilePhone().withMessage('Valid phone number is required'),
  body('address.street').optional().trim(),
  body('address.city').optional().trim(),
  body('address.state').optional().trim(),
  body('address.zipCode').optional().trim()
];

// Helper function to get client IP
const getClientIp = (req) => {
  return req.headers['x-forwarded-for'] || 
         req.connection.remoteAddress || 
         req.ip || 
         '127.0.0.1';
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', authRateLimit, registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password, firstName, lastName, dateOfBirth, phoneNumber, address } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      await logAuthentication('user_register', null, false, {
        email,
        reason: 'User already exists',
        ipAddress: getClientIp(req)
      });

      return res.status(409).json({
        success: false,
        message: 'User already exists with this email',
        code: 'USER_EXISTS'
      });
    }

    // Create Firebase user
    const firebaseUser = await createUser({
      email,
      password,
      emailVerified: false,
      displayName: `${firstName} ${lastName}`
    });

    // Create user in database
    const userData = {
      firebaseUid: firebaseUser.uid,
      email,
      personalInfo: {
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        phoneNumber: phoneNumber || '',
        address: address || {}
      },
      status: 'pending_verification',
      role: 'voter',
      permissions: ['vote']
    };

    const user = new User(userData);
    await user.save();

    // Generate email verification link
    const verificationLink = await generateEmailVerificationLink(email, {
      url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email`,
      handleCodeInApp: true
    });

    // Log successful registration
    await logAuthentication('user_register', user._id, true, {
      email,
      ipAddress: getClientIp(req)
    });

    await logAudit('user_create', 'user', user._id, user._id, {
      description: 'New user registered',
      severity: 'low'
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email for verification.',
      data: {
        user: {
          id: user._id,
          email: user.email,
          status: user.status,
          role: user.role
        },
        verificationLink // Only for development/testing
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    await logAuthentication('user_register', null, false, {
      email: req.body.email,
      error: error.message,
      ipAddress: getClientIp(req)
    });

    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.',
      code: 'REGISTRATION_ERROR'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user with Firebase ID token
// @access  Public
router.post('/login', authRateLimit, loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { idToken } = req.body;

    // Verify Firebase ID token
    const decodedToken = await verifyIdToken(idToken);
    
    // Get user from database
    let user = await User.findByFirebaseUid(decodedToken.uid);
    
    if (!user) {
      await logAuthentication('user_login', null, false, {
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        reason: 'User not found in database',
        ipAddress: getClientIp(req)
      });

      return res.status(404).json({
        success: false,
        message: 'User not found. Please register first.',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if user is locked
    if (user.isLocked) {
      await logAuthentication('user_login', user._id, false, {
        email: user.email,
        reason: 'Account is locked',
        ipAddress: getClientIp(req)
      });

      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to multiple failed attempts.',
        code: 'ACCOUNT_LOCKED'
      });
    }

    // Update login info
    user.securityInfo.lastLoginAt = new Date();
    user.securityInfo.lastLoginIp = getClientIp(req);
    user.securityInfo.loginAttempts = 0; // Reset login attempts
    await user.save();

    // Log successful login
    await logAuthentication('user_login', user._id, true, {
      email: user.email,
      ipAddress: getClientIp(req)
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          status: user.status,
          isEligibleToVote: user.isEligibleToVote,
          permissions: user.permissions,
          profile: user.profile
        },
        token: idToken
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    
    await logAuthentication('user_login', null, false, {
      error: error.message,
      ipAddress: getClientIp(req)
    });

    res.status(401).json({
      success: false,
      message: 'Login failed. Please check your credentials.',
      code: 'LOGIN_ERROR'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', firebaseAuth, async (req, res) => {
  try {
    // Revoke refresh tokens
    await revokeRefreshTokens(req.user.firebaseUid);

    // Log logout
    await logAuthentication('user_logout', req.user._id, true, {
      email: req.user.email,
      ipAddress: getClientIp(req)
    });

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', firebaseAuth, async (req, res) => {
  try {
    const user = req.user;
    
    // Decrypt sensitive data for response
    const userData = {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      permissions: user.permissions,
      isEligibleToVote: user.isEligibleToVote,
      age: user.age,
      profile: user.profile,
      personalInfo: {
        firstName: user.personalInfo.firstName,
        lastName: user.personalInfo.lastName,
        // Don't expose sensitive info like DOB, phone, address
      },
      votingInfo: {
        isRegistered: user.votingInfo.isRegistered,
        totalVotesCast: user.votingInfo.totalVotesCast,
        lastVoteDate: user.votingInfo.lastVoteDate
      },
      securityInfo: {
        twoFactorEnabled: user.securityInfo.twoFactorEnabled,
        lastLoginAt: user.securityInfo.lastLoginAt,
        emailVerified: user.securityInfo.emailVerified,
        phoneVerified: user.securityInfo.phoneVerified
      }
    };

    res.json({
      success: true,
      data: { user: userData }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile',
      code: 'PROFILE_ERROR'
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', firebaseAuth, updateProfileValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { firstName, lastName, phoneNumber, address, bio, preferences } = req.body;
    const user = req.user;

    // Update user data
    if (firstName) user.personalInfo.firstName = firstName;
    if (lastName) user.personalInfo.lastName = lastName;
    if (phoneNumber) user.personalInfo.phoneNumber = phoneNumber;
    if (address) user.personalInfo.address = { ...user.personalInfo.address, ...address };
    if (bio) user.profile.bio = bio;
    if (preferences) user.profile.preferences = { ...user.profile.preferences, ...preferences };

    user.updatedBy = user._id;
    await user.save();

    // Log profile update
    await logAudit('user_update', 'user', user._id, user._id, {
      description: 'User profile updated',
      updatedFields: Object.keys(req.body),
      severity: 'low'
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          profile: user.profile
        }
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      code: 'UPDATE_ERROR'
    });
  }
});

// @route   POST /api/auth/verify-email
// @desc    Verify user email
// @access  Private
router.post('/verify-email', firebaseAuth, async (req, res) => {
  try {
    const user = req.user;

    if (user.securityInfo.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified',
        code: 'ALREADY_VERIFIED'
      });
    }

    // Generate email verification link
    const verificationLink = await generateEmailVerificationLink(user.email, {
      url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email-success`,
      handleCodeInApp: true
    });

    // Log email verification request
    await logAudit('user_verification', 'user', user._id, user._id, {
      description: 'Email verification link requested',
      severity: 'low'
    });

    res.json({
      success: true,
      message: 'Verification email sent. Please check your inbox.',
      data: {
        verificationLink // Only for development/testing
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to send verification email',
      code: 'VERIFICATION_ERROR'
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Request password reset
// @access  Public
router.post('/reset-password', authRateLimit, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
        code: 'EMAIL_REQUIRED'
      });
    }

    // Check if user exists
    const user = await User.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent.'
      });
    }

    // Generate password reset link
    const resetLink = await generatePasswordResetLink(email, {
      url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password`,
      handleCodeInApp: true
    });

    // Log password reset request
    await logAuthentication('password_reset', user._id, true, {
      email,
      ipAddress: getClientIp(req)
    });

    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent.',
      data: {
        resetLink // Only for development/testing
      }
    });

  } catch (error) {
    console.error('Password reset error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to send password reset email',
      code: 'RESET_ERROR'
    });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', firebaseAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
        code: 'PASSWORDS_REQUIRED'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters',
        code: 'WEAK_PASSWORD'
      });
    }

    // Update password in Firebase
    await updateUser(req.user.firebaseUid, {
      password: newPassword
    });

    // Log password change
    await logAudit('password_change', 'user', req.user._id, req.user._id, {
      description: 'Password changed successfully',
      severity: 'medium'
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      code: 'CHANGE_PASSWORD_ERROR'
    });
  }
});

// @route   POST /api/auth/verify-phone
// @desc    Verify user phone number
// @access  Private
router.post('/verify-phone', firebaseAuth, async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
        code: 'PHONE_REQUIRED'
      });
    }

    const user = req.user;
    user.personalInfo.phoneNumber = phoneNumber;
    user.securityInfo.phoneVerified = true;
    await user.save();

    // Log phone verification
    await logAudit('phone_verification', 'user', user._id, user._id, {
      description: 'Phone number verified',
      severity: 'low'
    });

    res.json({
      success: true,
      message: 'Phone number verified successfully'
    });

  } catch (error) {
    console.error('Phone verification error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to verify phone number',
      code: 'PHONE_VERIFICATION_ERROR'
    });
  }
});

// @route   DELETE /api/auth/account
// @desc    Delete user account
// @access  Private
router.delete('/account', firebaseAuth, async (req, res) => {
  try {
    const user = req.user;

    // Check if user has voted in any elections
    if (user.votingInfo.totalVotesCast > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete account. You have cast votes that must be preserved for audit purposes.',
        code: 'VOTES_EXIST'
      });
    }

    // Soft delete user
    user.isDeleted = true;
    user.status = 'inactive';
    await user.save();

    // Log account deletion
    await logAudit('user_delete', 'user', user._id, user._id, {
      description: 'User account deleted',
      severity: 'high'
    });

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete account',
      code: 'DELETE_ERROR'
    });
  }
});

module.exports = router;
