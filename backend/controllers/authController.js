/**
 * PyroChain - Authentication Controller
 * Supports both MongoDB mode and In-Memory/Demo mode
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ── Demo users for in-memory mode ───────────────
const DEMO_USERS = [
    {
        _id: 'demo_admin',
        username: 'admin',
        password: '$2a$12$demo_hash_admin',   // placeholder — compared below
        plainPassword: 'admin123',
        name: 'System Admin',
        email: 'admin@pyrochain.io',
        role: 'admin',
        isActive: true,
    },
    {
        _id: 'demo_firedept',
        username: 'firedept',
        password: '$2a$12$demo_hash_firedept',
        plainPassword: 'firedept123',
        name: 'Fire Department Chief',
        email: 'firedept@pyrochain.io',
        role: 'firedept',
        isActive: true,
    },
];

function isMemoryMode() {
    try {
        const { isUsingMemoryStore } = require('../config/db');
        return isUsingMemoryStore();
    } catch {
        return false;
    }
}

function getSignedToken(user) {
    return jwt.sign(
        { userId: user._id, username: user.username, role: user.role },
        process.env.JWT_SECRET || 'pyrochain_secret',
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
}

// ─────────────────────────────────────────────
//  POST /api/auth/login
// ─────────────────────────────────────────────
const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password required.' });
        }

        // ── In-Memory / Demo mode ────────────────
        if (isMemoryMode()) {
            const demoUser = DEMO_USERS.find(u => u.username === username.toLowerCase());
            if (!demoUser || demoUser.plainPassword !== password) {
                return res.status(401).json({ success: false, message: 'Invalid credentials.' });
            }
            const token = getSignedToken(demoUser);
            return res.json({
                success: true, token,
                user: {
                    id: demoUser._id, username: demoUser.username,
                    name: demoUser.name, email: demoUser.email, role: demoUser.role,
                },
            });
        }

        // ── MongoDB mode ─────────────────────────
        const { User } = require('../models/FireAlert');
        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user || !user.isActive) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });
        const token = getSignedToken(user);

        return res.json({
            success: true, token,
            user: {
                id: user._id, username: user.username,
                name: user.name, email: user.email, role: user.role,
            },
        });
    } catch (err) {
        console.error('[Auth] login error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

// ─────────────────────────────────────────────
//  POST /api/auth/register
// ─────────────────────────────────────────────
const register = async (req, res) => {
    try {
        if (isMemoryMode()) {
            return res.status(503).json({
                success: false,
                message: 'Registration unavailable in demo/in-memory mode. Start MongoDB for full functionality.',
            });
        }
        const { username, password, name, email, role } = req.body;
        if (!username || !password || !name || !email) {
            return res.status(400).json({ success: false, message: 'All fields required.' });
        }
        const { User } = require('../models/FireAlert');
        const existing = await User.findOne({ $or: [{ username }, { email }] });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Username or email already exists.' });
        }
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({ username, password: hashedPassword, name, email, role: role || 'viewer' });
        await user.save();
        return res.status(201).json({ success: true, message: 'User registered.', userId: user._id });
    } catch (err) {
        console.error('[Auth] register error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

// ─────────────────────────────────────────────
//  GET /api/auth/me
// ─────────────────────────────────────────────
const getMe = async (req, res) => {
    try {
        if (isMemoryMode()) {
            const demoUser = DEMO_USERS.find(u => u._id === req.user?.userId);
            if (demoUser) return res.json({ success: true, user: demoUser });
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        const { User } = require('../models/FireAlert');
        const user = await User.findById(req.user.userId).select('-password').lean();
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        return res.json({ success: true, user });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

module.exports = { register, login, getMe };
