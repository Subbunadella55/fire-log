/**
 * PyroChain - Notification Controller
 * Handles email (Nodemailer) and SMS simulation
 */
require('dotenv').config();
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const supabase = require('../config/supabase');

// ── Configure Twilio Client ─────────
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

let twilioClient = null;
if (accountSid && authToken) {
  twilioClient = twilio(accountSid, authToken);
}

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

// ─────────────────────────────────────────────
//  Send SMS to People in the Alert Area
// ─────────────────────────────────────────────
const sendAreaAlertSMS = async (alert) => {
  const messageBody = `🚨 URGENT: FIRE ALERT (${alert.severity}) 🚨\nLocation: ${alert.location}\nEvacuate immediately.\nReply STOP to opt out of alerts.`;

  if (!twilioClient) {
    console.warn('[SMS] Twilio credentials not configured in .env. Simulating SMS to residents...');
    console.log(`[SMS SIMULATION] To residents in ${alert.location}:\n${messageBody}\n`);
    return false;
  }

  let numbersToAlert = [];

  // Fetch phone numbers from Supabase for this specific area
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('residents')
        .select('phone_number')
        .eq('zone_location', alert.location);
      
      if (!error && data) {
        numbersToAlert = data.map(r => r.phone_number);
      }
    } catch (err) {
      console.error('[SMS] Error fetching residents from Supabase:', err.message);
    }
  }
  
  // If no numbers for this location, fallback to default environment variable
  if (numbersToAlert.length === 0) {
    const envNumbers = process.env.DEFAULT_AREA_NUMBERS;
    if (envNumbers) {
      numbersToAlert = envNumbers.split(',');
    }
  }

  if (numbersToAlert.length === 0) {
    console.warn(`[SMS] No contact numbers found for area: ${alert.location}`);
    return false;
  }

  console.log(`[SMS] Sending area evacuation alerts to ${numbersToAlert.length} number(s) in ${alert.location}...`);

  try {
    const smsPromises = numbersToAlert.map((number) => {
      return twilioClient.messages.create({
        body: messageBody,
        from: twilioNumber,
        to: number.trim(),
      });
    });

    await Promise.all(smsPromises);
    console.log(`[SMS] Successfully sent area alerts for ${alert.location}`);
    return true;
  } catch (error) {
    console.error('[SMS] Failed to send area alert SMS:', error.message);
    return false;
  }
};

module.exports = { sendAlertEmail, sendAlertSMS, sendAreaAlertSMS };
