// Jest setup file for global configurations
require('jest-extended');
const sinon = require('sinon');

// Load global mocks - commented out to fix jest conflict
// require('./tests/setup/global-mocks.js');

// Global test timeout
jest.setTimeout(30000);

// Fix Node.js fs module property assignment issues
const fs = require('fs');
const fsPromises = require('fs/promises');

// Create writable property descriptors for fs methods
const fsMethodsToMock = ['readFileSync', 'writeFileSync', 'existsSync', 'mkdirSync', 'readFile', 'writeFile', 'access', 'mkdir', 'readdir', 'stat', 'lstat'];

fsMethodsToMock.forEach(method => {
  if (fs[method]) {
    Object.defineProperty(fs, method, {
      value: fs[method],
      writable: true,
      configurable: true,
      enumerable: true
    });
  }
  
  if (fsPromises[method]) {
    Object.defineProperty(fsPromises, method, {
      value: fsPromises[method],
      writable: true,
      configurable: true,
      enumerable: true
    });
  }
});

// Fix crypto module property assignment issues
const crypto = require('crypto');
const cryptoMethodsToMock = ['randomUUID', 'randomBytes', 'createHash', 'createCipher', 'createDecipher', 'pbkdf2Sync', 'timingSafeEqual'];

cryptoMethodsToMock.forEach(method => {
  if (crypto[method]) {
    Object.defineProperty(crypto, method, {
      value: crypto[method],
      writable: true,
      configurable: true,
      enumerable: true
    });
  }
});

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
  
  // Jest mock cleanup
  if (typeof global.clearAllMockCalls === 'function') {
    global.clearAllMockCalls();
  }
  
  // Reset mock file system
  if (global.mockUtils && typeof global.mockUtils.resetAllMocks === 'function') {
    global.mockUtils.resetAllMocks();
  }
  
  // Force garbage collection
  if (global.gc) {
    global.gc();
  }
};

// Add global mock utilities for property assignment fixes
global.createConfigurableProperty = function(obj, propName, value) {
  Object.defineProperty(obj, propName, {
    value: value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
};

global.makeMethodConfigurable = function(obj, methodName) {
  if (obj[methodName] && typeof obj[methodName] === 'function') {
    const originalMethod = obj[methodName];
    Object.defineProperty(obj, methodName, {
      value: originalMethod,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
};

// Global helper for safe mock property assignment
global.safeAssignMockProperty = function(mockObj, propName, mockImplementation) {
  try {
    if (typeof mockImplementation === 'function') {
      mockObj[propName] = jest.fn(mockImplementation);
    } else {
      mockObj[propName] = mockImplementation;
    }
    
    // Ensure property is configurable
    global.createConfigurableProperty(mockObj, propName, mockObj[propName]);
    
    return true;
  } catch (error) {
    console.warn(`Failed to assign mock property ${propName}:`, error.message);
    return false;
  }
};