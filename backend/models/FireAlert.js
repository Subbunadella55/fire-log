/**
 * PyroChain - MongoDB Schema Definitions
 * Models: FireAlert, User
 */
const mongoose = require('mongoose');

// ─────────────────────────────────────────────
//  FireAlert Schema
// ─────────────────────────────────────────────
const fireAlertSchema = new mongoose.Schema(
  {
    // Sensor identification
    deviceId: {
      type: String,
      required: [true, 'Device ID is required'],
      trim: true,
      index: true,
    },

    // Sensor readings
    temperature: {
      type: Number,
      required: [true, 'Temperature is required'],
      min: [-50, 'Temperature too low'],
      max: [200, 'Temperature too high'],
    },
    humidity: {
      type: Number,
      required: [true, 'Humidity is required'],
      min: [0, 'Humidity cannot be negative'],
      max: [100, 'Humidity cannot exceed 100%'],
    },
    smokeLevel: {
      type: Number,
      required: [true, 'Smoke level is required'],
      min: [0],
      max: [1023],
    },

    // Severity classification
    severity: {
      type: String,
      enum: ['NORMAL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      required: true,
      index: true,
    },
    severityScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    // Location data
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    latitude: {
      type: Number,
      required: [true, 'Latitude is required'],
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required'],
      min: -180,
      max: 180,
    },

    // Blockchain data
    blockchainTxHash: {
      type: String,
      default: null,
      index: true,
    },
    blockchainAlertId: {
      type: Number,
      default: null,
    },
    blockchainVerified: {
      type: Boolean,
      default: false,
    },
    blockchainError: {
      type: String,
      default: null,
    },

    // Alert lifecycle
    alertActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'FALSE_ALARM'],
      default: 'PENDING',
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: String,
      default: null,
    },

    // Dispatch tracking
    dispatchStatus: {
      type: String,
      enum: ['NOT_DISPATCHED', 'DISPATCHED', 'ON_SCENE', 'CLEARED'],
      default: 'NOT_DISPATCHED',
    },
    dispatchedAt: {
      type: Date,
      default: null,
    },

    // Deduplication
    alertHash: {
      type: String,
      unique: true,
      index: true,
    },

    // Notification tracking
    emailSent: { type: Boolean, default: false },
    smsSent: { type: Boolean, default: false },

    // Sensor timestamp vs server receipt time
    sensorTimestamp: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ──────────────────────────────────
fireAlertSchema.index({ createdAt: -1 });
fireAlertSchema.index({ severity: 1, temperature: -1 });
fireAlertSchema.index({ deviceId: 1, createdAt: -1 });

// ── Virtuals ─────────────────────────────────
fireAlertSchema.virtual('severityLabel').get(function () {
  const labels = { NORMAL: 'Normal', LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' };
  return labels[this.severity] || this.severity;
});

const FireAlert = mongoose.model('FireAlert', fireAlertSchema);

// ─────────────────────────────────────────────
//  User Schema (Role-based Auth)
// ─────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['admin', 'firedept', 'viewer'],
      default: 'viewer',
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

module.exports = { FireAlert, User };
