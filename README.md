A full-stack IoT device management and monitoring platform that ingests telemetry via MQTT, stores it in MongoDB, and visualizes it through a secure role-based dashboard.

The system demonstrates the complete pipeline:
*MQTT → Backend API → Database → Web Dashboard*


The goal of this project was to design and develop a complete IoT management platform that includes:

1. Secure user authentication and role-based access
   
2. Device lifecycle and assignment management
   
3. MQTT-based telemetry ingestion
   
4. Configurable parameter validation
   
5. Automated alert generation
   
6. Real-time dashboard visualization
   
7. Historical data analytics and export

**Tech Stack**

- **Frontend:** Next.js, Tailwind, Recharts
- **Backend:** Node.js, Express, MongoDB, JWT
- **IoT:** MQTT (HiveMQ) + Python Simulator

**Deployment**
- Frontend → Vercel(https://iot-dashboard-lovat.vercel.app/login)
- Backend → Renderhttps:(https://iot-dashboard-backend-zjgi.onrender.com/)
- Database → MongoDB Atlas

# Run locally
 
1. Clone repo : git clone https://github.com/diya-18/unified-iot-dashboard.git
   
cd unified-iot-dashboard


2. Backend setup : cd backend
                   npm install

create .env in background as --
 PORT=5000

MONGODB_URI=your_mongodb_connection_string

JWT_SECRET=your_secret

MQTT_BROKER_URL=mqtt://broker.hivemq.com

MQTT_PORT=1883

DEFAULT_ADMIN_EMAIL=admin@iot.com

DEFAULT_ADMIN_PASSWORD=Admin@123

finally Backend runs on http://localhost:5000 after * npm run dev*


3. Frontend setup: cd ../frontend/frontend
   
npm install


create .env.local in frontend as --

NEXT_PUBLIC_API_URL=http://localhost:5000

NEXT_PUBLIC_SOCKET_URL=http://localhost:5000

finally frontend runs on http://localhost:3000 after * npm run dev*


4.  Run MQTT simulator: cd ../mqtt-simulator
 
pip install paho-mqtt

python simulator.py

(This starts publishing simulated IoT telemetry.)

default login is Email: 
admin@iot.com

Password: Admin@123
