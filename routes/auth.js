const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { User, AuditLog } = require('../models');
const { verifyToken } = require('../middleware/authMiddleware');

// Rate Limiter for Auth Routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per windowMs
    message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' }
});

// Input Validation Middleware
const validateRegistration = [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/\d/).withMessage('Password must contain a number')
        .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter'),
    body('phone').optional().trim().isMobilePhone().withMessage('Invalid phone number')
];

const validateLogin = [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
    body('password').notEmpty().withMessage('Password is required')
];

// Register
router.post('/register', authLimiter, validateRegistration, async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }

    try {
        const { name, email, password, phone } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Email already in use.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Create user
        const user = await User.create({
            name,
            email,
            password_hash,
            phone: phone || null,
            role: 'voter' // Default role
        });

        // Create Audit Log
        await AuditLog.create({
            user_id: user.id,
            action: 'REGISTER',
            details: 'User registered successfully.',
            ip_address: req.ip
        });

        // Generate Token immediately for seamless UX
        const token = jwt.sign(
            { id: user.id, role: user.role, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully.',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ success: false, message: 'Server error during registration.' });
    }
});

// Login
router.post('/login', authLimiter, validateLogin, async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    try {
        const { email, password } = req.body;

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        // Generate Token
        const token = jwt.sign(
            { id: user.id, role: user.role, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Audit Log
        await AuditLog.create({
            user_id: user.id,
            action: 'LOGIN',
            details: 'User logged in successfully.',
            ip_address: req.ip
        });

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});

// Change Password
router.post('/change-password', verifyToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });
        }

        const user = await User.findByPk(req.userId);

        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Incorrect current password.' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password_hash = await bcrypt.hash(newPassword, salt);
        await user.save();

        await AuditLog.create({
            user_id: req.userId,
            action: 'PASSWORD_CHANGE',
            details: 'User changed their password.',
            ip_address: req.ip
        });

        res.json({ success: true, message: 'Password updated successfully.' });
    } catch (error) {
        console.error('Change Password Error:', error);
        res.status(500).json({ success: false, message: 'Error changing password.' });
    }
});

// Get Current User (Me)
router.get('/me', verifyToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.userId, {
            attributes: { exclude: ['password_hash', 'two_factor_secret'] }
        });

        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        res.json({ success: true, user });
    } catch (error) {
        console.error('Get Me Error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Update Profile
router.put('/update-profile', verifyToken, async (req, res) => {
    try {
        const { name, phone } = req.body;

        const user = await User.findByPk(req.userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        // Update fields
        if (name) user.name = name;
        if (phone !== undefined) user.phone = phone;

        await user.save();

        // Log the update
        await AuditLog.create({
            user_id: req.userId,
            action: 'PROFILE_UPDATE',
            details: 'User updated their profile.',
            ip_address: req.ip
        });

        // Return updated user (excluding sensitive data)
        const updatedUser = await User.findByPk(req.userId, {
            attributes: { exclude: ['password_hash', 'two_factor_secret'] }
        });

        res.json({ success: true, message: 'Profile updated successfully.', user: updatedUser });
    } catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({ success: false, message: 'Error updating profile.' });
    }
});

module.exports = router;

