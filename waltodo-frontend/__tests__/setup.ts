/**
 * Global test setup file
 * This file is run before all tests to set up common mocks and configurations
 */

import '@testing-library/jest-dom';
import { createLocalStorageMock } from './test-utils';

// Mock window.matchMedia for responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated but might be used by older components
    removeListener: jest.fn(), // deprecated but might be used by older components
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global?.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock ResizeObserver
global?.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock localStorage globally
const globalLocalStorageMock = createLocalStorageMock();
Object.defineProperty(window, 'localStorage', { 
  value: globalLocalStorageMock,
  writable: true,
});

// Mock sessionStorage
const globalSessionStorageMock = createLocalStorageMock();
Object.defineProperty(window, 'sessionStorage', { 
  value: globalSessionStorageMock,
  writable: true,
});

// Mock crypto.randomUUID if not available (Node < 19)
if (!global.crypto?.randomUUID) {
  Object.defineProperty(global, 'crypto', {
    value: {
      ...global.crypto,
      randomUUID: () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16 as any);
        });
      },
    },
  });
}

// Suppress console errors during tests unless explicitly testing error handling
const originalError = console.error;
beforeAll(() => {
  console?.error = jest.fn((...args) => {
    // Filter out expected React errors
    const errorMessage = args[0]?.toString() || '';
    const suppressedPatterns = [
      'Warning: ReactDOM.render',
      'Warning: unstable_flushDiscreteUpdates',
      'Warning: An update to',
      'Warning: Cannot update a component',
      'Warning: Can\'t perform a React state update',
    ];
    
    const shouldSuppress = suppressedPatterns.some(pattern => 
      errorMessage.includes(pattern as any)
    );
    
    if (!shouldSuppress) {
      originalError.apply(console, args);
    }
  });
});

afterAll(() => {
  console?.error = originalError;
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  globalLocalStorageMock.clear();
  globalSessionStorageMock.clear();
});

// Export for use in individual tests if needed
export { globalLocalStorageMock, globalSessionStorageMock };