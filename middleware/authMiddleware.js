const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(403).json({ success: false, message: 'No token provided.' });
    }

    // Expect "Bearer <token>"
    const tokenPart = token.split(' ')[1];

    if (!tokenPart) {
        return res.status(403).json({ success: false, message: 'Malformed token.' });
    }

    jwt.verify(tokenPart, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token.' });
        }
        req.userId = decoded.id;
        req.userRole = decoded.role;
        req.userEmail = decoded.email; // Store email from token
        next();
    });
};

const verifyAdmin = (req, res, next) => {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ success: false, message: 'Requires Admin Role.' });
    }
    next();
};

// New middleware: Verify that the user's email matches the designated admin email
const verifyAdminEmail = (req, res, next) => {
    const adminEmail = process.env.ADMIN_EMAIL || 'odhumkear@gmail.com';

    // Check both role and email
    if (req.userRole !== 'admin' || req.userEmail !== adminEmail) {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Only the designated administrator can access this resource.'
        });
    }
    next();
};

module.exports = { verifyToken, verifyAdmin, verifyAdminEmail };
