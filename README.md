# 💧 SmartStream — IoT Smart Water Meter System

> An IoT-based smart water monitoring platform that tracks real-time water consumption and quality, with automated billing and dual dashboards for consumers and administrators.

**Senior Project — Bachelor of Science in Computer and Communication Engineering**  
Lebanese International University — Fall 2024–2025  
**Authors:** Mohamad Ali Dakdouk · Ali Hussien Al Delbani  
**Supervisors:** Dr. Mohamad Raad · Dr. Rida El Chall

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Hardware Components](#hardware-components)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Sensor Equations](#sensor-equations)
- [Test Cases](#test-cases)
- [Future Work](#future-work)
- [License](#license)

---

## Overview

SmartStream replaces traditional manual water meters with a fully connected IoT system. An ESP32 microcontroller reads data from a water flow sensor and a turbidity sensor, then transmits it wirelessly to a Node.js backend. Users and administrators access the data through a React.js web dashboard that provides real-time monitoring, usage analytics, water quality alerts, and automated electronic billing.

---

## Features

### 👤 Consumer Dashboard
- Real-time water consumption display (in liters)
- Live turbidity / water quality status
- Daily and monthly usage analytics charts
- Electronic bill viewing and payment
- Push notifications for abnormal turbidity or new invoices

### 🛠️ Admin Dashboard
- Register, manage, and delete user accounts
- Monitor all smart meters simultaneously
- View per-user consumption analytics
- Generate and distribute PDF invoices
- System-wide alerts overview

### ⚙️ Core System
- Real-time data collection via ESP32 + sensors
- Wireless transmission over Wi-Fi using MQTT protocol
- Automated monthly bill generation
- Abnormal usage and turbidity alert engine
- JWT-based authentication with encrypted passwords

---

## System Architecture

```
┌─────────────────────┐        MQTT         ┌──────────────────────┐
│     IoT Layer       │ ─────────────────▶  │    Backend (Node.js) │
│                     │                     │    + Express.js       │
│  ESP32 + Sensors    │                     │    + MQTT Bridge      │
│  (Wi-Fi / GSM /     │                     └──────────┬───────────┘
│   LoRaWAN)          │                                │
└─────────────────────┘                                │ REST API
                                                       ▼
                                          ┌─────────────────────────┐
                                          │     MongoDB Database    │
                                          │  Users · Readings ·     │
                                          │  Bills · Alerts         │
                                          └──────────┬──────────────┘
                                                     │
                                          ┌──────────▼──────────────┐
                                          │   React.js Frontend     │
                                          │  User Dashboard         │
                                          │  Admin Dashboard        │
                                          └─────────────────────────┘
```

---

## Hardware Components

| Component | Qty | Purpose |
|---|---|---|
| ESP32 Development Board | 1 | Main microcontroller; handles sensor data, Wi-Fi, and MQTT |
| Water Flow Sensor | 1 | Measures flow rate and calculates total consumption (GPIO 14) |
| Turbidity Sensor | 1 | Monitors water quality and detects contamination (GPIO 34) |
| Level Converter (Logic Shifter) | 1 | Converts 5V sensor signals to 3.3V for ESP32 safety |
| 5V Power Adapter | 1 | Powers ESP32 and connected components |
| PCB Board | 1 | Circuit prototyping and stable connections |
| Jumper Wires | — | Connects all components |
| Water Pipes & Connectors | 1 set | Routes water through the flow sensor |

**Approximate cost:** ~$40 (local prototype) · ~$15–24/unit (mass production)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Microcontroller Firmware | C++ · Arduino IDE |
| Backend | Node.js · Express.js |
| Database | MongoDB · MongoDB Compass |
| Frontend | React.js · HTML · CSS · JavaScript |
| IoT Communication | MQTT (HiveMQ / EMQX Cloud) |
| Auth & Security | JWT · bcrypt |
| PDF Invoicing | pdfkit |
| IDE | Visual Studio Code |

---

## Getting Started

### Prerequisites

| Software | Version |
|---|---|
| Node.js | v18 or later |
| npm | v9 or later |
| MongoDB | v6 or later |
| Arduino IDE | v2 or later |
| MQTT Broker | HiveMQ Cloud / EMQX Cloud |

### 1. Clone the Repository

```bash
git clone https://github.com/mohamaddakdouk/water-meter-app.git
cd water-meter-app
```

### 2. Install Dependencies & Start Backend

```bash
cd server
npm install
# Installs: express, mongoose, mqtt, jsonwebtoken, cors, bcrypt, dotenv, pdfkit
```

### 3. Start the MQTT Bridge

```bash
node bridge.cjs
```

### 4. Start the Frontend

```bash
npm install
npm run frontend    # Development server at http://localhost:5173
npm run build       # Production build
```

### 5. Run Everything Together

```bash
cd water-meter-app
npm run dev         # Starts backend + frontend concurrently
```

### 6. Start MongoDB

```bash
mongod
# Database name: smart_water_meter
```

---

## Configuration

### ESP32 Firmware

Before flashing, update the following in the firmware sketch:

```cpp
// Wi-Fi credentials
const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// MQTT Broker
const char* mqttBroker = "YOUR_BROKER_URL";
const int   mqttPort   = 8883;

// Device Identity
const char* meterID = "YOUR_UNIQUE_METER_ID";

// GPIO Pins
#define FLOW_SENSOR_PIN     14
#define TURBIDITY_SENSOR_PIN 34
```

### Environment Variables (Backend)

Create a `.env` file in `/server`:

```env
MONGO_URI=mongodb://localhost:27017/smart_water_meter
JWT_SECRET=your_jwt_secret
MQTT_BROKER=your_broker_url
MQTT_USERNAME=your_broker_username
MQTT_PASSWORD=your_broker_password
```

---

## Project Structure

```
water-meter-app/
├── server/
│   ├── server.cjs          # Main Node.js / Express backend
│   ├── bridge.cjs          # MQTT-to-backend bridge
│   ├── models/             # Mongoose schemas (User, Admin, SensorReading, Bill, Alert)
│   └── routes/             # API route handlers
├── src/
│   ├── components/         # Reusable React components
│   ├── pages/
│   │   ├── UserDashboard/  # Home, Usage Analytics
│   │   └── AdminDashboard/ # Users, Meters, Billing, Alerts
│   └── App.jsx
├── esp32/
│   └── firmware.ino        # Arduino / C++ ESP32 sketch
├── .env
└── package.json
```

---

## Sensor Equations

### Flow Sensor (Water Consumption)

```
TotalLiters = TotalPulses / CalibrationFactor
```
- `CalibrationFactor` = **417 pulses per liter** for this sensor model

### Turbidity Sensor (Water Quality)

The analog output voltage (0–3.3V) is mapped to quality categories:

| Voltage Range | Water Quality |
|---|---|
| > 1.65 V | ✅ Very Clean |
| > 1.58 V | 🟢 Clean |
| > 1.55 V | 🟡 Slightly Cloudy |
| > 1.30 V | 🟠 Cloudy |
| ≤ 1.30 V | 🔴 Very Dirty |

### Billing

```
TotalAmount = MonthlyConsumption (L) × PricePerLiter (set by admin)
```

---

## Test Cases

All 10 test cases passed successfully:

| ID | Title | Result |
|---|---|---|
| TC-01 | User Login | ✅ Passed |
| TC-02 | Admin Login | ✅ Passed |
| TC-03 | Sensor Data Transmission | ✅ Passed (after fixing disconnected wire) |
| TC-04 | Real-Time Data Display | ✅ Passed (after MQTT reconnection) |
| TC-05 | Usage Reports | ✅ Passed |
| TC-06 | Turbidity Alert | ✅ Passed |
| TC-07 | Bill Generation | ✅ Passed |
| TC-08 | Manage Users | ✅ Passed |
| TC-09 | Database Storage | ✅ Passed |
| TC-10 | Sensor Parameter Test | ✅ Passed |

---

## Troubleshooting

| Issue | Likely Cause | Solution |
|---|---|---|
| ESP32 not detected by PC | Missing USB driver | Install CP2102 driver |
| COM port error | Port conflict | Close Serial Monitor before uploading |
| No sensor data arriving | Wiring issue | Check GPIO 14 and GPIO 34 connections |
| Incorrect flow readings | Calibration mismatch | Adjust `CalibrationFactor` in firmware |
| MQTT not receiving data | Wrong broker config | Verify broker URL, port, and topic names |
| Bridge not forwarding | Service not running | Run `node bridge.cjs` again |
| MongoDB connection failed | Service stopped | Restart MongoDB with `mongod` |

---

## Future Work

- 📡 LoRaWAN support for long-range, low-power deployments
- 📱 Native mobile app (Android & iOS)
- 💳 Integrated online payment gateway
- 🔍 Smart leak detection with automated alerts
- 🌡️ Additional sensors: pH, pressure, temperature, conductivity
- 📍 Location tracking for meters on an admin map view
- ⚡ Self-powered turbines inside pipelines for energy harvesting
- 🔐 Enhanced security: end-to-end encryption, 2FA

---

## References

Full references are available in the project report (`CENG495_CCE_Final_Report.pdf`).  
Key standards followed: ISO 24510 · ISO/IEC 27001 · WCAG · MQTT · IEEE Wireless

---

## Source Code

🔗 **GitHub:** https://github.com/mohamaddakdouk/water-meter-app
