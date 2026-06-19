const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8080', 'http://localhost:5000', 'http://127.0.0.1:5500'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the parent directory (frontend)
app.use(express.static(path.join(__dirname, '..')));

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'VoteSecure Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Sample API endpoints for testing
app.get('/api/elections', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        _id: '1',
        title: 'Student Council Election',
        description: 'Vote for your student council representatives',
        status: 'active',
        votingPeriod: {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        candidates: [
          { _id: '1', name: 'John Doe', party: 'Student Party', votes: 0 },
          { _id: '2', name: 'Jane Smith', party: 'Progressive Students', votes: 0 }
        ],
        totalVotes: 0,
        isBookmarked: false
      }
    ]
  });
});

app.get('/api/users/profile', (req, res) => {
  res.json({
    success: true,
    data: {
      _id: 'user1',
      email: 'test@example.com',
      role: 'voter',
      isVerified: true,
      votedElections: []
    }
  });
});

// MongoDB connection (optional for now)
const connectDB = async () => {
  try {
    if (process.env.MONGO_URI && process.env.MONGO_URI !== 'mongodb://localhost:27017/votesecure_online') {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('✅ MongoDB connected successfully');
    } else {
      console.log('⚠️  MongoDB connection skipped - using mock data');
    }
  } catch (error) {
    console.log('⚠️  MongoDB connection failed - using mock data:', error.message);
  }
};

// Connect to database and start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 VoteSecure Backend running on http://localhost:${PORT}`);
    console.log(`📱 Frontend available at http://localhost:${PORT}`);
    console.log(`🔧 API Health check: http://localhost:${PORT}/api/health`);
  });
});

module.exports = app;
