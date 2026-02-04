const express = require('express');
const router = express.Router();
const { Vote, Election, Candidate } = require('../models');
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

        // Map to flat structure expected by frontend
        res.json({ success: true, votes });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error fetching history.' });
    }
});

module.exports = router;
