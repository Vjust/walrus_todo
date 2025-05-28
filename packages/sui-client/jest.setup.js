// Jest setup for sui-client package
import '@testing-library/jest-dom';

// Mock fetch for configuration loading
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: false,
    status: 404,
    json: () => Promise.resolve({}),
  })
);

// Mock localStorage for browser compatibility
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
});

// Mock WebSocket for compatibility
global.WebSocket = jest.fn();

// Suppress console warnings for expected warnings in tests
const originalWarn = console.warn;
console.warn = (...args) => {
  if (
    args[0]?.includes?.('Using fallback configuration') ||
    args[0]?.includes?.('Failed to load') ||
    args[0]?.includes?.('could not determine') ||
    args[0]?.includes?.('version') ||
    args[0]?.includes?.('Hook error')
  ) {
    return; // Suppress expected warnings
  }
  originalWarn(...args);
};

// Suppress console.debug for cleaner test output
console.debug = jest.fn();