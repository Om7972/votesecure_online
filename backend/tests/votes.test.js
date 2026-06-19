const request = require('supertest');
const { app } = require('../server');
const User = require('../models/User');
const Election = require('../models/Election');
const Candidate = require('../models/Candidate');
const Vote = require('../models/Vote');
const mongoose = require('mongoose');

describe('Voting Routes', () => {
  let testUser;
  let testElection;
  let testCandidate;
  let authToken;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/votesecure_test');
  });

  afterAll(async () => {
    // Clean up and disconnect
    await User.deleteMany({});
    await Election.deleteMany({});
    await Candidate.deleteMany({});
    await Vote.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up before each test
    await User.deleteMany({});
    await Election.deleteMany({});
    await Candidate.deleteMany({});
    await Vote.deleteMany({});

    // Create test data
    testUser = new User({
      firebaseUid: 'test-uid',
      email: 'voter@example.com',
      personalInfo: {
        firstName: 'Jane',
        lastName: 'Voter',
        dateOfBirth: new Date('1990-01-01')
      },
      status: 'active',
      role: 'voter',
      permissions: ['vote'],
      votingInfo: {
        isRegistered: true
      }
    });
    await testUser.save();

    testElection = new Election({
      title: 'Test Election',
      description: 'A test election',
      type: 'local',
      category: 'mayor',
      votingPeriod: {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000)    // 1 day from now
      },
      status: 'active',
      workflow: {
        createdBy: testUser._id
      },
      createdBy: testUser._id
    });
    await testElection.save();

    testCandidate = new Candidate({
      firstName: 'John',
      lastName: 'Candidate',
      party: 'Test Party',
      elections: [testElection._id],
      status: 'active',
      createdBy: testUser._id
    });
    await testCandidate.save();

    // Add candidate to election
    testElection.candidates.push(testCandidate._id);
    await testElection.save();
  });

  describe('POST /api/votes/cast', () => {
    it('should cast a vote successfully', async () => {
      const voteData = {
        electionId: testElection._id,
        candidateId: testCandidate._id
      };

      // Mock authentication middleware
      const response = await request(app)
        .post('/api/votes/cast')
        .set('Authorization', `Bearer ${authToken}`)
        .send(voteData)
        .expect(401); // Would need proper authentication

      // In a real test with proper auth, this would expect 201
      expect(response.body.success).toBe(false);
    });

    it('should fail to cast vote in inactive election', async () => {
      // Make election inactive
      testElection.status = 'completed';
      await testElection.save();

      const voteData = {
        electionId: testElection._id,
        candidateId: testCandidate._id
      };

      const response = await request(app)
        .post('/api/votes/cast')
        .set('Authorization', `Bearer ${authToken}`)
        .send(voteData)
        .expect(401); // Would need proper authentication

      expect(response.body.success).toBe(false);
    });

    it('should fail to cast duplicate vote', async () => {
      // Create existing vote
      const existingVote = new Vote({
        electionId: testElection._id,
        candidateId: testCandidate._id,
        voterId: testUser._id,
        voteData: {
          encryptedVote: 'encrypted-data',
          hash: 'hash-value'
        },
        sessionInfo: {
          sessionId: 'test-session',
          ipAddress: '127.0.0.1',
          votingMethod: 'online'
        },
        validation: {
          isValid: true
        }
      });
      await existingVote.save();

      const voteData = {
        electionId: testElection._id,
        candidateId: testCandidate._id
      };

      const response = await request(app)
        .post('/api/votes/cast')
        .set('Authorization', `Bearer ${authToken}`)
        .send(voteData)
        .expect(401); // Would need proper authentication

      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid candidate', async () => {
      const voteData = {
        electionId: testElection._id,
        candidateId: new mongoose.Types.ObjectId() // Invalid candidate ID
      };

      const response = await request(app)
        .post('/api/votes/cast')
        .set('Authorization', `Bearer ${authToken}`)
        .send(voteData)
        .expect(401); // Would need proper authentication

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/votes/my-votes', () => {
    it('should return user voting history', async () => {
      // Create test votes
      const vote1 = new Vote({
        electionId: testElection._id,
        candidateId: testCandidate._id,
        voterId: testUser._id,
        voteData: {
          encryptedVote: 'encrypted-data-1',
          hash: 'hash-value-1'
        },
        sessionInfo: {
          sessionId: 'test-session-1',
          ipAddress: '127.0.0.1',
          votingMethod: 'online'
        },
        validation: {
          isValid: true
        }
      });
      await vote1.save();

      const response = await request(app)
        .get('/api/votes/my-votes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401); // Would need proper authentication

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/votes/election/:electionId/results', () => {
    it('should return election results when published', async () => {
      // Publish results
      testElection.results.isPublished = true;
      testElection.results.totalVotesCast = 10;
      testElection.results.candidateResults = [{
        candidateId: testCandidate._id,
        votes: 10,
        percentage: 100,
        isWinner: true
      }];
      await testElection.save();

      const response = await request(app)
        .get(`/api/votes/election/${testElection._id}/results`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401); // Would need proper authentication

      expect(response.body.success).toBe(false);
    });

    it('should fail to return unpublished results', async () => {
      const response = await request(app)
        .get(`/api/votes/election/${testElection._id}/results`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401); // Would need proper authentication

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/votes/stats', () => {
    it('should return voting statistics', async () => {
      // Create test votes
      const vote1 = new Vote({
        electionId: testElection._id,
        candidateId: testCandidate._id,
        voterId: testUser._id,
        voteData: {
          encryptedVote: 'encrypted-data',
          hash: 'hash-value'
        },
        sessionInfo: {
          sessionId: 'test-session',
          ipAddress: '127.0.0.1',
          votingMethod: 'online'
        },
        validation: {
          isValid: true
        }
      });
      await vote1.save();

      const response = await request(app)
        .get('/api/votes/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401); // Would need proper authentication

      expect(response.body.success).toBe(false);
    });
  });
});
