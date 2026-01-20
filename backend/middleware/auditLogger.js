const AuditLog = require('../models/AuditLog');
const { logAudit } = require('../services/logger');

// Audit logging middleware
const auditLogger = async (req, res, next) => {
  // Skip audit logging for certain endpoints
  const skipAuditPaths = [
    '/health',
    '/api/auth/login',
    '/api/auth/register'
  ];

  if (skipAuditPaths.includes(req.path)) {
    return next();
  }

  const startTime = Date.now();

  // Store original response methods
  const originalSend = res.send;
  const originalJson = res.json;

  // Override res.send to capture response data
  res.send = function(data) {
    logAuditEvent(req, res, startTime, data);
    return originalSend.call(this, data);
  };

  res.json = function(data) {
    logAuditEvent(req, res, startTime, data);
    return originalJson.call(this, data);
  };

  next();
};

// Helper function to log audit event
const logAuditEvent = async (req, res, startTime, responseData) => {
  try {
    const duration = Date.now() - startTime;
    
    // Determine action based on HTTP method and path
    const action = determineAction(req.method, req.path);
    
    // Determine entity type and ID
    const { entityType, entityId } = extractEntityInfo(req.path, req.params);
    
    // Extract user information
    const userInfo = extractUserInfo(req);
    
    // Determine severity based on response status
    const severity = determineSeverity(res.statusCode);
    
    // Extract request details
    const requestDetails = {
      method: req.method,
      url: req.url,
      headers: sanitizeHeaders(req.headers),
      body: sanitizeRequestBody(req.body),
      query: req.query,
      params: req.params
    };

    // Extract response details
    const responseDetails = {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      success: res.statusCode >= 200 && res.statusCode < 400,
      size: JSON.stringify(responseData || {}).length
    };

    // Create audit log entry
    const auditData = {
      action,
      entityType,
      entityId,
      userId: req.user?._id,
      userInfo,
      details: {
        description: `${req.method} ${req.path}`,
        request: requestDetails,
        response: responseDetails,
        severity
      },
      security: {
        riskLevel: determineRiskLevel(action, res.statusCode),
        requiresReview: shouldRequireReview(action, res.statusCode),
        isSuspicious: isSuspiciousActivity(req, res.statusCode)
      },
      location: {
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent']
      },
      device: {
        userAgent: req.headers['user-agent'],
        browser: getBrowserInfo(req),
        os: getOSInfo(req)
      },
      request: requestDetails,
      response: responseDetails,
      timestamp: new Date()
    };

    // Save audit log asynchronously (don't block response)
    setImmediate(async () => {
      try {
        await AuditLog.logAction(auditData);
      } catch (error) {
        console.error('Failed to save audit log:', error);
      }
    });

  } catch (error) {
    console.error('Audit logging error:', error);
  }
};

// Helper function to determine action from HTTP method and path
const determineAction = (method, path) => {
  const actionMap = {
    'GET': 'view',
    'POST': 'create',
    'PUT': 'update',
    'PATCH': 'update',
    'DELETE': 'delete'
  };

  // Special cases for specific paths
  if (path.includes('/auth/login')) return 'user_login';
  if (path.includes('/auth/logout')) return 'user_logout';
  if (path.includes('/auth/register')) return 'user_register';
  if (path.includes('/votes/cast')) return 'vote_cast';
  if (path.includes('/elections') && method === 'POST') return 'election_create';
  if (path.includes('/candidates') && method === 'POST') return 'candidate_create';
  if (path.includes('/admin/')) return 'admin_action';

  return actionMap[method] || 'unknown';
};

// Helper function to extract entity information from path
const extractEntityInfo = (path, params) => {
  let entityType = 'unknown';
  let entityId = null;

  if (path.includes('/users/')) {
    entityType = 'user';
    entityId = params.userId || params.id;
  } else if (path.includes('/elections/')) {
    entityType = 'election';
    entityId = params.electionId || params.id;
  } else if (path.includes('/candidates/')) {
    entityType = 'candidate';
    entityId = params.candidateId || params.id;
  } else if (path.includes('/votes/')) {
    entityType = 'vote';
    entityId = params.voteId || params.id;
  }

  return { entityType, entityId };
};

// Helper function to extract user information
const extractUserInfo = (req) => {
  if (!req.user) {
    return {
      email: null,
      role: null,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID
    };
  }

  return {
    email: req.user.email,
    role: req.user.role,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'],
    sessionId: req.sessionID
  };
};

// Helper function to determine severity based on response status
const determineSeverity = (statusCode) => {
  if (statusCode >= 500) return 'high';
  if (statusCode >= 400) return 'medium';
  if (statusCode >= 300) return 'low';
  return 'low';
};

// Helper function to determine risk level
const determineRiskLevel = (action, statusCode) => {
  // High risk actions
  const highRiskActions = ['vote_cast', 'election_create', 'user_delete', 'admin_action'];
  if (highRiskActions.includes(action)) return 'high';

  // Medium risk actions
  const mediumRiskActions = ['election_update', 'candidate_create', 'user_update'];
  if (mediumRiskActions.includes(action)) return 'medium';

  // Failed operations are higher risk
  if (statusCode >= 400) return 'medium';

  return 'low';
};

// Helper function to determine if review is required
const shouldRequireReview = (action, statusCode) => {
  const reviewActions = ['vote_cast', 'election_create', 'user_delete', 'admin_action'];
  return reviewActions.includes(action) || statusCode >= 400;
};

// Helper function to detect suspicious activity
const isSuspiciousActivity = (req, statusCode) => {
  // Multiple failed authentication attempts
  if (req.path.includes('/auth/') && statusCode >= 400) {
    return true;
  }

  // Access to admin endpoints by non-admin users
  if (req.path.includes('/admin/') && req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
    return true;
  }

  // Unusual request patterns (this would need more sophisticated logic)
  const suspiciousPatterns = [
    /\.\./,  // Path traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection
    /javascript:/i  // JavaScript injection
  ];

  const requestString = JSON.stringify({
    url: req.url,
    body: req.body,
    query: req.query
  });

  return suspiciousPatterns.some(pattern => pattern.test(requestString));
};

// Helper function to sanitize headers
const sanitizeHeaders = (headers) => {
  const sanitized = { ...headers };
  
  // Remove sensitive headers
  delete sanitized.authorization;
  delete sanitized.cookie;
  delete sanitized['x-api-key'];
  delete sanitized['x-auth-token'];
  
  return sanitized;
};

// Helper function to sanitize request body
const sanitizeRequestBody = (body) => {
  if (!body) return null;

  const sanitized = { ...body };
  
  // Remove sensitive fields
  delete sanitized.password;
  delete sanitized.token;
  delete sanitized.secret;
  delete sanitized.privateKey;
  
  // Truncate long strings
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'string' && sanitized[key].length > 1000) {
      sanitized[key] = sanitized[key].substring(0, 1000) + '... [truncated]';
    }
  });
  
  return sanitized;
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

// Custom audit logging function for specific events
const logCustomAudit = async (action, entityType, entityId, userId, details = {}) => {
  try {
    await AuditLog.logAction({
      action,
      entityType,
      entityId,
      userId,
      details,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Custom audit logging error:', error);
  }
};

module.exports = {
  auditLogger,
  logCustomAudit
};
