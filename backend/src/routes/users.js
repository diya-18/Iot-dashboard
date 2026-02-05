const express = require('express');
const router = express.Router();
const User = require('../models/User');
const LoginActivity = require('../models/LoginActivity');
const DeviceAssignment = require('../models/DeviceAssignment');
const { authenticate } = require('../middleware/auth');
const { requireAdmin, requirePermission } = require('../middleware/rbac');
const emailService = require('../services/emailService');
const crypto = require('crypto');

// All routes require authentication
router.use(authenticate);

// GET /api/users - List all users (Admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    
    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }
    
    const skip = (page - 1) * limit;
    
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(filter);
    
    res.json({
      users,
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

// GET /api/users/:id - Get single user (Admin only)
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get user's devices
    const assignments = await DeviceAssignment.getUserDevices(user._id);
    
    res.json({ user, deviceCount: assignments.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users - Create new user (Admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { email, name, role, permissions } = req.body;
    
    // Validate required fields
    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }
    
    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    // Generate temporary password
    const temporaryPassword = crypto.randomBytes(8).toString('hex');
    
    // Create user
    const user = new User({
      email,
      name,
      password: temporaryPassword,
      role: role || 'sub-user',
      permissions: permissions || {},
      createdBy: req.userId
    });
    
    if (user.role === 'admin') {
      user.setAdminPermissions();
    }
    
    await user.save();
    
    // Send welcome email with temporary password
    await emailService.sendWelcomeEmail(email, name, temporaryPassword);
    
    res.status(201).json({
      message: 'User created successfully',
      user: user.toJSON(),
      temporaryPassword: temporaryPassword
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/users/:id - Update user (Admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, role, permissions, isActive } = req.body;
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent admin from deactivating themselves
    if (req.userId.toString() === user._id.toString() && isActive === false) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }
    
    // Update fields
    if (name) user.name = name;
    if (role) user.role = role;
    if (permissions) user.permissions = permissions;
    if (isActive !== undefined) user.isActive = isActive;
    
    if (role === 'admin') {
      user.setAdminPermissions();
    }
    
    await user.save();
    
    res.json({
      message: 'User updated successfully',
      user: user.toJSON()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/users/:id - Delete user (Admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent admin from deleting themselves
    if (req.userId.toString() === user._id.toString()) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    // Remove all device assignments
    await DeviceAssignment.deleteMany({ userId: user._id });
    
    await user.deleteOne();
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users/:id/reset-password - Reset user password (Admin only)
router.post('/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Generate new password
    const newPassword = crypto.randomBytes(8).toString('hex');
    
    user.password = newPassword;
    await user.save();
    
    // Send email
    await emailService.sendWelcomeEmail(user.email, user.name, newPassword);
    
    res.json({
      message: 'Password reset successfully',
      temporaryPassword: newPassword
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/users/:id/login-history - Get user login history (Admin only)
router.get('/:id/login-history', requireAdmin, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const history = await LoginActivity.getUserHistory(req.params.id, parseInt(limit));
    
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/users/:id/devices - Get user's assigned devices
router.get('/:id/devices', requireAdmin, async (req, res) => {
  try {
    const assignments = await DeviceAssignment.getUserDevices(req.params.id);
    
    res.json({ assignments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;