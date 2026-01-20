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
        next();
    });
};

const verifyAdmin = (req, res, next) => {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ success: false, message: 'Requires Admin Role.' });
    }
    next();
};

module.exports = { verifyToken, verifyAdmin };
