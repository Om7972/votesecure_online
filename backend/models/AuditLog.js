const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // Action Information
  action: {
    type: String,
    required: true,
    enum: [
      // Authentication actions
      'user_login',
      'user_logout',
      'user_register',
      'user_verification',
      'password_reset',
      'two_factor_setup',
      
      // User management actions
      'user_create',
      'user_update',
      'user_delete',
      'user_suspend',
      'user_activate',
      'user_role_change',
      
      // Election actions
      'election_create',
      'election_update',
      'election_delete',
      'election_publish',
      'election_start',
      'election_end',
      'election_cancel',
      
      // Candidate actions
      'candidate_create',
      'candidate_update',
      'candidate_delete',
      'candidate_verify',
      'candidate_endorse',
      
      // Voting actions
      'vote_cast',
      'vote_verify',
      'vote_count',
      'vote_invalidate',
      'vote_challenge',
      'vote_recount',
      
      // Administrative actions
      'admin_access',
      'system_config_change',
      'security_settings_change',
      'backup_create',
      'backup_restore',
      'data_export',
      'data_import',
      
      // Security actions
      'security_breach',
      'suspicious_activity',
      'failed_login_attempt',
      'unauthorized_access',
      'data_breach',
      
      // System actions
      'system_startup',
      'system_shutdown',
      'maintenance_mode',
      'database_migration',
      'cache_clear',
      'log_rotation'
    ]
  },
  
  // Entity Information
  entityType: {
    type: String,
    enum: ['user', 'election', 'candidate', 'vote', 'system', 'admin'],
    required: true
  },
  
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  
  // User Information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  userInfo: {
    email: String,
    role: String,
    ipAddress: String,
    userAgent: String,
    sessionId: String
  },
  
  // Action Details
  details: {
    description: String,
    oldValues: mongoose.Schema.Types.Mixed,
    newValues: mongoose.Schema.Types.Mixed,
    metadata: mongoose.Schema.Types.Mixed,
    affectedFields: [String],
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    }
  },
  
  // Security Information
  security: {
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low'
    },
    requiresReview: {
      type: Boolean,
      default: false
    },
    isSuspicious: {
      type: Boolean,
      default: false
    },
    flaggedBy: {
      type: String,
      enum: ['system', 'admin', 'ai', 'user_report']
    },
    investigationStatus: {
      type: String,
      enum: ['none', 'pending', 'in_progress', 'resolved', 'dismissed'],
      default: 'none'
    }
  },
  
  // Location and Device Information
  location: {
    ipAddress: String,
    country: String,
    state: String,
    city: String,
    latitude: Number,
    longitude: Number,
    timezone: String
  },
  
  device: {
    userAgent: String,
    browser: String,
    os: String,
    deviceType: String,
    screenResolution: String,
    language: String
  },
  
  // Request Information
  request: {
    method: String,
    url: String,
    headers: mongoose.Schema.Types.Mixed,
    body: mongoose.Schema.Types.Mixed,
    query: mongoose.Schema.Types.Mixed,
    params: mongoose.Schema.Types.Mixed
  },
  
  // Response Information
  response: {
    statusCode: Number,
    responseTime: Number,
    errorMessage: String,
    success: Boolean
  },
  
  // Timestamps
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  
  // Audit Trail
  auditTrail: [{
    action: String,
    performedBy: mongoose.Schema.Types.ObjectId,
    timestamp: {
      type: Date,
      default: Date.now
    },
    reason: String,
    details: mongoose.Schema.Types.Mixed
  }],
  
  // Compliance and Legal
  compliance: {
    retentionPeriod: {
      type: Number,
      default: 2555 // 7 years in days
    },
    legalHold: {
      type: Boolean,
      default: false
    },
    gdprRelevant: {
      type: Boolean,
      default: false
    },
    soxRelevant: {
      type: Boolean,
      default: false
    }
  },
  
  // Data Integrity
  integrity: {
    checksum: String,
    signature: String,
    blockchainHash: String,
    verified: {
      type: Boolean,
      default: false
    },
    verificationDate: Date
  },
  
  // Classification
  classification: {
    sensitivity: {
      type: String,
      enum: ['public', 'internal', 'confidential', 'restricted'],
      default: 'internal'
    },
    category: {
      type: String,
      enum: ['administrative', 'operational', 'security', 'compliance', 'system'],
      default: 'operational'
    },
    tags: [String]
  },
  
  // Retention and Archival
  retention: {
    isArchived: {
      type: Boolean,
      default: false
    },
    archivedAt: Date,
    archiveLocation: String,
    scheduledForDeletion: Date,
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ 'userInfo.ipAddress': 1 });
auditLogSchema.index({ 'details.severity': 1 });
auditLogSchema.index({ 'security.riskLevel': 1 });
auditLogSchema.index({ 'security.requiresReview': 1 });
auditLogSchema.index({ 'classification.sensitivity': 1 });

// Compound indexes
auditLogSchema.index({ 
  timestamp: -1, 
  action: 1, 
  entityType: 1 
});

auditLogSchema.index({ 
  userId: 1, 
  timestamp: -1 
});

// Virtual fields
auditLogSchema.virtual('isHighRisk').get(function() {
  return this.security.riskLevel === 'high' || this.security.riskLevel === 'critical';
});

auditLogSchema.virtual('requiresAttention').get(function() {
  return this.security.requiresReview || this.security.isSuspicious || this.isHighRisk;
});

auditLogSchema.virtual('isRecent').get(function() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return this.timestamp > oneHourAgo;
});

auditLogSchema.virtual('ageInDays').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.timestamp);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Methods
auditLogSchema.methods.flagForReview = function(reason, flaggedBy = 'admin') {
  this.security.requiresReview = true;
  this.security.flaggedBy = flaggedBy;
  
  this.auditTrail.push({
    action: 'flag_for_review',
    performedBy: null,
    reason: reason
  });
  
  return this.save();
};

auditLogSchema.methods.markAsSuspicious = function(reason) {
  this.security.isSuspicious = true;
  this.security.requiresReview = true;
  this.security.flaggedBy = 'system';
  
  this.auditTrail.push({
    action: 'mark_suspicious',
    performedBy: null,
    reason: reason
  });
  
  return this.save();
};

auditLogSchema.methods.startInvestigation = function(investigatorId) {
  this.security.investigationStatus = 'in_progress';
  
  this.auditTrail.push({
    action: 'start_investigation',
    performedBy: investigatorId,
    reason: 'Investigation started'
  });
  
  return this.save();
};

auditLogSchema.methods.resolveInvestigation = function(resolution, investigatorId) {
  this.security.investigationStatus = 'resolved';
  this.security.requiresReview = false;
  
  this.auditTrail.push({
    action: 'resolve_investigation',
    performedBy: investigatorId,
    reason: resolution
  });
  
  return this.save();
};

auditLogSchema.methods.archive = function(archiveLocation) {
  this.retention.isArchived = true;
  this.retention.archivedAt = new Date();
  this.retention.archiveLocation = archiveLocation;
  
  this.auditTrail.push({
    action: 'archive',
    performedBy: null,
    reason: 'Log archived for long-term storage'
  });
  
  return this.save();
};

auditLogSchema.methods.scheduleForDeletion = function(daysFromNow = 30) {
  const deletionDate = new Date();
  deletionDate.setDate(deletionDate.getDate() + daysFromNow);
  
  this.retention.scheduledForDeletion = deletionDate;
  
  this.auditTrail.push({
    action: 'schedule_deletion',
    performedBy: null,
    reason: `Scheduled for deletion in ${daysFromNow} days`
  });
  
  return this.save();
};

auditLogSchema.methods.verifyIntegrity = function() {
  // Generate checksum for current log entry
  const data = JSON.stringify({
    action: this.action,
    entityType: this.entityType,
    entityId: this.entityId,
    userId: this.userId,
    timestamp: this.timestamp,
    details: this.details
  });
  
  const crypto = require('crypto');
  const checksum = crypto.createHash('sha256').update(data).digest('hex');
  
  this.integrity.checksum = checksum;
  this.integrity.verified = true;
  this.integrity.verificationDate = new Date();
  
  return this.save();
};

// Static methods
auditLogSchema.statics.logAction = function(actionData) {
  const auditLog = new this(actionData);
  return auditLog.save();
};

auditLogSchema.statics.findByUser = function(userId, limit = 100) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

auditLogSchema.statics.findByAction = function(action, limit = 100) {
  return this.find({ action })
    .sort({ timestamp: -1 })
    .limit(limit);
};

auditLogSchema.statics.findByEntity = function(entityType, entityId, limit = 100) {
  return this.find({ entityType, entityId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

auditLogSchema.statics.findSuspiciousActivity = function(hours = 24, limit = 100) {
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return this.find({
    timestamp: { $gte: cutoffTime },
    $or: [
      { 'security.isSuspicious': true },
      { 'security.requiresReview': true },
      { 'security.riskLevel': { $in: ['high', 'critical'] } }
    ]
  })
  .sort({ timestamp: -1 })
  .limit(limit);
};

auditLogSchema.statics.findByIpAddress = function(ipAddress, limit = 100) {
  return this.find({ 'userInfo.ipAddress': ipAddress })
    .sort({ timestamp: -1 })
    .limit(limit);
};

auditLogSchema.statics.getAuditStats = async function(timeframe = '24h') {
  const timeframes = {
    '1h': 1,
    '24h': 24,
    '7d': 24 * 7,
    '30d': 24 * 30
  };
  
  const hours = timeframes[timeframe] || 24;
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const stats = await this.aggregate([
    {
      $match: {
        timestamp: { $gte: cutoffTime }
      }
    },
    {
      $group: {
        _id: null,
        totalActions: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        suspiciousActions: {
          $sum: { $cond: [{ $eq: ['$security.isSuspicious', true] }, 1, 0] }
        },
        highRiskActions: {
          $sum: { $cond: [{ $eq: ['$security.riskLevel', 'high'] }, 1, 0] }
        },
        criticalActions: {
          $sum: { $cond: [{ $eq: ['$security.riskLevel', 'critical'] }, 1, 0] }
        },
        actionsByType: {
          $push: '$action'
        }
      }
    },
    {
      $project: {
        totalActions: 1,
        uniqueUserCount: { $size: '$uniqueUsers' },
        suspiciousActions: 1,
        highRiskActions: 1,
        criticalActions: 1,
        actionBreakdown: {
          $reduce: {
            input: '$actionsByType',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [
                    [{
                      k: '$$this',
                      v: {
                        $add: [
                          { $ifNull: [{ $getField: { field: '$$this', input: '$$value' } }, 0] },
                          1
                        ]
                      }
                    }]
                  ]
                }
              ]
            }
          }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalActions: 0,
    uniqueUserCount: 0,
    suspiciousActions: 0,
    highRiskActions: 0,
    criticalActions: 0,
    actionBreakdown: {}
  };
};

auditLogSchema.statics.cleanupOldLogs = async function() {
  const sevenYearsAgo = new Date();
  sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);
  
  const result = await this.updateMany(
    {
      timestamp: { $lt: sevenYearsAgo },
      'retention.isDeleted': false
    },
    {
      $set: {
        'retention.isDeleted': true,
        'retention.deletedAt': new Date()
      }
    }
  );
  
  return result;
};

// Pre-save middleware
auditLogSchema.pre('save', function(next) {
  // Generate checksum if not provided
  if (!this.integrity.checksum) {
    this.verifyIntegrity();
  }
  
  // Set default retention period based on sensitivity
  if (!this.compliance.retentionPeriod) {
    const retentionMap = {
      'public': 365, // 1 year
      'internal': 1095, // 3 years
      'confidential': 1825, // 5 years
      'restricted': 2555 // 7 years
    };
    
    this.compliance.retentionPeriod = retentionMap[this.classification.sensitivity] || 2555;
  }
  
  // Schedule for deletion based on retention period
  if (!this.retention.scheduledForDeletion) {
    const deletionDate = new Date(this.timestamp);
    deletionDate.setDate(deletionDate.getDate() + this.compliance.retentionPeriod);
    this.retention.scheduledForDeletion = deletionDate;
  }
  
  next();
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
