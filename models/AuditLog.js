const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    action: {
        type: DataTypes.STRING,
        allowNull: false
    },
    details: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    ip_address: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    timestamps: true,
    updatedAt: false, // Logs are immutable
    tableName: 'audit_logs'
});

module.exports = AuditLog;
