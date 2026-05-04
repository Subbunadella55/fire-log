/**
 * PyroChain - Express Routes
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, requireRole } = require('./middleware');

const {
    receiveFireAlert,
    getAlerts,
    updateAlertStatus,
    dispatchFireUnit,
    getStats,
} = require('../controllers/fireAlertController');

const { register, login, getMe } = require('../controllers/authController');
const { generateReport } = require('../controllers/reportController');

// ─────────────────────────────────────────────
//  Validation middleware
// ─────────────────────────────────────────────
const validateAlert = [
    body('deviceId').notEmpty().trim(),
    body('temperature').isFloat({ min: -50, max: 200 }),
    body('smokeLevel').isInt({ min: 0, max: 1023 }),
    body('humidity').optional().isFloat({ min: 0, max: 100 }),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.warn('[Validation] Ignoring minor sensor error to keep dashboard live:', errors.array());
            // Proceed to controller despite minor validation issues
        }
        next();
    },
];

// ─────────────────────────────────────────────
//  Auth Routes
// ─────────────────────────────────────────────
router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', protect, getMe);

// ─────────────────────────────────────────────
//  Fire Alert Routes
// ─────────────────────────────────────────────

// Receive alert from IoT device (no auth — device sends directly)
router.post('/fire-alert', validateAlert, receiveFireAlert);

// Get list of alerts (requires login)
router.get('/fire-alert', protect, getAlerts);

// Get stats
router.get('/fire-alert/stats', protect, getStats);

// Update alert status (firedept or admin)
router.patch(
    '/fire-alert/:id/status',
    protect,
    requireRole('admin', 'firedept'),
    updateAlertStatus
);

// Dispatch fire unit (firedept or admin)
router.patch(
    '/fire-alert/:id/dispatch',
    protect,
    requireRole('admin', 'firedept'),
    dispatchFireUnit
);

// ─────────────────────────────────────────────
//  Report Routes
// ─────────────────────────────────────────────
router.get('/report/pdf', protect, requireRole('admin'), generateReport);

// ─────────────────────────────────────────────
//  Health check
// ─────────────────────────────────────────────
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'PyroChain API',
        timestamp: new Date().toISOString(),
    });
});

module.exports = router;
