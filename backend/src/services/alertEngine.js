// Alert Engine Service
const Alert = require('../models/Alert');
const AlertLog = require('../models/AlertLog');
const emailService = require('./emailService');

class AlertEngine {
  async checkThresholds(deviceId, serialNumber, telemetryData) {
    try {
      // Get active alerts for this device
      const alerts = await Alert.getActiveAlerts(deviceId);
      
      if (alerts.length === 0) {
        return;
      }
      
      // Check each parameter against alerts
      for (const alert of alerts) {
        const parameterName = alert.parameterName;
        const value = telemetryData[parameterName];
        
        if (value === undefined || value === null) {
          continue;
        }
        
        // Check if alert should trigger
        const check = alert.shouldTrigger(value);
        
        if (check.shouldTrigger) {
          await this.triggerAlert(alert, {
            deviceId,
            serialNumber,
            value,
            thresholdType: check.thresholdType,
            threshold: check.threshold,
            message: check.message
          });
        }
      }
    } catch (error) {
      console.error('Alert engine error:', error);
    }
  }
  
  async triggerAlert(alert, data) {
    try {
      // Create alert log
      const alertLog = await AlertLog.logAlert({
        alertId: alert._id,
        deviceId: data.deviceId,
        parameterId: alert.parameterId,
        parameterName: alert.parameterName,
        thresholdType: data.thresholdType,
        thresholdValue: data.threshold,
        actualValue: data.value,
        message: data.message,
        severity: alert.severity
      });
      
      // Send email notifications
      if (alert.notifications.email.enabled && alert.notifications.email.recipients.length > 0) {
        const emailSent = await emailService.sendAlertEmail({
          recipients: alert.notifications.email.recipients,
          deviceSerialNumber: data.serialNumber,
          parameterName: alert.parameterName,
          value: data.value,
          threshold: data.threshold,
          thresholdType: data.thresholdType,
          message: data.message,
          severity: alert.severity
        });
        
        if (emailSent) {
          alertLog.notificationsSent.email.sent = true;
          alertLog.notificationsSent.email.sentAt = new Date();
          alertLog.notificationsSent.email.recipients = alert.notifications.email.recipients;
          await alertLog.save();
        }
      }
      
      // SMS notifications (placeholder)
      if (alert.notifications.sms.enabled) {
        console.log('SMS notification would be sent here');
        // TODO: Implement SMS service
      }
      
      // Record trigger in alert
      await alert.recordTrigger();
      
      // Emit socket event
      if (global.io) {
        global.io.emit('alert', {
          alertLog,
          alert
        });
      }
      
      console.log(`✅ Alert triggered: ${data.message}`);
    } catch (error) {
      console.error('Error triggering alert:', error);
    }
  }
}

module.exports = new AlertEngine();