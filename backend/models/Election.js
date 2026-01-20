const mongoose = require('mongoose');

const electionSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  
  // Election Type and Category
  type: {
    type: String,
    enum: ['federal', 'state', 'local', 'municipal', 'school', 'special'],
    required: true
  },
  
  category: {
    type: String,
    enum: ['presidential', 'senate', 'house', 'governor', 'mayor', 'city_council', 'school_board', 'referendum', 'other'],
    required: true
  },
  
  // Geographic Scope
  jurisdiction: {
    country: {
      type: String,
      default: 'US'
    },
    state: String,
    county: String,
    city: String,
    district: String,
    precinct: String
  },
  
  // Voting Period
  votingPeriod: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    timezone: {
      type: String,
      default: 'America/New_York'
    }
  },
  
  // Election Configuration
  configuration: {
    allowWriteIn: {
      type: Boolean,
      default: false
    },
    maxSelections: {
      type: Number,
      default: 1
    },
    minSelections: {
      type: Number,
      default: 1
    },
    requirePhotoId: {
      type: Boolean,
      default: true
    },
    allowEarlyVoting: {
      type: Boolean,
      default: true
    },
    allowAbsenteeVoting: {
      type: Boolean,
      default: true
    },
    votingMethod: {
      type: String,
      enum: ['online_only', 'hybrid', 'in_person_only'],
      default: 'hybrid'
    }
  },
  
  // Eligibility Requirements
  eligibility: {
    minAge: {
      type: Number,
      default: 18
    },
    citizenshipRequired: {
      type: Boolean,
      default: true
    },
    residencyRequired: {
      type: Boolean,
      default: true
    },
    registrationDeadline: Date,
    allowedStates: [String],
    allowedCounties: [String],
    allowedCities: [String]
  },
  
  // Candidates
  candidates: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate'
  }],
  
  // Results and Statistics
  results: {
    isPublished: {
      type: Boolean,
      default: false
    },
    publishedAt: Date,
    totalVotesCast: {
      type: Number,
      default: 0
    },
    totalRegisteredVoters: {
      type: Number,
      default: 0
    },
    turnoutPercentage: {
      type: Number,
      default: 0
    },
    candidateResults: [{
      candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Candidate'
      },
      votes: {
        type: Number,
        default: 0
      },
      percentage: {
        type: Number,
        default: 0
      },
      isWinner: {
        type: Boolean,
        default: false
      }
    }],
    writeInVotes: [{
      candidateName: String,
      votes: Number,
      percentage: Number
    }]
  },
  
  // Status and Workflow
  status: {
    type: String,
    enum: ['draft', 'published', 'active', 'completed', 'cancelled', 'suspended'],
    default: 'draft'
  },
  
  workflow: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    publishedAt: Date,
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Security and Audit
  security: {
    encryptionEnabled: {
      type: Boolean,
      default: true
    },
    auditTrail: {
      type: Boolean,
      default: true
    },
    ipTracking: {
      type: Boolean,
      default: true
    },
    deviceFingerprinting: {
      type: Boolean,
      default: true
    },
    maxVotesPerUser: {
      type: Number,
      default: 1
    }
  },
  
  // Notifications and Communications
  notifications: {
    reminderEnabled: {
      type: Boolean,
      default: true
    },
    reminderSchedule: [{
      type: String,
      enum: ['24h_before', '2h_before', '1h_before', '30m_before', '15m_before']
    }],
    resultNotificationEnabled: {
      type: Boolean,
      default: true
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
electionSchema.index({ status: 1 });
electionSchema.index({ type: 1, category: 1 });
electionSchema.index({ 'votingPeriod.startDate': 1, 'votingPeriod.endDate': 1 });
electionSchema.index({ 'jurisdiction.country': 1, 'jurisdiction.state': 1 });
electionSchema.index({ 'results.isPublished': 1 });
electionSchema.index({ createdAt: -1 });
electionSchema.index({ tags: 1 });

// Compound indexes
electionSchema.index({ 
  status: 1, 
  'votingPeriod.startDate': 1, 
  'votingPeriod.endDate': 1 
});

// Virtual fields
electionSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'active' && 
         this.votingPeriod.startDate <= now && 
         this.votingPeriod.endDate >= now;
});

electionSchema.virtual('isUpcoming').get(function() {
  const now = new Date();
  return this.status === 'published' && this.votingPeriod.startDate > now;
});

electionSchema.virtual('isCompleted').get(function() {
  const now = new Date();
  return this.status === 'completed' || this.votingPeriod.endDate < now;
});

electionSchema.virtual('isOpenForVoting').get(function() {
  const now = new Date();
  return this.isActive && 
         this.candidates.length > 0 &&
         this.status === 'active';
});

electionSchema.virtual('timeRemaining').get(function() {
  if (!this.isActive) return null;
  
  const now = new Date();
  const endTime = new Date(this.votingPeriod.endDate);
  const diff = endTime - now;
  
  if (diff <= 0) return null;
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return { days, hours, minutes };
});

electionSchema.virtual('turnoutRate').get(function() {
  if (this.results.totalRegisteredVoters === 0) return 0;
  return (this.results.totalVotesCast / this.results.totalRegisteredVoters) * 100;
});

electionSchema.virtual('candidateCount').get(function() {
  return this.candidates.length;
});

// Methods
electionSchema.methods.addCandidate = function(candidateId) {
  if (!this.candidates.includes(candidateId)) {
    this.candidates.push(candidateId);
    return this.save();
  }
  return Promise.resolve(this);
};

electionSchema.methods.removeCandidate = function(candidateId) {
  this.candidates = this.candidates.filter(id => id.toString() !== candidateId.toString());
  return this.save();
};

electionSchema.methods.updateResults = async function() {
  const Vote = mongoose.model('Vote');
  
  // Get all votes for this election
  const votes = await Vote.find({ 
    electionId: this._id,
    isValid: true 
  });
  
  // Count votes by candidate
  const voteCounts = {};
  votes.forEach(vote => {
    const candidateId = vote.candidateId.toString();
    voteCounts[candidateId] = (voteCounts[candidateId] || 0) + 1;
  });
  
  // Update results
  this.results.totalVotesCast = votes.length;
  this.results.candidateResults = [];
  
  for (const candidateId of this.candidates) {
    const votes = voteCounts[candidateId.toString()] || 0;
    const percentage = this.results.totalVotesCast > 0 ? 
      (votes / this.results.totalVotesCast) * 100 : 0;
    
    this.results.candidateResults.push({
      candidateId,
      votes,
      percentage: Math.round(percentage * 100) / 100,
      isWinner: false // Will be determined later
    });
  }
  
  // Determine winner(s)
  if (this.results.candidateResults.length > 0) {
    const maxVotes = Math.max(...this.results.candidateResults.map(r => r.votes));
    this.results.candidateResults.forEach(result => {
      result.isWinner = result.votes === maxVotes && maxVotes > 0;
    });
  }
  
  // Calculate turnout
  this.results.turnoutPercentage = this.turnoutRate;
  
  return this.save();
};

electionSchema.methods.publishResults = function() {
  if (this.status !== 'completed') {
    throw new Error('Cannot publish results for incomplete election');
  }
  
  this.results.isPublished = true;
  this.results.publishedAt = new Date();
  
  return this.save();
};

electionSchema.methods.startElection = function() {
  if (this.status !== 'published') {
    throw new Error('Only published elections can be started');
  }
  
  if (this.candidates.length === 0) {
    throw new Error('Cannot start election without candidates');
  }
  
  this.status = 'active';
  return this.save();
};

electionSchema.methods.endElection = async function() {
  if (this.status !== 'active') {
    throw new Error('Only active elections can be ended');
  }
  
  this.status = 'completed';
  await this.updateResults();
  return this.save();
};

electionSchema.methods.canUserVote = function(user) {
  // Check if election is active
  if (!this.isActive) return false;
  
  // Check if user is eligible
  if (!user.isEligibleToVote) return false;
  
  // Check age requirement
  if (user.age < this.eligibility.minAge) return false;
  
  // Check citizenship requirement
  if (this.eligibility.citizenshipRequired && !user.votingInfo.isRegistered) return false;
  
  // Check residency requirements
  if (this.eligibility.residencyRequired) {
    // Add residency validation logic here
  }
  
  // Check if user has already voted
  if (user.hasVotedInElection(this._id)) return false;
  
  return true;
};

// Static methods
electionSchema.statics.findActive = function() {
  const now = new Date();
  return this.find({
    status: 'active',
    'votingPeriod.startDate': { $lte: now },
    'votingPeriod.endDate': { $gte: now },
    isDeleted: false
  }).populate('candidates');
};

electionSchema.statics.findUpcoming = function() {
  const now = new Date();
  return this.find({
    status: 'published',
    'votingPeriod.startDate': { $gt: now },
    isDeleted: false
  }).populate('candidates');
};

electionSchema.statics.findCompleted = function() {
  const now = new Date();
  return this.find({
    $or: [
      { status: 'completed' },
      { 'votingPeriod.endDate': { $lt: now } }
    ],
    isDeleted: false
  }).populate('candidates');
};

electionSchema.statics.findByType = function(type) {
  return this.find({ type, isDeleted: false }).populate('candidates');
};

electionSchema.statics.findByJurisdiction = function(country, state, city) {
  const query = { isDeleted: false };
  
  if (country) query['jurisdiction.country'] = country;
  if (state) query['jurisdiction.state'] = state;
  if (city) query['jurisdiction.city'] = city;
  
  return this.find(query).populate('candidates');
};

electionSchema.statics.getElectionStats = async function() {
  const stats = await this.aggregate([
    {
      $match: {
        isDeleted: false
      }
    },
    {
      $group: {
        _id: null,
        totalElections: { $sum: 1 },
        activeElections: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'active'] },
                  { $lte: ['$votingPeriod.startDate', '$$NOW'] },
                  { $gte: ['$votingPeriod.endDate', '$$NOW'] }
                ]
              },
              1,
              0
            ]
          }
        },
        upcomingElections: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'published'] },
                  { $gt: ['$votingPeriod.startDate', '$$NOW'] }
                ]
              },
              1,
              0
            ]
          }
        },
        completedElections: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$status', 'completed'] },
                  { $lt: ['$votingPeriod.endDate', '$$NOW'] }
                ]
              },
              1,
              0
            ]
          }
        },
        totalVotesCast: { $sum: '$results.totalVotesCast' },
        averageTurnout: { $avg: '$results.turnoutPercentage' }
      }
    }
  ]);
  
  return stats[0] || {
    totalElections: 0,
    activeElections: 0,
    upcomingElections: 0,
    completedElections: 0,
    totalVotesCast: 0,
    averageTurnout: 0
  };
};

// Validation
electionSchema.pre('validate', function(next) {
  // Validate voting period
  if (this.votingPeriod.startDate >= this.votingPeriod.endDate) {
    this.invalidate('votingPeriod.endDate', 'End date must be after start date');
  }
  
  // Validate registration deadline
  if (this.eligibility.registrationDeadline && 
      this.eligibility.registrationDeadline >= this.votingPeriod.startDate) {
    this.invalidate('eligibility.registrationDeadline', 
      'Registration deadline must be before voting starts');
  }
  
  // Validate candidate count
  if (this.candidates.length < 2 && this.status === 'active') {
    this.invalidate('candidates', 'Active elections must have at least 2 candidates');
  }
  
  next();
});

module.exports = mongoose.model('Election', electionSchema);
