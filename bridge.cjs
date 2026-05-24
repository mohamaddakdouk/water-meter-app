

const mqtt = require('mqtt');
const { MongoClient } = require('mongodb');

// Broker and database connection settings
const MQTT_BROKER = 'mqtt://broker.hivemq.com';
const MQTT_TOPIC = 'home/water/meter';
const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'smart_water_meter';

// 30-minute cooldown for repeated alerts
const ALERT_COOLDOWN = 30 * 60 * 1000; 

async function startBridge() {
    // Connect to local MongoDB
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const readingsCol = db.collection('sensor_readings');
    const alertsCol = db.collection('alerts');
    
    console.log("Connected to MongoDB.");

    // Connect to the MQTT broker
    const mqttClient = mqtt.connect(MQTT_BROKER, {
        clientId: 'water_meter_backend_' + Math.random().toString(16).substr(2, 8),
        clean: true
    });

    mqttClient.on('connect', () => {
        console.log("Connected to MQTT Broker.");
        mqttClient.subscribe(MQTT_TOPIC);
    });
    
    mqttClient.on('error', (err) => {
    console.log("MQTT Error:", err.message);
});

    // Handle incoming MQTT messages from the water meter
    mqttClient.on('message', async (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            const voltage = data.turbidity;
            const now = new Date();

            // Label the water quality based on the sensor voltage
            let waterQuality = "";
            if (voltage > 1.65) waterQuality = "Very Clean";
            else if (voltage > 1.58) waterQuality = "Clean";
            else if (voltage > 1.55) waterQuality = "Slightly Cloudy";
            else if (voltage > 1.3)  waterQuality = "Cloudy";
            else                     waterQuality = "Very Dirty";

            // Insert the sensor reading into the database
            await readingsCol.insertOne({
                meterID: data.meterID,
                totalLiters: data.totalLiters,
                turbidity: voltage,
                quality: waterQuality,
                timestamp: now
            });
            console.log(`New Reading: ${voltage}V | ${waterQuality}`);

            // If turbidity is in the dirty range, decide whether to save a new alert
            if (voltage <= 1.55) {
                // Load the most recent alert for this meter
                const lastAlert = await alertsCol.findOne(
                    { meterID: data.meterID },
                    { sort: { timestamp: -1 } }
                );

                let sendNewAlert = false;
                if (!lastAlert) {
                    sendNewAlert = true; // No previous alerts exist
                } else {
                    const lastTime = new Date(lastAlert.timestamp).getTime();
                    // Only send a new alert after the cooldown period
                    if (now.getTime() - lastTime > ALERT_COOLDOWN) {
                        sendNewAlert = true; 
                    }
                }

                if (sendNewAlert) {
                    await alertsCol.insertOne({
                        meterID: data.meterID,
                        message: `High turbidity detected: ${waterQuality}`,
                        timestamp: now
                    });
                    console.log(`Alert saved: ${waterQuality}`);
                }
            }
        } catch (err) {
            console.log("Error reading data:", err.message);
        }
    });
}

startBridge();
