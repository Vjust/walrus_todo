// Get jest from globals
const { jest } = require('@jest/globals');

// Mock AuditLogger
const mockLogEntries = [];
let mockHashChain = 'initial-hash';
let mockEnabled = true;

const mockAuditLogger = {
  log: jest.fn().mockImplementation((eventType, details = {}) => {
    if (!mockEnabled) return;
    
    // Simulate PII sanitization
    const sanitizedDetails = mockAuditLogger.sanitizeForLogging(details);
    
    const entry = {
      eventType,
      timestamp: Date.now(),
      ...sanitizedDetails,
      hash: `hash-${Date.now()}`, // Mock hash
    };
    
    mockLogEntries.push(entry);
    return entry;
  }),
  
  getEntries: jest.fn().mockImplementation(() => {
    // Return copy of mock log entries
    return [...mockLogEntries];
  }),
  
  setEnabled: jest.fn().mockImplementation((enabled) => {
    mockEnabled = enabled;
  }),
  
  verifyLogIntegrity: jest.fn().mockImplementation(() => {
    // Mock integrity verification - return true unless specifically testing tampering
    return mockLogEntries.every(entry => entry.hash && entry.eventType);
  }),
  
  setRotationSize: jest.fn().mockImplementation((size) => {
    // Mock log rotation size setting
  }),
  
  // PII sanitization
  sanitizeForLogging: jest.fn().mockImplementation((data) => {
    if (typeof data === 'string') {
      return data
        .replace(/super-secret-api-key-12345/g, '[REDACTED]')
        .replace(/sensitive-nested-key/g, '[REDACTED]')
        .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED PII]')
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED PII]')
        .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[REDACTED PII]')
        .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[REDACTED PII]');
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized = Array.isArray(data) ? [] : {};
      for (const [key, value] of Object.entries(data)) {
        const sensitiveFields = ['apiKey', 'credential', 'password', 'token', 'secret', 'key'];
        if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = mockAuditLogger.sanitizeForLogging(value);
        }
      }
      return sanitized;
    }
    
    return data;
  }),
  
  // Test helper methods
  clearEntries: jest.fn().mockImplementation(() => {
    mockLogEntries.length = 0; // Clear the array
  }),
}

const MockAuditLoggerClass = jest.fn().mockImplementation(() => mockAuditLogger);

module.exports = {
  AuditLogger: MockAuditLoggerClass,
  default: MockAuditLoggerClass,
};