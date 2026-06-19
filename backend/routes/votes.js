const express = require('express');
const { body, validationResult } = require('express-validator');
const Vote = require('../models/Vote');
const Election = require('../models/Election');
const Candidate = require('../models/Candidate');
const User = require('../models/User');
const { checkVoteStatus } = require('../middleware/auth');
const { logVoteCast, logVoting } = require('../services/logger');
const { encryptVoteData } = require('../utils/encryption');
const router = express.Router();

// Validation rules
const castVoteValidation = [
  body('electionId').isMongoId().withMessage('Valid election ID is required'),
  body('candidateId').isMongoId().withMessage('Valid candidate ID is required'),
  body('writeInName').optional().trim().isLength({ max: 100 }).withMessage('Write-in name too long'),
  body('writeInDescription').optional().trim().isLength({ max: 500 }).withMessage('Write-in description too long')
];

// @route   POST /api/votes/cast
// @desc    Cast a vote in an election
// @access  Private
router.post('/cast', castVoteValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { electionId, candidateId, writeInName, writeInDescription } = req.body;
    const user = req.user;

    // Get election
    const election = await Election.findById(electionId);
    if (!election || election.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Election not found',
        code: 'ELECTION_NOT_FOUND'
      });
    }

    // Check if election is active
    if (!election.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Election is not currently active',
        code: 'ELECTION_NOT_ACTIVE'
      });
    }

    // Check if user can vote
    if (!election.canUserVote(user)) {
      return res.status(403).json({
        success: false,
        message: 'You are not eligible to vote in this election',
        code: 'NOT_ELIGIBLE'
      });
    }

    // Check if user has already voted
    if (user.hasVotedInElection(electionId)) {
      return res.status(409).json({
        success: false,
        message: 'You have already voted in this election',
        code: 'ALREADY_VOTED'
      });
    }

    // Validate candidate
    if (!writeInName) {
      const candidate = await Candidate.findById(candidateId);
      if (!candidate || !election.candidates.includes(candidateId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid candidate for this election',
          code: 'INVALID_CANDIDATE'
        });
      }
    }

    // Check write-in permissions
    if (writeInName && !election.configuration.allowWriteIn) {
      return res.status(400).json({
        success: false,
        message: 'Write-in votes are not allowed in this election',
        code: 'WRITE_IN_NOT_ALLOWED'
      });
    }

    // Create vote data
    const voteData = {
      electionId,
      candidateId: writeInName ? null : candidateId,
      voterId: user._id,
      writeInName: writeInName || null,
      writeInDescription: writeInDescription || null,
      votedAt: new Date()
    };

    // Encrypt vote data
    const encryptedVoteData = encryptVoteData(voteData);

    // Create vote record
    const vote = new Vote({
      electionId,
      candidateId: writeInName ? null : candidateId,
      voterId: user._id,
      voteData: encryptedVoteData,
      sessionInfo: {
        sessionId: req.sessionID || 'unknown',
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        votingMethod: 'online',
        location: {
          // Location data would be collected from client if available
        }
      },
      writeInInfo: {
        isWriteIn: !!writeInName,
        candidateName: writeInName || null,
        candidateDescription: writeInDescription || null
      }
    });

    // Validate vote
    await vote.validateVote();
    
    if (!vote.validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Vote validation failed',
        code: 'VOTE_VALIDATION_FAILED',
        details: vote.validation.validationChecks
      });
    }

    // Save vote
    await vote.save();

    // Update user's voting history
    await user.addVote(electionId, candidateId);

    // Update election vote count
    await election.updateResults();

    // Log vote casting
    await logVoteCast(electionId, candidateId, user._id, {
      writeIn: !!writeInName,
      candidateName: writeInName || 'Regular candidate',
      electionTitle: election.title
    });

    await logVoting('vote_cast', electionId, user._id, {
      candidateId: writeInName ? null : candidateId,
      writeInName,
      validationChecks: vote.validation.validationChecks.length,
      allChecksPassed: vote.validation.validationChecks.every(check => check.passed)
    });

    res.status(201).json({
      success: true,
      message: 'Vote cast successfully',
      data: {
        vote: {
          id: vote._id,
          electionId,
          candidateId: writeInName ? null : candidateId,
          votedAt: vote.votedAt,
          status: vote.status,
          isValid: vote.validation.isValid,
          writeIn: !!writeInName
        },
        confirmation: {
          electionTitle: election.title,
          candidateName: writeInName || 'Selected candidate',
          votedAt: vote.votedAt.toISOString(),
          voteId: vote._id.toString()
        }
      }
    });

  } catch (error) {
    console.error('Cast vote error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to cast vote',
      code: 'VOTE_ERROR'
    });
  }
});

// @route   GET /api/votes/my-votes
// @desc    Get user's voting history
// @access  Private
router.get('/my-votes', async (req, res) => {
  try {
    const user = req.user;
    const votes = await Vote.findByVoter(user._id);

    const transformedVotes = votes.map(vote => ({
      id: vote._id,
      electionId: vote.electionId,
      candidateId: vote.candidateId,
      votedAt: vote.votedAt,
      status: vote.status,
      isValid: vote.validation.isValid,
      writeIn: vote.writeInInfo.isWriteIn,
      writeInName: vote.writeInInfo.candidateName
    }));

    res.json({
      success: true,
      data: {
        votes: transformedVotes,
        totalVotes: transformedVotes.length
      }
    });

  } catch (error) {
    console.error('Get my votes error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch voting history',
      code: 'FETCH_ERROR'
    });
  }
});

// @route   GET /api/votes/election/:electionId
// @desc    Get votes for a specific election (Admin only)
// @access  Private (Admin)
router.get('/election/:electionId', async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.role.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
        code: 'ADMIN_REQUIRED'
      });
    }

    const { electionId } = req.params;
    const { includeInvalid = false, page = 1, limit = 50 } = req.query;

    // Get votes
    const votes = await Vote.findByElection(electionId, includeInvalid === 'true')
      .populate('candidateId', 'firstName lastName party')
      .populate('voterId', 'email fullName')
      .sort({ votedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Get total count
    const query = { electionId };
    if (!includeInvalid) {
      query['validation.isValid'] = true;
    }
    const total = await Vote.countDocuments(query);

    const transformedVotes = votes.map(vote => ({
      id: vote._id,
      electionId: vote.electionId,
      candidateId: vote.candidateId,
      voterId: vote.voterId,
      votedAt: vote.votedAt,
      status: vote.status,
      isValid: vote.validation.isValid,
      writeIn: vote.writeInInfo.isWriteIn,
      writeInName: vote.writeInInfo.candidateName,
      sessionInfo: {
        ipAddress: vote.sessionInfo.ipAddress,
        votingMethod: vote.sessionInfo.votingMethod
      }
    }));

    res.json({
      success: true,
      data: {
        votes: transformedVotes,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get election votes error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch election votes',
      code: 'FETCH_ERROR'
    });
  }
});

// @route   GET /api/votes/election/:electionId/results
// @desc    Get election results (if published)
// @access  Private
router.get('/election/:electionId/results', async (req, res) => {
  try {
    const { electionId } = req.params;

    const election = await Election.findById(electionId);
    if (!election || election.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Election not found',
        code: 'ELECTION_NOT_FOUND'
      });
    }

    // Check if results are published
    if (!election.results.isPublished) {
      return res.status(403).json({
        success: false,
        message: 'Election results are not yet published',
        code: 'RESULTS_NOT_PUBLISHED'
      });
    }

    // Get vote counts
    const voteCounts = await Vote.getVoteCounts(electionId);
    const turnout = await Vote.getVoterTurnout(electionId);

    res.json({
      success: true,
      data: {
        election: {
          id: election._id,
          title: election.title,
          type: election.type,
          category: election.category,
          votingPeriod: election.votingPeriod,
          results: election.results,
          voteCounts,
          turnout,
          publishedAt: election.results.publishedAt
        }
      }
    });

  } catch (error) {
    console.error('Get election results error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch election results',
      code: 'FETCH_ERROR'
    });
  }
});

// @route   POST /api/votes/:voteId/verify
// @desc    Verify a vote (Admin only)
// @access  Private (Admin)
router.post('/:voteId/verify', async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.role.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
        code: 'ADMIN_REQUIRED'
      });
    }

    const { voteId } = req.params;
    const vote = await Vote.findById(voteId);

    if (!vote) {
      return res.status(404).json({
        success: false,
        message: 'Vote not found',
        code: 'VOTE_NOT_FOUND'
      });
    }

    await vote.verifyVote(req.user._id);

    // Log vote verification
    await logVoting('vote_verify', vote.electionId, req.user._id, {
      voteId: vote._id,
      verifiedBy: req.user._id
    });

    res.json({
      success: true,
      message: 'Vote verified successfully',
      data: {
        vote: {
          id: vote._id,
          status: vote.status,
          verifiedAt: vote.verifiedAt
        }
      }
    });

  } catch (error) {
    console.error('Verify vote error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to verify vote',
      code: 'VERIFY_ERROR'
    });
  }
});

// @route   POST /api/votes/:voteId/invalidate
// @desc    Invalidate a vote (Admin only)
// @access  Private (Admin)
router.post('/:voteId/invalidate', async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.role.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
        code: 'ADMIN_REQUIRED'
      });
    }

    const { voteId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason for invalidation is required',
        code: 'REASON_REQUIRED'
      });
    }

    const vote = await Vote.findById(voteId);

    if (!vote) {
      return res.status(404).json({
        success: false,
        message: 'Vote not found',
        code: 'VOTE_NOT_FOUND'
      });
    }

    await vote.invalidateVote(reason, req.user._id);

    // Log vote invalidation
    await logVoting('vote_invalidate', vote.electionId, req.user._id, {
      voteId: vote._id,
      reason,
      invalidatedBy: req.user._id
    });

    res.json({
      success: true,
      message: 'Vote invalidated successfully',
      data: {
        vote: {
          id: vote._id,
          status: vote.status,
          invalidatedAt: vote.invalidatedAt
        }
      }
    });

  } catch (error) {
    console.error('Invalidate vote error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to invalidate vote',
      code: 'INVALIDATE_ERROR'
    });
  }
});

// @route   POST /api/votes/:voteId/challenge
// @desc    Challenge a vote
// @access  Private
router.post('/:voteId/challenge', async (req, res) => {
  try {
    const { voteId } = req.params;
    const { reason, evidence = [] } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason for challenge is required',
        code: 'REASON_REQUIRED'
      });
    }

    const vote = await Vote.findById(voteId);

    if (!vote) {
      return res.status(404).json({
        success: false,
        message: 'Vote not found',
        code: 'VOTE_NOT_FOUND'
      });
    }

    // Check if user can challenge this vote
    // (This would typically require specific permissions or roles)
    if (req.user.role !== 'admin' && vote.voterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to challenge this vote',
        code: 'UNAUTHORIZED_CHALLENGE'
      });
    }

    await vote.challengeVote(req.user._id, reason, evidence);

    // Log vote challenge
    await logVoting('vote_challenge', vote.electionId, req.user._id, {
      voteId: vote._id,
      reason,
      evidenceCount: evidence.length,
      challenger: req.user._id
    });

    res.json({
      success: true,
      message: 'Vote challenged successfully',
      data: {
        vote: {
          id: vote._id,
          challenges: vote.challenges.length
        }
      }
    });

  } catch (error) {
    console.error('Challenge vote error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to challenge vote',
      code: 'CHALLENGE_ERROR'
    });
  }
});

// @route   GET /api/votes/:voteId/challenges
// @desc    Get challenges for a vote
// @access  Private (Admin)
router.get('/:voteId/challenges', async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.role.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
        code: 'ADMIN_REQUIRED'
      });
    }

    const { voteId } = req.params;
    const vote = await Vote.findById(voteId).populate('challenges.challengerId', 'fullName email');

    if (!vote) {
      return res.status(404).json({
        success: false,
        message: 'Vote not found',
        code: 'VOTE_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        voteId: vote._id,
        challenges: vote.challenges.map(challenge => ({
          id: challenge._id,
          challenger: challenge.challengerId,
          reason: challenge.reason,
          evidence: challenge.evidence,
          status: challenge.status,
          createdAt: challenge.createdAt,
          reviewedBy: challenge.reviewedBy,
          reviewedAt: challenge.reviewedAt,
          resolution: challenge.resolution
        }))
      }
    });

  } catch (error) {
    console.error('Get vote challenges error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vote challenges',
      code: 'FETCH_ERROR'
    });
  }
});

// @route   GET /api/votes/stats
// @desc    Get voting statistics
// @access  Private
router.get('/stats', async (req, res) => {
  try {
    const user = req.user;
    
    // Get user's voting statistics
    const userVotes = await Vote.findByVoter(user._id);
    
    // Get total elections participated in
    const participatedElections = [...new Set(userVotes.map(vote => vote.electionId.toString()))];
    
    // Get vote validation stats
    const validVotes = userVotes.filter(vote => vote.validation.isValid).length;
    const invalidVotes = userVotes.filter(vote => !vote.validation.isValid).length;
    
    res.json({
      success: true,
      data: {
        userStats: {
          totalVotesCast: userVotes.length,
          validVotes,
          invalidVotes,
          electionsParticipated: participatedElections.length,
          lastVoteDate: user.votingInfo.lastVoteDate,
          isEligibleToVote: user.isEligibleToVote
        }
      }
    });

  } catch (error) {
    console.error('Get voting stats error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch voting statistics',
      code: 'FETCH_ERROR'
    });
  }
});

module.exports = router;
