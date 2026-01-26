const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, AuditLog } = require('../models');
const { verifyToken } = require('../middleware/authMiddleware');

// Register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already in use.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Create user
        const user = await User.create({
            name,
            email,
            password_hash,
            phone: req.body.phone,
            role: 'voter' // Default role
        });

        res.status(201).json({ success: true, message: 'User registered successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error during registration.' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        // Generate Token
        const token = jwt.sign(
            { id: user.id, role: user.role },
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
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});

// Change Password
router.post('/change-password', verifyToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
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
        console.error(error);
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
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
