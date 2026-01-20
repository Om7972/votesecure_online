+const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Vote = sequelize.define('Vote', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    election_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    candidate_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    receipt_hash: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    }
}, {
    timestamps: true,
    tableName: 'votes',
    indexes: [
        {
            unique: true,
            fields: ['user_id', 'election_id'] // Prevent duplicate voting
        }
    ]
});

module.exports = Vote;
