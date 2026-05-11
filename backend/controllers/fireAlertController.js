/**
 * PyroChain - Fire Alert Controller
 * Handles: receiving sensor data, severity classification,
 *          zone prioritization, blockchain logging, auto-resolution.
 *
 * Supports BOTH MongoDB (persistent) and In-Memory (no MongoDB needed) modes.
 */
require('dotenv').config();
const crypto = require('crypto');
const blockchain = require('../config/blockchain');
const { sendAlertEmail, sendAreaAlertSMS } = require('./notificationController');
const supabase = require('../config/supabase');

async function logToSupabase(data) {
    if (!supabase) return;
    try {
        const { error } = await supabase.from('fire_alerts').insert([data]);
        if (error) {
            console.error('[Supabase] Error saving alert:', error.message);
        } else {
            console.log(`[Supabase] Alert logged for device: ${data.device_id}`);
        }
    } catch (err) {
        console.error('[Supabase] Exception:', err.message);
    }
}

// ── Buzzer State ──
let buzzerState = { active: false, severity: null, activatedAt: null };

function setBuzzer(severity) {
    buzzerState = { active: true, severity, activatedAt: Date.now() };
    console.log(`[Buzzer] Activated for ${severity} alert`);
}

function getBuzzerStatus(req, res) {
    // Auto-clear buzzer after 30 seconds
    if (buzzerState.active && buzzerState.activatedAt) {
        if ((Date.now() - buzzerState.activatedAt) > 30000) {
            buzzerState = { active: false, severity: null, activatedAt: null };
        }
    }
    res.json({ buzzerActive: buzzerState.active, severity: buzzerState.severity });
}

function clearBuzzer(req, res) {
    buzzerState = { active: false, severity: null, activatedAt: null };
    console.log('[Buzzer] Silenced manually');
    res.json({ success: true, message: 'Buzzer silenced.' });
}

function mapSupabaseToAlert(sb) {
    return {
        _id: sb.id || `sb_${sb.alert_hash || Date.now()}`,
        deviceId: sb.device_id,
        temperature: parseFloat(sb.temperature),
        humidity: parseFloat(sb.humidity),
        smokeLevel: parseInt(sb.smoke_level),
        severity: sb.severity,
        location: sb.location,
        latitude: parseFloat(sb.latitude),
        longitude: parseFloat(sb.longitude),
        alertActive: sb.alert_active,
        alertHash: sb.alert_hash,
        sensorTimestamp: sb.timestamp,
        status: sb.alert_active ? 'PENDING' : 'RESOLVED',
        createdAt: sb.timestamp,
        updatedAt: sb.timestamp,
        isSupabaseData: true
    };
}

// ─────────────────────────────────────────────
//  In-Memory Store (used when MongoDB is unavailable)
// ─────────────────────────────────────────────
const memoryStore = {
    alerts: [],       // Array of alert objects
    idCounter: 1,
};

function isMemoryMode() {
    try {
        const { isUsingMemoryStore } = require('../config/db');
        return isUsingMemoryStore();
    } catch {
        return false;
    }
}

// ─────────────────────────────────────────────
//  Lazy-load FireAlert model (only when MongoDB is available)
// ─────────────────────────────────────────────
let FireAlert;
function getFireAlertModel() {
    if (!FireAlert) {
        try { FireAlert = require('../models/FireAlert').FireAlert; } catch { }
    }
    return FireAlert;
}

// ─────────────────────────────────────────────
//  Threshold Configuration (from env or defaults)
// ─────────────────────────────────────────────
const THRESHOLDS = {
    smoke: {
        low: parseInt(process.env.SMOKE_THRESHOLD_LOW) || 300,
        medium: parseInt(process.env.SMOKE_THRESHOLD_MEDIUM) || 450,
        high: parseInt(process.env.SMOKE_THRESHOLD_HIGH) || 600,
    },
    temp: {
        low: parseFloat(process.env.TEMP_THRESHOLD_LOW) || 45,
        medium: parseFloat(process.env.TEMP_THRESHOLD_MEDIUM) || 55,
        high: parseFloat(process.env.TEMP_THRESHOLD_HIGH) || 60,
        critical: parseFloat(process.env.TEMP_THRESHOLD_CRITICAL) || 70,
    },
};

// ─────────────────────────────────────────────
//  Priority Zone Manager
// ─────────────────────────────────────────────
class PriorityZoneManager {
    constructor() {
        this.zones = new Map();
    }

    update(deviceId, temperature, severity, location) {
        this.zones.set(deviceId, {
            deviceId, temperature, severity, location,
            lastUpdate: new Date(),
        });
    }

    remove(deviceId) { this.zones.delete(deviceId); }

    getSortedZones() {
        return Array.from(this.zones.values()).sort(
            (a, b) => b.temperature - a.temperature
        );
    }

    getTopPriority() {
        const s = this.getSortedZones();
        return s.length > 0 ? s[0] : null;
    }

    cleanup() {
        const cutoff = new Date(Date.now() - 5 * 60 * 1000);
        for (const [key, zone] of this.zones) {
            if (zone.lastUpdate < cutoff) this.zones.delete(key);
        }
    }
}

const zoneManager = new PriorityZoneManager();
setInterval(() => zoneManager.cleanup(), 2 * 60 * 1000);

// ─────────────────────────────────────────────
//  Severity Classification
// ─────────────────────────────────────────────
function classifySeverity(temperature, smokeLevel) {
    const { temp, smoke } = THRESHOLDS;

    let tempScore = 0;
    let smokeScore = 0;

    if (temperature >= temp.critical) tempScore = 60;
    else if (temperature >= temp.high) tempScore = 45;
    else if (temperature >= temp.medium) tempScore = 30;
    else if (temperature >= temp.low) tempScore = 15;

    if (smokeLevel >= smoke.high) smokeScore = 80; // User defined high smoke = critical
    else if (smokeLevel >= smoke.medium) smokeScore = 40;
    else if (smokeLevel >= smoke.low) smokeScore = 25;

    const totalScore = tempScore + smokeScore;

    let severity;
    if (totalScore >= 80) severity = 'CRITICAL';
    else if (totalScore >= 55) severity = 'HIGH';
    else if (totalScore >= 30) severity = 'MEDIUM';
    else if (totalScore >= 10) severity = 'LOW';
    else severity = 'NORMAL';

    return { severity, severityScore: totalScore };
}

function generateAlertHash(deviceId, temperature, smokeLevel, timestamp) {
    const window = Math.floor(new Date(timestamp).getTime() / 10000);
    const raw = `${deviceId}:${Math.round(temperature)}:${Math.round(smokeLevel / 10)}:${window}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
}

// ─────────────────────────────────────────────
//  POST /api/fire-alert  — Receive sensor data from ESP8266
// ─────────────────────────────────────────────
const receiveFireAlert = async (req, res) => {
    try {
        let {
            deviceId,
            temperature,
            humidity = 0,
            smokeLevel,
            latitude = 0,
            longitude = 0,
            location = 'Unknown Zone',
            timestamp,
            alertActive,
        } = req.body;

        // If hardware didn't send GPS, assign a realistic fixed location
        if (parseFloat(latitude) === 0 || parseFloat(longitude) === 0) {
            // Base Sathyabama University coordinates
            const baseLat = 12.8731;
            const baseLon = 80.2219;
            
            // Create a small deterministic offset based on the deviceId string
            let hash = 0;
            for (let i = 0; i < deviceId.length; i++) {
                hash = deviceId.charCodeAt(i) + ((hash << 5) - hash);
            }
            // Sathyabama Campus is a specific tight area, decrease offset spread
            latitude = baseLat + ((hash % 100) / 40000);
            longitude = baseLon + (((hash >> 2) % 100) / 40000);
        }

        if (!deviceId || temperature === undefined || smokeLevel === undefined) {
            return res.status(400).json({
                success: false,
                message: 'deviceId, temperature, and smokeLevel are required.',
            });
        }

        const sensorTimestamp = timestamp ? new Date(timestamp) : new Date();
        const { severity, severityScore } = classifySeverity(
            parseFloat(temperature), parseInt(smokeLevel)
        );

        const alertHash = generateAlertHash(deviceId, temperature, smokeLevel, sensorTimestamp);
        const isActiveAlert = alertActive !== false && severity !== 'NORMAL';

        const supabaseData = {
            device_id: deviceId,
            temperature: parseFloat(temperature),
            humidity: parseFloat(humidity),
            smoke_level: parseInt(smokeLevel),
            severity: severity,
            location: location,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            alert_active: isActiveAlert,
            alert_hash: alertHash,
            timestamp: sensorTimestamp.toISOString()
        };

        // ── In-Memory Mode ───────────────────────
        if (isMemoryMode()) {
            // Check for duplicate
            const dup = memoryStore.alerts.find(a => a.alertHash === alertHash);
            if (dup) {
                return res.status(200).json({
                    success: true, message: 'Duplicate alert.', alertId: dup._id, duplicate: true,
                });
            }

            const newAlert = {
                _id: `mem_${memoryStore.idCounter++}`,
                deviceId,
                temperature: parseFloat(temperature),
                humidity: parseFloat(humidity),
                smokeLevel: parseInt(smokeLevel),
                severity,
                severityScore,
                location,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                alertActive: isActiveAlert,
                alertHash,
                sensorTimestamp,
                status: isActiveAlert ? 'PENDING' : 'RESOLVED',
                dispatchStatus: 'NOT_DISPATCHED',
                blockchainTxHash: null,
                blockchainVerified: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            memoryStore.alerts.unshift(newAlert);
            // Keep last 500 alerts in memory

            // Log to Supabase async execution
            setImmediate(() => logToSupabase(supabaseData));
            if (memoryStore.alerts.length > 500) memoryStore.alerts.pop();

            if (isActiveAlert) zoneManager.update(deviceId, parseFloat(temperature), severity, location);
            else zoneManager.remove(deviceId);

            // Emit real-time socket event
            const io = req.app.get('io');
            const now = new Date().toISOString();
            // Update server-level heartbeat (powers REST /api/sensor-status)
            const updater = req.app.get('updateSensorHeartbeat');
            if (typeof updater === 'function') updater(now, { deviceId, temperature: parseFloat(temperature), smokeLevel: parseInt(smokeLevel) });
            if (io) {
                // Heartbeat: lets frontend know sensor is actively connected with live data
                io.emit('sensor-heartbeat', { 
                    deviceId, 
                    temperature: parseFloat(temperature), 
                    smokeLevel: parseInt(smokeLevel),
                    timestamp: now 
                });
                io.emit('new-alert', {
                    ...newAlert,
                    topPriority: zoneManager.getTopPriority(),
                    allZones: zoneManager.getSortedZones(),
                });
            }

            console.log(`[Alert][MEM] ${deviceId} | Temp: ${temperature}°C | Smoke: ${smokeLevel} | ${severity}`);

            if (isActiveAlert) {
                // Trigger Buzzer for Critical
                if (severity === 'CRITICAL') setBuzzer(severity);

                setImmediate(async () => {
                    try {
                        const bcResult = await blockchain.logAlert({
                            deviceId, temperature: parseFloat(temperature),
                            humidity: parseFloat(humidity), smokeLevel: parseInt(smokeLevel),
                            severity, location,
                            latitude: parseFloat(latitude), longitude: parseFloat(longitude),
                            sensorTimestamp,
                        });
                        if (bcResult) {
                            newAlert.blockchainTxHash = bcResult.txHash;
                            newAlert.blockchainAlertId = bcResult.alertId;
                            newAlert.blockchainVerified = true;
                            if (io) io.emit('blockchain-confirmed', {
                                alertId: newAlert._id, txHash: bcResult.txHash, severity,
                            });
                        }
                    } catch (bcErr) {
                        newAlert.blockchainError = bcErr.message;
                        console.error('[Blockchain] In-Memory error:', bcErr.message);
                    }
                });

                if (severity === 'HIGH' || severity === 'CRITICAL') {
                    setImmediate(() => sendAlertEmail(newAlert).catch(console.error));
                    setImmediate(() => sendAreaAlertSMS(newAlert).catch(console.error));
                }
            }

            return res.status(201).json({
                success: true,
                message: 'Alert received (in-memory mode).',
                alertId: newAlert._id, severity, severityScore,
                topPriority: zoneManager.getTopPriority(),
            });
        }

        // ── MongoDB Mode ─────────────────────────
        const FA = getFireAlertModel();
        const existing = await FA.findOne({ alertHash });
        if (existing) {
            return res.status(200).json({
                success: true, message: 'Duplicate alert — already logged.',
                alertId: existing._id, duplicate: true,
            });
        }

        if (isActiveAlert) zoneManager.update(deviceId, parseFloat(temperature), severity, location);
        else zoneManager.remove(deviceId);

        const newAlert = new FA({
            deviceId,
            temperature: parseFloat(temperature),
            humidity: parseFloat(humidity),
            smokeLevel: parseInt(smokeLevel),
            severity, severityScore, location,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            alertActive: isActiveAlert,
            alertHash, sensorTimestamp,
            status: isActiveAlert ? 'PENDING' : 'RESOLVED',
        });
        await newAlert.save();

        // Log to Supabase async execution
        setImmediate(() => logToSupabase(supabaseData));

        const io = req.app.get('io');
        const nowTs = new Date().toISOString();
        const updater2 = req.app.get('updateSensorHeartbeat');
        if (typeof updater2 === 'function') updater2(nowTs, { deviceId, temperature: parseFloat(temperature), smokeLevel: parseInt(smokeLevel) });
        if (io) {
            // Heartbeat: lets frontend know sensor is actively connected with live data
            io.emit('sensor-heartbeat', { 
                deviceId, 
                temperature: parseFloat(temperature), 
                smokeLevel: parseInt(smokeLevel),
                timestamp: nowTs 
            });
            io.emit('new-alert', {
                ...newAlert.toJSON(),
                topPriority: zoneManager.getTopPriority(),
                allZones: zoneManager.getSortedZones(),
            });
        }

        if (isActiveAlert) {
            // Trigger Buzzer for Critical
            if (severity === 'CRITICAL') setBuzzer(severity);

            setImmediate(async () => {
                try {
                    const bcResult = await blockchain.logAlert({
                        deviceId, temperature: parseFloat(temperature),
                        humidity: parseFloat(humidity), smokeLevel: parseInt(smokeLevel),
                        severity, location,
                        latitude: parseFloat(latitude), longitude: parseFloat(longitude),
                        sensorTimestamp,
                    });
                    if (bcResult) {
                        await FA.findByIdAndUpdate(newAlert._id, {
                            blockchainTxHash: bcResult.txHash,
                            blockchainAlertId: bcResult.alertId,
                            blockchainVerified: true,
                        });
                        if (io) io.emit('blockchain-confirmed', {
                            alertId: newAlert._id, txHash: bcResult.txHash, severity,
                        });
                    }
                } catch (bcErr) {
                    await FA.findByIdAndUpdate(newAlert._id, { blockchainError: bcErr.message });
                }
            });

            if (severity === 'HIGH' || severity === 'CRITICAL') {
                setImmediate(() => sendAlertEmail(newAlert).catch(console.error));
                setImmediate(() => sendAreaAlertSMS(newAlert).catch(console.error));
            }
        }

        return res.status(201).json({
            success: true, message: 'Alert received and logged.',
            alertId: newAlert._id, severity, severityScore,
            topPriority: zoneManager.getTopPriority(),
        });

    } catch (err) {
        console.error('[Alert] receiveFireAlert error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error.', error: err.message });
    }
};

// ─────────────────────────────────────────────
//  GET /api/fire-alert  — List alerts
// ─────────────────────────────────────────────
const getAlerts = async (req, res) => {
    try {
        const {
            severity, status, deviceId,
            limit = 50, page = 1,
            sortBy = 'createdAt', order = 'desc',
        } = req.query;

        let results = [];
        let total = 0;

        // ── 1. Try MongoDB First ────────────────
        if (!isMemoryMode()) {
            const FA = getFireAlertModel();
            const filter = {};
            if (severity) filter.severity = severity.toUpperCase();
            if (status) filter.status = status.toUpperCase();
            if (deviceId) filter.deviceId = deviceId;

            total = await FA.countDocuments(filter);
            if (total > 0) {
                const skip = (parseInt(page) - 1) * parseInt(limit);
                results = await FA.find(filter)
                    .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean();
            }
        }

        // ── 2. Fallback to Memory Store ──────────
        if (results.length === 0) {
            results = [...memoryStore.alerts];
            if (severity) results = results.filter(a => a.severity === severity.toUpperCase());
            if (status) results = results.filter(a => a.status === status.toUpperCase());
            if (deviceId) results = results.filter(a => a.deviceId === deviceId);

            results.sort((a, b) => {
                const v = order === 'asc' ? 1 : -1;
                return (a[sortBy] > b[sortBy] ? 1 : -1) * v;
            });
            total = results.length;
            const skip = (parseInt(page) - 1) * parseInt(limit);
            results = results.slice(skip, skip + parseInt(limit));
        }

        // ── 3. Final Fallback to Supabase ────────
        if (results.length === 0 && supabase) {
            console.log('[Alert] No local data, fetching from Supabase...');
            let query = supabase.from('fire_alerts').select('*', { count: 'exact' });
            
            if (severity) query = query.eq('severity', severity.toUpperCase());
            if (deviceId) query = query.eq('device_id', deviceId);
            
            const skip = (parseInt(page) - 1) * parseInt(limit);
            query = query.order('timestamp', { ascending: order === 'asc' })
                         .range(skip, skip + parseInt(limit) - 1);

            const { data, count, error } = await query;
            if (!error && data) {
                results = data.map(mapSupabaseToAlert);
                total = count;
            }
        }

        return res.json({
            success: true,
            data: results,
            pagination: { 
                total, 
                page: parseInt(page), 
                limit: parseInt(limit), 
                totalPages: Math.ceil(total / parseInt(limit)) 
            },
            topPriority: zoneManager.getTopPriority(),
            allZones: zoneManager.getSortedZones(),
        });
    } catch (err) {
        console.error('[Alert] getAlerts error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

// ─────────────────────────────────────────────
//  PATCH /api/fire-alert/:id/status
// ─────────────────────────────────────────────
const updateAlertStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resolvedBy } = req.body;

        const validStatuses = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'FALSE_ALARM'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `Invalid status.` });
        }

        if (isMemoryMode()) {
            const alert = memoryStore.alerts.find(a => a._id === id);
            if (!alert) return res.status(404).json({ success: false, message: 'Alert not found.' });
            alert.status = status;
            if (status === 'RESOLVED' || status === 'FALSE_ALARM') {
                alert.alertActive = false;
                alert.resolvedAt = new Date().toISOString();
                alert.resolvedBy = resolvedBy || 'System';
                zoneManager.remove(alert.deviceId);
            }
            const io = req.app.get('io');
            if (io) io.emit('alert-status-update', { alertId: id, status });
            return res.json({ success: true, data: alert });
        }

        const FA = getFireAlertModel();
        const update = { status };
        if (status === 'RESOLVED' || status === 'FALSE_ALARM') {
            update.alertActive = false;
            update.resolvedAt = new Date();
            update.resolvedBy = resolvedBy || 'System';
        }
        const alert = await FA.findByIdAndUpdate(id, update, { new: true });
        if (!alert) return res.status(404).json({ success: false, message: 'Alert not found.' });
        if (status === 'RESOLVED' || status === 'FALSE_ALARM') zoneManager.remove(alert.deviceId);

        const io = req.app.get('io');
        if (io) io.emit('alert-status-update', { alertId: id, status });
        return res.json({ success: true, data: alert });

    } catch (err) {
        console.error('[Alert] updateAlertStatus error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

// ─────────────────────────────────────────────
//  PATCH /api/fire-alert/:id/dispatch
// ─────────────────────────────────────────────
const dispatchFireUnit = async (req, res) => {
    try {
        const { id } = req.params;

        if (isMemoryMode()) {
            const alert = memoryStore.alerts.find(a => a._id === id);
            if (!alert) return res.status(404).json({ success: false, message: 'Alert not found.' });
            alert.dispatchStatus = 'DISPATCHED';
            alert.status = 'IN_PROGRESS';
            const io = req.app.get('io');
            if (io) io.emit('unit-dispatched', { alertId: id, location: alert.location });
            return res.json({ success: true, message: 'Fire unit dispatched!', data: alert });
        }

        const FA = getFireAlertModel();
        const alert = await FA.findByIdAndUpdate(
            id,
            { dispatchStatus: 'DISPATCHED', dispatchedAt: new Date(), status: 'IN_PROGRESS' },
            { new: true }
        );
        if (!alert) return res.status(404).json({ success: false, message: 'Alert not found.' });

        const io = req.app.get('io');
        if (io) io.emit('unit-dispatched', { alertId: id, location: alert.location });
        return res.json({ success: true, message: 'Fire unit dispatched!', data: alert });

    } catch (err) {
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

// ─────────────────────────────────────────────
//  GET /api/fire-alert/stats
// ─────────────────────────────────────────────
const getStats = async (req, res) => {
    try {
        if (isMemoryMode()) {
            const alerts = memoryStore.alerts;
            const total = alerts.length;
            const activeAlerts = alerts.filter(a => a.alertActive).length;
            const bySeverity = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NORMAL'].map(sev => ({
                _id: sev,
                count: alerts.filter(a => a.severity === sev).length,
                avgTemp: alerts.filter(a => a.severity === sev).reduce((s, a) => s + a.temperature, 0) /
                    (alerts.filter(a => a.severity === sev).length || 1),
                maxTemp: Math.max(...alerts.filter(a => a.severity === sev).map(a => a.temperature), 0),
            })).filter(s => s.count > 0);

            let bchTotal = 0;
            try { bchTotal = await blockchain.getTotalAlerts(); } catch { }

            return res.json({
                success: true,
                data: {
                    total, activeAlerts, bchTotal, bySeverity,
                    topPriority: zoneManager.getTopPriority(),
                    allZones: zoneManager.getSortedZones()
                },
            });
        }

        const FA = getFireAlertModel();
        const [stats, bchTotal] = await Promise.all([
            FA.aggregate([{
                $group: {
                    _id: '$severity',
                    count: { $sum: 1 },
                    avgTemp: { $avg: '$temperature' },
                    maxTemp: { $max: '$temperature' },
                    avgSmoke: { $avg: '$smokeLevel' },
                }
            }]),
            blockchain.getTotalAlerts(),
        ]);
        const total = await FA.countDocuments();
        const activeAlerts = await FA.countDocuments({ alertActive: true });
        return res.json({
            success: true,
            data: {
                total, activeAlerts, bchTotal, bySeverity: stats,
                topPriority: zoneManager.getTopPriority(),
                allZones: zoneManager.getSortedZones()
            },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

module.exports = {
    receiveFireAlert,
    getAlerts,
    updateAlertStatus,
    dispatchFireUnit,
    getStats,
    getBuzzerStatus,
    clearBuzzer,
    setBuzzer,
    zoneManager,
};
