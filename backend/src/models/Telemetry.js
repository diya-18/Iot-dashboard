// backend/src/models/Telemetry.js
const mongoose = require('mongoose');

const telemetrySchema = new mongoose.Schema({
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true,
    index: true
  },
  serialNumber: {
    type: String,
    required: true,
    index: true,
    validate: {
      validator: function(v) {
        return /^\d{10}$/.test(v);
      },
      message: 'Serial number must be exactly 10 digits'
    }
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
    // Flexible structure to accommodate any parameters
    // Example: { temperature: 25.5, humidity: 60, pressure: 1013.25 }
  },
  quality: {
    type: String,
    enum: ['good', 'fair', 'poor', 'error'],
    default: 'good'
  },
  metadata: {
    source: {
      type: String,
      default: 'mqtt'
    },
    mqttTopic: String,
    processingTime: Number,
    batteryLevel: Number,
    signalStrength: Number,
    rawPayload: String
  }
}, {
  timestamps: false
});

// Compound indexes for efficient queries
telemetrySchema.index({ deviceId: 1, timestamp: -1 });
telemetrySchema.index({ serialNumber: 1, timestamp: -1 });
telemetrySchema.index({ timestamp: -1 });

// TTL index - automatically delete data older than 90 days
telemetrySchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

// Static method to store telemetry with validation
telemetrySchema.statics.storeTelemetry = async function(data) {
  const { deviceId, serialNumber, timestamp, telemetryData, quality, metadata } = data;
  
  const telemetry = new this({
    deviceId,
    serialNumber,
    timestamp: timestamp || new Date(),
    data: telemetryData,
    quality: quality || 'good',
    metadata: metadata || {}
  });
  
  await telemetry.save();
  return telemetry;
};

// Static method to get latest telemetry
telemetrySchema.statics.getLatest = async function(deviceId, count = 1) {
  return await this.find({ deviceId })
    .sort({ timestamp: -1 })
    .limit(count)
    .lean();
};

// Static method to get telemetry in time range
telemetrySchema.statics.getInTimeRange = async function(deviceId, startTime, endTime, limit = 1000) {
  const query = { deviceId };
  
  if (startTime || endTime) {
    query.timestamp = {};
    if (startTime) query.timestamp.$gte = new Date(startTime);
    if (endTime) query.timestamp.$lte = new Date(endTime);
  }
  
  return await this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// Static method to get aggregated data for a parameter
telemetrySchema.statics.getAggregatedParameter = async function(deviceId, parameterName, startTime, endTime, interval = '1h') {
  const intervalMap = {
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000
  };
  
  const intervalMs = intervalMap[interval] || intervalMap['1h'];
  
  const matchStage = { deviceId };
  if (startTime || endTime) {
    matchStage.timestamp = {};
    if (startTime) matchStage.timestamp.$gte = new Date(startTime);
    if (endTime) matchStage.timestamp.$lte = new Date(endTime);
  }
  
  const pipeline = [
    { $match: matchStage },
    {
      $addFields: {
        parameterValue: `$data.${parameterName}`,
        intervalBucket: {
          $subtract: [
            { $toLong: '$timestamp' },
            { $mod: [{ $toLong: '$timestamp' }, intervalMs] }
          ]
        }
      }
    },
    {
      $match: {
        parameterValue: { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: '$intervalBucket',
        timestamp: { $first: '$timestamp' },
        avg: { $avg: '$parameterValue' },
        min: { $min: '$parameterValue' },
        max: { $max: '$parameterValue' },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ];
  
  const results = await this.aggregate(pipeline);
  
  return results.map(item => ({
    timestamp: new Date(item._id),
    avg: item.avg,
    min: item.min,
    max: item.max,
    count: item.count
  }));
};

// Static method to export to CSV format
telemetrySchema.statics.exportToCSV = async function(deviceId, startTime, endTime, parameters = []) {
  const data = await this.getInTimeRange(deviceId, startTime, endTime);
  
  if (data.length === 0) {
    return { headers: [], rows: [] };
  }
  
  // Determine headers
  const headers = ['Timestamp', 'Serial Number'];
  
  if (parameters.length > 0) {
    headers.push(...parameters);
  } else {
    // Auto-detect parameters from first record
    const firstRecord = data[0];
    headers.push(...Object.keys(firstRecord.data));
  }
  
  headers.push('Quality');
  
  // Build rows
  const rows = data.map(record => {
    const row = [
      record.timestamp.toISOString(),
      record.serialNumber
    ];
    
    // Add parameter values
    const paramList = parameters.length > 0 ? parameters : Object.keys(record.data);
    paramList.forEach(param => {
      row.push(record.data[param] !== undefined ? record.data[param] : '');
    });
    
    row.push(record.quality);
    
    return row;
  });
  
  return { headers, rows };
};

const Telemetry = mongoose.model('Telemetry', telemetrySchema);

module.exports = Telemetry;