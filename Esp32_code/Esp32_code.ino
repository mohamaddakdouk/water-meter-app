#include <WiFi.h>
#include <PubSubClient.h>
#include <Preferences.h>

//System Configuration
const char* ssid = "Nokia";
const char* password = "123456789";
const char* mqtt_server = "broker.hivemq.com"; 
const int mqtt_port = 1883;
const char* DEVICE_ID = "101"; 

//pins
#define FLOW_PIN 14  // water flow Sensor
#define TURB_PIN 34  // Turbidity Sensor

//Global Objects
WiFiClient espClient;
PubSubClient client(espClient);
Preferences preferences; 

//Variables
volatile unsigned long pulseCount = 0;
unsigned long totalPulses = 0;
float calibrationFactor = 417.0; 
volatile unsigned long lastInterruptTime = 0;
unsigned long lastMqttPulse = 0;
unsigned long lastSave = 0;

// INTERRUPT:water flow pulses in real-time
void IRAM_ATTR pulseCounter() {
  unsigned long interruptTime = millis();
  if (interruptTime - lastInterruptTime > 5) { // Noise filter 
    pulseCount++;
    lastInterruptTime = interruptTime;
  }
}

// WIFI: loop untill connection
void connectToWiFi() {
  Serial.print("\n[WiFi] Connecting...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }
  Serial.println("\n[WiFi] Connected.");
  client.setServer(mqtt_server, mqtt_port);
}

// MQTT: Handles reconnection to the broker 
void reconnectMQTT() {
  while (!client.connected() && WiFi.status() == WL_CONNECTED) {
    Serial.println("[MQTT] Connecting...");
    if (client.connect(DEVICE_ID)) {
      Serial.println("[MQTT] Connected successfully.");
    } else {
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(9600);
  
  // Pin Setup & Interrupt Attachment
  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), pulseCounter, FALLING);
  pinMode(TURB_PIN, INPUT);

  // Get data from Flash memory
  preferences.begin("water", false);
  totalPulses = preferences.getUInt("totalPulses", 0);
  
  connectToWiFi();
}

void loop() {
  // 1. Maintain Network Connectivity
  if (WiFi.status() != WL_CONNECTED) connectToWiFi();
  if (!client.connected()) reconnectMQTT();
  client.loop();

  // 2. Send interrupt to main counter
  noInterrupts();
  totalPulses += pulseCount;
  pulseCount = 0;
  interrupts();

  float totalLiters = (float)totalPulses / calibrationFactor; //calibrationFactor=417

  // 3. Sensor Sampling 
  if (millis() - lastMqttPulse > 1000) {
    // Average 10 Turbidity samples for stability
    float sum = 0;
    for(int i=0; i<10; i++) { sum += (float)analogRead(TURB_PIN); delay(5); }
    float voltage = (sum / 10.0) * (3.3 / 4095.0);

    // Create JSON Payload
    String payload = "{\"meterID\":\"" + String(DEVICE_ID) + "\",";
    payload += "\"totalLiters\":" + String(totalLiters, 2) + ",";
    payload += "\"turbidity\":" + String(voltage, 2) + "}";

    client.publish("home/water/meter", payload.c_str());
    Serial.println("Data to mqtt sended : " + payload);
    lastMqttPulse = millis();
  }

  // 4.backup to Flash every 1 sec
  if (millis() - lastSave > 1000) {
    preferences.putUInt("totalPulses", totalPulses);
    lastSave = millis();
  }
}

