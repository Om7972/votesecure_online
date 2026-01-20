const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Election = require('../models/Election');
const Vote = require('../models/Vote');
const { authorize, hasPermission } = require('../middleware/auth');
const { logAudit, logElectionManagement } = require('../services/logger');
const router = express.Router();

// Validation rules
const createElectionValidation = [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be less than 200 characters'),
  body('description').trim().isLength({ min: 1, max: 2000 }).withMessage('Description is required and must be less than 2000 characters'),
  body('type').isIn(['federal', 'state', 'local', 'municipal', 'school', 'special']).withMessage('Valid election type is required'),
  body('category').isIn(['presidential', 'senate', 'house', 'governor', 'mayor', 'city_council', 'school_board', 'referendum', 'other']).withMessage('Valid election category is required'),
  body('votingPeriod.startDate').isISO8601().withMessage('Valid start date is required'),
  body('votingPeriod.endDate').isISO8601().withMessage('Valid end date is required'),
  body('jurisdiction.country').optional().trim(),
  body('jurisdiction.state').optional().trim(),
  body('jurisdiction.city').optional().trim()
];

const updateElectionValidation = [
  body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Title must be less than 200 characters'),
  body('description').optional().trim().isLength({ min: 1, max: 2000 }).withMessage('Description must be less than 2000 characters'),
  body('status').optional().isIn(['draft', 'published', 'active', 'completed', 'cancelled', 'suspended']).withMessage('Valid status is required')
];

// @route   GET /api/elections
// @desc    Get all elections with filtering and pagination
// @access  Private
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['draft', 'published', 'active', 'completed', 'cancelled', 'suspended']).withMessage('Invalid status'),
  query('type').optional().isIn(['federal', 'state', 'local', 'municipal', 'school', 'special']).withMessage('Invalid type'),
  query('category').optional().isIn(['presidential', 'senate', 'house', 'governor', 'mayor', 'city_council', 'school_board', 'referendum', 'other']).withMessage('Invalid category'),
  query('search').optional().trim().isLength({ max: 100 }).withMessage('Search term too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      page = 1,
      limit = 10,
      status,
      type,
      category,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = { isDeleted: false };

    if (status) query.status = status;
    if (type) query.type = type;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get elections
    const elections = await Election.find(query)
      .populate('candidates', 'firstName lastName party profileImage')
      .populate('workflow.createdBy', 'fullName email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Election.countDocuments(query);

    // Transform elections for response
    const transformedElections = elections.map(election => ({
      id: election._id,
      title: election.title,
      description: election.description,
      type: election.type,
      category: election.category,
      jurisdiction: election.jurisdiction,
      votingPeriod: election.votingPeriod,
      configuration: election.configuration,
      status: election.status,
      candidateCount: election.candidateCount,
      isActive: election.isActive,
      isUpcoming: election.isUpcoming,
      isCompleted: election.isCompleted,
      timeRemaining: election.timeRemaining,
      results: election.results.isPublished ? election.results : null,
      createdBy: election.workflow.createdBy,
      createdAt: election.createdAt,
      updatedAt: election.updatedAt
    }));

    res.json({
      success: true,
      data: {
        elections: transformedElections,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get elections error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch elections',
      code: 'FETCH_ERROR'
    });
  }
});

// @route   GET /api/elections/active
// @desc    Get active elections
// @access  Private
router.get('/active', async (req, res) => {
  try {
    const elections = await Election.findActive();
    
    const transformedElections = elections.map(election => ({
      id: election._id,
      title: election.title,
      description: election.description,
      type: election.type,
      category: election.category,
      votingPeriod: election.votingPeriod,
      timeRemaining: election.timeRemaining,
      candidateCount: election.candidateCount,
      candidates: election.candidates.map(candidate => ({
        id: candidate._id,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        party: candidate.party,
        profileImage: candidate.media?.profileImage
      }))
    }));

    res.json({
      success: true,
      data: { elections: transformedElections }
    });

  } catch (error) {
    console.error('Get active elections error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active elections',
      code: 'FETCH_ERROR'
    });
  }
});

// @route   GET /api/elections/upcoming
// @desc    Get upcoming elections
// @access  Private
router.get('/upcoming', async (req, res) => {
  try {
    const elections = await Election.findUpcoming();
    
    const transformedElections = elections.map(election => ({
      id: election._id,
      title: election.title,
      description: election.description,
      type: election.type,
      category: election.category,
      votingPeriod: election.votingPeriod,
      timeRemaining: election.timeRemaining,
      candidateCount: election.candidateCount,
      candidates: election.candidates.map(candidate => ({
        id: candidate._id,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        party: candidate.party,
        profileImage: candidate.media?.profileImage
      }))
    }));

    res.json({
      success: true,
      data: { elections: transformedElections }
    });

  } catch (error) {
    console.error('Get upcoming elections error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming elections',
      code: 'FETCH_ERROR'
    });
  }
});

// @route   GET /api/elections/completed
// @desc    Get completed elections
// @access  Private
router.get('/completed', async (req, res) => {
  try {
    const elections = await Election.findCompleted();
    
    const transformedElections = elections.map(election => ({
      id: election._id,
      title: election.title,
      description: election.description,
      type: election.type,
      category: election.category,
      votingPeriod: election.votingPeriod,
      candidateCount: election.candidateCount,
      results: election.results.isPublished ? election.results : null,
      candidates: election.candidates.map(candidate => ({
        id: candidate._id,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        party: candidate.party,
        profileImage: candidate.media?.profileImage,
        votes: election.results.candidateResults.find(r => 
          r.candidateId.toString() === candidate._id.toString()
        )?.votes || 0,
        percentage: election.results.candidateResults.find(r => 
          r.candidateId.toString() === candidate._id.toString()
        )?.percentage || 0,
        isWinner: election.results.candidateResults.find(r => 
          r.candidateId.toString() === candidate._id.toString()
        )?.isWinner || false
      }))
    }));

    res.json({
      success: true,
      data: { elections: transformedElections }
    });

  } catch (error) {
    console.error('Get completed elections error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch completed elections',
      code: 'FETCH_ERROR'
    });
  }
});

// @route   GET /api/elections/:id
// @desc    Get election by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const election = await Election.findById(req.params.id)
      .populate('candidates')
      .populate('workflow.createdBy', 'fullName email')
      .populate('workflow.approvedBy', 'fullName email');

    if (!election || election.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Election not found',
        code: 'ELECTION_NOT_FOUND'
      });
    }

    // Check if user can vote in this election
    const canVote = req.user ? election.canUserVote(req.user) : false;
    const hasVoted = req.user ? req.user.hasVotedInElection(election._id) : false;

    res.json({
      success: true,
      data: {
        election: {
          id: election._id,
          title: election.title,
          description: election.description,
          type: election.type,
          category: election.category,
          jurisdiction: election.jurisdiction,
          votingPeriod: election.votingPeriod,
          configuration: election.configuration,
          eligibility: election.eligibility,
          status: election.status,
          candidateCount: election.candidateCount,
          isActive: election.isActive,
          isUpcoming: election.isUpcoming,
          isCompleted: election.isCompleted,
          timeRemaining: election.timeRemaining,
          results: election.results.isPublished ? election.results : null,
          candidates: election.candidates,
          canVote,
          hasVoted,
          createdBy: election.workflow.createdBy,
          createdAt: election.createdAt,
          updatedAt: election.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Get election error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch election',
      code: 'FETCH_ERROR'
    });
  }
});

// @route   POST /api/elections
// @desc    Create a new election
// @access  Private (Admin only)
router.post('/', authorize('admin', 'super_admin'), createElectionValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const electionData = {
      ...req.body,
      workflow: {
        createdBy: req.user._id
      },
      createdBy: req.user._id
    };

    const election = new Election(electionData);
    await election.save();

    // Log election creation
    await logElectionManagement('election_create', election._id, req.user._id, {
      title: election.title,
      type: election.type,
      category: election.category
    });

    res.status(201).json({
      success: true,
      message: 'Election created successfully',
      data: {
        election: {
          id: election._id,
          title: election.title,
          status: election.status,
          type: election.type,
          category: election.category,
          votingPeriod: election.votingPeriod
        }
      }
    });

  } catch (error) {
    console.error('Create election error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to create election',
      code: 'CREATE_ERROR'
    });
  }
});

// @route   PUT /api/elections/:id
// @desc    Update an election
// @access  Private (Admin only)
router.put('/:id', authorize('admin', 'super_admin'), updateElectionValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const election = await Election.findById(req.params.id);

    if (!election || election.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Election not found',
        code: 'ELECTION_NOT_FOUND'
      });
    }

    // Prevent updates to active elections (except status changes)
    if (election.status === 'active' && req.body.status !== 'completed' && req.body.status !== 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update active election',
        code: 'ACTIVE_ELECTION_UPDATE'
      });
    }

    // Update election
    Object.assign(election, req.body);
    election.workflow.lastModifiedBy = req.user._id;
    election.updatedBy = req.user._id;
    await election.save();

    // Log election update
    await logElectionManagement('election_update', election._id, req.user._id, {
      updatedFields: Object.keys(req.body)
    });

    res.json({
      success: true,
      message: 'Election updated successfully',
      data: {
        election: {
          id: election._id,
          title: election.title,
          status: election.status,
          type: election.type,
          category: election.category,
          votingPeriod: election.votingPeriod
        }
      }
    });

  } catch (error) {
    console.error('Update election error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to update election',
      code: 'UPDATE_ERROR'
    });
  }
});

// @route   POST /api/elections/:id/publish
// @desc    Publish an election
// @access  Private (Admin only)
router.post('/:id/publish', authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const election = await Election.findById(req.params.id);

    if (!election || election.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Election not found',
        code: 'ELECTION_NOT_FOUND'
      });
    }

    if (election.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft elections can be published',
        code: 'INVALID_STATUS'
      });
    }

    if (election.candidates.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Election must have at least 2 candidates to be published',
        code: 'INSUFFICIENT_CANDIDATES'
      });
    }

    // Publish election
    election.status = 'published';
    election.workflow.publishedBy = req.user._id;
    election.workflow.publishedAt = new Date();
    election.workflow.lastModifiedBy = req.user._id;
    await election.save();

    // Log election publication
    await logElectionManagement('election_publish', election._id, req.user._id, {
      title: election.title
    });

    res.json({
      success: true,
      message: 'Election published successfully',
      data: {
        election: {
          id: election._id,
          title: election.title,
          status: election.status,
          publishedAt: election.workflow.publishedAt
        }
      }
    });

  } catch (error) {
    console.error('Publish election error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to publish election',
      code: 'PUBLISH_ERROR'
    });
  }
});

// @route   POST /api/elections/:id/start
// @desc    Start an election
// @access  Private (Admin only)
router.post('/:id/start', authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const election = await Election.findById(req.params.id);

    if (!election || election.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Election not found',
        code: 'ELECTION_NOT_FOUND'
      });
    }

    await election.startElection();

    // Log election start
    await logElectionManagement('election_start', election._id, req.user._id, {
      title: election.title,
      startDate: election.votingPeriod.startDate
    });

    res.json({
      success: true,
      message: 'Election started successfully',
      data: {
        election: {
          id: election._id,
          title: election.title,
          status: election.status,
          isActive: election.isActive
        }
      }
    });

  } catch (error) {
    console.error('Start election error:', error);
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start election',
      code: 'START_ERROR'
    });
  }
});

// @route   POST /api/elections/:id/end
// @desc    End an election
// @access  Private (Admin only)
router.post('/:id/end', authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const election = await Election.findById(req.params.id);

    if (!election || election.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Election not found',
        code: 'ELECTION_NOT_FOUND'
      });
    }

    await election.endElection();

    // Log election end
    await logElectionManagement('election_end', election._id, req.user._id, {
      title: election.title,
      endDate: election.votingPeriod.endDate,
      totalVotes: election.results.totalVotesCast
    });

    res.json({
      success: true,
      message: 'Election ended successfully',
      data: {
        election: {
          id: election._id,
          title: election.title,
          status: election.status,
          isCompleted: election.isCompleted,
          results: election.results
        }
      }
    });

  } catch (error) {
    console.error('End election error:', error);
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to end election',
      code: 'END_ERROR'
    });
  }
});

// @route   POST /api/elections/:id/publish-results
// @desc    Publish election results
// @access  Private (Admin only)
router.post('/:id/publish-results', authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const election = await Election.findById(req.params.id);

    if (!election || election.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Election not found',
        code: 'ELECTION_NOT_FOUND'
      });
    }

    await election.publishResults();

    // Log results publication
    await logElectionManagement('results_publish', election._id, req.user._id, {
      title: election.title,
      totalVotes: election.results.totalVotesCast
    });

    res.json({
      success: true,
      message: 'Election results published successfully',
      data: {
        election: {
          id: election._id,
          title: election.title,
          results: election.results
        }
      }
    });

  } catch (error) {
    console.error('Publish results error:', error);
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to publish results',
      code: 'PUBLISH_RESULTS_ERROR'
    });
  }
});

// @route   DELETE /api/elections/:id
// @desc    Delete an election (soft delete)
// @access  Private (Admin only)
router.delete('/:id', authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const election = await Election.findById(req.params.id);

    if (!election || election.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Election not found',
        code: 'ELECTION_NOT_FOUND'
      });
    }

    // Prevent deletion of active elections
    if (election.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete active election',
        code: 'ACTIVE_ELECTION_DELETE'
      });
    }

    // Soft delete
    election.isDeleted = true;
    election.updatedBy = req.user._id;
    await election.save();

    // Log election deletion
    await logElectionManagement('election_delete', election._id, req.user._id, {
      title: election.title,
      status: election.status
    });

    res.json({
      success: true,
      message: 'Election deleted successfully'
    });

  } catch (error) {
    console.error('Delete election error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete election',
      code: 'DELETE_ERROR'
    });
  }
});

// @route   GET /api/elections/:id/stats
// @desc    Get election statistics
// @access  Private (Admin only)
router.get('/:id/stats', authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const electionId = req.params.id;
    
    const [election, voteStats] = await Promise.all([
      Election.findById(electionId),
      Vote.getVotingStats(electionId)
    ]);

    if (!election || election.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Election not found',
        code: 'ELECTION_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        election: {
          id: election._id,
          title: election.title,
          status: election.status,
          candidateCount: election.candidateCount,
          totalVotesCast: election.results.totalVotesCast,
          turnoutPercentage: election.results.turnoutPercentage
        },
        voteStats,
        timeRemaining: election.timeRemaining,
        isActive: election.isActive
      }
    });

  } catch (error) {
    console.error('Get election stats error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch election statistics',
      code: 'FETCH_ERROR'
    });
  }
});

module.exports = router;
