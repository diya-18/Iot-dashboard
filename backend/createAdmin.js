// createAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Check if admin already exists
    const existingAdmin = await usersCollection.findOne({ email: 'admin@iot.com' });
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Hash password manually
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Admin@123', salt);

    // Insert directly into MongoDB collection (bypasses Mongoose hooks)
    await usersCollection.insertOne({
      email: 'admin@iot.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'admin',
      isActive: true,
      permissions: {
        canManageUsers: true,
        canManageDevices: true,
        canConfigureParameters: true,
        canConfigureAlerts: true,
        canViewLogs: true
      },
      createdBy: null,
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin@iot.com');
    console.log('🔑 Password: Admin@123');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

createAdmin();