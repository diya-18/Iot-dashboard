const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const deviceRoutes = require('./routes/devices');
const parameterRoutes = require('./routes/parameters');
const telemetryRoutes = require('./routes/telemetry');
const alertRoutes = require('./routes/alerts');
const analyticsRoutes = require('./routes/analytics');

// Import MQTT client
const mqttClient = require('./mqtt/client');

// Import models
const User = require('./models/User');

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ['GET', 'POST'],
    credentials: true
  }
});
global.io = io;

// Middleware
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});


// 🔥 In-memory MongoDB (works everywhere including Render)
async function connectDB() {
  try {
    const mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    await mongoose.connect(uri);
    console.log("✅ Connected to in-memory MongoDB");

    // Create default admin after DB connects
    await initializeDefaultAdmin();

  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
  }
}
connectDB();


// Create default admin automatically
async function initializeDefaultAdmin() {
  try {
    const existingAdmin = await User.findOne({ email: 'admin@iot.com' });

    if (!existingAdmin) {
      const adminUser = new User({
        email: 'admin@iot.com',
        password: 'Admin@123',
        name: 'System Administrator',
        role: 'admin'
      });

      adminUser.setAdminPermissions();
      await adminUser.save();

      console.log('✅ Default admin created → admin@iot.com / Admin@123');
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
}


// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'IoT Dashboard API - DRD Compliant',
    status: 'running'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/parameters', parameterRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    mqtt: mqttClient.connected ? 'connected' : 'disconnected'
  });
});

// Socket.io
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
});

// Start server
const PORT = process.env.PORT || 10000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
