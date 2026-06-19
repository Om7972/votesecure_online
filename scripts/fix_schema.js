const sequelize = require('../config/database');

async function fixSchema() {
    try {
        console.log('Connecting...');
        await sequelize.authenticate();
        console.log('Connected.');

        // 1. Check Candidates.position
        const [cCols] = await sequelize.query("PRAGMA table_info(candidates);");
        const hasPosition = cCols.some(c => c.name === 'position');
        if (!hasPosition) {
            console.log('Adding position to candidates...');
            await sequelize.query("ALTER TABLE candidates ADD COLUMN position VARCHAR(255) DEFAULT 'General Member';");
            console.log('Added position.');
        } else {
            console.log('Candidates.position exists.');
        }

        // 2. Check Users.status
        const [uCols] = await sequelize.query("PRAGMA table_info(users);");
        const hasStatus = uCols.some(c => c.name === 'status');
        if (!hasStatus) {
            console.log('Adding status to users...');
            await sequelize.query("ALTER TABLE users ADD COLUMN status VARCHAR(255) DEFAULT 'active';");
            console.log('Added status.');
        } else {
            console.log('Users.status exists.');
        }

        // 3. Check Elections.type
        const [eCols] = await sequelize.query("PRAGMA table_info(elections);");
        const hasType = eCols.some(c => c.name === 'type');
        if (!hasType) {
            console.log('Adding type to elections...');
            await sequelize.query("ALTER TABLE elections ADD COLUMN type VARCHAR(255) DEFAULT 'General';");
            console.log('Added type.');
        } else {
            console.log('Elections.type exists.');
        }

        console.log('Schema fix complete.');

    } catch (error) {
        console.error('Error fixing schema:', error);
    } finally {
        await sequelize.close();
    }
}

fixSchema();
