const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();
const sequelize = require('./config/database');

// Import Routes
const authRoutes = require('./routes/auth');
const electionRoutes = require('./routes/elections');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const voteRoutes = require('./routes/votes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://cdn.tailwindcss.com", "https://unpkg.com", "https://www.gstatic.com", "https://cdn.socket.io"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com", "https://cdn.tailwindcss.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://unpkg.com", "data:"],
            imgSrc: ["'self'", "data:", "blob:", "https://images.unsplash.com"],
            connectSrc: ["'self'", "https://votesecure6766back.builtwithrocket.new", "https://application.rocket.new", "ws://localhost:5000", "https://unpkg.com"],
            workerSrc: ["'self'", "blob:"],
        },
    },
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Files
app.use(express.static(path.join(__dirname, '/')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/elections', electionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/votes', voteRoutes);

// Sync Database
// Note: In production, use migrations instead of sync({ alter: true })
sequelize.sync({ alter: true }).then(() => {
    console.log('Database synced');
}).catch(err => {
    console.error('Failed to sync database:', err);
});

// Base Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
