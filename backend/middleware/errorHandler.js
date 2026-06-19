const { logError } = require('../services/logger');

const errorHandler = (error, req, res, next) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';
  let code = error.code || 'INTERNAL_ERROR';

  // Log the error
  logError(error, {
    url: req.url,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    code = 'VALIDATION_ERROR';
    
    // Extract validation errors
    const errors = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));
    
    return res.status(statusCode).json({
      success: false,
      message,
      code,
      errors
    });
  }

  if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
    code = 'INVALID_ID';
  }

  if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    if (error.code === 11000) {
      statusCode = 409;
      message = 'Duplicate entry';
      code = 'DUPLICATE_ENTRY';
      
      // Extract duplicate field
      const duplicateField = Object.keys(error.keyValue)[0];
      if (duplicateField) {
        message = `${duplicateField} already exists`;
      }
    } else {
      statusCode = 500;
      message = 'Database error';
      code = 'DATABASE_ERROR';
    }
  }

  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  }

  if (error.name === 'MulterError') {
    if (error.code === 'LIMIT_FILE_SIZE') {
      statusCode = 400;
      message = 'File too large';
      code = 'FILE_TOO_LARGE';
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      statusCode = 400;
      message = 'Too many files';
      code = 'TOO_MANY_FILES';
    } else {
      statusCode = 400;
      message = 'File upload error';
      code = 'UPLOAD_ERROR';
    }
  }

  // Handle rate limiting errors
  if (error.status === 429) {
    statusCode = 429;
    message = 'Too many requests';
    code = 'RATE_LIMIT_EXCEEDED';
  }

  // Handle Firebase errors
  if (error.code && error.code.startsWith('auth/')) {
    statusCode = 401;
    message = getFirebaseErrorMessage(error);
    code = error.code;
  }

  // Handle custom application errors
  if (error.isOperational) {
    statusCode = error.statusCode || 400;
    message = error.message;
    code = error.code || 'OPERATIONAL_ERROR';
  }

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const errorResponse = {
    success: false,
    message,
    code,
    ...(isDevelopment && { 
      stack: error.stack,
      details: error.details 
    })
  };

  // Add request ID if available
  if (req.requestId) {
    errorResponse.requestId = req.requestId;
  }

  // Add timestamp
  errorResponse.timestamp = new Date().toISOString();

  res.status(statusCode).json(errorResponse);
};

// Helper function to get Firebase error messages
const getFirebaseErrorMessage = (error) => {
  const errorMessages = {
    'auth/user-not-found': 'User not found',
    'auth/wrong-password': 'Incorrect password',
    'auth/invalid-email': 'Invalid email address',
    'auth/user-disabled': 'User account is disabled',
    'auth/email-already-exists': 'Email address already exists',
    'auth/weak-password': 'Password is too weak',
    'auth/invalid-credential': 'Invalid credentials',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later',
    'auth/network-request-failed': 'Network error. Please check your connection',
    'auth/invalid-id-token': 'Invalid authentication token',
    'auth/id-token-expired': 'Authentication token has expired'
  };

  return errorMessages[error.code] || error.message;
};

// Custom error class for operational errors
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'APP_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404, 'ROUTE_NOT_FOUND');
  next(error);
};

module.exports = {
  errorHandler,
  AppError,
  asyncHandler,
  notFoundHandler
};
