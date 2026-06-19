const { Election, Candidate } = require('../models');
const sequelize = require('../config/database');

async function testFetch() {
    try {
        console.log('Testing connection...');
        await sequelize.authenticate();
        console.log('Connection OK.');

        // Check columns in candidates table
        console.log('Checking candidates schema...');
        const [results] = await sequelize.query("PRAGMA table_info(candidates);");
        console.log('Candidates columns:', results.map(c => c.name));

        // Check columns in elections table
        console.log('Checking elections schema...');
        const [eResults] = await sequelize.query("PRAGMA table_info(elections);");
        console.log('Elections columns:', eResults.map(c => c.name));

        console.log('Fetching Elections...');
        const elections = await Election.findAll({
            include: [{ model: Candidate }]
        });
        console.log('Fetched ' + elections.length + ' elections.');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

testFetch();
