const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const Telemetry = require('../models/Telemetry');
const AlertLog = require('../models/AlertLog');
const DeviceAssignment = require('../models/DeviceAssignment');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');

router.use(authenticate);

// GET /api/analytics/summary - Dashboard summary
router.get('/summary', async (req, res) => {
  try {
    let deviceFilter = {};
    
    // Non-admin users see only their assigned devices
    if (req.userRole !== 'admin') {
      const assignments = await DeviceAssignment.getUserDevices(req.userId);
      const deviceIds = assignments.map(a => a.deviceId._id);
      deviceFilter._id = { $in: deviceIds };
    }
    
    const totalDevices = await Device.countDocuments(deviceFilter);
    const onlineDevices = await Device.countDocuments({ ...deviceFilter, status: 'online' });
    const offlineDevices = await Device.countDocuments({ ...deviceFilter, status: 'offline' });
    const errorDevices = await Device.countDocuments({ ...deviceFilter, status: 'error' });
    
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    
    let telemetryFilter = { timestamp: { $gte: oneDayAgo } };
    if (req.userRole !== 'admin') {
      const assignments = await DeviceAssignment.getUserDevices(req.userId);
      const deviceIds = assignments.map(a => a.deviceId._id);
      telemetryFilter.deviceId = { $in: deviceIds };
    }
    
    const recentTelemetry = await Telemetry.countDocuments(telemetryFilter);
    
    // Get unacknowledged alerts
    const unacknowledgedAlerts = await AlertLog.getUnacknowledged();
    
    res.json({
      timestamp: now,
      devices: {
        total: totalDevices,
        online: onlineDevices,
        offline: offlineDevices,
        error: errorDevices
      },
      telemetry: {
        last24Hours: recentTelemetry
      },
      alerts: {
        unacknowledged: unacknowledgedAlerts.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/analytics/activity - Activity timeline
router.get('/activity', async (req, res) => {
  try {
    const { period = '24h', interval = '1h' } = req.query;
    
    const now = new Date();
    let startTime;
    
    switch (period) {
      case '1h':
        startTime = new Date(now - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now - 24 * 60 * 60 * 1000);
    }
    
    let telemetryFilter = { timestamp: { $gte: startTime } };
    
    if (req.userRole !== 'admin') {
      const assignments = await DeviceAssignment.getUserDevices(req.userId);
      const deviceIds = assignments.map(a => a.deviceId._id);
      telemetryFilter.deviceId = { $in: deviceIds };
    }
    
    const intervalMap = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    
    const intervalMs = intervalMap[interval] || intervalMap['1h'];
    
    const activityData = await Telemetry.aggregate([
      { $match: telemetryFilter },
      {
        $addFields: {
          intervalBucket: {
            $subtract: [
              { $toLong: '$timestamp' },
              { $mod: [{ $toLong: '$timestamp' }, intervalMs] }
            ]
          }
        }
      },
      {
        $group: {
          _id: '$intervalBucket',
          timestamp: { $first: '$timestamp' },
          count: { $sum: 1 },
          uniqueDevices: { $addToSet: '$deviceId' }
        }
      },
      {
        $project: {
          _id: 0,
          timestamp: { $toDate: '$_id' },
          messageCount: '$count',
          deviceCount: { $size: '$uniqueDevices' }
        }
      },
      { $sort: { timestamp: 1 } }
    ]);
    
    res.json({
      period,
      interval,
      data: activityData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
