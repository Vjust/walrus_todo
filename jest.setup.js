// Jest setup file for global configurations
require('jest-extended');
const sinon = require('sinon');

// Load global mocks
require('./tests/setup/global-mocks.js');

// Global test timeout
jest.setTimeout(30000);

// Memory management
let originalConsoleWarn = console.warn;

// Memory configuration - don't override if already set by package.json scripts
// This prevents conflicts between different configurations
if (!process.env.JEST_WORKER_ID) {
  // Only set in main process, not workers
  if (!process.env.NODE_OPTIONS || !process.env.NODE_OPTIONS.includes('--max-old-space-size')) {
    console.log('⚙️  Setting default memory configuration for Jest');
  }
}

// Record initial memory usage
let initialMemory;
if (global.gc) {
  global.gc();
}
initialMemory = process.memoryUsage();

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

// Global Sinon helper for safe stub creation
global.createSafeStub = function(obj, method, implementation) {
  // Check if already stubbed and restore first
  if (obj[method] && typeof obj[method].restore === 'function') {
    obj[method].restore();
  }
  return sinon.stub(obj, method).callsFake(implementation || (() => {}));
};

// Global Sinon sandbox for tests that need isolated stubs
global.createSinonSandbox = function() {
  return sinon.createSandbox();
};

// Global Sinon cleanup helper
global.restoreAllSinon = function() {
  try {
    sinon.restore();
  } catch (e) {
    // Ignore errors if nothing to restore
  }
};

// Enhanced cleanup helper
global.performCleanup = function() {
  // Sinon cleanup
  global.restoreAllSinon();
  
  // Force garbage collection
  if (global.gc) {
    global.gc();
  }
};