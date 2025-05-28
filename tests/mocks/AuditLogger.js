const { jest } = require('@jest/globals');

// Mock AuditLogger
const mockAuditLogger = {
  log: jest.fn().mockImplementation(async (level, message, metadata = {}) => {
    // Simulate PII sanitization
    const sanitizedMessage = mockAuditLogger.sanitizeForLogging(message);
    const sanitizedMetadata = mockAuditLogger.sanitizeForLogging(metadata);
    
    const logEntry = {
      timestamp: Date.now(),
      level,
      message: sanitizedMessage,
      metadata: sanitizedMetadata,
      id: `log-${Date.now()}`,
    };
    
    // Store the log entry (in real implementation would write to secure storage)
    return logEntry;
  }),
  
  getEntries: jest.fn().mockImplementation((filters = {}) => {
    // Return mock log entries
    return [
      {
        timestamp: Date.now() - 1000,
        level: 'info',
        message: 'AI operation completed',
        metadata: { operation: 'summarize', user: 'test-user' },
        id: 'log-1',
      },
      {
        timestamp: Date.now() - 2000,
        level: 'security',
        message: 'Permission check performed',
        metadata: { action: 'categorize', result: 'granted' },
        id: 'log-2',
      },
    ];
  }),
  
  enable: jest.fn().mockImplementation(() => {
    mockAuditLogger.enabled = true;
  }),
  
  disable: jest.fn().mockImplementation(() => {
    mockAuditLogger.enabled = false;
  }),
  
  enabled: true,
  
  // PII sanitization
  sanitizeForLogging: jest.fn().mockImplementation((data) => {
    if (typeof data === 'string') {
      return data
        .replace(/test-api-key-sensitive/g, '[REDACTED_API_KEY]')
        .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]')
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]')
        .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[REDACTED_CARD]');
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized = {};
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
  
  // Secure file writing simulation
  writeToSecureLog: jest.fn().mockImplementation(async (entry) => {
    // Simulate secure file writing with proper permissions
    if (!entry.timestamp || !entry.level || !entry.message) {
      throw new Error('Invalid log entry format');
    }
    
    // Simulate file permission check
    const filePermissions = '600'; // Read/write for owner only
    
    return {
      written: true,
      path: '/secure/logs/audit.log',
      permissions: filePermissions,
      entryId: entry.id,
    };
  }),
  
  // Security event logging
  logSecurityEvent: jest.fn().mockImplementation(async (eventType, details) => {
    const securityEvents = [
      'authentication_failure',
      'permission_denied',
      'credential_access',
      'suspicious_activity',
      'privilege_escalation_attempt'
    ];
    
    if (!securityEvents.includes(eventType)) {
      throw new Error(`Invalid security event type: ${eventType}`);
    }
    
    return mockAuditLogger.log('security', `Security event: ${eventType}`, details);
  }),
  
  // Debug mode security
  enableSecureDebugMode: jest.fn().mockImplementation((enabled) => {
    mockAuditLogger.secureDebugMode = enabled;
    
    if (enabled) {
      // In secure debug mode, extra sanitization is applied
      mockAuditLogger.debugSanitizationLevel = 'strict';
    } else {
      mockAuditLogger.debugSanitizationLevel = 'standard';
    }
  }),
  
  secureDebugMode: false,
  debugSanitizationLevel: 'standard',
};

const MockAuditLoggerClass = jest.fn().mockImplementation(() => mockAuditLogger);

module.exports = {
  AuditLogger: MockAuditLoggerClass,
  default: MockAuditLoggerClass,
};