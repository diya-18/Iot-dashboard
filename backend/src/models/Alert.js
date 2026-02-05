// backend/src/models/Alert.js
const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true,
    index: true
  },
  parameterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parameter',
    required: true,
    index: true
  },
  parameterName: {
    type: String,
    required: true
    // Denormalized for faster queries
  },
  enabled: {
    type: Boolean,
    default: true
  },
  upperThreshold: {
    value: {
      type: Number,
      default: null
    },
    enabled: {
      type: Boolean,
      default: false
    }
  },
  lowerThreshold: {
    value: {
      type: Number,
      default: null
    },
    enabled: {
      type: Boolean,
      default: false
    }
  },
  notifications: {
    email: {
      enabled: {
        type: Boolean,
        default: true
      },
      recipients: [{
        type: String,
        validate: {
          validator: function(v) {
            return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
          },
          message: 'Invalid email format'
        }
      }]
    },
    sms: {
      enabled: {
        type: Boolean,
        default: false
        // Placeholder - SMS integration to be implemented
      },
      recipients: [{
        type: String
      }]
    }
  },
  cooldownPeriod: {
    type: Number,
    default: 300
    // Seconds to wait before sending another alert for same condition
  },
  lastTriggered: {
    type: Date,
    default: null
  },
  triggerCount: {
    type: Number,
    default: 0
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  description: {
    type: String,
    default: ''
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

// Compound index for unique alert per device-parameter
alertSchema.index({ deviceId: 1, parameterId: 1 }, { unique: true });
alertSchema.index({ enabled: 1 });
alertSchema.index({ lastTriggered: 1 });

// Method to check if alert should be triggered
alertSchema.methods.shouldTrigger = function(value) {
  if (!this.enabled) {
    return { shouldTrigger: false, reason: 'Alert disabled' };
  }
  
  // Check cooldown period
  if (this.lastTriggered) {
    const timeSinceLastTrigger = (Date.now() - this.lastTriggered.getTime()) / 1000;
    if (timeSinceLastTrigger < this.cooldownPeriod) {
      return { 
        shouldTrigger: false, 
        reason: 'Cooldown period active',
        remainingCooldown: this.cooldownPeriod - timeSinceLastTrigger
      };
    }
  }
  
  // Check upper threshold
  if (this.upperThreshold.enabled && this.upperThreshold.value !== null) {
    if (value > this.upperThreshold.value) {
      return {
        shouldTrigger: true,
        thresholdType: 'upper',
        threshold: this.upperThreshold.value,
        value: value,
        message: `${this.parameterName} exceeded upper threshold: ${value} > ${this.upperThreshold.value}`
      };
    }
  }
  
  // Check lower threshold
  if (this.lowerThreshold.enabled && this.lowerThreshold.value !== null) {
    if (value < this.lowerThreshold.value) {
      return {
        shouldTrigger: true,
        thresholdType: 'lower',
        threshold: this.lowerThreshold.value,
        value: value,
        message: `${this.parameterName} below lower threshold: ${value} < ${this.lowerThreshold.value}`
      };
    }
  }
  
  return { shouldTrigger: false, reason: 'Within thresholds' };
};

// Method to record alert trigger
alertSchema.methods.recordTrigger = async function() {
  this.lastTriggered = new Date();
  this.triggerCount += 1;
  await this.save();
};

// Static method to get device alerts
alertSchema.statics.getDeviceAlerts = async function(deviceId) {
  return await this.find({ deviceId })
    .populate('parameterId')
    .sort({ createdAt: -1 })
    .lean();
};

// Static method to get active alerts
alertSchema.statics.getActiveAlerts = async function(deviceId) {
  return await this.find({ 
    deviceId, 
    enabled: true,
    $or: [
      { 'upperThreshold.enabled': true },
      { 'lowerThreshold.enabled': true }
    ]
  })
  .populate('parameterId')
  .lean();
};

const Alert = mongoose.model('Alert', alertSchema);

module.exports = Alert;