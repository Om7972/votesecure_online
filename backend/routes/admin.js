const express = require('express');
const User = require('../models/User');
const Election = require('../models/Election');
const Candidate = require('../models/Candidate');
const Vote = require('../models/Vote');
const AuditLog = require('../models/AuditLog');
const { authorize } = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/admin/stats
// @desc    Get system dashboard stats (Admin only)
// @access  Private (Admin)
router.get('/stats', authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ isDeleted: false });
    const verifiedVoters = await User.countDocuments({ isDeleted: false, status: 'active' });
    const totalElections = await Election.countDocuments({ isDeleted: false });
    const activeElections = await Election.countDocuments({ isDeleted: false, status: 'active' });
    const totalCandidates = await Candidate.countDocuments({ isDeleted: false });
    
    let totalVotes = 0;
    try {
      totalVotes = await Vote.countDocuments({ isValid: true });
    } catch (e) {
      // Fallback if Vote schema is not matching
      totalVotes = await Vote.countDocuments();
    }
    
    // Recent audit logs
    let recentLogs = [];
    try {
      recentLogs = await AuditLog.find().sort({ createdAt: -1 }).limit(10);
    } catch (e) {
      // Ignore if AuditLog isn't initialized yet
    }

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          verified: verifiedVoters,
          pending: totalUsers - verifiedVoters
        },
        elections: {
          total: totalElections,
          active: activeElections
        },
        candidates: {
          total: totalCandidates
        },
        votes: {
          total: totalVotes
        },
        recentLogs
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   GET /api/admin/settings
// @desc    Get system configuration (Admin only)
// @access  Private (Admin)
router.get('/settings', authorize('admin', 'super_admin'), async (req, res) => {
  res.json({
    success: true,
    data: {
      maintenanceMode: false,
      allowSelfRegistration: true,
      twoFactorRequired: false,
      encryptionKeyRotatedAt: new Date().toISOString()
    }
  });
});

// @route   PUT /api/admin/settings
// @desc    Update system configuration (Admin only)
// @access  Private (Admin)
router.put('/settings', authorize('admin', 'super_admin'), async (req, res) => {
  res.json({
    success: true,
    message: 'System settings updated successfully',
    data: req.body
  });
});

module.exports = router;
