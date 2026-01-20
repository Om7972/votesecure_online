const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    password_hash: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.ENUM('admin', 'voter'),
        defaultValue: 'voter'
    },
    is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    profile_image: {
        type: DataTypes.STRING,
        allowNull: true
    },
    two_factor_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    two_factor_secret: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    timestamps: true,
    tableName: 'users'
});

module.exports = User;
