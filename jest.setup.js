// Jest setup file for global configurations
require('jest-extended');
const sinon = require('sinon');

// Load global mocks - commented out to fix jest conflict
// require('./tests/setup/global-mocks.js');

// Global test timeout
jest.setTimeout(30000);

// Memory management
let originalConsoleWarn = console.warn;

// Memory configuration setup
try {
  const { setupMemoryLeakPrevention } = require('./tests/helpers/memory-leak-prevention');
  setupMemoryLeakPrevention();
} catch (error) {
  console.warn('Memory leak prevention setup failed:', error.message);
}

// Memory configuration - handled by test-runner.js to prevent conflicts
if (!process.env.JEST_WORKER_ID) {
  // Only log in main process, not workers
  const memUsage = process.memoryUsage();
  console.log(`⚙️ Jest setup complete - Initial memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
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