// Mock Logger for Jest tests
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  verbose: jest.fn(),
  silly: jest.fn(),
  log: jest.fn(),
  child: jest.fn().mockReturnThis(),
  setLevel: jest.fn(),
  addHandler: jest.fn(),
  removeHandler: jest.fn(),
  clearHandlers: jest.fn()
};

export class Logger {
  constructor(_componentName?: string) {
    // Mock constructor
  }

  debug = mockLogger.debug;
  info = mockLogger.info;
  warn = mockLogger.warn;
  error = mockLogger.error;
  verbose = mockLogger.verbose;
  silly = mockLogger.silly;
  log = mockLogger.log;
  child = mockLogger.child;
  setLevel = mockLogger.setLevel;
  addHandler = mockLogger.addHandler;
  removeHandler = mockLogger.removeHandler;
  clearHandlers = mockLogger.clearHandlers;

  // Support both instance and static getInstance() patterns
  static getInstance = jest.fn().mockReturnValue(mockLogger);
}

// Export for both CommonJS and ES modules
module.exports = { Logger };
module.exports.Logger = Logger;
module.exports.default = { Logger };