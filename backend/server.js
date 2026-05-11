/**
 * ┌─────────────────────────────────────────────────────────────┐
 * │  PyroChain — Smart Fire Safety Alert Logging System         │
 * │  Backend Server (Node.js + Express + MongoDB + Socket.io)   │
 * │  Version: 1.0.0                                             │
 * └─────────────────────────────────────────────────────────────┘
 */

'use strict';
require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const os = require('os');
const { Server } = require('socket.io');
const path = require('path');

const connectDB = require('./config/db');
const blockchain = require('./config/blockchain');
const routes = require('./routes/index');
const { User } = require('./models/FireAlert');
const bcrypt = require('bcryptjs');

// ─────────────────────────────────────────────
//  App Initialization
// ─────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ─────────────────────────────────────────────
//  Socket.io Setup
// ─────────────────────────────────────────────
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || '*',
        methods: ['GET', 'POST'],
    },
    pingInterval: 10000,
    pingTimeout: 5000,
});

app.set('io', io);

// ── Track last ESP8266 heartbeat (server-level, updated by controller) ──
let lastSensorHeartbeat = null;
let lastSensorData = {}; // Store latest temp/smoke/deviceId

app.set('lastSensorHeartbeat', () => lastSensorHeartbeat);
app.set('lastSensorData', () => lastSensorData);

app.set('updateSensorHeartbeat', (ts, data = {}) => {
    lastSensorHeartbeat = ts || new Date();
    if (data.deviceId) {
        lastSensorData = { ...lastSensorData, ...data, timestamp: lastSensorHeartbeat };
    }
});

io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });

    // Client can request current zone status
    socket.on('get-zones', () => {
        const { zoneManager } = require('./controllers/fireAlertController');
        socket.emit('zones-update', {
            topPriority: zoneManager.getTopPriority(),
            allZones: zoneManager.getSortedZones(),
        });
    });

    // Client can query last sensor heartbeat time
    socket.on('get-sensor-status', () => {
        socket.emit('sensor-status', { lastHeartbeat: lastSensorHeartbeat });
    });
});

// ─────────────────────────────────────────────
//  Security & Performance Middleware
// ─────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: false, // Disabled for dev; enable in production
    crossOriginEmbedderPolicy: false,
}));
app.use(compression());

// CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id'],
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

// ─────────────────────────────────────────────
//  Rate Limiting
// ─────────────────────────────────────────────
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: { success: false, message: 'Too many requests — please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', limiter);

// ─────────────────────────────────────────────
//  Static Files (Dashboard)
// ─────────────────────────────────────────────
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// ─────────────────────────────────────────────
//  API Routes
// ─────────────────────────────────────────────
app.use('/api', routes);

// ─────────────────────────────────────────────
//  Sensor Status Endpoint (polled on page load)
// ─────────────────────────────────────────────
app.get('/api/sensor-status', (req, res) => {
    const getHeartbeat = req.app.get('lastSensorHeartbeat');
    const getSensorData = req.app.get('lastSensorData');

    const lastHeartbeat = typeof getHeartbeat === 'function' ? getHeartbeat() : null;
    const lastData = typeof getSensorData === 'function' ? getSensorData() : {};

    const isOnline = lastHeartbeat
        ? (Date.now() - new Date(lastHeartbeat).getTime()) < 90000 // 90 seconds timeout
        : false;

    res.json({ success: true, isOnline, lastHeartbeat, data: lastData });
});

// Root redirect to dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.', error: err.message });
});

// ─────────────────────────────────────────────
//  Seed Default Admin User
// ─────────────────────────────────────────────
const seedDefaultUsers = async () => {
    const defaultUsers = [
        { username: 'admin', password: 'admin123', name: 'System Admin', email: 'admin@pyrochain.io', role: 'admin' },
        { username: 'firedept', password: 'firedept123', name: 'Fire Department Chief', email: 'firedept@pyrochain.io', role: 'firedept' },
    ];

    for (const u of defaultUsers) {
        const exists = await User.findOne({ username: u.username });
        if (!exists) {
            const hashed = await bcrypt.hash(u.password, 12);
            await User.create({ ...u, password: hashed });
            console.log(`[Seed] Created user: ${u.username} (${u.role})`);
        }
    }
};

// ─────────────────────────────────────────────
//  Start Server
// ─────────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 5000;

const startServer = async () => {
    try {
        // Connect to MongoDB (won't crash if unavailable — uses in-memory fallback)
        await connectDB();

        const { isUsingMemoryStore } = require('./config/db');

        // Seed default users (only if MongoDB is available)
        if (!isUsingMemoryStore()) {
            await seedDefaultUsers();
        } else {
            console.log('[Seed] Skipping user seed — in-memory mode active.');
            console.log('[Info] Dashboard is in DEMO mode. Login with: admin / admin123');
        }

        // Initialize blockchain service
        const bcReady = await blockchain.init();
        if (bcReady) {
            console.log('[Blockchain] Service initialized successfully.');
        } else {
            console.warn('[Blockchain] Running without blockchain — check .env configuration.');
        }

        // Start HTTP server
        server.listen(PORT, () => {
            console.log('\n╔══════════════════════════════════════════════╗');
            console.log(`║   PyroChain Backend running on port ${PORT}     ║`);
            console.log(`║   Dashboard: http://localhost:${PORT}            ║`);
            console.log(`║   API:       http://localhost:${PORT}/api        ║`);
            console.log('╚══════════════════════════════════════════════╝\n');
            console.log('  Default credentials:');
            console.log('  Admin:    admin / admin123');
            console.log('  FireDept: firedept / firedept123\n');
            if (isUsingMemoryStore()) {
                // Find local IP dynamically
                const nets = os.networkInterfaces();
                let localIp = '127.0.0.1';
                for (const name of Object.keys(nets)) {
                    for (const net of nets[name]) {
                        if (net.family === 'IPv4' && !net.internal) {
                            localIp = net.address;
                            break;
                        }
                    }
                }
                console.log('  ⚠️  IN-MEMORY MODE: MongoDB not found. Data is temporary.');
                console.log(`  📡 ESP8266 → POST http://${localIp}:${PORT}/api/fire-alert\n`);
            }
        });
    } catch (err) {
        console.error('[Server] Failed to start:', err);
        process.exit(1);
    }
};


startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received — shutting down gracefully...');
    server.close(() => {
        console.log('[Server] HTTP server closed.');
        process.exit(0);
    });
});

process.on('uncaughtException', (err) => console.error('[Server] Uncaught exception:', err));
process.on('unhandledRejection', (reason) => console.error('[Server] Unhandled rejection:', reason));
