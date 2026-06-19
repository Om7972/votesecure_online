const mongoose = require('mongoose');
const crypto = require('crypto');

const voteSchema = new mongoose.Schema({
  // Election and Candidate References
  electionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Election',
    required: true
  },
  
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true
  },
  
  // Voter Information
  voterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Vote Data (Encrypted)
  voteData: {
    encryptedVote: {
      type: String,
      required: true
    },
    encryptionKey: String,
    hash: {
      type: String,
      required: true
    }
  },
  
  // Voting Session Information
  sessionInfo: {
    sessionId: {
      type: String,
      required: true
    },
    ipAddress: {
      type: String,
      required: true
    },
    userAgent: String,
    deviceFingerprint: String,
    votingMethod: {
      type: String,
      enum: ['online', 'mobile', 'kiosk', 'absentee'],
      default: 'online'
    },
    location: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      country: String,
      state: String,
      city: String
    }
  },
  
  // Vote Validation and Security
  validation: {
    isValid: {
      type: Boolean,
      default: true
    },
    validationChecks: [{
      checkType: {
        type: String,
        enum: [
          'duplicate_vote',
          'election_active',
          'voter_eligible',
          'candidate_valid',
          'time_window',
          'ip_validation',
          'device_validation',
          'signature_validation'
        ]
      },
      passed: Boolean,
      details: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    blockchainHash: String,
    merkleProof: String
  },
  
  // Vote Status and Workflow
  status: {
    type: String,
    enum: ['cast', 'verified', 'counted', 'invalidated', 'challenged'],
    default: 'cast'
  },
  
  // Timestamps
  votedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  
  verifiedAt: Date,
  countedAt: Date,
  invalidatedAt: Date,
  
  // Audit Information
  auditTrail: [{
    action: {
      type: String,
      enum: ['cast', 'verify', 'count', 'invalidate', 'challenge', 'recount']
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    reason: String,
    details: mongoose.Schema.Types.Mixed
  }],
  
  // Verification and Challenges
  challenges: [{
    challengerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    evidence: [String],
    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'rejected'],
      default: 'pending'
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: Date,
    resolution: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Recount Information
  recountInfo: {
    hasBeenRecounted: {
      type: Boolean,
      default: false
    },
    recountCount: {
      type: Number,
      default: 0
    },
    lastRecountAt: Date,
    recountResults: [{
      recountedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      recountedAt: Date,
      originalResult: mongoose.Schema.Types.Mixed,
      recountedResult: mongoose.Schema.Types.Mixed,
      discrepancies: [String]
    }]
  },
  
  // Write-in Votes
  writeInInfo: {
    isWriteIn: {
      type: Boolean,
      default: false
    },
    candidateName: String,
    candidateDescription: String
  },
  
  // Anonymization and Privacy
  anonymization: {
    anonymizedAt: Date,
    anonymizationMethod: String,
    originalVoterId: mongoose.Schema.Types.ObjectId,
    anonymizedVoterId: String
  },
  
  // Metadata
  metadata: {
    votingDuration: Number, // Time spent on voting page in seconds
    pageViews: [String], // Pages visited during voting session
    interactions: [{
      element: String,
      action: String,
      timestamp: Date
    }],
    technicalDetails: {
      browser: String,
      os: String,
      screenResolution: String,
      language: String,
      timezone: String
    }
  },
  
  // Flags
  isDeleted: {
    type: Boolean,
    default: false
  },
  
  isAnonymized: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance and uniqueness
voteSchema.index({ electionId: 1, voterId: 1 }, { unique: true });
voteSchema.index({ electionId: 1, candidateId: 1 });
voteSchema.index({ 'sessionInfo.sessionId': 1 });
voteSchema.index({ status: 1 });
voteSchema.index({ votedAt: -1 });
voteSchema.index({ 'validation.isValid': 1 });
voteSchema.index({ 'writeInInfo.isWriteIn': 1 });

// Compound indexes
voteSchema.index({ 
  electionId: 1, 
  status: 1, 
  'validation.isValid': 1 
});

// Virtual fields
voteSchema.virtual('isVerified').get(function() {
  return this.status === 'verified' || this.status === 'counted';
});

voteSchema.virtual('isCounted').get(function() {
  return this.status === 'counted';
});

voteSchema.virtual('isValidVote').get(function() {
  return this.validation.isValid && this.status !== 'invalidated';
});

voteSchema.virtual('hasChallenges').get(function() {
  return this.challenges && this.challenges.length > 0;
});

voteSchema.virtual('activeChallenges').get(function() {
  if (!this.challenges) return [];
  return this.challenges.filter(challenge => 
    challenge.status === 'pending' || challenge.status === 'under_review'
  );
});

// Methods
voteSchema.methods.generateHash = function() {
  const voteString = `${this.electionId}${this.candidateId}${this.voterId}${this.votedAt}`;
  return crypto.createHash('sha256').update(voteString).digest('hex');
};

voteSchema.methods.encryptVote = function(voteData) {
  const algorithm = 'aes-256-gcm';
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key);
  
  let encrypted = cipher.update(JSON.stringify(voteData), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  this.voteData = {
    encryptedVote: encrypted,
    encryptionKey: key.toString('hex'),
    hash: this.generateHash()
  };
  
  return this;
};

voteSchema.methods.decryptVote = function() {
  try {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(this.voteData.encryptionKey, 'hex');
    const decipher = crypto.createDecipher(algorithm, key);
    
    let decrypted = decipher.update(this.voteData.encryptedVote, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    throw new Error('Failed to decrypt vote data');
  }
};

voteSchema.methods.validateVote = async function() {
  const validationChecks = [];
  let isValid = true;
  
  // Check if election is active
  const Election = mongoose.model('Election');
  const election = await Election.findById(this.electionId);
  
  if (!election || !election.isActive) {
    validationChecks.push({
      checkType: 'election_active',
      passed: false,
      details: 'Election is not currently active'
    });
    isValid = false;
  } else {
    validationChecks.push({
      checkType: 'election_active',
      passed: true,
      details: 'Election is active'
    });
  }
  
  // Check if voter is eligible
  const User = mongoose.model('User');
  const voter = await User.findById(this.voterId);
  
  if (!voter || !voter.isEligibleToVote) {
    validationChecks.push({
      checkType: 'voter_eligible',
      passed: false,
      details: 'Voter is not eligible to vote'
    });
    isValid = false;
  } else {
    validationChecks.push({
      checkType: 'voter_eligible',
      passed: true,
      details: 'Voter is eligible'
    });
  }
  
  // Check if candidate is valid for this election
  if (election && !election.candidates.includes(this.candidateId)) {
    validationChecks.push({
      checkType: 'candidate_valid',
      passed: false,
      details: 'Candidate is not valid for this election'
    });
    isValid = false;
  } else {
    validationChecks.push({
      checkType: 'candidate_valid',
      passed: true,
      details: 'Candidate is valid for this election'
    });
  }
  
  // Check for duplicate votes
  const existingVote = await Vote.findOne({
    electionId: this.electionId,
    voterId: this.voterId,
    _id: { $ne: this._id }
  });
  
  if (existingVote) {
    validationChecks.push({
      checkType: 'duplicate_vote',
      passed: false,
      details: 'Voter has already cast a vote in this election'
    });
    isValid = false;
  } else {
    validationChecks.push({
      checkType: 'duplicate_vote',
      passed: true,
      details: 'No duplicate vote found'
    });
  }
  
  // Check time window
  const now = new Date();
  if (this.votedAt < election.votingPeriod.startDate || 
      this.votedAt > election.votingPeriod.endDate) {
    validationChecks.push({
      checkType: 'time_window',
      passed: false,
      details: 'Vote cast outside of voting period'
    });
    isValid = false;
  } else {
    validationChecks.push({
      checkType: 'time_window',
      passed: true,
      details: 'Vote cast within voting period'
    });
  }
  
  // Update validation results
  this.validation.isValid = isValid;
  this.validation.validationChecks = validationChecks;
  
  return isValid;
};

voteSchema.methods.verifyVote = function(verifiedBy) {
  this.status = 'verified';
  this.verifiedAt = new Date();
  
  this.auditTrail.push({
    action: 'verify',
    performedBy: verifiedBy,
    reason: 'Vote verification completed'
  });
  
  return this.save();
};

voteSchema.methods.countVote = function(countedBy) {
  this.status = 'counted';
  this.countedAt = new Date();
  
  this.auditTrail.push({
    action: 'count',
    performedBy: countedBy,
    reason: 'Vote counted in final results'
  });
  
  return this.save();
};

voteSchema.methods.invalidateVote = function(reason, invalidatedBy) {
  this.status = 'invalidated';
  this.invalidatedAt = new Date();
  this.validation.isValid = false;
  
  this.auditTrail.push({
    action: 'invalidate',
    performedBy: invalidatedBy,
    reason: reason
  });
  
  return this.save();
};

voteSchema.methods.challengeVote = function(challengerId, reason, evidence = []) {
  this.challenges.push({
    challengerId,
    reason,
    evidence,
    status: 'pending'
  });
  
  this.auditTrail.push({
    action: 'challenge',
    performedBy: challengerId,
    reason: reason,
    details: { evidence }
  });
  
  return this.save();
};

voteSchema.methods.anonymizeVote = function() {
  if (this.isAnonymized) return this;
  
  this.anonymization = {
    anonymizedAt: new Date(),
    anonymizationMethod: 'hash_replacement',
    originalVoterId: this.voterId,
    anonymizedVoterId: crypto.randomBytes(16).toString('hex')
  };
  
  this.voterId = this.anonymization.anonymizedVoterId;
  this.isAnonymized = true;
  
  return this.save();
};

// Static methods
voteSchema.statics.findByElection = function(electionId, includeInvalid = false) {
  const query = { electionId };
  if (!includeInvalid) {
    query['validation.isValid'] = true;
  }
  
  return this.find(query).populate('candidateId voterId');
};

voteSchema.statics.findByVoter = function(voterId) {
  return this.find({ voterId }).populate('electionId candidateId');
};

voteSchema.statics.findValidVotes = function(electionId) {
  return this.find({
    electionId,
    'validation.isValid': true,
    status: { $in: ['verified', 'counted'] }
  });
};

voteSchema.statics.getVoteCounts = async function(electionId) {
  const voteCounts = await this.aggregate([
    {
      $match: {
        electionId: mongoose.Types.ObjectId(electionId),
        'validation.isValid': true,
        status: { $in: ['verified', 'counted'] }
      }
    },
    {
      $group: {
        _id: '$candidateId',
        voteCount: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'candidates',
        localField: '_id',
        foreignField: '_id',
        as: 'candidate'
      }
    },
    {
      $unwind: '$candidate'
    },
    {
      $project: {
        candidateId: '$_id',
        candidateName: '$candidate.fullName',
        party: '$candidate.party',
        voteCount: 1,
        _id: 0
      }
    },
    {
      $sort: { voteCount: -1 }
    }
  ]);
  
  return voteCounts;
};

voteSchema.statics.getVoterTurnout = async function(electionId) {
  const turnout = await this.aggregate([
    {
      $match: {
        electionId: mongoose.Types.ObjectId(electionId),
        'validation.isValid': true
      }
    },
    {
      $group: {
        _id: null,
        totalVotes: { $sum: 1 },
        uniqueVoters: { $addToSet: '$voterId' }
      }
    },
    {
      $project: {
        totalVotes: 1,
        uniqueVoterCount: { $size: '$uniqueVoters' }
      }
    }
  ]);
  
  return turnout[0] || { totalVotes: 0, uniqueVoterCount: 0 };
};

voteSchema.statics.getVotingStats = async function(electionId) {
  const stats = await this.aggregate([
    {
      $match: {
        electionId: mongoose.Types.ObjectId(electionId)
      }
    },
    {
      $group: {
        _id: null,
        totalVotes: { $sum: 1 },
        validVotes: {
          $sum: { $cond: [{ $eq: ['$validation.isValid', true] }, 1, 0] }
        },
        invalidVotes: {
          $sum: { $cond: [{ $eq: ['$validation.isValid', false] }, 1, 0] }
        },
        writeInVotes: {
          $sum: { $cond: [{ $eq: ['$writeInInfo.isWriteIn', true] }, 1, 0] }
        },
        challengedVotes: {
          $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ['$challenges', []] } }, 0] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalVotes: 0,
    validVotes: 0,
    invalidVotes: 0,
    writeInVotes: 0,
    challengedVotes: 0
  };
};

// Pre-save middleware
voteSchema.pre('save', function(next) {
  // Generate session ID if not provided
  if (!this.sessionInfo.sessionId) {
    this.sessionInfo.sessionId = crypto.randomBytes(32).toString('hex');
  }
  
  // Generate hash if not provided
  if (!this.voteData.hash) {
    this.voteData.hash = this.generateHash();
  }
  
  // Add initial audit entry
  if (this.isNew) {
    this.auditTrail.push({
      action: 'cast',
      performedBy: this.voterId,
      reason: 'Vote cast'
    });
  }
  
  next();
});

// Post-save middleware
voteSchema.post('save', async function(doc) {
  // Update election vote count
  if (doc.validation.isValid && doc.status === 'counted') {
    const Election = mongoose.model('Election');
    await Election.findByIdAndUpdate(doc.electionId, {
      $inc: { 'results.totalVotesCast': 1 }
    });
  }
});

module.exports = mongoose.model('Vote', voteSchema);
