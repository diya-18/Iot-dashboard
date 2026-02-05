// backend/src/models/Parameter.js
const mongoose = require('mongoose');

const parameterSchema = new mongoose.Schema({
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  displayName: {
    type: String,
    trim: true
  },
  unit: {
    type: String,
    default: '',
    trim: true
    // Examples: °C, %, V, A, kWh, etc.
  },
  dataType: {
    type: String,
    required: true,
    enum: ['boolean', 'integer', 'unsigned_integer', 'float', 'sfloat', 'string'],
    default: 'float'
  },
  minValue: {
    type: Number,
    default: null
  },
  maxValue: {
    type: Number,
    default: null
  },
  defaultValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  locked: {
    type: Boolean,
    default: false
    // If true, sub-users cannot modify this parameter
  },
  description: {
    type: String,
    default: ''
  },
  order: {
    type: Number,
    default: 0
    // For display ordering
  },
  enabled: {
    type: Boolean,
    default: true
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

// Compound index for unique parameters per device
parameterSchema.index({ deviceId: 1, name: 1 }, { unique: true });
parameterSchema.index({ deviceId: 1, order: 1 });
parameterSchema.index({ enabled: 1 });

// Method to validate value against parameter constraints
parameterSchema.methods.validateValue = function(value) {
  // Type validation
  switch (this.dataType) {
    case 'boolean':
      if (typeof value !== 'boolean') {
        return { valid: false, error: 'Value must be boolean' };
      }
      break;
    
    case 'integer':
    case 'unsigned_integer':
      if (!Number.isInteger(value)) {
        return { valid: false, error: 'Value must be an integer' };
      }
      if (this.dataType === 'unsigned_integer' && value < 0) {
        return { valid: false, error: 'Value must be non-negative' };
      }
      break;
    
    case 'float':
    case 'sfloat':
      if (typeof value !== 'number') {
        return { valid: false, error: 'Value must be a number' };
      }
      break;
    
    case 'string':
      if (typeof value !== 'string') {
        return { valid: false, error: 'Value must be a string' };
      }
      break;
  }
  
  // Range validation
  if (this.minValue !== null && value < this.minValue) {
    return { 
      valid: false, 
      error: `Value must be >= ${this.minValue}` 
    };
  }
  
  if (this.maxValue !== null && value > this.maxValue) {
    return { 
      valid: false, 
      error: `Value must be <= ${this.maxValue}` 
    };
  }
  
  return { valid: true };
};

// Static method to get device parameters
parameterSchema.statics.getDeviceParameters = async function(deviceId) {
  return await this.find({ deviceId, enabled: true })
    .sort({ order: 1, name: 1 })
    .lean();
};

// Static method to create default parameters for common device types
parameterSchema.statics.createDefaultParameters = async function(deviceId, deviceType, createdBy) {
  const defaults = {
    temperature_sensor: [
      { name: 'temperature', displayName: 'Temperature', unit: '°C', dataType: 'float', minValue: -50, maxValue: 150 }
    ],
    humidity_sensor: [
      { name: 'humidity', displayName: 'Humidity', unit: '%', dataType: 'float', minValue: 0, maxValue: 100 }
    ],
    multi_sensor: [
      { name: 'temperature', displayName: 'Temperature', unit: '°C', dataType: 'float', minValue: -50, maxValue: 150, order: 1 },
      { name: 'humidity', displayName: 'Humidity', unit: '%', dataType: 'float', minValue: 0, maxValue: 100, order: 2 },
      { name: 'pressure', displayName: 'Pressure', unit: 'hPa', dataType: 'float', minValue: 800, maxValue: 1200, order: 3 }
    ],
    smart_meter: [
      { name: 'power', displayName: 'Power', unit: 'W', dataType: 'float', minValue: 0, maxValue: 10000, order: 1 },
      { name: 'voltage', displayName: 'Voltage', unit: 'V', dataType: 'float', minValue: 0, maxValue: 500, order: 2 },
      { name: 'current', displayName: 'Current', unit: 'A', dataType: 'float', minValue: 0, maxValue: 100, order: 3 }
    ]
  };
  
  const parameterDefs = defaults[deviceType] || [];
  
  const parameters = [];
  for (const def of parameterDefs) {
    const param = new this({
      deviceId,
      ...def,
      createdBy
    });
    await param.save();
    parameters.push(param);
  }
  
  return parameters;
};

const Parameter = mongoose.model('Parameter', parameterSchema);

module.exports = Parameter;