const express = require('express');
const router = express.Router();
// Import models from index to ensure associations are loaded
const { User, Election, Candidate, Vote, AuditLog } = require('../models');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const { Op } = require('sequelize');

// Helper to get IO
const getIo = (req) => req.app.get('io');

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
            attributes: ['id', 'name', 'email', 'role', 'status', 'is_verified', 'createdAt'],
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

        // Emit socket event
        const io = getIo(req);
        if (io) io.emit('user_update', { id: user.id, status: user.status });

        res.json({ success: true, message: `User status updated to ${status}.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error updating user status.' });
    }
});

// Update User Role (User/Admin)
router.patch('/users/:id/role', [verifyToken, verifyAdmin], async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!['admin', 'voter'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid role.' });
        }

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        user.role = role;
        await user.save();

        // Emit socket event
        const io = getIo(req);
        if (io) io.emit('user_update', { id: user.id, role: user.role });

        res.json({ success: true, message: `User role updated to ${role}.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error updating user role.' });
    }
});

// Update User Details (Name/Edit) - Simplified
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

        const io = getIo(req);
        if (io) io.emit('user_update', { id: user.id, name: user.name });

        res.json({ success: true, message: 'User updated successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error updating user.' });
    }
});

// ===============================
// ELECTION MANAGEMENT
// ===============================

// Create Election
router.post('/elections', [verifyToken, verifyAdmin], async (req, res) => {
    try {
        const { title, description, start_time, end_time, type } = req.body;

        const newElection = await Election.create({
            title,
            description,
            start_time,
            end_time,
            type: type || 'General',
            status: 'upcoming',
            created_by: req.user.id
        });

        const io = getIo(req);
        if (io) io.emit('election_update', { type: 'create', election: newElection });

        res.status(201).json({ success: true, election: newElection });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error creating election.' });
    }
});

// Update Election (Status/Details)
router.patch('/elections/:id', [verifyToken, verifyAdmin], async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, start_time, end_time, status, type } = req.body;

        const election = await Election.findByPk(id);
        if (!election) {
            return res.status(404).json({ success: false, message: 'Election not found.' });
        }

        if (title) election.title = title;
        if (description) election.description = description;
        if (start_time) election.start_time = start_time;
        if (end_time) election.end_time = end_time;
        if (status) election.status = status;
        if (type) election.type = type;

        await election.save();

        const io = getIo(req);
        if (io) io.emit('election_update', { type: 'update', election });

        res.json({ success: true, election });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error updating election.' });
    }
});

// Delete Election
router.delete('/elections/:id', [verifyToken, verifyAdmin], async (req, res) => {
    try {
        const { id } = req.params;
        const election = await Election.findByPk(id);

        if (!election) {
            return res.status(404).json({ success: false, message: 'Election not found.' });
        }

        await election.destroy();

        const io = getIo(req);
        if (io) io.emit('election_update', { type: 'delete', id });

        res.json({ success: true, message: 'Election deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error deleting election' });
    }
});

// Add Candidate
router.post('/elections/:id/candidates', [verifyToken, verifyAdmin], async (req, res) => {
    try {
        const { id } = req.params;
        const { name, party, position, image_url, manifesto } = req.body;

        const election = await Election.findByPk(id);
        if (!election) {
            return res.status(404).json({ success: false, message: 'Election not found.' });
        }

        const candidate = await Candidate.create({
            election_id: id,
            name,
            party,
            position,
            image_url,
            manifesto
        });

        const io = getIo(req);
        if (io) {
            io.emit('candidate_update', { type: 'create', electionId: id, candidate });
            // Also emit election update to refresh any election lists showing candidate counts
            io.emit('election_update', { type: 'update', id });
        }

        res.status(201).json({ success: true, candidate });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error adding candidate.' });
    }
});

// Update Candidate
router.patch('/elections/:id/candidates/:candidateId', [verifyToken, verifyAdmin], async (req, res) => {
    try {
        const { id, candidateId } = req.params; // id is election_id, irrelevant for lookup but good for check
        const { name, party, position, image_url, manifesto } = req.body;

        const candidate = await Candidate.findByPk(candidateId);
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found.' });
        }

        if (name) candidate.name = name;
        if (party) candidate.party = party;
        if (position) candidate.position = position;
        if (image_url) candidate.image_url = image_url;
        if (manifesto) candidate.manifesto = manifesto;

        await candidate.save();

        const io = getIo(req);
        if (io) io.emit('candidate_update', { type: 'update', electionId: id, candidate });

        res.json({ success: true, candidate });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error updating candidate.' });
    }
});

// Delete Candidate
router.delete('/elections/:id/candidates/:candidateId', [verifyToken, verifyAdmin], async (req, res) => {
    try {
        const { id, candidateId } = req.params;

        const candidate = await Candidate.findByPk(candidateId);
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found.' });
        }

        await candidate.destroy();

        const io = getIo(req);
        if (io) {
            io.emit('candidate_update', { type: 'delete', electionId: id, candidateId });
            io.emit('election_update', { type: 'update', id });
        }

        res.json({ success: true, message: 'Candidate deleted.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error deleting candidate.' });
    }
});

// ===============================
// DATABASE VIEWER (Development Only)
// ===============================

// Get all database tables and their data
router.get('/database', async (req, res) => {
    try {
        const { Session } = require('../models');

        const [users, elections, candidates, votes, auditLogs, sessions] = await Promise.all([
            User.findAll({ attributes: { exclude: ['password_hash'] } }),
            Election.findAll(),
            Candidate.findAll(),
            Vote.findAll(),
            AuditLog.findAll(),
            Session.findAll()
        ]);

        res.json({
            success: true,
            database: {
                users: { count: users.length, data: users },
                elections: { count: elections.length, data: elections },
                candidates: { count: candidates.length, data: candidates },
                votes: { count: votes.length, data: votes },
                audit_logs: { count: auditLogs.length, data: auditLogs },
                sessions: { count: sessions.length, data: sessions }
            },
            summary: {
                totalUsers: users.length,
                totalElections: elections.length,
                totalCandidates: candidates.length,
                totalVotes: votes.length
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error fetching database.' });
    }
});

// Get specific table data
router.get('/database/:table', async (req, res) => {
    try {
        const { table } = req.params;
        const { Session } = require('../models');

        const tables = {
            users: User,
            elections: Election,
            candidates: Candidate,
            votes: Vote,
            audit_logs: AuditLog,
            sessions: Session
        };

        if (!tables[table]) {
            return res.status(404).json({
                success: false,
                message: `Table '${table}' not found. Available: ${Object.keys(tables).join(', ')}`
            });
        }

        const data = await tables[table].findAll(
            table === 'users' ? { attributes: { exclude: ['password_hash'] } } : {}
        );

        res.json({ success: true, table, count: data.length, data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error fetching table data.' });
    }
});

module.exports = router;
