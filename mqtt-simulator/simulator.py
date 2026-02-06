import paho.mqtt.client as mqtt
import json
import time
import random
from datetime import datetime

# MQTT Configuration
BROKER = "broker.hivemq.com"
PORT = 1883
CLIENT_ID = f"iot_simulator_{random.randint(1000, 9999)}"

# 🔐 MUST match backend BASE_TOPIC
BASE_TOPIC = "diya/iot-dashboard"

DEVICES = [
    {"serialNumber": "1234567890", "parameters": ["temperature","humidity"]},
    {"serialNumber": "1234567891", "parameters": ["temperature","humidity","pressure"]},
    {"serialNumber": "1234567892", "parameters": ["power","voltage","current"]}
]

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Connected to MQTT Broker")
        print("Publishing to namespace:", BASE_TOPIC)
    else:
        print("❌ MQTT connection failed")

def generate_sensor_data(parameters):
    data = {}
    for p in parameters:
        if p == "temperature": data[p] = round(random.uniform(15,35),2)
        if p == "humidity": data[p] = round(random.uniform(30,80),2)
        if p == "pressure": data[p] = round(random.uniform(980,1040),2)
        if p == "power": data[p] = round(random.uniform(100,500),2)
        if p == "voltage": data[p] = round(random.uniform(220,240),2)
        if p == "current": data[p] = round(random.uniform(1,10),2)
    return data

def publish_telemetry(client, device):
    topic = f"{BASE_TOPIC}/devices/{device['serialNumber']}/telemetry"

    payload = {
        "timestamp": datetime.utcnow().isoformat()+"Z",
        **generate_sensor_data(device["parameters"])
    }

    client.publish(topic, json.dumps(payload), qos=1)
    print("📊", device["serialNumber"], payload)

def publish_status(client, device):
    topic = f"{BASE_TOPIC}/devices/{device['serialNumber']}/status"
    payload = {"status":"online"}
    client.publish(topic, json.dumps(payload), qos=1)

def main():
    client = mqtt.Client(CLIENT_ID)
    client.on_connect = on_connect
    client.connect(BROKER, PORT, 60)
    client.loop_start()
    time.sleep(2)

    print("\n🚀 Simulator running...\n")

    try:
        while True:
            for device in DEVICES:
                publish_telemetry(client, device)
                publish_status(client, device)
                time.sleep(1)
            time.sleep(5)

    except KeyboardInterrupt:
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()
