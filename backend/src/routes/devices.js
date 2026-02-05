const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const DeviceAssignment = require('../models/DeviceAssignment');
const Parameter = require('../models/Parameter');
const Telemetry = require('../models/Telemetry');
const { authenticate } = require('../middleware/auth');
const { requireAdmin, requirePermission, requireDeviceAccess } = require('../middleware/rbac');

// All routes require authentication
router.use(authenticate);

// GET /api/devices - List all devices (user sees only assigned devices)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type, search } = req.query;
    
    let deviceIds = [];
    
    if (req.userRole !== 'admin') {
      // Get user's assigned devices
      const assignments = await DeviceAssignment.getUserDevices(req.userId);
      deviceIds = assignments.map(a => a.deviceId._id);
      
      if (deviceIds.length === 0) {
        return res.json({
          devices: [],
          pagination: { total: 0, page: 1, limit: parseInt(limit), pages: 0 }
        });
      }
    }
    
    const filter = {};
    if (req.userRole !== 'admin') {
      filter._id = { $in: deviceIds };
    }
    if (status) filter.status = status;
    if (type) filter.deviceType = type;
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { serialNumber: new RegExp(search, 'i') }
      ];
    }
    
    const skip = (page - 1) * limit;
    
    const devices = await Device.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Device.countDocuments(filter);
    
    res.json({
      devices,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/devices/:serialNumber - Get device by serial number
router.get('/:serialNumber', async (req, res) => {
  try {
    const device = await Device.findOne({ serialNumber: req.params.serialNumber });
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Check access permission
    if (req.userRole !== 'admin') {
      const hasAccess = await device.canBeAccessedBy(req.userId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'No access to this device' });
      }
    }
    
    // Get parameters
    const parameters = await Parameter.getDeviceParameters(device._id);
    
    // Get latest telemetry
    const latestTelemetry = await Telemetry.getLatest(device._id, 1);
    
    res.json({
      device,
      parameters,
      latestTelemetry: latestTelemetry[0] || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/devices - Register new device (Admin or with permission)
router.post('/', requirePermission('canManageDevices'), async (req, res) => {
  try {
    const {
      serialNumber,
      name,
      deviceType,
      description,
      location,
      metadata
    } = req.body;
    
    // Validate serial number
    if (!Device.validateSerialNumber(serialNumber)) {
      return res.status(400).json({ 
        error: 'Serial number must be exactly 10 digits' 
      });
    }
    
    // Check if device exists
    const existing = await Device.findOne({ serialNumber });
    if (existing) {
      return res.status(409).json({ error: 'Device already exists' });
    }
    
    // Create device
    const device = new Device({
      serialNumber,
      name,
      deviceType: deviceType || 'custom',
      description: description || '',
      location: location || {},
      metadata: metadata || {},
      createdBy: req.userId,
      enabled: true
    });
    
    await device.save();
    
    // Create default parameters based on device type
    if (deviceType && deviceType !== 'custom') {
      await Parameter.createDefaultParameters(device._id, deviceType, req.userId);
    }
    
    // Auto-assign to creator if not admin
    if (req.userRole !== 'admin') {
      await DeviceAssignment.assignDevice({
        deviceId: device._id,
        userId: req.userId,
        permissions: {
          canView: true,
          canEdit: true,
          canConfigureParameters: true,
          canConfigureAlerts: true,
          canDelete: false
        },
        assignedBy: req.userId
      });
    }
    
    res.status(201).json({
      message: 'Device registered successfully',
      device
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/devices/:serialNumber - Update device
router.put('/:serialNumber', async (req, res) => {
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
        'canEdit'
      );
      
      if (!hasPermission) {
        return res.status(403).json({ error: 'No edit permission for this device' });
      }
    }
    
    const { name, description, location, metadata, enabled } = req.body;
    
    if (name) device.name = name;
    if (description !== undefined) device.description = description;
    if (location) device.location = { ...device.location, ...location };
    if (metadata) device.metadata = { ...device.metadata, ...metadata };
    if (enabled !== undefined && req.userRole === 'admin') {
      device.enabled = enabled;
    }
    
    await device.save();
    
    res.json({
      message: 'Device updated successfully',
      device
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/devices/:serialNumber - Delete device (Admin only)
router.delete('/:serialNumber', requireAdmin, async (req, res) => {
  try {
    const device = await Device.findOne({ serialNumber: req.params.serialNumber });
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Delete all related data
    await DeviceAssignment.deleteMany({ deviceId: device._id });
    await Parameter.deleteMany({ deviceId: device._id });
    await Telemetry.deleteMany({ deviceId: device._id });
    
    await device.deleteOne();
    
    res.json({ message: 'Device and related data deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/devices/:serialNumber/assign - Assign device to user (Admin only)
router.post('/:serialNumber/assign', requireAdmin, async (req, res) => {
  try {
    const { userId, permissions, notes } = req.body;
    
    const device = await Device.findOne({ serialNumber: req.params.serialNumber });
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const assignment = await DeviceAssignment.assignDevice({
      deviceId: device._id,
      userId,
      permissions: permissions || {
        canView: true,
        canEdit: false,
        canConfigureParameters: false,
        canConfigureAlerts: false,
        canDelete: false
      },
      assignedBy: req.userId,
      notes: notes || ''
    });
    
    res.json({
      message: 'Device assigned successfully',
      assignment
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/devices/:serialNumber/assign/:userId - Remove assignment (Admin only)
router.delete('/:serialNumber/assign/:userId', requireAdmin, async (req, res) => {
  try {
    const device = await Device.findOne({ serialNumber: req.params.serialNumber });
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    await DeviceAssignment.removeAssignment(req.params.userId, device._id);
    
    res.json({ message: 'Assignment removed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/devices/:serialNumber/assignments - Get device assignments (Admin only)
router.get('/:serialNumber/assignments', requireAdmin, async (req, res) => {
  try {
    const device = await Device.findOne({ serialNumber: req.params.serialNumber });
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const assignments = await DeviceAssignment.getDeviceUsers(device._id);
    
    res.json({ assignments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;