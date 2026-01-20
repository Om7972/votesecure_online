const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const xss = require('xss-clean'); // Using xss-clean instead of custom implementation
const path = require('path');
const cron = require('node-cron');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const electionRoutes = require('./routes/elections');
const candidateRoutes = require('./routes/candidates');
const voteRoutes = require('./routes/votes');
const adminRoutes = require('./routes/admin');
const auditRoutes = require('./routes/audit');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');
const auditLogger = require('./middleware/auditLogger');

// Import services
const { initializeFirebase } = require('./services/firebase');
const { connectDatabase } = require('./services/database');
const { initializeSocket } = require('./services/socket');
const { initializeScheduler } = require('./services/scheduler');
const { initializeLogger } = require('./services/logger');

// Import models for initialization
require('./models/User');
require('./models/Election');
require('./models/Candidate');
require('./models/Vote');
require('./models/AuditLog');

const app = express();
const server = createServer(app);

// Initialize logger
const logger = initializeLogger();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Added unsafe-inline for some frontend frameworks
      connectSrc: ["'self'", "https://identitytoolkit.googleapis.com"],
    },
  },
  crossOriginEmbedderPolicy: false // Disabled for Socket.IO compatibility
}));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://localhost:8080', 'http://localhost:5000'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
};
app.use(cors(corsOptions));

// Rate limiting - more specific limits for different endpoints
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: 900 // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization middleware
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(hpp()); // Prevent parameter pollution

// XSS protection - using xss-clean package instead of custom implementation
app.use(xss());

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/elections', authMiddleware, electionRoutes);
app.use('/api/candidates', authMiddleware, candidateRoutes);
app.use('/api/votes', authMiddleware, voteRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api/audit', authMiddleware, auditRoutes);

// API documentation
if (process.env.NODE_ENV !== 'production') {
  try {
    const swaggerUi = require('swagger-ui-express');
    const swaggerSpec = require('./config/swagger');
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    logger.info('Swagger API documentation enabled');
  } catch (error) {
    logger.warn('Swagger documentation not available:', error.message);
  }
}

// Serve frontend files in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../client/build');
  
  // Check if the frontend build directory exists
  if (require('fs').existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
    logger.info('Serving frontend files from ' + frontendPath);
  } else {
    logger.warn('Frontend build directory not found at ' + frontendPath);
  }
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use(errorHandler);

// Initialize services
async function initializeApp() {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('Database connected successfully');

    // Initialize Firebase
    await initializeFirebase();
    logger.info('Firebase initialized successfully');

    // Initialize Socket.IO
    const io = initializeSocket(server);
    app.set('io', io);

    // Initialize scheduled tasks
    initializeScheduler();

    const PORT = process.env.PORT || 5000;
    const HOST = process.env.HOST || '0.0.0.0'; // Changed to 0.0.0.0 for Docker compatibility

    const port = 3000;

// Serve static files (HTML, CSS, JS, images)
app.use(express.static(__dirname));

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
    server.listen(PORT, HOST, () => {
      logger.info(`🚀 VoteSecure server running on ${HOST}:${PORT}`);
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`📚 API Documentation available at http://${HOST}:${PORT}/api-docs`);
      }
      logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      server.close(() => {
        logger.info('HTTP server closed');
        mongoose.connection.close(false, () => {
          logger.info('MongoDB connection closed');
          process.exit(0);
        });
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  initializeApp();
}

module.exports = { app, server };