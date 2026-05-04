/**
 * PyroChain - Express Middleware
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');

// ── JWT Authentication Middleware ─────────────
const protect = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : null;

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access denied. Token required.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }
};

// ── Role-based Authorization ────────────────
const requireRole = (...roles) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: `Access forbidden. Required roles: ${roles.join(', ')}`,
        });
    }
    next();
};

module.exports = { protect, requireRole };
