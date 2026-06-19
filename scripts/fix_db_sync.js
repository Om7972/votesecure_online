const sequelize = require('../config/database');

async function fixDbSync() {
    try {
        console.log('Connecting...');
        await sequelize.authenticate();
        console.log('Connected.');

        // 1. Cleanup backup tables if any
        try {
            await sequelize.query("DROP TABLE IF EXISTS users_backup;");
            console.log('Dropped users_backup.');
        } catch (e) {
            console.log('No users_backup to drop or error:', e.message);
        }

        // 2. Start Transaction to safely migrate `users` if needed
        const t = await sequelize.transaction();

        try {
            // Get current columns
            const [uCols] = await sequelize.query("PRAGMA table_info(users);", { transaction: t });
            const colNames = uCols.map(c => c.name);
            console.log('Current user columns:', colNames);

            if (!colNames.includes('status')) {
                console.log('Adding status column...');
                await sequelize.query("ALTER TABLE users ADD COLUMN status VARCHAR(255) DEFAULT 'active';", { transaction: t });
            } else {
                console.log('Status column exists.');
            }

            // Check other tables just in case
            const [cCols] = await sequelize.query("PRAGMA table_info(candidates);", { transaction: t });
            if (!cCols.map(c => c.name).includes('position')) {
                console.log('Adding position to candidates...');
                await sequelize.query("ALTER TABLE candidates ADD COLUMN position VARCHAR(255) DEFAULT 'General Member';", { transaction: t });
            }

            const [eCols] = await sequelize.query("PRAGMA table_info(elections);", { transaction: t });
            if (!eCols.map(c => c.name).includes('type')) {
                console.log('Adding type to elections...');
                await sequelize.query("ALTER TABLE elections ADD COLUMN type VARCHAR(255) DEFAULT 'General';", { transaction: t });
            }

            await t.commit();
            console.log('Database fixed successfully.');

        } catch (error) {
            await t.rollback();
            console.error('Migration failed:', error);
        }

    } catch (error) {
        console.error('Connection error:', error);
    } finally {
        await sequelize.close();
    }
}

fixDbSync();
