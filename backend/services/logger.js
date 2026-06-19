const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'votesecure-backend' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, stack }) => {
          let log = `${timestamp} ${level}: ${message}`;
          if (stack) {
            log += `\n${stack}`;
          }
          return log;
        })
      )
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // File transport for error logs
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // File transport for audit logs
    new winston.transports.File({
      filename: path.join(logsDir, 'audit.log'),
      level: 'info',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 3,
      tailable: true
    })
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 5242880,
      maxFiles: 3,
      tailable: true
    })
  ]
});

// Create audit logger
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'audit.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 20,
      tailable: true
    })
  ]
});

// Security logger for sensitive events
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      tailable: true
    })
  ]
});

// Voting logger for vote-related events
const votingLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'voting.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 15,
      tailable: true
    })
  ]
});

// Performance logger
const performanceLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'performance.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

// Helper functions for structured logging
const logAudit = (action, entityType, entityId, userId, details = {}) => {
  auditLogger.info('Audit Log', {
    action,
    entityType,
    entityId,
    userId,
    timestamp: new Date().toISOString(),
    ...details
  });
};

const logSecurity = (event, severity, details = {}) => {
  securityLogger.warn('Security Event', {
    event,
    severity,
    timestamp: new Date().toISOString(),
    ...details
  });
};

const logVoting = (action, electionId, userId, details = {}) => {
  votingLogger.info('Voting Event', {
    action,
    electionId,
    userId,
    timestamp: new Date().toISOString(),
    ...details
  });
};

const logPerformance = (operation, duration, details = {}) => {
  performanceLogger.info('Performance Metric', {
    operation,
    duration,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Middleware for request logging
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  logger.info('Incoming Request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id
  });
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    
    logger.info('Outgoing Response', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id
    });
    
    // Log performance if request took longer than 1 second
    if (duration > 1000) {
      logPerformance('slow_request', duration, {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode
      });
    }
    
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

// Error logging helper
const logError = (error, context = {}) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    ...context
  });
};

// Database operation logging
const logDatabaseOperation = (operation, collection, duration, details = {}) => {
  performanceLogger.info('Database Operation', {
    operation,
    collection,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// API endpoint logging
const logApiCall = (method, endpoint, statusCode, duration, userId = null) => {
  logger.info('API Call', {
    method,
    endpoint,
    statusCode,
    duration: `${duration}ms`,
    userId,
    timestamp: new Date().toISOString()
  });
};

// Authentication logging
const logAuthentication = (action, userId, success, details = {}) => {
  const level = success ? 'info' : 'warn';
  
  securityLogger[level]('Authentication Event', {
    action,
    userId,
    success,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Vote casting logging
const logVoteCast = (electionId, candidateId, userId, details = {}) => {
  votingLogger.info('Vote Cast', {
    electionId,
    candidateId,
    userId,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Election management logging
const logElectionManagement = (action, electionId, userId, details = {}) => {
  auditLogger.info('Election Management', {
    action,
    electionId,
    userId,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// User management logging
const logUserManagement = (action, targetUserId, userId, details = {}) => {
  auditLogger.info('User Management', {
    action,
    targetUserId,
    userId,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// System health logging
const logSystemHealth = (component, status, details = {}) => {
  const level = status === 'healthy' ? 'info' : 'warn';
  
  logger[level]('System Health', {
    component,
    status,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Export logger and helper functions
module.exports = {
  logger,
  auditLogger,
  securityLogger,
  votingLogger,
  performanceLogger,
  requestLogger,
  logAudit,
  logSecurity,
  logVoting,
  logPerformance,
  logError,
  logDatabaseOperation,
  logApiCall,
  logAuthentication,
  logVoteCast,
  logElectionManagement,
  logUserManagement,
  logSystemHealth
};
