// Role-Based Access Control Middleware
const DeviceAssignment = require('../models/DeviceAssignment');

// Admin only
exports.requireAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Check specific permission
exports.requirePermission = (permission) => {
  return (req, res, next) => {
    if (req.userRole === 'admin') {
      // Admins have all permissions
      return next();
    }
    
    if (!req.user.permissions[permission]) {
      return res.status(403).json({ 
        error: `Permission required: ${permission}` 
      });
    }
    
    next();
  };
};

// Check device access permission
exports.requireDeviceAccess = (permissionType = 'canView') => {
  return async (req, res, next) => {
    try {
      const deviceId = req.params.deviceId || req.params.id || req.body.deviceId;
      
      if (!deviceId) {
        return res.status(400).json({ error: 'Device ID required' });
      }
      
      // Admins have access to all devices
      if (req.userRole === 'admin') {
        return next();
      }
      
      // Check device assignment
      const assignment = await DeviceAssignment.findOne({
        deviceId,
        userId: req.userId
      });
      
      if (!assignment) {
        return res.status(403).json({ error: 'No access to this device' });
      }
      
      if (!assignment.permissions[permissionType]) {
        return res.status(403).json({ 
          error: `Permission required: ${permissionType}` 
        });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
};