// backend/src/models/AlertLog.js
const mongoose = require('mongoose');

const alertLogSchema = new mongoose.Schema({
  alertId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Alert',
    required: true,
    index: true
  },
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true,
    index: true
  },
  parameterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parameter',
    required: true
  },
  parameterName: {
    type: String,
    required: true
  },
  thresholdType: {
    type: String,
    enum: ['upper', 'lower'],
    required: true
  },
  thresholdValue: {
    type: Number,
    required: true
  },
  actualValue: {
    type: Number,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  notificationsSent: {
    email: {
      sent: {
        type: Boolean,
        default: false
      },
      sentAt: Date,
      recipients: [String],
      error: String
    },
    sms: {
      sent: {
        type: Boolean,
        default: false
      },
      sentAt: Date,
      recipients: [String],
      error: String
    }
  },
  acknowledged: {
    type: Boolean,
    default: false
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  acknowledgedAt: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false
});

// Compound indexes
alertLogSchema.index({ alertId: 1, timestamp: -1 });
alertLogSchema.index({ deviceId: 1, timestamp: -1 });
alertLogSchema.index({ acknowledged: 1, timestamp: -1 });
alertLogSchema.index({ severity: 1, timestamp: -1 });

// TTL index - delete logs older than 180 days
alertLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 15552000 });

// Static method to log alert
alertLogSchema.statics.logAlert = async function(data) {
  const {
    alertId,
    deviceId,
    parameterId,
    parameterName,
    thresholdType,
    thresholdValue,
    actualValue,
    message,
    severity
  } = data;
  
  const log = new this({
    alertId,
    deviceId,
    parameterId,
    parameterName,
    thresholdType,
    thresholdValue,
    actualValue,
    message,
    severity
  });
  
  await log.save();
  return log;
};

// Method to mark as acknowledged
alertLogSchema.methods.acknowledge = async function(userId, notes = '') {
  this.acknowledged = true;
  this.acknowledgedBy = userId;
  this.acknowledgedAt = new Date();
  this.notes = notes;
  await this.save();
};

// Static method to get device alert history
alertLogSchema.statics.getDeviceHistory = async function(deviceId, limit = 50) {
  return await this.find({ deviceId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('acknowledgedBy', 'name email')
    .lean();
};

// Static method to get unacknowledged alerts
alertLogSchema.statics.getUnacknowledged = async function(deviceId = null) {
  const query = { acknowledged: false };
  if (deviceId) {
    query.deviceId = deviceId;
  }
  
  return await this.find(query)
    .sort({ timestamp: -1 })
    .populate('deviceId', 'serialNumber name')
    .lean();
};

// Static method to get alert statistics
alertLogSchema.statics.getStatistics = async function(deviceId, days = 7) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const stats = await this.aggregate([
    {
      $match: {
        deviceId: deviceId,
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$severity',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const total = await this.countDocuments({
    deviceId,
    timestamp: { $gte: startDate }
  });
  
  const acknowledged = await this.countDocuments({
    deviceId,
    timestamp: { $gte: startDate },
    acknowledged: true
  });
  
  return {
    total,
    acknowledged,
    unacknowledged: total - acknowledged,
    bySeverity: stats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {})
  };
};

const AlertLog = mongoose.model('AlertLog', alertLogSchema);

module.exports = AlertLog;