/**
 * PyroChain - Notification Controller
 * Handles email (Nodemailer) and SMS simulation
 */
require('dotenv').config();
const nodemailer = require('nodemailer');

// ── Configure Nodemailer transporter ─────────
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// ─────────────────────────────────────────────
//  Send Alert Email to Fire Department
// ─────────────────────────────────────────────
const sendAlertEmail = async (alert) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[Email] Credentials not configured — skipping email.');
    return false;
  }

  const severityColors = {
    CRITICAL: '#FF1744',
    HIGH: '#FF6D00',
    MEDIUM: '#FFC107',
    LOW: '#4CAF50',
  };
  const color = severityColors[alert.severity] || '#607D8B';

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #0a0a0a; color: #fff; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: #1a1a2e; border-radius: 12px; border: 2px solid ${color}; overflow: hidden;">
        <div style="background: ${color}; padding: 20px; text-align: center;">
          <h1 style="margin: 0; color: #fff; font-size: 24px;">🔥 FIRE ALERT — ${alert.severity}</h1>
        </div>
        <div style="padding: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; color: #aaa;">Device ID</td><td style="padding: 8px; color: #fff; font-weight: bold;">${alert.deviceId}</td></tr>
            <tr><td style="padding: 8px; color: #aaa;">Location</td><td style="padding: 8px; color: #fff; font-weight: bold;">${alert.location}</td></tr>
            <tr><td style="padding: 8px; color: #aaa;">Temperature</td><td style="padding: 8px; color: ${color}; font-weight: bold; font-size: 18px;">${alert.temperature}°C</td></tr>
            <tr><td style="padding: 8px; color: #aaa;">Smoke Level</td><td style="padding: 8px; color: #fff;">${alert.smokeLevel} ADC</td></tr>
            <tr><td style="padding: 8px; color: #aaa;">Humidity</td><td style="padding: 8px; color: #fff;">${alert.humidity}%</td></tr>
            <tr><td style="padding: 8px; color: #aaa;">GPS</td><td style="padding: 8px; color: #fff;">${alert.latitude}, ${alert.longitude}</td></tr>
            <tr><td style="padding: 8px; color: #aaa;">Timestamp</td><td style="padding: 8px; color: #fff;">${new Date(alert.sensorTimestamp).toLocaleString()}</td></tr>
            <tr><td style="padding: 8px; color: #aaa;">Alert ID</td><td style="padding: 8px; color: #fff; font-family: monospace;">${alert._id}</td></tr>
          </table>
          <div style="margin-top: 20px; padding: 16px; background: #16213e; border-radius: 8px; text-align: center;">
            <p style="color: #aaa; margin: 0;">Logged on Blockchain TX: <span style="color: #7c3aed;">${alert.blockchainTxHash || 'Pending...'}</span></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.FIRE_DEPT_EMAIL,
      subject: `🔥 [${alert.severity}] Fire Alert at ${alert.location} — ${alert.deviceId}`,
      html,
    });

    console.log(`[Email] Alert email sent for ${alert._id}`);
    return true;
  } catch (err) {
    console.error('[Email] Send failed:', err.message);
    return false;
  }
};

// ─────────────────────────────────────────────
//  SMS Simulation (replace with Twilio/MSG91)
// ─────────────────────────────────────────────
const sendAlertSMS = async (alert) => {
  // Simulated SMS — integrate real provider here
  const message = `🔥 FIRE ALERT [${alert.severity}]
Location: ${alert.location}
Temp: ${alert.temperature}°C | Smoke: ${alert.smokeLevel}
Device: ${alert.deviceId}
Time: ${new Date(alert.sensorTimestamp).toLocaleString()}`;

  console.log(`[SMS SIMULATION] Would send to Fire Dept:\n${message}\n`);
  return true;
};

module.exports = { sendAlertEmail, sendAlertSMS };
