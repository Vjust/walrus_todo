// Jest setup file for global configurations
import 'jest-extended';

// Global test timeout
jest.setTimeout(30000);

// Mock console.error to reduce noise in tests unless explicitly checking for errors
const originalError = console.error;
beforeEach(() => {
  console.error = jest.fn();
});

afterEach(() => {
  console.error = originalError;
});

// Global mock for process.exit to prevent tests from actually exiting
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit() was called');
});

afterAll(() => {
  mockExit.mockRestore();
});

// Setup for node environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock AbortController if not available
if (typeof global.AbortController === 'undefined') {
  global.AbortController = class AbortController {
    signal = {
      aborted: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
    abort = jest.fn(() => {
      this.signal.aborted = true;
    });
  };
}