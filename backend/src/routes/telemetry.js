const express = require('express');
const router = express.Router();
const Telemetry = require('../models/Telemetry');
const Parameter = require('../models/Parameter');
const Device = require('../models/Device');
const DeviceAssignment = require('../models/DeviceAssignment');
const csvExportService = require('../services/csvExport');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/telemetry/:serialNumber - Get device telemetry
router.get('/:serialNumber', async (req, res) => {
  try {
    const { startTime, endTime, limit = 100, page = 1 } = req.query;
    
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
    
    const data = await Telemetry.getInTimeRange(
      device._id,
      startTime,
      endTime,
      parseInt(limit)
    );
    
    res.json({
      telemetry: data,
      count: data.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/telemetry/:serialNumber/latest - Get latest telemetry
router.get('/:serialNumber/latest', async (req, res) => {
  try {
    const { count = 10 } = req.query;
    
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
    
    const data = await Telemetry.getLatest(device._id, parseInt(count));
    
    res.json({
      latest: data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/telemetry/:serialNumber/aggregate - Get aggregated data
router.get('/:serialNumber/aggregate', async (req, res) => {
  try {
    const { parameterName, startTime, endTime, interval = '1h' } = req.query;
    
    if (!parameterName) {
      return res.status(400).json({ error: 'parameterName is required' });
    }
    
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
    
    const data = await Telemetry.getAggregatedParameter(
      device._id,
      parameterName,
      startTime,
      endTime,
      interval
    );
    
    res.json({
      parameterName,
      interval,
      data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/telemetry/:serialNumber/export - Export to CSV
router.get('/:serialNumber/export', async (req, res) => {
  try {
    const { startTime, endTime, parameters } = req.query;
    
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
    
    const paramList = parameters ? parameters.split(',') : [];
    
    const csvData = await csvExportService.exportTelemetryData(
      device._id,
      startTime,
      endTime,
      paramList
    );
    
    if (!csvData) {
      return res.status(404).json({ error: 'No data available for export' });
    }
    
    const filename = `telemetry_${device.serialNumber}_${Date.now()}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;