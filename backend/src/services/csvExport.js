// CSV Export Service
const { createObjectCsvStringifier } = require('csv-writer');
const Telemetry = require('../models/Telemetry');

class CSVExportService {
  async exportTelemetryData(deviceId, startTime, endTime, parameters = []) {
    try {
      // Get data from database
      const { headers, rows } = await Telemetry.exportToCSV(
        deviceId,
        startTime,
        endTime,
        parameters
      );
      
      if (rows.length === 0) {
        return null;
      }
      
      // Create CSV stringifier
      const csvStringifier = createObjectCsvStringifier({
        header: headers.map(h => ({ id: h, title: h }))
      });
      
      // Convert rows to objects
      const records = rows.map(row => {
        const record = {};
        headers.forEach((header, index) => {
          record[header] = row[index];
        });
        return record;
      });
      
      // Generate CSV
      const csvHeader = csvStringifier.getHeaderString();
      const csvBody = csvStringifier.stringifyRecords(records);
      
      return csvHeader + csvBody;
    } catch (error) {
      console.error('CSV export error:', error);
      throw error;
    }
  }
}

module.exports = new CSVExportService();