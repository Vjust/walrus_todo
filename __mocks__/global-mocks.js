/**
 * Global mock setup for Jest tests
 * This file ensures consistent mocking across all test files
 */

// Environment setup
process.env.NODE_ENV = 'test';
process.env.WALRUS_USE_MOCK = 'true';

// Mock console methods to prevent spam in tests
const originalConsole = { ...console };
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn((message) => {
    // Only show actual errors, not warnings
    if (typeof message === 'string' && !message.includes('Warning:')) {
      originalConsole.error(message);
    }
  }),
  debug: jest.fn(),
};

// Mock process.exit to prevent tests from actually exiting
const originalExit = process.exit;
process.exit = jest.fn((code) => {
  throw new Error(`EXIT_CODE_${code || 0}`);
});

// Restore originals after all tests
if (typeof afterAll !== 'undefined') {
  afterAll(() => {
    global.console = originalConsole;
    process.exit = originalExit;
  });
}

module.exports = {};