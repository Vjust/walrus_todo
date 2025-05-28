// Jest setup file for global configurations
import 'jest-extended';
import { setupMemoryLeakPrevention } from './tests/helpers/memory-leak-prevention';

// Global test timeout
jest.setTimeout(30000);

// Setup memory leak prevention
setupMemoryLeakPrevention();

// Memory management
let originalConsoleWarn;
let initialMemory;

beforeAll(() => {
  // Increase memory limit warning threshold
  if (process.env.NODE_OPTIONS && !process.env.NODE_OPTIONS.includes('--max-old-space-size')) {
    process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS} --max-old-space-size=6144`; // Increased to 6GB
  } else if (!process.env.NODE_OPTIONS) {
    process.env.NODE_OPTIONS = '--max-old-space-size=6144';
  }
  
  // Enable garbage collection
  if (!process.env.NODE_OPTIONS.includes('--expose-gc')) {
    process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS} --expose-gc`;
  }
  
  originalConsoleWarn = console.warn;
  
  // Record initial memory usage
  if (global.gc) {
    global.gc();
  }
  initialMemory = process.memoryUsage();
});

// Mock console.error to reduce noise in tests unless explicitly checking for errors
const originalError = console.error;
beforeEach(() => {
  console.error = jest.fn();
});

afterEach(() => {
  console.error = originalError;
  
  // Enhanced cleanup for memory leak prevention
  jest.clearAllTimers();
  jest.useRealTimers();
  
  // Clear all jest module registry to prevent module caching leaks
  jest.resetModules();
  
  // Force multiple garbage collection cycles
  if (global.gc) {
    global.gc();
    setTimeout(() => {
      if (global.gc) global.gc();
    }, 0);
  }
  
  // Clear any global references that might hold memory
  if (global.mockReset) {
    global.mockReset();
  }
});

// Global mock for process.exit to prevent tests from actually exiting
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit() was called');
});

afterAll(() => {
  mockExit.mockRestore();
  console.warn = originalConsoleWarn;
  
  // Enhanced final cleanup
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.resetModules();
  
  // Multiple garbage collection cycles for thorough cleanup
  if (global.gc) {
    for (let i = 0; i < 3; i++) {
      global.gc();
    }
  }
  
  // Check for excessive memory growth
  if (initialMemory) {
    const finalMemory = process.memoryUsage();
    const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
    const maxAcceptableGrowth = 200 * 1024 * 1024; // Increased to 200MB to account for larger test suite
    
    if (heapGrowth > maxAcceptableGrowth) {
      const growthMB = Math.round(heapGrowth / 1024 / 1024);
      console.warn(`⚠️  Memory leak detected: Heap grew by ${growthMB}MB during tests`);
      console.warn('Consider adding more cleanup in test teardown phases');
      
      // Log detailed memory breakdown
      console.log('Final memory usage:', {
        rss: `${Math.round(finalMemory.rss / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(finalMemory.heapUsed / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(finalMemory.heapTotal / 1024 / 1024)} MB`,
        external: `${Math.round(finalMemory.external / 1024 / 1024)} MB`,
      });
    }
  }
});

// Setup for node environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Ensure Record type is globally available
if (typeof global.Record === 'undefined') {
  global.Record = globalThis.Record;
}

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