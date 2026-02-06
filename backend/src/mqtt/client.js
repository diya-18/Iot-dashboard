const mqtt = require('mqtt');
const Device = require('../models/Device');
const Parameter = require('../models/Parameter');
const Telemetry = require('../models/Telemetry');
const alertEngine = require('../services/alertEngine');

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com';
const MQTT_PORT = process.env.MQTT_PORT || 1883;
const CLIENT_ID = process.env.MQTT_CLIENT_ID || `iot_backend_${Math.random().toString(16).slice(2, 8)}`;

// 🔐 Unique namespace to avoid public broker noise
const BASE_TOPIC = "diya/iot-dashboard";

const TOPICS = [
  `${BASE_TOPIC}/devices/+/telemetry`,
  `${BASE_TOPIC}/devices/+/status`,
  `${BASE_TOPIC}/devices/register`
];

// Connect to MQTT Broker
const client = mqtt.connect(MQTT_BROKER_URL, {
  port: MQTT_PORT,
  clientId: CLIENT_ID,
  clean: true,
  reconnectPeriod: 5000,
  connectTimeout: 30000,
});

client.on('connect', () => {
  console.log('✅ MQTT Client connected');

  TOPICS.forEach(topic => {
    client.subscribe(topic, (err) => {
      if (err) console.error(`❌ Failed to subscribe to ${topic}:`, err);
      else console.log(`📡 Subscribed to: ${topic}`);
    });
  });
});

client.on('message', async (topic, message) => {
  // 🛡️ SAFE JSON parsing (prevents crash from random broker messages)
  let payload;
  try {
    payload = JSON.parse(message.toString());
  } catch {
    console.log("⚠️ Ignored non-JSON MQTT message:", message.toString());
    return;
  }

  try {
    const topicParts = topic.split('/');
    // topic format: diya/iot-dashboard/devices/<serial>/<type>
    const serialNumber = topicParts[3];
    const messageType = topicParts[4];

    console.log(`📨 MQTT ${messageType} from ${serialNumber}`);

    if (topic === `${BASE_TOPIC}/devices/register`) {
      await handleRegistration(payload);
      return;
    }

    switch (messageType) {
      case 'telemetry':
        await handleTelemetry(serialNumber, payload);
        break;
      case 'status':
        await handleStatus(serialNumber, payload);
        break;
    }

  } catch (error) {
    console.error('❌ Error processing MQTT message:', error.message);
  }
});

async function handleTelemetry(serialNumber, payload) {
  try {
    if (!Device.validateSerialNumber(serialNumber)) return;

    const device = await Device.findOne({ serialNumber });
    if (!device || !device.enabled) return;

    const { timestamp, ...telemetryData } = payload;
    if (!Object.keys(telemetryData).length) return;

    const parameters = await Parameter.getDeviceParameters(device._id);

    for (const param of parameters) {
      const value = telemetryData[param.name];
      if (value !== undefined) param.validateValue(value);
    }

    const telemetry = await Telemetry.storeTelemetry({
      deviceId: device._id,
      serialNumber,
      timestamp: timestamp || new Date(),
      telemetryData,
      quality: 'good',
      metadata: { source: 'mqtt', mqttTopic: topic }
    });

    await device.updateLastSeen();
    await alertEngine.checkThresholds(device._id, serialNumber, telemetryData);

    if (global.io) {
      global.io.emit('telemetry', {
        serialNumber,
        deviceId: device._id,
        data: telemetry
      });
    }

    console.log(`✅ Telemetry stored for ${serialNumber}`);

  } catch (error) {
    console.error('❌ Telemetry error:', error.message);
  }
}

async function handleStatus(serialNumber, payload) {
  try {
    if (!Device.validateSerialNumber(serialNumber)) return;

    const device = await Device.findOne({ serialNumber });
    if (!device) return;

    device.status = payload.status || 'online';
    device.lastSeen = new Date();
    await device.save();

    if (global.io) {
      global.io.emit('deviceStatus', {
        serialNumber,
        status: device.status,
        lastSeen: device.lastSeen
      });
    }

    console.log(`✅ Status updated: ${serialNumber} -> ${device.status}`);

  } catch (error) {
    console.error('❌ Status error:', error.message);
  }
}

async function handleRegistration(payload) {
  try {
    const { serialNumber } = payload;
    if (!Device.validateSerialNumber(serialNumber)) return;

    const device = await Device.findOne({ serialNumber });
    if (!device) return;

    device.status = 'online';
    device.lastSeen = new Date();
    await device.save();

    console.log(`✅ Device online: ${serialNumber}`);

  } catch (error) {
    console.error('❌ Registration error:', error.message);
  }
}

client.on('error', err => console.error('❌ MQTT Error:', err.message));
client.on('reconnect', () => console.log('🔄 MQTT reconnecting...'));
client.on('close', () => console.log('🔌 MQTT disconnected'));

module.exports = client;
