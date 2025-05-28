// Jest setup for sui-client package

// Mock browser globals for Node.js environment
global.window = undefined;
global.document = undefined;
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Mock fetch for configuration loading
global.fetch = jest.fn();

// Suppress console.warn for expected warnings in tests
const originalWarn = console.warn;
console.warn = (...args) => {
  if (
    args[0]?.includes?.('Using fallback configuration') ||
    args[0]?.includes?.('Failed to load')
  ) {
    return; // Suppress expected warnings
  }
  originalWarn(...args);
};