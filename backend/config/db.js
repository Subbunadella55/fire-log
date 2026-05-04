/**
 * PyroChain - MongoDB Connection + In-Memory Fallback
 * If MongoDB is not running, we use an in-memory store so the
 * ESP8266 sensor data still flows through to the frontend.
 */
require('dotenv').config();
const mongoose = require('mongoose');

let usingMemoryStore = false;

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 4000,  // fail fast
            connectTimeoutMS: 4000,
        });
        console.log(`[MongoDB] Connected: ${mongoose.connection.host}`);
        usingMemoryStore = false;
    } catch (err) {
        console.warn('[MongoDB] Not available — switching to IN-MEMORY store.');
        console.warn('[MongoDB] Data will be lost on restart. Install MongoDB for persistence.');
        usingMemoryStore = true;
        // Do NOT exit — let the server run with in-memory data
    }
};

const isUsingMemoryStore = () => usingMemoryStore;

module.exports = connectDB;
module.exports.isUsingMemoryStore = isUsingMemoryStore;
