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

// Submit Vote
router.post('/submit', verifyToken, async (req, res) => {
    try {
        const { electionId, votes, signature, timestamp } = req.body;

        // Validate input
        if (!electionId || !votes || !Array.isArray(votes) || votes.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid vote data'
            });
        }

        // Check if election exists and is active
        const election = await Election.findByPk(electionId);
        if (!election) {
            return res.status(404).json({
                success: false,
                message: 'Election not found'
            });
        }

        if (election.status !== 'active') {
            return res.status(400).json({
                success: false,
                message: 'Election is not active'
            });
        }

        // Check if user already voted in this election
        const existingVote = await Vote.findOne({
            where: {
                user_id: req.userId,
                election_id: electionId
            }
        });

        if (existingVote) {
            return res.status(400).json({
                success: false,
                message: 'You have already voted in this election'
            });
        }

        // Create votes for each candidate
        const voteRecords = [];
        for (const vote of votes) {
            // Check if this is a NOTA vote
            const isNota = vote.candidateId.toString().startsWith('nota-');

            if (!isNota) {
                // Regular vote - verify candidate exists
                const candidate = await Candidate.findByPk(vote.candidateId);

                if (!candidate) {
                    return res.status(404).json({
                        success: false,
                        message: `Candidate ${vote.candidateId} not found`
                    });
                }

                // Generate a unique receipt hash
                const receiptHash = `VOTE-${Date.now()}-${req.userId}-${electionId}-${vote.candidateId}-${Math.random().toString(36).substring(2, 10)}`;

                const voteRecord = await Vote.create({
                    user_id: req.userId,
                    election_id: electionId,
                    candidate_id: vote.candidateId,
                    receipt_hash: receiptHash
                });

                // Update candidate vote count
                await Candidate.increment('vote_count', { where: { id: vote.candidateId } });

                voteRecords.push(voteRecord);
            } else {
                // NOTA vote - store with candidate_id as 0 (or null indicator)
                const receiptHash = `NOTA-${Date.now()}-${req.userId}-${electionId}-${Math.random().toString(36).substring(2, 10)}`;

                const voteRecord = await Vote.create({
                    user_id: req.userId,
                    election_id: electionId,
                    candidate_id: 0, // 0 indicates NOTA vote
                    receipt_hash: receiptHash
                });

                voteRecords.push(voteRecord);
            }
        }

        // Generate receipt
        const receipt = {
            transactionId: `TX-${new Date().getFullYear()}-BC${Math.floor(Math.random() * 1000000)}`,
            verificationCode: `VER-${generateVerificationCode()}`,
            timestamp: new Date().toISOString(),
            electionId: electionId,
            voteCount: voteRecords.length
        };

        res.json({
            success: true,
            message: 'Vote submitted successfully',
            receipt: receipt
        });

    } catch (error) {
        console.error('Error submitting vote:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting vote'
        });
    }
});

// Helper function to generate encryption hash
function generateHash() {
    return 'SHA256-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Helper function to generate verification code
function generateVerificationCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

module.exports = router;

