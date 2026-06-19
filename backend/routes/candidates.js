const express = require('express');
const { body, validationResult } = require('express-validator');
const Candidate = require('../models/Candidate');
const { authorize } = require('../middleware/auth');
const { logAudit } = require('../services/logger');
const router = express.Router();

// Validation rules
const candidateValidation = [
  body('firstName').trim().isLength({ min: 1, max: 50 }).withMessage('First name is required (max 50 chars)'),
  body('lastName').trim().isLength({ min: 1, max: 50 }).withMessage('Last name is required (max 50 chars)'),
  body('party').optional().trim().isLength({ max: 100 }).withMessage('Party name is too long'),
  body('partyColor').optional().matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).withMessage('Must be a valid hex color'),
  body('campaignInfo.slogan').optional().trim().isLength({ max: 200 }).withMessage('Slogan must be under 200 chars'),
  body('campaignInfo.biography').optional().trim().isLength({ max: 5000 }).withMessage('Biography must be under 5000 chars')
];

// @route   GET /api/candidates
// @desc    Get all active candidates
// @access  Private
router.get('/', async (req, res) => {
  try {
    const candidates = await Candidate.find({ isDeleted: false, status: 'active' });
    res.json({ success: true, count: candidates.length, data: candidates });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   GET /api/candidates/election/:electionId
// @desc    Get candidates associated with a specific election
// @access  Private
router.get('/election/:electionId', async (req, res) => {
  try {
    const candidates = await Candidate.find({
      elections: req.params.electionId,
      isDeleted: false,
      status: 'active'
    });
    res.json({ success: true, count: candidates.length, data: candidates });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   GET /api/candidates/:id
// @desc    Get candidate details by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const candidate = await Candidate.findOne({ _id: req.params.id, isDeleted: false });
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }
    res.json({ success: true, data: candidate });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   POST /api/candidates
// @desc    Create a candidate (Admin only)
// @access  Private (Admin)
router.post('/', authorize('admin', 'super_admin'), candidateValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const candidateData = {
      ...req.body,
      createdBy: req.user.id,
      status: 'active', // Default to active for simplicity
      verification: {
        isVerified: true,
        verifiedBy: req.user.id,
        verifiedAt: new Date(),
        backgroundCheckCompleted: true
      }
    };

    const candidate = new Candidate(candidateData);
    await candidate.save();

    await logAudit('candidate_create', 'candidate', candidate._id, req.user.id, {
      description: `Created candidate ${candidate.fullName}`
    });

    res.status(201).json({ success: true, message: 'Candidate created successfully', data: candidate });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/candidates/:id
// @desc    Update candidate details (Admin only)
// @access  Private (Admin)
router.put('/:id', authorize('admin', 'super_admin'), candidateValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    let candidate = await Candidate.findOne({ _id: req.params.id, isDeleted: false });
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    // Update field by field
    Object.assign(candidate, req.body);
    candidate.updatedBy = req.user.id;
    await candidate.save();

    await logAudit('candidate_update', 'candidate', candidate._id, req.user.id, {
      description: `Updated candidate ${candidate.fullName}`
    });

    res.json({ success: true, message: 'Candidate updated successfully', data: candidate });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/candidates/:id
// @desc    Soft delete candidate (Admin only)
// @access  Private (Admin)
router.delete('/:id', authorize('admin', 'super_admin'), async (req, res) => {
  try {
    let candidate = await Candidate.findOne({ _id: req.params.id, isDeleted: false });
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    candidate.isDeleted = true;
    candidate.status = 'withdrawn';
    await candidate.save();

    await logAudit('candidate_delete', 'candidate', candidate._id, req.user.id, {
      description: `Deleted candidate ${candidate.fullName}`
    });

    res.json({ success: true, message: 'Candidate deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

module.exports = router;
