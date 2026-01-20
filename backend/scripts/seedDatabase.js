const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Election = require('../models/Election');
const Candidate = require('../models/Candidate');
const Vote = require('../models/Vote');

// Sample data
const sampleUsers = [
  {
    firebaseUid: 'seed-admin-001',
    email: 'admin@votesecure.com',
    personalInfo: {
      firstName: 'Admin',
      lastName: 'User',
      dateOfBirth: new Date('1985-01-01'),
      phoneNumber: '+1234567890',
      address: {
        street: '123 Admin Street',
        city: 'Admin City',
        state: 'AC',
        zipCode: '12345',
        country: 'US'
      }
    },
    role: 'admin',
    permissions: ['vote', 'create_election', 'edit_election', 'delete_election', 'manage_candidates', 'view_audit_logs', 'manage_users', 'export_data', 'view_results'],
    status: 'active',
    votingInfo: {
      isRegistered: true,
      registrationDate: new Date(),
      totalVotesCast: 0
    },
    securityInfo: {
      emailVerified: true,
      phoneVerified: true
    }
  },
  {
    firebaseUid: 'seed-voter-001',
    email: 'voter1@votesecure.com',
    personalInfo: {
      firstName: 'John',
      lastName: 'Voter',
      dateOfBirth: new Date('1990-05-15'),
      phoneNumber: '+1234567891',
      address: {
        street: '456 Voter Avenue',
        city: 'Voter City',
        state: 'VC',
        zipCode: '54321',
        country: 'US'
      }
    },
    role: 'voter',
    permissions: ['vote'],
    status: 'active',
    votingInfo: {
      isRegistered: true,
      registrationDate: new Date(),
      totalVotesCast: 0
    },
    securityInfo: {
      emailVerified: true,
      phoneVerified: true
    }
  },
  {
    firebaseUid: 'seed-voter-002',
    email: 'voter2@votesecure.com',
    personalInfo: {
      firstName: 'Jane',
      lastName: 'Citizen',
      dateOfBirth: new Date('1988-12-03'),
      phoneNumber: '+1234567892',
      address: {
        street: '789 Citizen Road',
        city: 'Citizen City',
        state: 'CC',
        zipCode: '67890',
        country: 'US'
      }
    },
    role: 'voter',
    permissions: ['vote'],
    status: 'active',
    votingInfo: {
      isRegistered: true,
      registrationDate: new Date(),
      totalVotesCast: 0
    },
    securityInfo: {
      emailVerified: true,
      phoneVerified: true
    }
  }
];

const sampleElections = [
  {
    title: '2024 Presidential Election',
    description: 'Choose the next President and Vice President of the United States. Your vote matters in shaping the future of our democracy.',
    type: 'federal',
    category: 'presidential',
    jurisdiction: {
      country: 'US',
      state: null,
      city: null
    },
    votingPeriod: {
      startDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      timezone: 'America/New_York'
    },
    configuration: {
      allowWriteIn: true,
      maxSelections: 1,
      minSelections: 1,
      requirePhotoId: true,
      allowEarlyVoting: true,
      allowAbsenteeVoting: true,
      votingMethod: 'hybrid'
    },
    eligibility: {
      minAge: 18,
      citizenshipRequired: true,
      residencyRequired: true,
      allowedStates: ['US'],
      allowedCounties: [],
      allowedCities: []
    },
    status: 'published',
    tags: ['federal', 'presidential', '2024'],
    notifications: {
      reminderEnabled: true,
      reminderSchedule: ['24h_before', '2h_before'],
      resultNotificationEnabled: true
    }
  },
  {
    title: 'City Council Election',
    description: 'Local representatives who will address community issues and municipal governance for the next term.',
    type: 'local',
    category: 'city_council',
    jurisdiction: {
      country: 'US',
      state: 'California',
      city: 'San Francisco'
    },
    votingPeriod: {
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday (active)
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      timezone: 'America/Los_Angeles'
    },
    configuration: {
      allowWriteIn: false,
      maxSelections: 3,
      minSelections: 1,
      requirePhotoId: true,
      allowEarlyVoting: true,
      allowAbsenteeVoting: true,
      votingMethod: 'hybrid'
    },
    eligibility: {
      minAge: 18,
      citizenshipRequired: true,
      residencyRequired: true,
      allowedStates: ['California'],
      allowedCounties: ['San Francisco'],
      allowedCities: ['San Francisco']
    },
    status: 'active',
    tags: ['local', 'city_council', 'san-francisco'],
    notifications: {
      reminderEnabled: true,
      reminderSchedule: ['24h_before', '2h_before', '1h_before'],
      resultNotificationEnabled: true
    }
  },
  {
    title: 'School Board Election',
    description: 'Choose representatives who will shape educational policies and oversee school district operations.',
    type: 'school',
    category: 'school_board',
    jurisdiction: {
      country: 'US',
      state: 'California',
      city: 'San Francisco'
    },
    votingPeriod: {
      startDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
      endDate: new Date(Date.now() + 67 * 24 * 60 * 60 * 1000), // 67 days from now
      timezone: 'America/Los_Angeles'
    },
    configuration: {
      allowWriteIn: false,
      maxSelections: 2,
      minSelections: 1,
      requirePhotoId: false,
      allowEarlyVoting: true,
      allowAbsenteeVoting: true,
      votingMethod: 'hybrid'
    },
    eligibility: {
      minAge: 18,
      citizenshipRequired: true,
      residencyRequired: true,
      allowedStates: ['California'],
      allowedCounties: ['San Francisco'],
      allowedCities: ['San Francisco']
    },
    status: 'published',
    tags: ['school', 'school_board', 'education'],
    notifications: {
      reminderEnabled: true,
      reminderSchedule: ['24h_before'],
      resultNotificationEnabled: true
    }
  }
];

const sampleCandidates = [
  // Presidential candidates
  {
    firstName: 'Alice',
    lastName: 'Johnson',
    party: 'Progressive Party',
    partyColor: '#1E40AF',
    contactInfo: {
      email: 'alice@progressiveparty.com',
      website: 'https://alicejohnson.com'
    },
    professionalInfo: {
      occupation: 'Former Governor',
      currentPosition: 'Governor of California',
      yearsOfExperience: 12,
      education: [
        {
          degree: 'Juris Doctor',
          institution: 'Stanford Law School',
          year: 2005,
          fieldOfStudy: 'Constitutional Law'
        }
      ]
    },
    campaignInfo: {
      slogan: 'Building a Better Future Together',
      biography: 'Alice Johnson has dedicated her career to public service, serving as Governor of California for the past 8 years.',
      keyIssues: [
        {
          issue: 'Climate Change',
          position: 'Pro-environment',
          description: 'Comprehensive climate action plan'
        },
        {
          issue: 'Healthcare',
          position: 'Universal Healthcare',
          description: 'Expanding access to quality healthcare'
        }
      ],
      platform: 'Progressive policies focused on environmental protection, social justice, and economic equality.'
    },
    status: 'active',
    verification: {
      isVerified: true,
      verifiedAt: new Date(),
      backgroundCheckCompleted: true
    }
  },
  {
    firstName: 'Robert',
    lastName: 'Smith',
    party: 'Conservative Party',
    partyColor: '#DC2626',
    contactInfo: {
      email: 'robert@conservativeparty.com',
      website: 'https://robertsmith.com'
    },
    professionalInfo: {
      occupation: 'Business Executive',
      currentPosition: 'CEO of TechCorp',
      yearsOfExperience: 20,
      education: [
        {
          degree: 'Master of Business Administration',
          institution: 'Harvard Business School',
          year: 2000,
          fieldOfStudy: 'Business Administration'
        }
      ]
    },
    campaignInfo: {
      slogan: 'Economic Growth and Security',
      biography: 'Robert Smith brings decades of business experience and a focus on economic growth.',
      keyIssues: [
        {
          issue: 'Economy',
          position: 'Pro-business',
          description: 'Lower taxes and reduced regulation'
        },
        {
          issue: 'Security',
          position: 'Strong Defense',
          description: 'Enhanced national security measures'
        }
      ],
      platform: 'Conservative approach focusing on economic growth, national security, and traditional values.'
    },
    status: 'active',
    verification: {
      isVerified: true,
      verifiedAt: new Date(),
      backgroundCheckCompleted: true
    }
  },
  // City Council candidates
  {
    firstName: 'Maria',
    lastName: 'Garcia',
    party: 'Independent',
    partyColor: '#059669',
    contactInfo: {
      email: 'maria@mariagarcia.com',
      website: 'https://mariagarcia.com'
    },
    professionalInfo: {
      occupation: 'Community Organizer',
      currentPosition: 'Executive Director, Community Center',
      yearsOfExperience: 8
    },
    campaignInfo: {
      slogan: 'Community First',
      biography: 'Maria Garcia has been a community advocate for over 8 years.',
      keyIssues: [
        {
          issue: 'Affordable Housing',
          position: 'Pro-housing',
          description: 'More affordable housing options'
        }
      ],
      platform: 'Focus on community needs and local issues.'
    },
    status: 'active',
    verification: {
      isVerified: true,
      verifiedAt: new Date(),
      backgroundCheckCompleted: true
    }
  },
  {
    firstName: 'David',
    lastName: 'Chen',
    party: 'Independent',
    partyColor: '#7C3AED',
    contactInfo: {
      email: 'david@davidchen.com',
      website: 'https://davidchen.com'
    },
    professionalInfo: {
      occupation: 'Small Business Owner',
      currentPosition: 'Owner, Local Restaurant',
      yearsOfExperience: 15
    },
    campaignInfo: {
      slogan: 'Business-Friendly Policies',
      biography: 'David Chen is a successful small business owner with deep community roots.',
      keyIssues: [
        {
          issue: 'Small Business',
          position: 'Pro-business',
          description: 'Support for local businesses'
        }
      ],
      platform: 'Supporting local businesses and economic development.'
    },
    status: 'active',
    verification: {
      isVerified: true,
      verifiedAt: new Date(),
      backgroundCheckCompleted: true
    }
  }
];

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/votesecure');
    console.log('✅ Connected to database');

    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await User.deleteMany({});
    await Election.deleteMany({});
    await Candidate.deleteMany({});
    await Vote.deleteMany({});

    // Seed users
    console.log('👥 Creating users...');
    const users = await User.insertMany(sampleUsers);
    console.log(`✅ Created ${users.length} users`);

    // Seed elections
    console.log('🗳️ Creating elections...');
    const elections = await Election.insertMany(sampleElections.map(election => ({
      ...election,
      workflow: {
        createdBy: users.find(u => u.role === 'admin')._id,
        publishedBy: users.find(u => u.role === 'admin')._id,
        publishedAt: new Date()
      },
      createdBy: users.find(u => u.role === 'admin')._id
    })));
    console.log(`✅ Created ${elections.length} elections`);

    // Seed candidates
    console.log('👤 Creating candidates...');
    const candidates = await Candidate.insertMany(sampleCandidates.map((candidate, index) => ({
      ...candidate,
      elections: index < 2 ? [elections[0]._id] : [elections[1]._id], // First 2 for presidential, others for city council
      createdBy: users.find(u => u.role === 'admin')._id
    })));
    console.log(`✅ Created ${candidates.length} candidates`);

    // Update elections with candidates
    console.log('🔗 Linking candidates to elections...');
    elections[0].candidates = candidates.slice(0, 2).map(c => c._id); // Presidential candidates
    elections[1].candidates = candidates.slice(2, 4).map(c => c._id); // City council candidates
    elections[2].candidates = candidates.slice(2, 4).map(c => c._id); // School board (same as city council)
    
    await Promise.all(elections.map(election => election.save()));
    console.log('✅ Linked candidates to elections');

    // Create some sample votes for the active election
    console.log('🗳️ Creating sample votes...');
    const activeElection = elections[1]; // City Council election
    const activeCandidates = candidates.slice(2, 4);
    
    const sampleVotes = [
      {
        electionId: activeElection._id,
        candidateId: activeCandidates[0]._id,
        voterId: users[1]._id,
        voteData: {
          encryptedVote: 'sample-encrypted-vote-1',
          hash: 'sample-hash-1'
        },
        sessionInfo: {
          sessionId: 'sample-session-1',
          ipAddress: '192.168.1.1',
          votingMethod: 'online'
        },
        validation: {
          isValid: true
        },
        status: 'counted'
      },
      {
        electionId: activeElection._id,
        candidateId: activeCandidates[1]._id,
        voterId: users[2]._id,
        voteData: {
          encryptedVote: 'sample-encrypted-vote-2',
          hash: 'sample-hash-2'
        },
        sessionInfo: {
          sessionId: 'sample-session-2',
          ipAddress: '192.168.1.2',
          votingMethod: 'online'
        },
        validation: {
          isValid: true
        },
        status: 'counted'
      }
    ];

    await Vote.insertMany(sampleVotes);
    console.log(`✅ Created ${sampleVotes.length} sample votes`);

    // Update election results
    console.log('📊 Updating election results...');
    await activeElection.updateResults();
    console.log('✅ Updated election results');

    // Update user voting history
    console.log('📝 Updating user voting history...');
    users[1].votingInfo.totalVotesCast = 1;
    users[1].votingInfo.lastVoteDate = new Date();
    users[1].votingInfo.votingHistory.push({
      electionId: activeElection._id,
      votedAt: new Date(),
      candidateId: activeCandidates[0]._id
    });

    users[2].votingInfo.totalVotesCast = 1;
    users[2].votingInfo.lastVoteDate = new Date();
    users[2].votingInfo.votingHistory.push({
      electionId: activeElection._id,
      votedAt: new Date(),
      candidateId: activeCandidates[1]._id
    });

    await Promise.all([users[1].save(), users[2].save()]);
    console.log('✅ Updated user voting history');

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   👥 Users: ${users.length}`);
    console.log(`   🗳️ Elections: ${elections.length}`);
    console.log(`   👤 Candidates: ${candidates.length}`);
    console.log(`   🗳️ Votes: ${sampleVotes.length}`);
    console.log('\n🔑 Test Accounts:');
    console.log('   Admin: admin@votesecure.com');
    console.log('   Voter 1: voter1@votesecure.com');
    console.log('   Voter 2: voter2@votesecure.com');

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
