const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { encrypt, decrypt } = require('../utils/encryption');

const userSchema = new mongoose.Schema({
  // Firebase UID
  firebaseUid: {
    type: String,
    required: true,
    unique: true
  },
  
  // Basic Information
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  
  // Personal Information (Encrypted)
  personalInfo: {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    dateOfBirth: {
      type: Date,
      required: true
    },
    phoneNumber: {
      type: String,
      trim: true,
      match: [/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number']
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: {
        type: String,
        default: 'US'
      }
    },
    voterId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    }
  },
  
  // Voting Information
  votingInfo: {
    isRegistered: {
      type: Boolean,
      default: false
    },
    registrationDate: Date,
    lastVoteDate: Date,
    totalVotesCast: {
      type: Number,
      default: 0
    },
    eligibleElections: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Election'
    }],
    votingHistory: [{
      electionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Election'
      },
      votedAt: Date,
      candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Candidate'
      }
    }]
  },
  
  // Security Information
  securityInfo: {
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    twoFactorSecret: String,
    lastLoginAt: Date,
    lastLoginIp: String,
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockedUntil: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    emailVerificationToken: String,
    emailVerified: {
      type: Boolean,
      default: false
    },
    phoneVerified: {
      type: Boolean,
      default: false
    }
  },
  
  // User Roles and Permissions
  role: {
    type: String,
    enum: ['voter', 'admin', 'moderator', 'super_admin'],
    default: 'voter'
  },
  
  permissions: [{
    type: String,
    enum: [
      'vote',
      'create_election',
      'edit_election',
      'delete_election',
      'manage_candidates',
      'view_audit_logs',
      'manage_users',
      'export_data',
      'view_results'
    ]
  }],
  
  // Profile Information
  profile: {
    avatar: String,
    bio: {
      type: String,
      maxlength: 500
    },
    preferences: {
      notifications: {
        email: {
          type: Boolean,
          default: true
        },
        sms: {
          type: Boolean,
          default: false
        },
        push: {
          type: Boolean,
          default: true
        }
      },
      privacy: {
        showVotingHistory: {
          type: Boolean,
          default: false
        },
        showProfile: {
          type: Boolean,
          default: true
        }
      },
      language: {
        type: String,
        default: 'en'
      },
      timezone: {
        type: String,
        default: 'America/New_York'
      }
    }
  },
  
  // Status and Activity
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending_verification'],
    default: 'pending_verification'
  },
  
  isDeleted: {
    type: Boolean,
    default: false
  },
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ 'votingInfo.isRegistered': 1 });
userSchema.index({ createdAt: -1 });

// Virtual fields
userSchema.virtual('fullName').get(function() {
  return `${this.personalInfo.firstName} ${this.personalInfo.lastName}`;
});

userSchema.virtual('isLocked').get(function() {
  return !!(this.securityInfo.lockedUntil && this.securityInfo.lockedUntil > Date.now());
});

userSchema.virtual('age').get(function() {
  if (!this.personalInfo.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.personalInfo.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

userSchema.virtual('isEligibleToVote').get(function() {
  return this.age >= 18 && this.votingInfo.isRegistered && this.status === 'active';
});

// Pre-save middleware to encrypt sensitive data
userSchema.pre('save', function(next) {
  if (this.isModified('personalInfo') && !this.isNew) {
    // Encrypt personal information
    if (this.personalInfo.firstName) {
      this.personalInfo.firstName = encrypt(this.personalInfo.firstName);
    }
    if (this.personalInfo.lastName) {
      this.personalInfo.lastName = encrypt(this.personalInfo.lastName);
    }
    if (this.personalInfo.phoneNumber) {
      this.personalInfo.phoneNumber = encrypt(this.personalInfo.phoneNumber);
    }
    if (this.personalInfo.address) {
      this.personalInfo.address.street = encrypt(this.personalInfo.address.street || '');
      this.personalInfo.address.city = encrypt(this.personalInfo.address.city || '');
      this.personalInfo.address.state = encrypt(this.personalInfo.address.state || '');
      this.personalInfo.address.zipCode = encrypt(this.personalInfo.address.zipCode || '');
    }
    if (this.personalInfo.voterId) {
      this.personalInfo.voterId = encrypt(this.personalInfo.voterId);
    }
  }
  next();
});

// Post-save middleware to decrypt data when retrieving
userSchema.post('findOne', function(doc) {
  if (doc && doc.personalInfo) {
    try {
      doc.personalInfo.firstName = decrypt(doc.personalInfo.firstName);
      doc.personalInfo.lastName = decrypt(doc.personalInfo.lastName);
      if (doc.personalInfo.phoneNumber) {
        doc.personalInfo.phoneNumber = decrypt(doc.personalInfo.phoneNumber);
      }
      if (doc.personalInfo.address) {
        doc.personalInfo.address.street = decrypt(doc.personalInfo.address.street);
        doc.personalInfo.address.city = decrypt(doc.personalInfo.address.city);
        doc.personalInfo.address.state = decrypt(doc.personalInfo.address.state);
        doc.personalInfo.address.zipCode = decrypt(doc.personalInfo.address.zipCode);
      }
      if (doc.personalInfo.voterId) {
        doc.personalInfo.voterId = decrypt(doc.personalInfo.voterId);
      }
    } catch (error) {
      console.error('Decryption error:', error);
    }
  }
});

// Methods
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.securityInfo.lockedUntil && this.securityInfo.lockedUntil < Date.now()) {
    return this.updateOne({
      $unset: { 'securityInfo.lockedUntil': 1 },
      $set: { 'securityInfo.loginAttempts': 1 }
    });
  }
  
  const updates = { $inc: { 'securityInfo.loginAttempts': 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.securityInfo.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { 'securityInfo.lockedUntil': Date.now() + 2 * 60 * 60 * 1000 };
  }
  
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      'securityInfo.loginAttempts': 1,
      'securityInfo.lockedUntil': 1
    }
  });
};

userSchema.methods.generateVoterId = function() {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `VR${timestamp.slice(-6)}${random}`;
};

userSchema.methods.addVote = function(electionId, candidateId) {
  this.votingInfo.votingHistory.push({
    electionId,
    candidateId,
    votedAt: new Date()
  });
  this.votingInfo.totalVotesCast += 1;
  this.votingInfo.lastVoteDate = new Date();
  return this.save();
};

userSchema.methods.hasVotedInElection = function(electionId) {
  return this.votingInfo.votingHistory.some(
    vote => vote.electionId.toString() === electionId.toString()
  );
};

userSchema.methods.canVoteInElection = function(electionId) {
  return this.isEligibleToVote && 
         !this.hasVotedInElection(electionId) &&
         this.votingInfo.eligibleElections.includes(electionId);
};

// Static methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByFirebaseUid = function(firebaseUid) {
  return this.findOne({ firebaseUid });
};

userSchema.statics.findActiveVoters = function() {
  return this.find({
    status: 'active',
    'votingInfo.isRegistered': true,
    isDeleted: false
  });
};

userSchema.statics.getVoterStats = async function() {
  const stats = await this.aggregate([
    {
      $match: {
        isDeleted: false
      }
    },
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        registeredVoters: {
          $sum: { $cond: [{ $eq: ['$votingInfo.isRegistered', true] }, 1, 0] }
        },
        activeUsers: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        totalVotesCast: { $sum: '$votingInfo.totalVotesCast' }
      }
    }
  ]);
  
  return stats[0] || {
    totalUsers: 0,
    registeredVoters: 0,
    activeUsers: 0,
    totalVotesCast: 0
  };
};

// Validation
userSchema.pre('validate', function(next) {
  // Validate age for voting eligibility
  if (this.personalInfo.dateOfBirth) {
    const age = this.age;
    if (age < 18) {
      this.invalidate('personalInfo.dateOfBirth', 'Must be at least 18 years old to register');
    }
  }
  
  // Generate voter ID if not provided
  if (this.votingInfo.isRegistered && !this.personalInfo.voterId) {
    this.personalInfo.voterId = this.generateVoterId();
  }
  
  next();
});

module.exports = mongoose.model('User', userSchema);
