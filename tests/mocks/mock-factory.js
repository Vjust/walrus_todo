/**
 * Mock factory for creating comprehensive Jest mocks with proper property handling
 * Fixes mock method expectations and property assignment issues
 */

/**
 * Creates a Jest mock with configurable properties
 * @param {Object} methods - Object containing method implementations
 * @param {Object} properties - Object containing property values
 * @returns {Object} Mock object with proper property descriptors
 */
function createConfigurableMock(methods = {}, properties = {}) {
  const mock = {};
  
  // Add methods as Jest mocks
  Object.keys(methods).forEach(methodName => {
    const implementation = methods[methodName];
    
    if (typeof implementation === 'function') {
      mock[methodName] = jest.fn(implementation);
    } else {
      mock[methodName] = jest.fn().mockImplementation(implementation);
    }
    
    // Ensure method is configurable
    Object.defineProperty(mock, methodName, {
      value: mock[methodName],
      writable: true,
      configurable: true,
      enumerable: true,
    });
  });
  
  // Add properties
  Object.keys(properties).forEach(propName => {
    Object.defineProperty(mock, propName, {
      value: properties[propName],
      writable: true,
      configurable: true,
      enumerable: true,
    });
  });
  
  return mock;
}

/**
 * Creates a class mock with proper prototype handling
 * @param {Function} OriginalClass - The class to mock
 * @param {Object} methodImplementations - Mock implementations for methods
 * @returns {jest.MockedClass} Mocked class
 */
function createClassMock(OriginalClass, methodImplementations = {}) {
  const MockedClass = jest.fn().mockImplementation((...args) => {
    const instance = {};
    
    // Add prototype methods
    if (OriginalClass.prototype) {
      Object.getOwnPropertyNames(OriginalClass.prototype).forEach(name => {
        if (name !== 'constructor') {
          const implementation = methodImplementations[name];
          if (implementation) {
            instance[name] = jest.fn(implementation);
          } else {
            instance[name] = jest.fn();
          }
          
          // Ensure method is configurable
          Object.defineProperty(instance, name, {
            value: instance[name],
            writable: true,
            configurable: true,
            enumerable: true,
          });
        }
      });
    }
    
    // Add custom method implementations
    Object.keys(methodImplementations).forEach(methodName => {
      if (!instance[methodName]) {
        const implementation = methodImplementations[methodName];
        instance[methodName] = jest.fn(implementation);
        
        Object.defineProperty(instance, methodName, {
          value: instance[methodName],
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
    });
    
    return instance;
  });
  
  // Mock static methods
  if (OriginalClass) {
    Object.getOwnPropertyNames(OriginalClass).forEach(name => {
      if (name !== 'prototype' && name !== 'name' && name !== 'length') {
        const descriptor = Object.getOwnPropertyDescriptor(OriginalClass, name);
        if (descriptor && typeof descriptor.value === 'function') {
          MockedClass[name] = jest.fn();
        }
      }
    });
  }
  
  return MockedClass;
}

/**
 * Creates a mock with call tracking and validation
 * @param {Object} config - Configuration object
 * @returns {Object} Mock with call tracking
 */
function createTrackingMock(config = {}) {
  const {
    methods = {},
    expectedCalls = {},
    validateCalls = false,
  } = config;
  
  const mock = createConfigurableMock(methods);
  const callTracker = {};
  
  // Initialize call tracking
  Object.keys(methods).forEach(methodName => {
    callTracker[methodName] = {
      calls: [],
      callCount: 0,
      expectedCount: expectedCalls[methodName] || 0,
    };
    
    // Wrap the mock to track calls
    const originalMock = mock[methodName];
    mock[methodName] = jest.fn((...args) => {
      callTracker[methodName].calls.push(args);
      callTracker[methodName].callCount++;
      return originalMock(...args);
    });
    
    Object.defineProperty(mock, methodName, {
      value: mock[methodName],
      writable: true,
      configurable: true,
      enumerable: true,
    });
  });
  
  // Add tracking utilities
  mock._getCallTracker = () => callTracker;
  mock._validateExpectedCalls = () => {
    if (!validateCalls) return true;
    
    const failures = [];
    Object.keys(expectedCalls).forEach(methodName => {
      const expected = expectedCalls[methodName];
      const actual = callTracker[methodName]?.callCount || 0;
      if (actual !== expected) {
        failures.push(`${methodName}: expected ${expected}, got ${actual}`);
      }
    });
    
    if (failures.length > 0) {
      throw new Error(`Call expectation failures: ${failures.join(', ')}`);
    }
    return true;
  };
  
  mock._resetCallTracker = () => {
    Object.keys(callTracker).forEach(methodName => {
      callTracker[methodName].calls = [];
      callTracker[methodName].callCount = 0;
    });
  };
  
  return mock;
}

/**
 * Creates a file system mock that supports property assignment
 * @returns {Object} File system mock
 */
function createFileSystemMock() {
  const fsMock = require('./fs-mock.js');
  
  // Ensure all methods are properly configured
  Object.keys(fsMock).forEach(key => {
    if (typeof fsMock[key] === 'function') {
      Object.defineProperty(fsMock, key, {
        value: fsMock[key],
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
  });
  
  return fsMock;
}

/**
 * Creates a crypto mock that supports property assignment
 * @returns {Object} Crypto mock
 */
function createCryptoMock() {
  const cryptoMock = require('./crypto-mock.js');
  
  // Ensure all methods are properly configured
  Object.keys(cryptoMock).forEach(key => {
    if (typeof cryptoMock[key] === 'function') {
      Object.defineProperty(cryptoMock, key, {
        value: cryptoMock[key],
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
  });
  
  return cryptoMock;
}

/**
 * Creates a comprehensive module mock
 * @param {string} moduleName - Name of the module to mock
 * @param {Object} exports - Object containing mock exports
 * @returns {Object} Module mock
 */
function createModuleMock(moduleName, exports = {}) {
  const mock = {};
  
  Object.keys(exports).forEach(exportName => {
    const exportValue = exports[exportName];
    
    if (typeof exportValue === 'function') {
      // Mock functions and classes
      mock[exportName] = jest.fn(exportValue);
    } else if (typeof exportValue === 'object' && exportValue !== null) {
      // Mock objects recursively
      mock[exportName] = createConfigurableMock(exportValue);
    } else {
      // Mock primitive values
      mock[exportName] = exportValue;
    }
    
    Object.defineProperty(mock, exportName, {
      value: mock[exportName],
      writable: true,
      configurable: true,
      enumerable: true,
    });
  });
  
  // Add default export if not explicitly provided
  if (!mock.default) {
    mock.default = mock;
  }
  
  return mock;
}

/**
 * Ensures all properties of an object are configurable
 * @param {Object} obj - Object to make configurable
 * @returns {Object} Object with configurable properties
 */
function makePropertiesConfigurable(obj) {
  Object.keys(obj).forEach(key => {
    const descriptor = Object.getOwnPropertyDescriptor(obj, key);
    if (descriptor && !descriptor.configurable) {
      Object.defineProperty(obj, key, {
        ...descriptor,
        configurable: true,
        writable: true,
      });
    }
  });
  return obj;
}

/**
 * Resets all Jest mocks in an object
 * @param {Object} mockObject - Object containing Jest mocks
 */
function resetAllMocks(mockObject) {
  Object.keys(mockObject).forEach(key => {
    const value = mockObject[key];
    if (value && typeof value.mockReset === 'function') {
      value.mockReset();
    } else if (value && typeof value === 'object') {
      resetAllMocks(value);
    }
  });
}

/**
 * Clears all Jest mock calls in an object
 * @param {Object} mockObject - Object containing Jest mocks
 */
function clearAllMockCalls(mockObject) {
  Object.keys(mockObject).forEach(key => {
    const value = mockObject[key];
    if (value && typeof value.mockClear === 'function') {
      value.mockClear();
    } else if (value && typeof value === 'object') {
      clearAllMockCalls(value);
    }
  });
}

module.exports = {
  createConfigurableMock,
  createClassMock,
  createTrackingMock,
  createFileSystemMock,
  createCryptoMock,
  createModuleMock,
  makePropertiesConfigurable,
  resetAllMocks,
  clearAllMockCalls,
};