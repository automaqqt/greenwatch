#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <EEPROM.h>
#include <ArduinoJson.h>

// Configuration constants
const char* ssid = "red";
const char* password = "acted";
const char* serverUrl = "https://farm.vidsoft.net/api/upload_sensor_data";
const char* apiKey = "acb123";

// EEPROM addresses for storing calibration values
const int ADDR_MIN_SOIL = 0;
const int ADDR_MAX_SOIL = 4;
const int EEPROM_SIZE = 8;

// Pin definitions
#define DHTPIN 32
#define DHTTYPE DHT22
#define SOIL_SENSOR_PIN 33
#define LED_STATUS_PIN 2

// Constants for soil humidity calibration
const int CALIBRATION_SAMPLES = 10;
const int CALIBRATION_DELAY_MS = 1000;
const float DETECTION_THRESHOLD = 0.60;  // 20% of current value indicates watering event (value drops when wet)
const unsigned long STABILIZATION_TIME = 300000;  // 5 minutes for soil to stabilize

// Sensor objects
DHT dht(DHTPIN, DHTTYPE);

// Global variables
struct {
  int minSoilValue = 1;     // Wettest value (100% humidity)
  int maxSoilValue = 4095;  // Driest value (0% humidity)
  bool isCalibrating = false;
  unsigned long calibrationStartTime = 0;
  int previousReading = 0;
  int lowestValue = 4095;  // Track lowest value during watering event
} sensorCalibration;

// Function declarations
void setupWiFi();
void calibrateSoilSensor();
int getRawSoilHumidity();
void detectWateringEvent(int currentReading);
void saveCalibrationValues();
void loadCalibrationValues();
bool sendDataToServer(const JsonDocument& data);
void indicateStatus(int blinks, int duration);

void setup() {
  Serial.begin(115200);
  
  pinMode(LED_STATUS_PIN, OUTPUT);
  
  dht.begin();
  EEPROM.begin(EEPROM_SIZE);
  loadCalibrationValues();
  setupWiFi();
  
  indicateStatus(3, 200);
}

void setupWiFi() {
  Serial.print("Connecting to Wi-Fi");
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConnected to Wi-Fi");
    indicateStatus(1, 1000);
  } else {
    Serial.println("\nWi-Fi connection failed!");
    indicateStatus(5, 100);
  }
}

int getRawSoilHumidity() {
  // Take average of multiple readings for stability
  int sum = 0;
  for (int i = 0; i < 5; i++) {
    sum += analogRead(SOIL_SENSOR_PIN);
    delay(50);
  }
  return sum / 5;
}

void detectWateringEvent(int currentReading) {
  // Detect sudden decrease in reading (water addition)
  if (currentReading < sensorCalibration.previousReading * DETECTION_THRESHOLD) {
    sensorCalibration.isCalibrating = true;
    sensorCalibration.calibrationStartTime = millis();
    sensorCalibration.lowestValue = currentReading;
    Serial.println("Watering event detected! Starting calibration...");
  } else if (sensorCalibration.isCalibrating && currentReading < sensorCalibration.lowestValue) {
    // Keep tracking the lowest value during the watering event
    sensorCalibration.lowestValue = currentReading;
  }
  
  sensorCalibration.previousReading = currentReading;
}

void calibrateSoilSensor() {
  if (!sensorCalibration.isCalibrating) return;
  
  unsigned long currentTime = millis();
  if (currentTime - sensorCalibration.calibrationStartTime >= STABILIZATION_TIME) {
    // After stabilization time, set new calibration values
    int newMinValue = sensorCalibration.lowestValue;
    int newMaxValue = sensorCalibration.previousReading;
    
    // Add safety margins
    sensorCalibration.minSoilValue = max(1, newMinValue - 50);  // Wettest value with margin
    sensorCalibration.maxSoilValue = min(3600, newMaxValue + 900);  // Driest value with margin
    
    saveCalibrationValues();
    sensorCalibration.isCalibrating = false;
    
    Serial.println("Calibration complete!");
    Serial.printf("New range: %d (100%%) to %d (0%%)\n", 
                 sensorCalibration.minSoilValue, 
                 sensorCalibration.maxSoilValue);
    
    indicateStatus(2, 500);
  }
}

void saveCalibrationValues() {
  EEPROM.writeInt(ADDR_MIN_SOIL, sensorCalibration.minSoilValue);
  EEPROM.writeInt(ADDR_MAX_SOIL, sensorCalibration.maxSoilValue);
  EEPROM.commit();
}

void loadCalibrationValues() {
  sensorCalibration.minSoilValue = EEPROM.readInt(ADDR_MIN_SOIL);
  sensorCalibration.maxSoilValue = EEPROM.readInt(ADDR_MAX_SOIL);
  
  // Validate loaded values
  if (sensorCalibration.minSoilValue < 1 || 
      sensorCalibration.maxSoilValue > 4095 ||
      sensorCalibration.minSoilValue >= sensorCalibration.maxSoilValue) {
    // Use defaults if values are invalid
    sensorCalibration.minSoilValue = 1;
    sensorCalibration.maxSoilValue = 4095;
  }
}

bool sendDataToServer(const JsonDocument& data) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi not connected!");
    return false;
  }

  HTTPClient http;
  String urlWithKey = String(serverUrl) + "?key=" + apiKey;
  http.begin(urlWithKey);
  http.addHeader("Content-Type", "application/json");
  
  String payload;
  serializeJson(data, payload);
  
  int httpResponseCode = http.POST(payload);
  bool success = httpResponseCode > 0;
  
  if (success) {
    Serial.println("Data sent successfully!");
    Serial.println("Response: " + http.getString());
  } else {
    Serial.println("Error sending data. HTTP Response code: " + String(httpResponseCode));
  }
  
  http.end();
  return success;
}

void indicateStatus(int blinks, int duration) {
  for (int i = 0; i < blinks; i++) {
    digitalWrite(LED_STATUS_PIN, HIGH);
    delay(duration);
    digitalWrite(LED_STATUS_PIN, LOW);
    delay(duration);
  }
}

void loop() {
  // Read sensors
  int rawSoilHumidity = getRawSoilHumidity();
  detectWateringEvent(rawSoilHumidity);
  calibrateSoilSensor();
  
  // Map soil humidity to percentage (inverted mapping since lower value = higher humidity)
  int soilHumidity = constrain(rawSoilHumidity, 
                             sensorCalibration.minSoilValue, 
                             sensorCalibration.maxSoilValue);
  soilHumidity = map(soilHumidity, 
                    sensorCalibration.maxSoilValue,  // High value (dry) maps to 0%
                    sensorCalibration.minSoilValue,  // Low value (wet) maps to 100%
                    0, 100);
  
  // Read DHT sensor
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  
  // Check if readings are valid
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("Failed to read from DHT sensor!");
    indicateStatus(4, 200);
    return;
  }
  
  // Create JSON document for data
  StaticJsonDocument<200> doc;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["soil_humidity"] = soilHumidity;
  doc["raw_soil_reading"] = rawSoilHumidity;
  doc["is_calibrating"] = sensorCalibration.isCalibrating;
  
  // Print values to Serial Monitor
  Serial.printf("Soil Humidity: %d%% (Raw: %d), Temperature: %.1f°C, Humidity: %.1f%%\n",
                soilHumidity, rawSoilHumidity, temperature, humidity);
  
  // Send data to server
  if (sendDataToServer(doc)) {
    indicateStatus(1, 100);
  }
  
  delay(60000);  // 1 minute delay between readings
}