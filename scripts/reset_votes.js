const sequelize = require('../config/database');
const { Vote } = require('../models');

async function fixVoteTable() {
    try {
        console.log('Dropping votes table...');
        await sequelize.query("DROP TABLE IF EXISTS votes;");
        console.log('Votes table dropped.');

        console.log('Re-creating schema...');
        // Since sync() is used in server.js, restarting will handle it, or we can force sync now for this model
        await Vote.sync();
        console.log('Votes table recreated with allowNull: true.');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

fixVoteTable();
