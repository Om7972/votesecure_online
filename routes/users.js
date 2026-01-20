const express = require('express');
const router = express.Router();
const { User, Vote, Election, Candidate } = require('../models');
const { verifyToken } = require('../middleware/authMiddleware');

// Get Voting History
router.get('/history', verifyToken, async (req, res) => {
    try {
        const votes = await Vote.findAll({
            where: { user_id: req.userId },
            include: [
                { model: Election, attributes: ['title', 'status', 'end_time'] },
                { model: Candidate, attributes: ['name', 'party'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({ success: true, history: votes });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error fetching history.' });
    }
});

// Update Profile
router.put('/profile', verifyToken, async (req, res) => {
    try {
        const { name, phone, address } = req.body; // Mock address for now as it wasn't in simple model
        // In real app, handle file upload for profile_image here

        await User.update({ name, phone }, {
            where: { id: req.userId }
        });

        res.json({ success: true, message: 'Profile updated.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating profile.' });
    }
});

module.exports = router;
