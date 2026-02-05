const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const LoginActivity = require('../models/LoginActivity');
const { authenticate } = require('../middleware/auth');

// Generate JWT token
function generateToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
}

// POST /api/auth/register (first admin only)
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Check if first user
    const userCount = await User.countDocuments();
    
    if (userCount > 0) {
      return res.status(403).json({ 
        error: 'Registration disabled. Contact admin to create account.' 
      });
    }
    
    // Create first admin user
    const user = new User({
      email,
      password,
      name,
      role: 'admin'
    });
    
    user.setAdminPermissions();
    await user.save();
    
    const token = generateToken(user._id);
    
    res.status(201).json({
      message: 'Admin user created successfully',
      user: user.toJSON(),
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      
      
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check if account is active
    if (!user.isActive) {
      await LoginActivity.logAttempt({
        userId: user._id,
        email,
        success: false,
        ipAddress,
        userAgent,
        failureReason: 'Account inactive'
      });
      
      return res.status(401).json({ error: 'Account is inactive' });
    }
    
    // Verify password
    const isValidPassword = await user.comparePassword(password);
    
    if (!isValidPassword) {
      await LoginActivity.logAttempt({
        userId: user._id,
        email,
        success: false,
        ipAddress,
        userAgent,
        failureReason: 'Invalid password'
      });
      
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Log successful login
    await LoginActivity.logAttempt({
      userId: user._id,
      email,
      success: true,
      ipAddress,
      userAgent
    });
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Generate token
    const token = generateToken(user._id);
    
    res.json({
      message: 'Login successful',
      user: user.toJSON(),
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({ user: req.user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.userId);
    
    // Verify current password
    const isValid = await user.comparePassword(currentPassword);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/login-history
router.get('/login-history', authenticate, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const history = await LoginActivity.getUserHistory(req.userId, parseInt(limit));
    
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;