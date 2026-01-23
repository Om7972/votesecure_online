const { Sequelize } = require('sequelize');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

let sequelize;
if (process.env.DATABASE_URL) {
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    });
} else {
    const dataDir = path.resolve(__dirname, '../data');
    try { fs.mkdirSync(dataDir, { recursive: true }); } catch (_) {}
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(dataDir, 'dev.sqlite'),
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
    });
}

const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection to PostgreSQL has been established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};

testConnection();

module.exports = sequelize;
