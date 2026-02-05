// backend/src/models/DeviceAssignment.js
const mongoose = require('mongoose');

const deviceAssignmentSchema = new mongoose.Schema({
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  permissions: {
    canView: {
      type: Boolean,
      default: true
    },
    canEdit: {
      type: Boolean,
      default: false
    },
    canConfigureParameters: {
      type: Boolean,
      default: false
    },
    canConfigureAlerts: {
      type: Boolean,
      default: false
    },
    canDelete: {
      type: Boolean,
      default: false
    }
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedAt: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Compound unique index - one assignment per user-device pair
deviceAssignmentSchema.index({ deviceId: 1, userId: 1 }, { unique: true });

// Compound indexes for efficient queries
deviceAssignmentSchema.index({ userId: 1, assignedAt: -1 });
deviceAssignmentSchema.index({ deviceId: 1, assignedAt: -1 });

// Static method to assign device to user
deviceAssignmentSchema.statics.assignDevice = async function(data) {
  const { deviceId, userId, permissions, assignedBy, notes } = data;
  
  // Check if assignment already exists
  const existing = await this.findOne({ deviceId, userId });
  
  if (existing) {
    // Update existing assignment
    existing.permissions = permissions || existing.permissions;
    existing.assignedBy = assignedBy;
    existing.notes = notes || existing.notes;
    existing.assignedAt = new Date();
    await existing.save();
    return existing;
  } else {
    // Create new assignment
    const assignment = new this({
      deviceId,
      userId,
      permissions: permissions || {},
      assignedBy,
      notes: notes || ''
    });
    await assignment.save();
    return assignment;
  }
};

// Static method to get user's devices
deviceAssignmentSchema.statics.getUserDevices = async function(userId) {
  return await this.find({ userId })
    .populate('deviceId')
    .sort({ assignedAt: -1 })
    .lean();
};

// Static method to get device's assigned users
deviceAssignmentSchema.statics.getDeviceUsers = async function(deviceId) {
  return await this.find({ deviceId })
    .populate('userId', '-password')
    .sort({ assignedAt: -1 })
    .lean();
};

// Static method to check if user has permission
deviceAssignmentSchema.statics.hasPermission = async function(userId, deviceId, permissionType) {
  const assignment = await this.findOne({ userId, deviceId });
  
  if (!assignment) {
    return false;
  }
  
  return assignment.permissions[permissionType] === true;
};

// Static method to remove assignment
deviceAssignmentSchema.statics.removeAssignment = async function(userId, deviceId) {
  return await this.findOneAndDelete({ userId, deviceId });
};

const DeviceAssignment = mongoose.model('DeviceAssignment', deviceAssignmentSchema);

module.exports = DeviceAssignment;