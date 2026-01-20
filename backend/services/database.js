const mongoose = require('mongoose');
const { logError, logSystemHealth } = require('./logger');

let isConnected = false;

const connectDatabase = async () => {
  try {
    if (isConnected) {
      console.log('Database already connected');
      return;
    }

    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/votesecure';
    
    console.log('Connecting to MongoDB...');
    
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferMaxEntries: 0, // Disable mongoose buffering
      bufferCommands: false, // Disable mongoose buffering
    };

    await mongoose.connect(mongoUri, options);
    
    isConnected = true;
    
    // Connection event listeners
    mongoose.connection.on('connected', () => {
      console.log('MongoDB connected successfully');
      logSystemHealth('database', 'healthy', {
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      });
    });

    mongoose.connection.on('error', (error) => {
      console.error('MongoDB connection error:', error);
      logError(error, { component: 'database' });
      logSystemHealth('database', 'unhealthy', { error: error.message });
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      isConnected = false;
      logSystemHealth('database', 'disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
      isConnected = true;
      logSystemHealth('database', 'healthy', { status: 'reconnected' });
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed through app termination');
        process.exit(0);
      } catch (error) {
        console.error('Error closing MongoDB connection:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    logError(error, { component: 'database', action: 'connection' });
    logSystemHealth('database', 'unhealthy', { error: error.message });
    throw error;
  }
};

const disconnectDatabase = async () => {
  try {
    if (isConnected) {
      await mongoose.connection.close();
      isConnected = false;
      console.log('MongoDB disconnected');
    }
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error);
    logError(error, { component: 'database', action: 'disconnection' });
    throw error;
  }
};

const getConnectionStatus = () => {
  return {
    isConnected,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name
  };
};

const getDatabaseStats = async () => {
  try {
    if (!isConnected) {
      throw new Error('Database not connected');
    }

    const stats = await mongoose.connection.db.stats();
    
    return {
      collections: stats.collections,
      dataSize: stats.dataSize,
      storageSize: stats.storageSize,
      indexSize: stats.indexSize,
      objects: stats.objects,
      avgObjSize: stats.avgObjSize,
      indexes: stats.indexes
    };
  } catch (error) {
    logError(error, { component: 'database', action: 'getStats' });
    throw error;
  }
};

const createIndexes = async () => {
  try {
    if (!isConnected) {
      throw new Error('Database not connected');
    }

    // Create indexes for better performance
    const User = require('../models/User');
    const Election = require('../models/Election');
    const Candidate = require('../models/Candidate');
    const Vote = require('../models/Vote');
    const AuditLog = require('../models/AuditLog');

    // User indexes
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ firebaseUid: 1 }, { unique: true });
    await User.collection.createIndex({ 'personalInfo.voterId': 1 }, { unique: true, sparse: true });
    await User.collection.createIndex({ role: 1 });
    await User.collection.createIndex({ status: 1 });
    await User.collection.createIndex({ createdAt: -1 });

    // Election indexes
    await Election.collection.createIndex({ status: 1 });
    await Election.collection.createIndex({ type: 1, category: 1 });
    await Election.collection.createIndex({ 'votingPeriod.startDate': 1, 'votingPeriod.endDate': 1 });
    await Election.collection.createIndex({ 'jurisdiction.country': 1, 'jurisdiction.state': 1 });
    await Election.collection.createIndex({ createdAt: -1 });

    // Candidate indexes
    await Candidate.collection.createIndex({ firstName: 1, lastName: 1 });
    await Candidate.collection.createIndex({ party: 1 });
    await Candidate.collection.createIndex({ status: 1 });
    await Candidate.collection.createIndex({ elections: 1 });

    // Vote indexes
    await Vote.collection.createIndex({ electionId: 1, voterId: 1 }, { unique: true });
    await Vote.collection.createIndex({ electionId: 1, candidateId: 1 });
    await Vote.collection.createIndex({ 'sessionInfo.sessionId': 1 });
    await Vote.collection.createIndex({ status: 1 });
    await Vote.collection.createIndex({ votedAt: -1 });

    // AuditLog indexes
    await AuditLog.collection.createIndex({ timestamp: -1 });
    await AuditLog.collection.createIndex({ action: 1 });
    await AuditLog.collection.createIndex({ entityType: 1, entityId: 1 });
    await AuditLog.collection.createIndex({ userId: 1 });
    await AuditLog.collection.createIndex({ 'userInfo.ipAddress': 1 });

    console.log('Database indexes created successfully');
    
  } catch (error) {
    logError(error, { component: 'database', action: 'createIndexes' });
    throw error;
  }
};

const backupDatabase = async (backupPath) => {
  try {
    // This would typically use mongodump or similar tool
    // For now, we'll just log the request
    console.log(`Database backup requested to: ${backupPath}`);
    
    // In a real implementation, you would:
    // 1. Use mongodump to create a backup
    // 2. Compress the backup
    // 3. Store it in a secure location
    // 4. Log the backup operation
    
    return {
      success: true,
      backupPath,
      timestamp: new Date(),
      size: '0MB' // Would be actual size in real implementation
    };
    
  } catch (error) {
    logError(error, { component: 'database', action: 'backup' });
    throw error;
  }
};

const restoreDatabase = async (backupPath) => {
  try {
    // This would typically use mongorestore or similar tool
    console.log(`Database restore requested from: ${backupPath}`);
    
    // In a real implementation, you would:
    // 1. Validate the backup file
    // 2. Use mongorestore to restore the database
    // 3. Verify the restoration
    // 4. Log the restore operation
    
    return {
      success: true,
      restoredFrom: backupPath,
      timestamp: new Date()
    };
    
  } catch (error) {
    logError(error, { component: 'database', action: 'restore' });
    throw error;
  }
};

const cleanupDatabase = async () => {
  try {
    if (!isConnected) {
      throw new Error('Database not connected');
    }

    // Clean up old audit logs (older than 7 years)
    const AuditLog = require('../models/AuditLog');
    const result = await AuditLog.cleanupOldLogs();
    
    console.log(`Cleaned up ${result.modifiedCount} old audit log entries`);
    
    return {
      success: true,
      cleanedEntries: result.modifiedCount,
      timestamp: new Date()
    };
    
  } catch (error) {
    logError(error, { component: 'database', action: 'cleanup' });
    throw error;
  }
};

const validateDatabaseIntegrity = async () => {
  try {
    if (!isConnected) {
      throw new Error('Database not connected');
    }

    const User = require('../models/User');
    const Election = require('../models/Election');
    const Candidate = require('../models/Candidate');
    const Vote = require('../models/Vote');
    const AuditLog = require('../models/AuditLog');

    // Check for orphaned votes
    const orphanedVotes = await Vote.find({
      $or: [
        { electionId: { $exists: false } },
        { candidateId: { $exists: false } },
        { voterId: { $exists: false } }
      ]
    });

    // Check for invalid elections
    const invalidElections = await Election.find({
      $or: [
        { 'votingPeriod.startDate': { $gte: '$votingPeriod.endDate' } },
        { candidates: { $size: 0 } }
      ]
    });

    // Check for users without Firebase UIDs
    const invalidUsers = await User.find({
      $or: [
        { firebaseUid: { $exists: false } },
        { email: { $exists: false } }
      ]
    });

    const integrityReport = {
      timestamp: new Date(),
      orphanedVotes: orphanedVotes.length,
      invalidElections: invalidElections.length,
      invalidUsers: invalidUsers.length,
      issues: []
    };

    if (orphanedVotes.length > 0) {
      integrityReport.issues.push(`${orphanedVotes.length} orphaned votes found`);
    }

    if (invalidElections.length > 0) {
      integrityReport.issues.push(`${invalidElections.length} invalid elections found`);
    }

    if (invalidUsers.length > 0) {
      integrityReport.issues.push(`${invalidUsers.length} invalid users found`);
    }

    integrityReport.isHealthy = integrityReport.issues.length === 0;

    return integrityReport;
    
  } catch (error) {
    logError(error, { component: 'database', action: 'validateIntegrity' });
    throw error;
  }
};

module.exports = {
  connectDatabase,
  disconnectDatabase,
  getConnectionStatus,
  getDatabaseStats,
  createIndexes,
  backupDatabase,
  restoreDatabase,
  cleanupDatabase,
  validateDatabaseIntegrity
};
