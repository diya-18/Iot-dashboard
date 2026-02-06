const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
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
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io globally accessible
global.io = io;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// MongoDB Connection
console.log("Mongo URI from ENV:", process.env.MONGODB_URI);const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

async function connectDB() {
  try {
    const mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    await mongoose.connect(uri);
    console.log("✅ Connected to in-memory MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
  }
}

connectDB();

// Initialize default admin user
// In backend/src/server.js, locate the initializeDefaultAdmin function

async function initializeDefaultAdmin() {
  try {
    const userCount = await User.countDocuments();
    
    if (userCount === 0) {
      const adminUser = new User({
        email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@iot.com',
        password: process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123',
        name: 'System Administrator',
        role: 'admin'
      });
      
      adminUser.setAdminPermissions();
      await adminUser.save();
      
      console.log('✅ Default admin user created');
      console.log(`📧 Email: ${adminUser.email}`);
      console.log(`🔑 Password: ${process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123'}`);
      console.log('⚠️  CHANGE PASSWORD AFTER FIRST LOGIN!');
    } else {
      // Add a section to update the existing admin user with a fresh hash
      const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@iot.com';
      const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123';
      const existingAdmin = await User.findOne({ email: adminEmail });

      if (existingAdmin && !(await existingAdmin.comparePassword(defaultPassword))) {
        // If the password doesn't match the default, update it using a bypass method
        existingAdmin.password = defaultPassword;
        // Use an update method that doesn't trigger 'pre.save' if necessary,
        // or ensure your pre-save hook is marked as modified:
        existingAdmin.isModified('password'); 
        await existingAdmin.save();
        console.log('⚠️ Existing admin password was incorrect; updated with default password.');
      }
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
}


// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'IoT Dashboard API - DRD Compliant',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      devices: '/api/devices',
      parameters: '/api/parameters',
      telemetry: '/api/telemetry',
      alerts: '/api/alerts',
      analytics: '/api/analytics'
    }
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
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    mqtt: mqttClient.connected ? 'connected' : 'disconnected'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  require('./socket/handler')(socket, io);
  
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// MQTT connection events
mqttClient.on('connect', () => {
  console.log('✅ MQTT Client connected to broker');
});

mqttClient.on('error', (error) => {
  console.error('❌ MQTT Client error:', error.message);
});

// Start server
const PORT = process.env.PORT || 10000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});


// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    mongoose.connection.close();
    mqttClient.end();
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, io };