const sequelize = require('../config/database');
const User = require('./User');
const Election = require('./Election');
const Candidate = require('./Candidate');
const Vote = require('./Vote');
const AuditLog = require('./AuditLog');
const Session = require('./Session');

// Election Created By User (Admin)
User.hasMany(Election, { foreignKey: 'created_by' });
Election.belongsTo(User, { foreignKey: 'created_by' });

// Candidates belong to Election
Election.hasMany(Candidate, { foreignKey: 'election_id', onDelete: 'CASCADE' });
Candidate.belongsTo(Election, { foreignKey: 'election_id' });

// Vote Associations
User.hasMany(Vote, { foreignKey: 'user_id' });
Vote.belongsTo(User, { foreignKey: 'user_id' });

Election.hasMany(Vote, { foreignKey: 'election_id' });
Vote.belongsTo(Election, { foreignKey: 'election_id' });

Candidate.hasMany(Vote, { foreignKey: 'candidate_id' });
Vote.belongsTo(Candidate, { foreignKey: 'candidate_id' });

// Audit Logs
User.hasMany(AuditLog, { foreignKey: 'user_id' });
AuditLog.belongsTo(User, { foreignKey: 'user_id' });

// Session Associations
User.hasMany(Session, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Session.belongsTo(User, { foreignKey: 'user_id' });

module.exports = { sequelize, User, Election, Candidate, Vote, AuditLog, Session };
