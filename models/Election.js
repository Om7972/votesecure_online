const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Election = sequelize.define('Election', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    start_time: {
        type: DataTypes.DATE,
        allowNull: false
    },
    end_time: {
        type: DataTypes.DATE,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('upcoming', 'active', 'ended', 'frozen'),
        defaultValue: 'upcoming'
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: false
        // References User model handled in associations
    }
}, {
    timestamps: true,
    tableName: 'elections'
});

module.exports = Election;
