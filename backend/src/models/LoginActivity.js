// backend/src/models/LoginActivity.js
const mongoose = require('mongoose');

const loginActivitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  email: {
    type: String,
    required: true
  },
  success: {
    type: Boolean,
    required: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    default: ''
  },
  failureReason: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
    expires: 7776000
  }
}, {
  timestamps: false
});

// Compound index for efficient queries
loginActivitySchema.index({ userId: 1, timestamp: -1 });
loginActivitySchema.index({ success: 1, timestamp: -1 });
loginActivitySchema.index({ ipAddress: 1, timestamp: -1 });



// Static method to log login attempt
loginActivitySchema.statics.logAttempt = async function(data) {
  const { userId, email, success, ipAddress, userAgent, failureReason } = data;
  
  const activity = new this({
    userId,
    email,
    success,
    ipAddress,
    userAgent: userAgent || 'Unknown',
    failureReason: success ? null : failureReason
  });
  
  await activity.save();
  return activity;
};

// Static method to get user login history
loginActivitySchema.statics.getUserHistory = async function(userId, limit = 10) {
  return await this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// Static method to get failed login attempts
loginActivitySchema.statics.getFailedAttempts = async function(email, hours = 1) {
  const timeThreshold = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return await this.countDocuments({
    email,
    success: false,
    timestamp: { $gte: timeThreshold }
  });
};

const LoginActivity = mongoose.model('LoginActivity', loginActivitySchema);

module.exports = LoginActivity;