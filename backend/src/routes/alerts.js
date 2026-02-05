const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const AlertLog = require('../models/AlertLog');
const Parameter = require('../models/Parameter');
const Device = require('../models/Device');
const DeviceAssignment = require('../models/DeviceAssignment');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');

router.use(authenticate);

// GET /api/alerts/:serialNumber - Get device alerts
router.get('/:serialNumber', async (req, res) => {
  try {
    const device = await Device.findOne({ serialNumber: req.params.serialNumber });
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Check access
    if (req.userRole !== 'admin') {
      const hasAccess = await device.canBeAccessedBy(req.userId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'No access to this device' });
      }
    }
    
    const alerts = await Alert.getDeviceAlerts(device._id);
    
    res.json({ alerts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/alerts/:serialNumber - Create alert
router.post('/:serialNumber', async (req, res) => {
  try {
    const device = await Device.findOne({ serialNumber: req.params.serialNumber });
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Check permission
    if (req.userRole !== 'admin') {
      const hasPermission = await DeviceAssignment.hasPermission(
        req.userId,
        device._id,
        'canConfigureAlerts'
      );
      
      if (!hasPermission) {
        return res.status(403).json({ error: 'No permission to configure alerts' });
      }
    }
    
    const {
      parameterId,
      upperThreshold,
      lowerThreshold,
      emailEnabled,
      emailRecipients,
      smsEnabled,
      smsRecipients,
      severity,
      description
    } = req.body;
    
    // Validate parameter
    const parameter = await Parameter.findById(parameterId);
    if (!parameter || parameter.deviceId.toString() !== device._id.toString()) {
      return res.status(400).json({ error: 'Invalid parameter' });
    }
    
    const alert = new Alert({
      deviceId: device._id,
      parameterId,
      parameterName: parameter.name,
      enabled: true,
      upperThreshold: {
        value: upperThreshold?.value,
        enabled: upperThreshold?.enabled || false
      },
      lowerThreshold: {
        value: lowerThreshold?.value,
        enabled: lowerThreshold?.enabled || false
      },
      notifications: {
        email: {
          enabled: emailEnabled || false,
          recipients: emailRecipients || []
        },
        sms: {
          enabled: smsEnabled || false,
          recipients: smsRecipients || []
        }
      },
      severity: severity || 'medium',
      description: description || '',
      createdBy: req.userId
    });
    
    await alert.save();
    
    res.status(201).json({
      message: 'Alert created successfully',
      alert
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Alert already exists for this parameter' });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/alerts/:id - Update alert
router.put('/:id', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    const device = await Device.findById(alert.deviceId);
    
    // Check permission
    if (req.userRole !== 'admin') {
      const hasPermission = await DeviceAssignment.hasPermission(
        req.userId,
        device._id,
        'canConfigureAlerts'
      );
      
      if (!hasPermission) {
        return res.status(403).json({ error: 'No permission to configure alerts' });
      }
    }
    
    const {
      enabled,
      upperThreshold,
      lowerThreshold,
      emailEnabled,
      emailRecipients,
      smsEnabled,
      smsRecipients,
      severity,
      description,
      cooldownPeriod
    } = req.body;
    
    if (enabled !== undefined) alert.enabled = enabled;
    if (upperThreshold) alert.upperThreshold = upperThreshold;
    if (lowerThreshold) alert.lowerThreshold = lowerThreshold;
    if (emailEnabled !== undefined) alert.notifications.email.enabled = emailEnabled;
    if (emailRecipients) alert.notifications.email.recipients = emailRecipients;
    if (smsEnabled !== undefined) alert.notifications.sms.enabled = smsEnabled;
    if (smsRecipients) alert.notifications.sms.recipients = smsRecipients;
    if (severity) alert.severity = severity;
    if (description !== undefined) alert.description = description;
    if (cooldownPeriod) alert.cooldownPeriod = cooldownPeriod;
    
    await alert.save();
    
    res.json({
      message: 'Alert updated successfully',
      alert
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/alerts/:id - Delete alert
router.delete('/:id', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    const device = await Device.findById(alert.deviceId);
    
    // Check permission
    if (req.userRole !== 'admin') {
      const hasPermission = await DeviceAssignment.hasPermission(
        req.userId,
        device._id,
        'canConfigureAlerts'
      );
      
      if (!hasPermission) {
        return res.status(403).json({ error: 'No permission to configure alerts' });
      }
    }
    
    await alert.deleteOne();
    
    res.json({ message: 'Alert deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/alerts/:serialNumber/logs - Get alert logs
router.get('/:serialNumber/logs', async (req, res) => {
  try {
    const { limit = 50, acknowledged } = req.query;
    
    const device = await Device.findOne({ serialNumber: req.params.serialNumber });
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Check access
    if (req.userRole !== 'admin') {
      const hasAccess = await device.canBeAccessedBy(req.userId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'No access to this device' });
      }
    }
    
    const query = { deviceId: device._id };
    if (acknowledged !== undefined) {
      query.acknowledged = acknowledged === 'true';
    }
    
    const logs = await AlertLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate('acknowledgedBy', 'name email');
    
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/alerts/logs/:id/acknowledge - Acknowledge alert
router.post('/logs/:id/acknowledge', async (req, res) => {
  try {
    const { notes } = req.body;
    
    const alertLog = await AlertLog.findById(req.params.id);
    
    if (!alertLog) {
      return res.status(404).json({ error: 'Alert log not found' });
    }
    
    await alertLog.acknowledge(req.userId, notes || '');
    
    res.json({
      message: 'Alert acknowledged successfully',
      alertLog
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/alerts/:serialNumber/statistics - Get alert statistics
router.get('/:serialNumber/statistics', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    const device = await Device.findOne({ serialNumber: req.params.serialNumber });
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const stats = await AlertLog.getStatistics(device._id, parseInt(days));
    
    res.json({ statistics: stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;