const express = require('express');
const AuditLog = require('../models/AuditLog');
const { authorize } = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/audit/logs
// @desc    Get all audit logs with query filters (Admin/Auditor only)
// @access  Private (Admin/Auditor)
router.get('/logs', authorize('admin', 'super_admin', 'auditor'), async (req, res) => {
  try {
    const { action, severity, page = 1, limit = 50 } = req.query;
    const filter = {};
    
    if (action) filter.action = action;
    if (severity) filter['details.severity'] = severity;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AuditLog.countDocuments(filter);

    res.json({
      success: true,
      count: logs.length,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      data: logs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   GET /api/audit/logs/:id
// @desc    Get detailed audit log by ID
// @access  Private (Admin/Auditor)
router.get('/logs/:id', authorize('admin', 'super_admin', 'auditor'), async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id);
    if (!log) {
      return res.status(404).json({ success: false, message: 'Audit log not found' });
    }
    res.json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

module.exports = router;
