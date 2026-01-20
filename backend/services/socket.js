const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { verifyIdToken } = require('./firebase');
const User = require('../models/User');
const { logError } = require('./logger');

let io = null;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'],
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify Firebase token
      const decodedToken = await verifyIdToken(token);
      
      // Get user from database
      const user = await User.findByFirebaseUid(decodedToken.uid);
      
      if (!user) {
        return next(new Error('User not found'));
      }

      if (user.status !== 'active' && user.status !== 'pending_verification') {
        return next(new Error('User account is not active'));
      }

      socket.user = user;
      socket.firebaseToken = decodedToken;
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.email} connected via socket`);
    
    // Join user to their personal room
    socket.join(`user:${socket.user._id}`);
    
    // Join user to admin room if they're an admin
    if (socket.user.role === 'admin' || socket.user.role === 'super_admin') {
      socket.join('admin');
    }

    // Handle joining election rooms
    socket.on('join-election', (electionId) => {
      socket.join(`election:${electionId}`);
      console.log(`User ${socket.user.email} joined election room: ${electionId}`);
    });

    // Handle leaving election rooms
    socket.on('leave-election', (electionId) => {
      socket.leave(`election:${electionId}`);
      console.log(`User ${socket.user.email} left election room: ${electionId}`);
    });

    // Handle real-time vote casting
    socket.on('vote-cast', async (data) => {
      try {
        const { electionId, candidateId } = data;
        
        // Validate the vote (this would typically be done through the API)
        // For now, we'll just broadcast to the election room
        
        // Broadcast vote cast to election room (without revealing who voted)
        socket.to(`election:${electionId}`).emit('vote-updated', {
          electionId,
          candidateId,
          timestamp: new Date(),
          // Don't include voter information for privacy
        });
        
        console.log(`Vote cast in election ${electionId} for candidate ${candidateId}`);
        
      } catch (error) {
        console.error('Vote cast error:', error);
        socket.emit('error', { message: 'Failed to process vote' });
      }
    });

    // Handle election status updates
    socket.on('election-status-update', (data) => {
      const { electionId, status } = data;
      
      // Broadcast to all users in the election room
      io.to(`election:${electionId}`).emit('election-status-changed', {
        electionId,
        status,
        timestamp: new Date()
      });
    });

    // Handle candidate updates
    socket.on('candidate-update', (data) => {
      const { electionId, candidateId, updateType } = data;
      
      io.to(`election:${electionId}`).emit('candidate-updated', {
        electionId,
        candidateId,
        updateType,
        timestamp: new Date()
      });
    });

    // Handle admin notifications
    socket.on('admin-notification', (data) => {
      const { type, message, targetUsers } = data;
      
      if (targetUsers && Array.isArray(targetUsers)) {
        // Send to specific users
        targetUsers.forEach(userId => {
          io.to(`user:${userId}`).emit('notification', {
            type,
            message,
            timestamp: new Date()
          });
        });
      } else {
        // Send to all admins
        io.to('admin').emit('notification', {
          type,
          message,
          timestamp: new Date()
        });
      }
    });

    // Handle typing indicators (for chat features if implemented)
    socket.on('typing-start', (data) => {
      const { electionId, channel } = data;
      socket.to(`election:${electionId}`).emit('user-typing', {
        userId: socket.user._id,
        userName: socket.user.fullName,
        channel,
        isTyping: true
      });
    });

    socket.on('typing-stop', (data) => {
      const { electionId, channel } = data;
      socket.to(`election:${electionId}`).emit('user-typing', {
        userId: socket.user._id,
        userName: socket.user.fullName,
        channel,
        isTyping: false
      });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`User ${socket.user.email} disconnected: ${reason}`);
      
      // Notify election rooms that user left (if needed)
      // This could be used for live participant counts
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.user.email}:`, error);
      logError(error, { 
        component: 'socket', 
        userId: socket.user._id,
        socketId: socket.id 
      });
    });
  });

  // Error handling for the entire Socket.IO server
  io.on('error', (error) => {
    console.error('Socket.IO server error:', error);
    logError(error, { component: 'socket', level: 'server' });
  });

  return io;
};

// Helper functions to emit events from other parts of the application
const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

const emitToElection = (electionId, event, data) => {
  if (io) {
    io.to(`election:${electionId}`).emit(event, data);
  }
};

const emitToAdmins = (event, data) => {
  if (io) {
    io.to('admin').emit(event, data);
  }
};

const emitToAll = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

// Real-time vote counting
const updateVoteCounts = async (electionId) => {
  try {
    const Vote = require('../models/Vote');
    const voteCounts = await Vote.getVoteCounts(electionId);
    
    emitToElection(electionId, 'vote-counts-updated', {
      electionId,
      voteCounts,
      timestamp: new Date()
    });
    
    // Also emit to admins
    emitToAdmins('election-vote-update', {
      electionId,
      voteCounts,
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('Error updating vote counts:', error);
    logError(error, { component: 'socket', action: 'updateVoteCounts', electionId });
  }
};

// Real-time election status updates
const updateElectionStatus = (electionId, status, additionalData = {}) => {
  emitToElection(electionId, 'election-status-updated', {
    electionId,
    status,
    timestamp: new Date(),
    ...additionalData
  });
  
  emitToAdmins('election-status-changed', {
    electionId,
    status,
    timestamp: new Date(),
    ...additionalData
  });
};

// Real-time notifications
const sendNotification = (userId, notification) => {
  emitToUser(userId, 'notification', {
    ...notification,
    timestamp: new Date()
  });
};

const sendBroadcastNotification = (notification) => {
  emitToAll('notification', {
    ...notification,
    timestamp: new Date()
  });
};

// System alerts
const sendSystemAlert = (alert) => {
  emitToAdmins('system-alert', {
    ...alert,
    timestamp: new Date()
  });
};

// User activity tracking
const trackUserActivity = (userId, activity) => {
  emitToUser(userId, 'activity-update', {
    activity,
    timestamp: new Date()
  });
};

// Get connected users count
const getConnectedUsersCount = () => {
  if (!io) return 0;
  return io.engine.clientsCount;
};

// Get connected users in a specific room
const getRoomUsersCount = (roomName) => {
  if (!io) return 0;
  const room = io.sockets.adapter.rooms.get(roomName);
  return room ? room.size : 0;
};

// Get all connected users info
const getConnectedUsers = () => {
  if (!io) return [];
  
  const users = [];
  io.sockets.sockets.forEach(socket => {
    if (socket.user) {
      users.push({
        userId: socket.user._id,
        email: socket.user.email,
        role: socket.user.role,
        connectedAt: socket.handshake.time,
        socketId: socket.id
      });
    }
  });
  
  return users;
};

// Graceful shutdown
const shutdown = () => {
  if (io) {
    console.log('Shutting down Socket.IO server...');
    io.close();
    io = null;
  }
};

module.exports = {
  initializeSocket,
  emitToUser,
  emitToElection,
  emitToAdmins,
  emitToAll,
  updateVoteCounts,
  updateElectionStatus,
  sendNotification,
  sendBroadcastNotification,
  sendSystemAlert,
  trackUserActivity,
  getConnectedUsersCount,
  getRoomUsersCount,
  getConnectedUsers,
  shutdown
};
