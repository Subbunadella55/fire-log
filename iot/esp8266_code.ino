/*
 * PyroChain - Smart Fire Safety Alert Logging System
 * ESP8266 IoT Firmware
 * Hardware Components: 
 *  - ESP8266 (NodeMCU / Wemos D1 Mini)
 *  - MQ-2 Smoke sensor
 *  - Flame sensor
 *  - LCD I2C (16x2)
 *  - 2 Red LEDs
 * 
 * Author: PyroChain Team
 * Date: 2026-02-28
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>
#include <WiFiClient.h>
#include <time.h>
#include <DHT.h>

// ─────────────────────────────────────────────
//  WiFi Configuration
// ─────────────────────────────────────────────
const char* WIFI_SSID     = "RAJ";      // ← Change this to your WiFi name
const char* WIFI_PASSWORD = "00000000";  // ← Change this to your WiFi password

// ─────────────────────────────────────────────
//  Backend Server Configuration
// ─────────────────────────────────────────────
// Replace with your local PC IP Address where the Node.js backend is running
const char* SERVER_URL    = "http://192.168.137.8:5000/api/fire-alert";
const char* DEVICE_ID     = "ESP8266_FIRE_SENSOR_01";
const char* ROOM_LOCATION = "Fire Detection Zone-A";

// Dynamic GPS coordinates (auto-detected via Wi-Fi)
float GPS_LAT       = 0.0f;
float GPS_LON       = 0.0f;

// ─────────────────────────────────────────────
//  Pin Definitions
// ─────────────────────────────────────────────
#define MQ2_PIN       A0     // Analog pin for MQ2 smoke sensor
#define FLAME_PIN     D3     // Digital pin for Flame sensor
#define LED_RED_1     D6     // First Red LED
#define LED_RED_2     D7     // Second Red LED
#define DHTPIN        D4     // Digital pin for DHT11
#define DHTTYPE       DHT11  

// ─────────────────────────────────────────────
//  Threshold Configuration
// ─────────────────────────────────────────────
#define SMOKE_THRESHOLD_LOW      300    // Warning smoke level (ADC 0-1023)
#define SMOKE_THRESHOLD_HIGH     600    // Critical smoke level

// ─────────────────────────────────────────────
//  Timing Configuration
// ─────────────────────────────────────────────
#define SENSOR_READ_INTERVAL     1000   // 1s - read sensors every second
#define ALERT_SEND_INTERVAL      5000   // 5s - send alert repeatedly during an active fire
#define NORMAL_SEND_INTERVAL     30000  // 30s - heartbeat payload during normal operation

// ─────────────────────────────────────────────
//  Global Objects
// ─────────────────────────────────────────────
LiquidCrystal_I2C lcd(0x27, 16, 2);  // LCD address 0x27 for a 16 chars and 2 line display
WiFiClient wifiClient;
HTTPClient http;
DHT dht(DHTPIN, DHTTYPE);

// ─────────────────────────────────────────────
//  State Variables
// ─────────────────────────────────────────────
int       smokeLevel      = 0;
bool      flameDetected   = false;

float     realTemperature  = 0.0f;  
float     realHumidity     = 0.0f;  

bool      alertActive     = false;
bool      lastAlertState  = false;
uint32_t  lastSensorRead  = 0;
uint32_t  lastDataSend    = 0;
String    currentSeverity = "NORMAL";
bool      ledToggle       = false;   // For alternating LED flashes

// Custom LCD Fire character
byte fireChar[8] = {
  0b00100, 0b01110, 0b11111, 0b01110,
  0b00100, 0b01010, 0b01110, 0b00000
};

// ─────────────────────────────────────────────
//  WiFi Connection
// ─────────────────────────────────────────────
void connectWiFi() {
  Serial.print("\n[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);
  
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Connecting WiFi");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    lcd.setCursor(attempts % 16, 1);
    lcd.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected!");
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("WiFi Connected!");
    lcd.setCursor(0, 1); lcd.print(WiFi.localIP().toString());
    delay(1000);
    
    // Auto-detect the location based on this Wi-Fi Network
    fetchLocationFromIP();
  } else {
    Serial.println("\n[WiFi] FAILED! Running offline.");
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("WiFi FAILED");
    delay(2000);
  }
}

// ─────────────────────────────────────────────
//  Auto-Detect Location via Wi-Fi IP
// ─────────────────────────────────────────────
void fetchLocationFromIP() {
  Serial.println("[Geo] Scanning for location via Wi-Fi...");
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Locating Area...");

  HTTPClient httpGeo;
  httpGeo.begin(wifiClient, "http://ip-api.com/json/");
  int httpCode = httpGeo.GET();
  
  if (httpCode == 200) {
    String payload = httpGeo.getString();
    StaticJsonDocument<512> docGeo;
    DeserializationError error = deserializeJson(docGeo, payload);
    
    if (!error && docGeo["status"] == "success") {
      GPS_LAT = docGeo["lat"];
      GPS_LON = docGeo["lon"];
      Serial.printf("[Geo] Location found! Lat: %.5f, Lon: %.5f\n", GPS_LAT, GPS_LON);
      lcd.setCursor(0, 1); lcd.print("Location Locked!");
    } else {
      Serial.println("[Geo] Failed to parse Location data.");
      lcd.setCursor(0, 1); lcd.print("Locating Failed");
    }
  } else {
    Serial.println("[Geo] Could not reach Geolocation Server.");
    lcd.setCursor(0, 1); lcd.print("Geo Server Error");
  }
  httpGeo.end();
  delay(1500);
}

// ─────────────────────────────────────────────
//  Get ISO8601 Timestamp
// ─────────────────────────────────────────────
String getTimestamp() {
  time_t now = time(nullptr);
  struct tm* t = gmtime(&now);
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", t);
  return String(buf);
}

// ─────────────────────────────────────────────
//  Read Sensors
// ─────────────────────────────────────────────
void readSensors() {
  // Read MQ2 Sensor
  smokeLevel = analogRead(MQ2_PIN);

  // Read Flame Sensor (Most flame sensors output LOW when a flame is detected)
  flameDetected = (digitalRead(FLAME_PIN) == LOW);

  // Read the temperature and humidity from the physical hardware
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  // Ensure reading did not fail
  if (!isnan(t) && !isnan(h)) {
    realTemperature = t;
    realHumidity = h;
  }

  Serial.printf("[Sensors] Smoke: %d | Flame: %s | Temp: %.1fC\n", 
                smokeLevel, flameDetected ? "DETECTED" : "SAFE", realTemperature);
}

// ─────────────────────────────────────────────
//  Determine Severity
// ─────────────────────────────────────────────
String determineSeverity() {
  bool highSmoke = (smokeLevel >= SMOKE_THRESHOLD_LOW);
  bool highTemp  = (realTemperature >= 35.0); // Set your specific threshold here

  // FIRE is only detected if ALL THREE conditions are met
  if (flameDetected && highSmoke && highTemp) {
      if (smokeLevel >= SMOKE_THRESHOLD_HIGH || realTemperature >= 45.0) return "CRITICAL";
      return "HIGH";
  }
  
  return "NORMAL";
}

// ─────────────────────────────────────────────
//  LCD Display Update
// ─────────────────────────────────────────────
void updateLCD() {
  lcd.clear();

  if (alertActive) {
    // Alternate between warning and sensor readings
    uint32_t t = millis() / 1000;
    if (t % 2 == 0) {
      lcd.setCursor(0, 0); lcd.print("** FIRE ALERT **");
      lcd.setCursor(0, 1); lcd.print("EVACUATE AREA!");
    } else {
      lcd.setCursor(0, 0);
      lcd.printf("SMOKE: %4d", smokeLevel);
      lcd.setCursor(0, 1);
      lcd.printf("FLAME: DETECTED");
    }
  } else {
    // Normal Display
    lcd.setCursor(0, 0);
    lcd.printf("SYSTEM SAFE   ");
    lcd.write(0); // Print custom fire char
    lcd.setCursor(0, 1);
    lcd.printf("SMK:%4d FLM:NO", smokeLevel);
  }
}

// ─────────────────────────────────────────────
//  Control 2 Red LEDs
// ─────────────────────────────────────────────
void controlAlarmOutputs() {
  if (alertActive) {
    // If critical alert, alternate flashing the two red LEDs like a police siren
    ledToggle = !ledToggle;
    if (ledToggle) {
      digitalWrite(LED_RED_1, HIGH);
      digitalWrite(LED_RED_2, LOW);
    } else {
      digitalWrite(LED_RED_1, LOW);
      digitalWrite(LED_RED_2, HIGH);
    }
  } else {
    // Turn both OFF during normal status
    digitalWrite(LED_RED_1, LOW);
    digitalWrite(LED_RED_2, LOW);
  }
}

// ─────────────────────────────────────────────
//  Send Data to Node.js Backend
// ─────────────────────────────────────────────
bool sendAlertToServer() {
  if (WiFi.status() != WL_CONNECTED) return false;

  // Build JSON payload
  StaticJsonDocument<256> doc;
  doc["deviceId"]    = DEVICE_ID;
  doc["temperature"] = realTemperature;
  doc["humidity"]    = realHumidity;
  doc["smokeLevel"]  = smokeLevel;
  doc["severity"]    = currentSeverity;
  doc["latitude"]    = GPS_LAT;
  doc["longitude"]   = GPS_LON;
  doc["location"]    = ROOM_LOCATION;
  doc["timestamp"]   = getTimestamp();
  doc["alertActive"] = alertActive;
  
  // Custom field to pass flame status directly if we want
  doc["flameDetected"] = flameDetected;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  Serial.println("[HTTP] Sending: " + jsonPayload);

  http.begin(wifiClient, SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id",  DEVICE_ID);
  http.setTimeout(8000);

  int httpCode = http.POST(jsonPayload);
  http.end();

  return (httpCode == 200 || httpCode == 201);
}

// ─────────────────────────────────────────────
//  Setup
// ─────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("\n\n=== PyroChain ESP8266 Fire System ===");

  // Initialize GPIO
  pinMode(FLAME_PIN, INPUT);
  
  pinMode(LED_RED_1, OUTPUT);
  pinMode(LED_RED_2, OUTPUT);
  digitalWrite(LED_RED_1, LOW);
  digitalWrite(LED_RED_2, LOW);

  // Initialize LCD
  lcd.init();
  lcd.backlight();
  lcd.createChar(0, fireChar);
  lcd.setCursor(0, 0); lcd.print("PyroChain v2.0");
  lcd.setCursor(0, 1); lcd.print("Initializing...");
  delay(1500);

  // Initialize DHT11
  dht.begin();

  // Connect WiFi
  connectWiFi();

  // Sync NTP Time
  configTime(19800, 0, "pool.ntp.org", "time.nist.gov");  // IST = UTC+5:30
  
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("System Ready");
  lcd.setCursor(0, 1); lcd.print("Monitoring...");
  delay(1000);
}

// ─────────────────────────────────────────────
//  Main Loop
// ─────────────────────────────────────────────
void loop() {
  uint32_t now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // 1. Read Sensors & Update UI locally (Every 1 second)
  if (now - lastSensorRead >= SENSOR_READ_INTERVAL) {
    lastSensorRead = now;
    readSensors();

    currentSeverity = determineSeverity();
    // ALERT only if severity is not NORMAL (which now requires ALL 3 sensors)
    alertActive     = (currentSeverity != "NORMAL");

    updateLCD();
    controlAlarmOutputs();
  }

  // 2. Transmit to Backend Server 
  // Send alert every 5s if active
  if (alertActive && (now - lastDataSend >= ALERT_SEND_INTERVAL)) {
    lastDataSend = now;
    sendAlertToServer();
  }
  
  // ADDED: Send Heartbeat every 30s even if everything is NORMAL
  // This makes the readings show up on the frontend!
  if (!alertActive && (now - lastDataSend >= NORMAL_SEND_INTERVAL)) {
    lastDataSend = now;
    sendAlertToServer();
    Serial.println("[Heartbeat] System Safe - Sending readings to Dashboard");
  }

  delay(100); 
}
