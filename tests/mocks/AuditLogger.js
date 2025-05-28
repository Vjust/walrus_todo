const { jest } = require('@jest/globals');

// Mock AuditLogger
const mockAuditLogger = {
  log: jest.fn(),
  getEntries: jest.fn().mockReturnValue([]),
  enable: jest.fn(),
  disable: jest.fn(),
};

const MockAuditLoggerClass = jest.fn().mockImplementation(() => mockAuditLogger);

module.exports = {
  AuditLogger: MockAuditLoggerClass,
  default: MockAuditLoggerClass,
};