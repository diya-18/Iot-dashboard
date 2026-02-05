// backend/src/models/Device.js
const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  serialNumber: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function(v) {
return /^[a-zA-Z0-9_]+$/.test(v); 

      },
      message: 'Serial number must be exactly 10 digits'
    }
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  deviceType: {
    type: String,
    required: true,
    enum: ['temperature_sensor', 'humidity_sensor', 'motion_detector', 'smart_meter', 'multi_sensor', 'custom'],
    default: 'custom'
  },
  description: {
    type: String,
    default: ''
  },
  location: {
    name: {
      type: String,
      default: ''
    },
    latitude: Number,
    longitude: Number,
    address: String
  },
  enabled: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'error', 'maintenance'],
    default: 'offline'
  },
  lastSeen: {
    type: Date,
    default: null
  },
  metadata: {
    manufacturer: String,
    model: String,
    firmwareVersion: String,
    hardwareVersion: String,
    installDate: Date
  },
  // OTA Firmware Update Placeholder
  otaConfig: {
    enabled: {
      type: Boolean,
      default: false
    },
    updateSource: {
      type: String,
      enum: ['aws_s3', 'ftp', 'http', 'https', null],
      default: null
    },
    updateUrl: {
      type: String,
      default: null
    },
    lastUpdateCheck: Date,
    currentFirmwareVersion: String,
    targetFirmwareVersion: String,
    updateStatus: {
      type: String,
      enum: ['idle', 'pending', 'downloading', 'installing', 'success', 'failed', null],
      default: 'idle'
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
deviceSchema.index({ serialNumber: 1 }, { unique: true });
deviceSchema.index({ enabled: 1 });
deviceSchema.index({ status: 1 });
deviceSchema.index({ deviceType: 1 });
deviceSchema.index({ createdBy: 1 });

// Method to update last seen
deviceSchema.methods.updateLastSeen = function() {
  this.lastSeen = new Date();
  this.status = 'online';
  return this.save();
};

// Method to check if device is accessible by user
deviceSchema.methods.canBeAccessedBy = async function(userId) {
  const DeviceAssignment = require('./DeviceAssignment');
  const assignment = await DeviceAssignment.findOne({
    deviceId: this._id,
    userId: userId
  });
  
  return assignment !== null;
};

// Static method to validate serial number format
deviceSchema.statics.validateSerialNumber = function(serialNumber) {
  return /^[a-zA-Z0-9_]+$/.test(serialNumber); 
};

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;