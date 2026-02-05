const mqtt = require('mqtt');
const Device = require('../models/Device');
const Parameter = require('../models/Parameter');
const Telemetry = require('../models/Telemetry');
const alertEngine = require('../services/alertEngine');

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com';
const MQTT_PORT = process.env.MQTT_PORT || 1883;
const CLIENT_ID = process.env.MQTT_CLIENT_ID || `iot_backend_${Math.random().toString(16).slice(2, 8)}`;

// Connect to MQTT Broker
const client = mqtt.connect(MQTT_BROKER_URL, {
  port: MQTT_PORT,
  clientId: CLIENT_ID,
  clean: true,
  reconnectPeriod: 5000,
  connectTimeout: 30000,
});

// Topic patterns
const TOPICS = [
  'iot/devices/+/telemetry',
  'iot/devices/+/status',
  'iot/devices/register'
];

client.on('connect', () => {
  console.log('✅ MQTT Client connected');
  
  TOPICS.forEach(topic => {
    client.subscribe(topic, (err) => {
      if (err) {
        console.error(`❌ Failed to subscribe to ${topic}:`, err);
      } else {
        console.log(`📡 Subscribed to: ${topic}`);
      }
    });
  });
});

client.on('message', async (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    console.log(`📨 Received on ${topic}:`, payload);

    const topicParts = topic.split('/');
    const messageType = topicParts[3];
    const serialNumber = topicParts[2];

    switch (messageType) {
      case 'telemetry':
        await handleTelemetry(serialNumber, payload);
        break;
      case 'status':
        await handleStatus(serialNumber, payload);
        break;
      default:
        if (topic === 'iot/devices/register') {
          await handleRegistration(payload);
        }
    }
  } catch (error) {
    console.error('❌ Error processing MQTT message:', error.message);
  }
});

async function handleTelemetry(serialNumber, payload) {
  try {
    // Validate serial number format
    if (!Device.validateSerialNumber(serialNumber)) {
      console.error(`❌ Invalid serial number format: ${serialNumber}`);
      return;
    }

    // Find device
    const device = await Device.findOne({ serialNumber });
    
    if (!device) {
      console.error(`❌ Device not found: ${serialNumber}`);
      return;
    }

    if (!device.enabled) {
      console.warn(`⚠️  Device disabled: ${serialNumber}`);
      return;
    }

    // Validate payload structure
    const { timestamp, ...telemetryData } = payload;
    
    if (!telemetryData || Object.keys(telemetryData).length === 0) {
      console.error('❌ Empty telemetry data');
      return;
    }

    // Get device parameters for validation
    const parameters = await Parameter.getDeviceParameters(device._id);
    
    // Validate each parameter value
    for (const param of parameters) {
      const value = telemetryData[param.name];
      
      if (value !== undefined && value !== null) {
        const validation = param.validateValue(value);
        if (!validation.valid) {
          console.warn(`⚠️  Validation failed for ${param.name}: ${validation.error}`);
        }
      }
    }

    // Store telemetry
    const telemetry = await Telemetry.storeTelemetry({
      deviceId: device._id,
      serialNumber,
      timestamp: timestamp || new Date(),
      telemetryData,
      quality: 'good',
      metadata: {
        source: 'mqtt',
        mqttTopic: `iot/devices/${serialNumber}/telemetry`
      }
    });

    // Update device last seen
    await device.updateLastSeen();

    // Check alert thresholds
    await alertEngine.checkThresholds(device._id, serialNumber, telemetryData);

    // Emit to Socket.io clients
    if (global.io) {
      global.io.emit('telemetry', {
        serialNumber,
        deviceId: device._id,
        data: telemetry
      });
    }

    console.log(`✅ Telemetry stored for device: ${serialNumber}`);
  } catch (error) {
    console.error('❌ Error handling telemetry:', error.message);
  }
}

async function handleStatus(serialNumber, payload) {
  try {
    if (!Device.validateSerialNumber(serialNumber)) {
      return;
    }

    const device = await Device.findOne({ serialNumber });
    
    if (device) {
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
    }
  } catch (error) {
    console.error('❌ Error handling status:', error.message);
  }
}

async function handleRegistration(payload) {
  try {
    const { serialNumber, name, deviceType, location, metadata } = payload;
    
    // Validate serial number
    if (!Device.validateSerialNumber(serialNumber)) {
      console.error(`❌ Invalid serial number in registration: ${serialNumber}`);
      return;
    }

    // Check if device exists
    let device = await Device.findOne({ serialNumber });
    
    if (!device) {
      // Device doesn't exist - auto-registration not allowed in DRD
      console.warn(`⚠️  Auto-registration attempt for: ${serialNumber}`);
      console.warn('Devices must be manually registered by admin');
      return;
    }

    // Device exists, just update status
    device.status = 'online';
    device.lastSeen = new Date();
    await device.save();
    
    console.log(`✅ Device came online: ${serialNumber}`);
  } catch (error) {
    console.error('❌ Error handling registration:', error.message);
  }
}

function publishMessage(topic, message) {
  const payload = typeof message === 'string' ? message : JSON.stringify(message);
  client.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error(`❌ Failed to publish to ${topic}:`, err);
    } else {
      console.log(`✅ Published to ${topic}`);
    }
  });
}

client.on('error', (error) => {
  console.error('❌ MQTT Client error:', error.message);
});

client.on('reconnect', () => {
  console.log('🔄 MQTT Client reconnecting...');
});

client.on('close', () => {
  console.log('🔌 MQTT Client disconnected');
});

module.exports = client;
module.exports.publishMessage = publishMessage;