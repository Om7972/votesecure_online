const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  // Basic Information
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
  
  // Candidate Details
  party: {
    type: String,
    trim: true,
    maxlength: 100
  },
  
  partyColor: {
    type: String,
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please enter a valid hex color']
  },
  
  // Contact Information
  contactInfo: {
    email: {
      type: String,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: {
      type: String,
      match: [/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number']
    },
    website: {
      type: String,
      match: [/^https?:\/\/.+/, 'Please enter a valid URL']
    },
    socialMedia: {
      twitter: String,
      facebook: String,
      instagram: String,
      linkedin: String
    }
  },
  
  // Professional Information
  professionalInfo: {
    occupation: String,
    currentPosition: String,
    employer: String,
    yearsOfExperience: Number,
    education: [{
      degree: String,
      institution: String,
      year: Number,
      fieldOfStudy: String
    }],
    previousPositions: [{
      title: String,
      organization: String,
      startDate: Date,
      endDate: Date,
      description: String
    }]
  },
  
  // Political Information
  politicalInfo: {
    politicalExperience: [{
      position: String,
      organization: String,
      startDate: Date,
      endDate: Date,
      description: String
    }],
    endorsements: [{
      organization: String,
      description: String,
      date: Date
    }],
    campaignCommittees: [{
      name: String,
      treasurer: String,
      address: String
    }]
  },
  
  // Campaign Information
  campaignInfo: {
    slogan: {
      type: String,
      maxlength: 200
    },
    biography: {
      type: String,
      maxlength: 5000
    },
    keyIssues: [{
      issue: String,
      position: String,
      description: String
    }],
    platform: {
      type: String,
      maxlength: 10000
    },
    campaignGoals: [String],
    fundraising: {
      targetAmount: Number,
      currentAmount: {
        type: Number,
        default: 0
      },
      lastUpdated: Date
    }
  },
  
  // Media and Assets
  media: {
    profileImage: String,
    campaignImages: [String],
    videos: [{
      title: String,
      url: String,
      description: String,
      type: {
        type: String,
        enum: ['campaign', 'debate', 'interview', 'speech', 'other']
      }
    }],
    documents: [{
      title: String,
      url: String,
      type: {
        type: String,
        enum: ['platform', 'resume', 'financial_disclosure', 'other']
      },
      uploadDate: {
        type: Date,
        default: Date.now
      }
    }]
  },
  
  // Election Association
  elections: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Election'
  }],
  
  // Campaign Status
  status: {
    type: String,
    enum: ['draft', 'active', 'suspended', 'withdrawn', 'elected', 'defeated'],
    default: 'draft'
  },
  
  // Verification and Approval
  verification: {
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedAt: Date,
    verificationNotes: String,
    documentsSubmitted: [String],
    backgroundCheckCompleted: {
      type: Boolean,
      default: false
    }
  },
  
  // Performance Metrics
  metrics: {
    totalVotes: {
      type: Number,
      default: 0
    },
    votePercentage: {
      type: Number,
      default: 0
    },
    isWinner: {
      type: Boolean,
      default: false
    },
    campaignReach: {
      type: Number,
      default: 0
    },
    socialMediaFollowers: {
      type: Number,
      default: 0
    }
  },
  
  // Campaign Team
  campaignTeam: [{
    name: String,
    role: {
      type: String,
      enum: ['manager', 'treasurer', 'volunteer_coordinator', 'communications', 'field_director', 'other']
    },
    email: String,
    phone: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  
  // Legal and Compliance
  compliance: {
    financialDisclosure: {
      submitted: {
        type: Boolean,
        default: false
      },
      dueDate: Date,
      submittedDate: Date,
      url: String
    },
    ethicsAgreement: {
      signed: {
        type: Boolean,
        default: false
      },
      signedDate: Date,
      url: String
    },
    campaignFinanceCompliance: {
      type: Boolean,
      default: false
    }
  },
  
  // Metadata
  tags: [String],
  
  isDeleted: {
    type: Boolean,
    default: false
  },
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
candidateSchema.index({ firstName: 1, lastName: 1 });
candidateSchema.index({ party: 1 });
candidateSchema.index({ status: 1 });
candidateSchema.index({ elections: 1 });
candidateSchema.index({ 'verification.isVerified': 1 });
candidateSchema.index({ createdAt: -1 });

// Virtual fields
candidateSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

candidateSchema.virtual('displayName').get(function() {
  if (this.party) {
    return `${this.firstName} ${this.lastName} (${this.party})`;
  }
  return this.fullName;
});

candidateSchema.virtual('isActive').get(function() {
  return this.status === 'active';
});

candidateSchema.virtual('hasWon').get(function() {
  return this.status === 'elected' || this.metrics.isWinner;
});

candidateSchema.virtual('totalExperience').get(function() {
  if (!this.professionalInfo.previousPositions) return 0;
  
  return this.professionalInfo.previousPositions.reduce((total, position) => {
    const start = new Date(position.startDate);
    const end = new Date(position.endDate || new Date());
    const years = (end - start) / (1000 * 60 * 60 * 24 * 365);
    return total + Math.max(0, years);
  }, 0);
});

// Methods
candidateSchema.methods.addToElection = function(electionId) {
  if (!this.elections.includes(electionId)) {
    this.elections.push(electionId);
    return this.save();
  }
  return Promise.resolve(this);
};

candidateSchema.methods.removeFromElection = function(electionId) {
  this.elections = this.elections.filter(id => id.toString() !== electionId.toString());
  return this.save();
};

candidateSchema.methods.updateVoteCount = async function(electionId) {
  const Vote = mongoose.model('Vote');
  
  const voteCount = await Vote.countDocuments({
    candidateId: this._id,
    electionId: electionId,
    isValid: true
  });
  
  this.metrics.totalVotes = voteCount;
  
  // Calculate percentage (this will be updated when election results are finalized)
  const Election = mongoose.model('Election');
  const election = await Election.findById(electionId);
  
  if (election && election.results.totalVotesCast > 0) {
    this.metrics.votePercentage = (voteCount / election.results.totalVotesCast) * 100;
  }
  
  return this.save();
};

candidateSchema.methods.verifyCandidate = function(verifiedBy, notes = '') {
  this.verification.isVerified = true;
  this.verification.verifiedBy = verifiedBy;
  this.verification.verifiedAt = new Date();
  this.verification.verificationNotes = notes;
  this.status = 'active';
  
  return this.save();
};

candidateSchema.methods.withdrawCandidacy = function() {
  this.status = 'withdrawn';
  return this.save();
};

candidateSchema.methods.addEndorsement = function(organization, description) {
  this.politicalInfo.endorsements.push({
    organization,
    description,
    date: new Date()
  });
  
  return this.save();
};

candidateSchema.methods.addKeyIssue = function(issue, position, description) {
  this.campaignInfo.keyIssues.push({
    issue,
    position,
    description
  });
  
  return this.save();
};

candidateSchema.methods.updateFundraising = function(amount) {
  this.campaignInfo.fundraising.currentAmount = amount;
  this.campaignInfo.fundraising.lastUpdated = new Date();
  
  return this.save();
};

// Static methods
candidateSchema.statics.findByElection = function(electionId) {
  return this.find({ 
    elections: electionId,
    isDeleted: false,
    status: { $in: ['active', 'elected', 'defeated'] }
  });
};

candidateSchema.statics.findActive = function() {
  return this.find({ 
    status: 'active',
    isDeleted: false 
  });
};

candidateSchema.statics.findVerified = function() {
  return this.find({ 
    'verification.isVerified': true,
    isDeleted: false 
  });
};

candidateSchema.statics.findByParty = function(party) {
  return this.find({ 
    party: new RegExp(party, 'i'),
    isDeleted: false 
  });
};

candidateSchema.statics.getCandidateStats = async function() {
  const stats = await this.aggregate([
    {
      $match: {
        isDeleted: false
      }
    },
    {
      $group: {
        _id: null,
        totalCandidates: { $sum: 1 },
        verifiedCandidates: {
          $sum: { $cond: [{ $eq: ['$verification.isVerified', true] }, 1, 0] }
        },
        activeCandidates: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        electedCandidates: {
          $sum: { $cond: [{ $eq: ['$status', 'elected'] }, 1, 0] }
        },
        averageVotes: { $avg: '$metrics.totalVotes' },
        totalVotes: { $sum: '$metrics.totalVotes' }
      }
    }
  ]);
  
  return stats[0] || {
    totalCandidates: 0,
    verifiedCandidates: 0,
    activeCandidates: 0,
    electedCandidates: 0,
    averageVotes: 0,
    totalVotes: 0
  };
};

candidateSchema.statics.getPartyStats = async function() {
  const stats = await this.aggregate([
    {
      $match: {
        isDeleted: false,
        party: { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: '$party',
        candidateCount: { $sum: 1 },
        totalVotes: { $sum: '$metrics.totalVotes' },
        electedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'elected'] }, 1, 0] }
        }
      }
    },
    {
      $sort: { candidateCount: -1 }
    }
  ]);
  
  return stats;
};

// Validation
candidateSchema.pre('validate', function(next) {
  // Validate professional experience dates
  if (this.professionalInfo.previousPositions) {
    this.professionalInfo.previousPositions.forEach((position, index) => {
      if (position.startDate >= position.endDate) {
        this.invalidate(`professionalInfo.previousPositions.${index}.endDate`, 
          'End date must be after start date');
      }
    });
  }
  
  // Validate political experience dates
  if (this.politicalInfo.politicalExperience) {
    this.politicalInfo.politicalExperience.forEach((experience, index) => {
      if (experience.startDate >= experience.endDate) {
        this.invalidate(`politicalInfo.politicalExperience.${index}.endDate`, 
          'End date must be after start date');
      }
    });
  }
  
  // Validate fundraising amounts
  if (this.campaignInfo.fundraising.currentAmount > this.campaignInfo.fundraising.targetAmount) {
    this.invalidate('campaignInfo.fundraising.currentAmount', 
      'Current amount cannot exceed target amount');
  }
  
  next();
});

// Middleware to update vote counts when candidate is modified
candidateSchema.post('save', async function(doc) {
  // Update vote counts for all associated elections
  if (doc.elections && doc.elections.length > 0) {
    for (const electionId of doc.elections) {
      await doc.updateVoteCount(electionId);
    }
  }
});

module.exports = mongoose.model('Candidate', candidateSchema);
