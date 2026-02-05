const express = require('express');
const router = express.Router();
const Parameter = require('../models/Parameter');
const Device = require('../models/Device');
const DeviceAssignment = require('../models/DeviceAssignment');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');

router.use(authenticate);

// GET /api/parameters/:serialNumber - Get device parameters
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
    
    const parameters = await Parameter.getDeviceParameters(device._id);
    
    res.json({ parameters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/parameters/:serialNumber - Add parameter
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
        'canConfigureParameters'
      );
      
      if (!hasPermission) {
        return res.status(403).json({ error: 'No permission to configure parameters' });
      }
    }
    
    const {
      name,
      displayName,
      unit,
      dataType,
      minValue,
      maxValue,
      defaultValue,
      locked,
      description,
      order
    } = req.body;
    
    if (!name || !dataType) {
      return res.status(400).json({ error: 'Name and dataType are required' });
    }
    
    const parameter = new Parameter({
      deviceId: device._id,
      name,
      displayName: displayName || name,
      unit: unit || '',
      dataType,
      minValue: minValue !== undefined ? minValue : null,
      maxValue: maxValue !== undefined ? maxValue : null,
      defaultValue: defaultValue !== undefined ? defaultValue : null,
      locked: locked || false,
      description: description || '',
      order: order || 0,
      createdBy: req.userId
    });
    
    await parameter.save();
    
    res.status(201).json({
      message: 'Parameter created successfully',
      parameter
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Parameter already exists for this device' });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/parameters/:id - Update parameter
router.put('/:id', async (req, res) => {
  try {
    const parameter = await Parameter.findById(req.params.id);
    
    if (!parameter) {
      return res.status(404).json({ error: 'Parameter not found' });
    }
    
    const device = await Device.findById(parameter.deviceId);
    
    // Check permission
    if (req.userRole !== 'admin') {
      // Check if parameter is locked
      if (parameter.locked) {
        return res.status(403).json({ error: 'Parameter is locked and cannot be modified' });
      }
      
      const hasPermission = await DeviceAssignment.hasPermission(
        req.userId,
        device._id,
        'canConfigureParameters'
      );
      
      if (!hasPermission) {
        return res.status(403).json({ error: 'No permission to configure parameters' });
      }
    }
    
    const {
      displayName,
      unit,
      minValue,
      maxValue,
      defaultValue,
      locked,
      description,
      order,
      enabled
    } = req.body;
    
    if (displayName) parameter.displayName = displayName;
    if (unit !== undefined) parameter.unit = unit;
    if (minValue !== undefined) parameter.minValue = minValue;
    if (maxValue !== undefined) parameter.maxValue = maxValue;
    if (defaultValue !== undefined) parameter.defaultValue = defaultValue;
    if (locked !== undefined && req.userRole === 'admin') parameter.locked = locked;
    if (description !== undefined) parameter.description = description;
    if (order !== undefined) parameter.order = order;
    if (enabled !== undefined) parameter.enabled = enabled;
    
    await parameter.save();
    
    res.json({
      message: 'Parameter updated successfully',
      parameter
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/parameters/:id - Delete parameter (Admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const parameter = await Parameter.findById(req.params.id);
    
    if (!parameter) {
      return res.status(404).json({ error: 'Parameter not found' });
    }
    
    await parameter.deleteOne();
    
    res.json({ message: 'Parameter deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;