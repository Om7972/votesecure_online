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

const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Allow all origins for simplicity in dev, restrict in prod
        methods: ["GET", "POST"]
    }
});

// Make io accessible in routes
app.set('io', io);

// Socket.IO Connection Handler
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:", "https://cdn.jsdelivr.net", "https://cdn.tailwindcss.com", "https://unpkg.com", "https://www.gstatic.com", "https://cdn.socket.io", "https://cdnjs.cloudflare.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com"],
            styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://unpkg.com", "data:"],
            imgSrc: ["'self'", "data:", "blob:", "https://images.unsplash.com", "https://*"],
            connectSrc: ["'self'", "https://votesecure6766back.builtwithrocket.new", "https://application.rocket.new", "ws://localhost:5000", "wss://localhost:5000", "ws:", "wss:", "https://unpkg.com", "https://*"],
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
sequelize.sync().then(() => {
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

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
