/**
 * Security Test Environment Setup
 * 
 * Minimal environment setup for security tests to avoid complex dependencies
 */

// Set test environment
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Mock common global objects that security tests might need
global.console = {
  ...console,
  // Override to capture security test output if needed
  log: jest.fn(console.log),
  error: jest.fn(console.error),
  warn: jest.fn(console.warn),
  info: jest.fn(console.info)
};

// Basic security test utilities
global.SecurityTestUtils = {
  // Mock file system operations for testing
  mockFS: {
    existsSync: jest.fn(() => true),
    readFileSync: jest.fn(() => '{}'),
    statSync: jest.fn(() => ({ mode: parseInt('644', 8) }))
  },
  
  // Mock process environment
  mockProcess: {
    env: { NODE_ENV: 'test' },
    argv: ['node', 'test']
  },
  
  // Security validation helpers
  isValidEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  isValidURL: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
  isSafePath: (path) => !path.includes('..') && !path.includes('//'),
  isSafeCommand: (cmd) => !cmd.includes(';') && !cmd.includes('|') && !cmd.includes('&')
};

// Clean up after each test
afterEach(() => {
  // Reset mocks
  if (global.console.log.mockReset) {
    global.console.log.mockReset();
    global.console.error.mockReset();
    global.console.warn.mockReset();
    global.console.info.mockReset();
  }
});