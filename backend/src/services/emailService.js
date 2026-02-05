// Email Service
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.configured = false;
    this.initializeTransporter();
  }
  
  initializeTransporter() {
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
      console.warn('⚠️  Email service not configured');
      return;
    }
    
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    this.configured = true;
    console.log('✅ Email service configured');
  }
  
  async sendAlertEmail(data) {
    if (!this.configured) {
      console.warn('Email service not configured, skipping email');
      return false;
    }
    
    const { recipients, deviceSerialNumber, parameterName, value, threshold, thresholdType, message, severity } = data;
    
    const severityColors = {
      low: '#FFA500',
      medium: '#FF8C00',
      high: '#FF4500',
      critical: '#DC143C'
    };
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${severityColors[severity]}; color: white; padding: 20px; text-align: center;">
          <h1>⚠️ IoT Alert - ${severity.toUpperCase()}</h1>
        </div>
        <div style="padding: 20px; background-color: #f9f9f9;">
          <h2>${message}</h2>
          <table style="width: 100%; margin-top: 20px;">
            <tr>
              <td style="padding: 10px; background-color: white;"><strong>Device Serial:</strong></td>
              <td style="padding: 10px; background-color: white;">${deviceSerialNumber}</td>
            </tr>
            <tr>
              <td style="padding: 10px; background-color: #f0f0f0;"><strong>Parameter:</strong></td>
              <td style="padding: 10px; background-color: #f0f0f0;">${parameterName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; background-color: white;"><strong>Current Value:</strong></td>
              <td style="padding: 10px; background-color: white;">${value}</td>
            </tr>
            <tr>
              <td style="padding: 10px; background-color: #f0f0f0;"><strong>Threshold (${thresholdType}):</strong></td>
              <td style="padding: 10px; background-color: #f0f0f0;">${threshold}</td>
            </tr>
            <tr>
              <td style="padding: 10px; background-color: white;"><strong>Timestamp:</strong></td>
              <td style="padding: 10px; background-color: white;">${new Date().toLocaleString()}</td>
            </tr>
          </table>
        </div>
        <div style="padding: 20px; text-align: center; color: #666;">
          <p>This is an automated alert from your IoT Dashboard</p>
        </div>
      </div>
    `;
    
    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: recipients.join(', '),
        subject: `🚨 IoT Alert: ${parameterName} - ${severity.toUpperCase()}`,
        html: emailHtml
      });
      
      console.log(`📧 Alert email sent to: ${recipients.join(', ')}`);
      return true;
    } catch (error) {
      console.error('❌ Email send error:', error);
      return false;
    }
  }
  
  async sendWelcomeEmail(email, name, temporaryPassword) {
    if (!this.configured) {
      return false;
    }
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #3b82f6; color: white; padding: 20px; text-align: center;">
          <h1>Welcome to IoT Dashboard</h1>
        </div>
        <div style="padding: 20px;">
          <p>Hello ${name},</p>
          <p>Your account has been created on the IoT Dashboard platform.</p>
          <p><strong>Login Credentials:</strong></p>
          <ul>
            <li>Email: ${email}</li>
            <li>Temporary Password: ${temporaryPassword}</li>
          </ul>
          <p><strong>Please change your password after first login.</strong></p>
          <p>Login URL: ${process.env.FRONTEND_URL}/login</p>
        </div>
      </div>
    `;
    
    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Welcome to IoT Dashboard',
        html: emailHtml
      });
      
      return true;
    } catch (error) {
      console.error('Email send error:', error);
      return false;
    }
  }
}

module.exports = new EmailService();