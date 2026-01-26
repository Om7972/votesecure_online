const express = require('express');
const router = express.Router();
const { User, Election, Vote, AuditLog } = require('../models');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const { Op } = require('sequelize');

// Get Admin Stats
router.get('/stats', [verifyToken, verifyAdmin], async (req, res) => {
    try {
        const activeElectionsCount = await Election.count({ where: { status: 'active' } });
        const userCount = await User.count({ where: { role: 'voter' } }); // Approx total users

        // Mock system health/uptime for now
        const stats = {
            activeElections: activeElectionsCount,
            activeUsers: userCount, // Simple proxy
            votesPerMinute: Math.floor(Math.random() * 50), // Mock
            systemHealth: '98%'
        };

        res.json({ success: true, stats });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error fetching admin stats.' });
    }
});

// Get Users (List/Search)
router.get('/users', [verifyToken, verifyAdmin], async (req, res) => {
    try {
        const { search } = req.query;
        const whereClause = {};

        if (search) {
            whereClause[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } }
            ];
        }

        const users = await User.findAll({
            where: whereClause,
            attributes: ['id', 'name', 'email', 'role', 'status', 'lastLogin', 'createdAt'],
            limit: 50 // Limit results
        });

        res.json({ success: true, users });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error fetching users.' });
    }
});

// Update User Status (Suspend/Activate)
router.patch('/users/:id/status', [verifyToken, verifyAdmin], async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['active', 'suspended'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status.' });
        }

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        user.status = status;
        await user.save();

        res.json({ success: true, message: `User status updated to ${status}.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error updating user status.' });
    }
});

// Update User Details (Name/Edit)
router.patch('/users/:id', [verifyToken, verifyAdmin], async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        if (name) user.name = name;
        await user.save();

        res.json({ success: true, message: 'User updated successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error updating user.' });
    }
});

module.exports = router;
