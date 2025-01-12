#include <Arduino.h>
#include <WiFi.h>  // For ESP32 WiFi support
#include <HTTPClient.h> // For HTTP POST requests
#include <DHT.h>

// WiFi credentials
const char* ssid = "red";
const char* password = "acted";

// Backend server details
const char* serverUrl = "http://192.168.178.23:5000/upload_sensor_data"; // Adjust to your backend IP
const char* apiKey = "123abc"; // Backend API key

// Constants
#define DHTPIN 32
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);
const int hygrometer = 33;

// Variables
float temperature;
float humidity;
int soilHumidity;

void setup() {
  Serial.begin(9600);

  // Initialize sensors
  dht.begin();

  // Connect to Wi-Fi
  Serial.print("Connecting to Wi-Fi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to Wi-Fi");
}

void sendDataToServer(float temperature, float humidity, int soilHumidity) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
	// Add API key to the URL
    String urlWithKey = String(serverUrl) + "?key=" + apiKey;
    http.begin(urlWithKey);
    http.addHeader("Content-Type", "application/json");

    // Prepare the JSON payload
    String payload = "{";
    payload += "\"temperature\": " + String(temperature) + ",";
    payload += "\"humidity\": " + String(humidity) + ",";
    payload += "\"soil_humidity\": " + String(soilHumidity);
    payload += "}";

    

    // Send the POST request
    int httpResponseCode = http.POST(payload);

    // Check the response
    if (httpResponseCode > 0) {
      Serial.println("Data sent successfully!");
      Serial.println("Response: " + http.getString());
    } else {
      Serial.println("Error sending data. HTTP Response code: " + String(httpResponseCode));
    }

    http.end();
  } else {
    Serial.println("Wi-Fi not connected!");
  }
}

String getCurrentTimestamp() {
  // For simplicity, return a placeholder timestamp
  // In real implementation, you may use an RTC module or NTP for accurate time
  return "2025-01-11T10:30:00"; // Example timestamp
}

void loop() {
  // Read soil humidity
  soilHumidity = analogRead(hygrometer);
  soilHumidity = constrain(soilHumidity, 400, 1023);
  soilHumidity = map(soilHumidity, 400, 1023, 100, 0);

  // Read DHT sensor values
  humidity = dht.readHumidity();
  temperature = dht.readTemperature();

  // Print values to Serial Monitor
  Serial.print("Soil Humidity: ");
  Serial.print(soilHumidity);
  Serial.print("%, Temperature: ");
  Serial.print(temperature);
  Serial.print("°C, Humidity: ");
  Serial.print(humidity);
  Serial.println("%");

  // Send data to the server
  sendDataToServer(temperature, humidity, soilHumidity);

  // Delay before the next reading
  delay(60000); // 1 minute delay
}
