const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authorize } = require('../middleware/auth');
const { logAudit } = require('../services/logger');
const router = express.Router();

// Validation rules
const updateProfileValidation = [
  body('personalInfo.firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('personalInfo.lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('personalInfo.phoneNumber').optional().trim().isMobilePhone().withMessage('Valid phone number is required'),
  body('personalInfo.address.street').optional().trim(),
  body('personalInfo.address.city').optional().trim(),
  body('personalInfo.address.state').optional().trim(),
  body('personalInfo.address.zipCode').optional().trim()
];

// @route   GET /api/users/profile
// @desc    Get current user profile (alternative endpoint)
// @access  Private
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/users/profile
// @desc    Update current user profile
// @access  Private
router.put('/profile', updateProfileValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Merge personal info
    if (req.body.personalInfo) {
      user.personalInfo = {
        ...user.personalInfo,
        ...req.body.personalInfo,
        address: {
          ...(user.personalInfo?.address || {}),
          ...(req.body.personalInfo.address || {})
        }
      };
    }

    await user.save();

    await logAudit('user_update', 'user', user._id, req.user.id, {
      description: 'User updated profile information'
    });

    res.json({ success: true, message: 'Profile updated successfully', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   GET /api/users
// @desc    Get all users (Admin only)
// @access  Private (Admin)
router.get('/', authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const users = await User.find({ isDeleted: false });
    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID (Admin only)
// @access  Private (Admin)
router.get('/:id', authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/users/:id/role
// @desc    Update user role (Admin only)
// @access  Private (Admin)
router.put('/:id/role', authorize('admin', 'super_admin'), [
  body('role').isIn(['voter', 'admin', 'super_admin', 'auditor']).withMessage('Invalid role')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.role = req.body.role;
    // Set permissions based on role
    if (user.role === 'admin' || user.role === 'super_admin') {
      user.permissions = ['vote', 'manage_users', 'manage_elections', 'manage_candidates', 'view_audit_logs'];
    } else if (user.role === 'auditor') {
      user.permissions = ['vote', 'view_audit_logs'];
    } else {
      user.permissions = ['vote'];
    }

    await user.save();

    await logAudit('user_role_update', 'user', user._id, req.user.id, {
      description: `User role updated to ${user.role}`
    });

    res.json({ success: true, message: 'User role updated successfully', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/users/:id/status
// @desc    Update user status / verify voter (Admin only)
// @access  Private (Admin)
router.put('/:id/status', authorize('admin', 'super_admin'), [
  body('status').isIn(['active', 'pending_verification', 'suspended', 'inactive']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.status = req.body.status;
    if (user.status === 'active') {
      user.votingInfo.isRegistered = true;
    }

    await user.save();

    await logAudit('user_status_update', 'user', user._id, req.user.id, {
      description: `User status updated to ${user.status}`
    });

    res.json({ success: true, message: 'User status updated successfully', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

module.exports = router;
