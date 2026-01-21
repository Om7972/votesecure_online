const express = require('express');
const router = express.Router();
const { Election, Candidate, Vote, User, AuditLog } = require('../models');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const crypto = require('crypto');

// Get Elections (Active/Upcoming)
router.get('/', verifyToken, async (req, res) => {
    try {
        const { status } = req.query;
        const validStatuses = ['active', 'upcoming', 'ended'];
        const whereClause = {};

        if (status && validStatuses.includes(status)) {
            whereClause.status = status;
        } else {
            whereClause.status = 'active'; // Default
        }

        const elections = await Election.findAll({
            where: whereClause,
            include: [{ model: Candidate }]
        });
        res.json({ success: true, elections });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error fetching elections.' });
    }
});

// Create Election (Admin)
router.post('/', [verifyToken, verifyAdmin], async (req, res) => {
    try {
        const { title, description, start_time, end_time, candidates } = req.body;

        const election = await Election.create({
            title,
            description,
            start_time,
            end_time,
            status: 'active', // For simplicity
            created_by: req.userId
        });

        if (candidates && candidates.length > 0) {
            const candidateData = candidates.map(c => ({
                ...c,
                election_id: election.id
            }));
            await Candidate.bulkCreate(candidateData);
        }

        res.status(201).json({ success: true, election });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error creating election.' });
    }
});

// Get Single Election Details
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const election = await Election.findByPk(req.params.id, {
            include: [{
                model: Candidate,
                attributes: ['id', 'name', 'party', 'manifesto', 'image_url', 'vote_count'] // Include vote_count for display if needed, or remove if secret
            }]
        });

        if (!election) {
            return res.status(404).json({ success: false, message: 'Election not found.' });
        }

        res.json({ success: true, election });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error fetching election details.' });
    }
});

// Vote in an election
router.post('/vote', verifyToken, async (req, res) => {
    try {
        const { election_id, candidate_id } = req.body;
        const userId = req.userId;

        // Check if user already voted
        const existingVote = await Vote.findOne({
            where: { user_id: userId, election_id }
        });
        if (existingVote) {
            return res.status(400).json({ success: false, message: 'You have already voted in this election.' });
        }

        // Check if election is active
        const election = await Election.findByPk(election_id);
        if (!election || election.status !== 'active') { // TODO: Check dates
            return res.status(400).json({ success: false, message: 'Election is not active.' });
        }

        // Create secure receipt hash
        const receiptHash = crypto.createHash('sha256').update(`${userId}-${election_id}-${Date.now()}`).digest('hex');

        // Cast Vote
        await Vote.create({
            user_id: userId,
            election_id,
            candidate_id,
            receipt_hash: receiptHash
        });

        await AuditLog.create({
            user_id: userId,
            action: 'VOTE_CAST',
            details: `Voted in election ID: ${election_id}`,
            ip_address: req.ip
        });

        // Increment candidate vote count
        await Candidate.increment('vote_count', { where: { id: candidate_id } });

        res.json({ success: true, message: 'Vote cast successfully.', receipt_hash: receiptHash });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error casting vote.' });
    }
});

module.exports = router;
