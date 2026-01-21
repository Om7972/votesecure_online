const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { User, Vote, Election, Candidate, Session, AuditLog } = require('../models');
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
router.put('/profile', verifyToken, upload.single('profile_image'), async (req, res) => {
    try {
        const { name, phone } = req.body;
        const updateData = { name, phone };

        if (req.file) {
            updateData.profile_image = `/uploads/profiles/${req.file.filename}`;
        }

        await User.update(updateData, {
            where: { id: req.userId }
        });

        await AuditLog.create({
            user_id: req.userId,
            action: 'PROFILE_UPDATE',
            details: 'User updated their profile information.',
            ip_address: req.ip
        });

        res.json({ success: true, message: 'Profile updated.', profile_image: updateData.profile_image });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error updating profile.' });
    }
});

// Get Active Sessions
router.get('/sessions', verifyToken, async (req, res) => {
    try {
        const sessions = await Session.findAll({
            where: { user_id: req.userId },
            order: [['last_active', 'DESC']]
        });
        res.json({ success: true, sessions });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error fetching sessions.' });
    }
});

// Revoke Session
router.delete('/sessions/:id', verifyToken, async (req, res) => {
    try {
        const session = await Session.findOne({
            where: { id: req.params.id, user_id: req.userId }
        });

        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found.' });
        }

        await session.destroy();

        await AuditLog.create({
            user_id: req.userId,
            action: 'SESSION_REVOKE',
            details: `Revoked session for device: ${session.device_info || 'Unknown'}`,
            ip_address: req.ip
        });

        res.json({ success: true, message: 'Session revoked.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error revoking session.' });
    }
});

// Get Audit Logs
router.get('/logs', verifyToken, async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const logs = await require('../models').AuditLog.findAll({
            where: { user_id: req.userId },
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit)
        });
        res.json({ success: true, logs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error fetching audit logs.' });
    }
});

module.exports = router;
