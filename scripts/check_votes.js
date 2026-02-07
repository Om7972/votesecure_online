const sequelize = require('../config/database');

async function checkVoteSchema() {
    try {
        await sequelize.authenticate();
        const [results] = await sequelize.query("PRAGMA table_info(votes);");
        console.log(results);
    } catch (error) {
        console.error(error);
    } finally {
        await sequelize.close();
    }
}

checkVoteSchema();
