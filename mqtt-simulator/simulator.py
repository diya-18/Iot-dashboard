import paho.mqtt.client as mqtt
import json
import time
import random
from datetime import datetime

# MQTT Configuration
BROKER = "broker.hivemq.com"
PORT = 1883
CLIENT_ID = f"iot_simulator_{random.randint(1000, 9999)}"

# Device configurations with 10-digit serial numbers
DEVICES = [
    {
        "serialNumber": "1234567890",
        "name": "Temperature Sensor - Warehouse A",
        "deviceType": "temperature_sensor",
        "parameters": ["temperature", "humidity"]
    },
    {
        "serialNumber": "1234567891",
        "name": "Multi Sensor - Office",
        "deviceType": "multi_sensor",
        "parameters": ["temperature", "humidity", "pressure"]
    },
    {
        "serialNumber": "1234567892",
        "name": "Smart Meter - Building 1",
        "deviceType": "smart_meter",
        "parameters": ["power", "voltage", "current"]
    }
]

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Connected to MQTT Broker!")
        print("\n⚠️  IMPORTANT: Devices must be registered manually via dashboard")
        print("Serial Numbers to register:")
        for device in DEVICES:
            print(f"  - {device['serialNumber']} ({device['name']})")
        print("\nStarting telemetry simulation...\n")
    else:
        print(f"❌ Failed to connect, return code {rc}")

def on_publish(client, userdata, mid):
    pass  # Silent to reduce console spam

def generate_sensor_data(parameters):
    """Generate random sensor data based on parameters"""
    data = {}
    
    for param in parameters:
        if param == "temperature":
            data[param] = round(random.uniform(15.0, 35.0), 2)
        elif param == "humidity":
            data[param] = round(random.uniform(30.0, 80.0), 2)
        elif param == "pressure":
            data[param] = round(random.uniform(980.0, 1040.0), 2)
        elif param == "power":
            data[param] = round(random.uniform(100.0, 500.0), 2)
        elif param == "voltage":
            data[param] = round(random.uniform(220.0, 240.0), 2)
        elif param == "current":
            data[param] = round(random.uniform(1.0, 10.0), 2)
    
    return data

def publish_telemetry(client, device):
    """Publish telemetry data for a device"""
    topic = f"iot/devices/{device['serialNumber']}/telemetry"
    
    # DRD-compliant payload format
    payload = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        **generate_sensor_data(device["parameters"])
    }
    
    client.publish(topic, json.dumps(payload), qos=1)
    
    # Display telemetry
    data_str = ", ".join([f"{k}={v}" for k, v in payload.items() if k != "timestamp"])
    print(f"📊 [{device['serialNumber']}] {data_str}")

def publish_status(client, device):
    """Publish device status"""
    topic = f"iot/devices/{device['serialNumber']}/status"
    
    payload = {
        "status": "online",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    
    client.publish(topic, json.dumps(payload), qos=1)

def main():
    # Create MQTT client
    client = mqtt.Client(CLIENT_ID)
    client.on_connect = on_connect
    client.on_publish = on_publish
    
    # Connect to broker
    print(f"🔌 Connecting to MQTT Broker: {BROKER}:{PORT}")
    client.connect(BROKER, PORT, 60)
    
    # Start network loop in background
    client.loop_start()
    
    # Give time for connection
    time.sleep(2)
    
    print("\n🚀 Starting telemetry simulation...")
    print("Press Ctrl+C to stop\n")
    
    try:
        iteration = 0
        while True:
            iteration += 1
            
            if iteration % 10 == 1:
                print(f"\n--- Iteration {iteration} ---")
            
            # Publish data from all devices
            for device in DEVICES:
                publish_telemetry(client, device)
                
                # Occasionally publish status
                if iteration % 20 == 0:
                    publish_status(client, device)
                
                time.sleep(0.3)
            
            # Wait before next iteration
            time.sleep(10)
            
    except KeyboardInterrupt:
        print("\n\n🛑 Stopping simulator...")
        client.loop_stop()
        client.disconnect()
        print("✅ Disconnected from MQTT Broker")

if __name__ == "__main__":
    print("""
╔═══════════════════════════════════════════════════════════╗
║                     IoT DEVICE SIMULATOR                  ║
╚═══════════════════════════════════════════════════════════╝

SETUP INSTRUCTIONS:
1. First, register these devices via the dashboard:
   - Serial: 1234567890 (Temperature Sensor)
   - Serial: 1234567891 (Multi Sensor)
   - Serial: 1234567892 (Smart Meter)

2. Run this simulator to send telemetry data

3. Watch real-time updates on the dashboard

""")
    
    input("Press Enter to start simulator...")
    main()