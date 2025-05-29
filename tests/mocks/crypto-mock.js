/**
 * Mock for Node.js crypto module to fix UUID issues in tests
 * Ensures all properties are configurable and writable to prevent assignment errors
 */

// Counter for unique UUIDs in tests
let uuidCounter = 0;

// Mock crypto functions for testing
const cryptoMock = {
  randomUUID: jest.fn(() => {
    uuidCounter++;
    return `mock-uuid-${uuidCounter.toString().padStart(4, '0')}-${Math.random().toString(36).substr(2, 5)}`;
  }),
  
  randomBytes: jest.fn((size) => {
    const buffer = Buffer.alloc(size);
    // Fill with deterministic "random" data for testing
    for (let i = 0; i < size; i++) {
      buffer[i] = (i + 42) % 256;
    }
    return buffer;
  }),
  
  createHash: jest.fn((algorithm) => {
    const mockHash = {
      update: jest.fn().mockReturnThis(),
      digest: jest.fn((encoding) => {
        if (encoding === 'hex') {
          return 'mock-hash-hex-' + algorithm;
        } else if (encoding === 'base64') {
          return 'mock-hash-base64-' + algorithm;
        }
        return Buffer.from('mock-hash-' + algorithm);
      }),
    };
    return mockHash;
  }),
  
  createCipher: jest.fn((algorithm, password) => ({
    update: jest.fn(() => Buffer.from('encrypted-data')),
    final: jest.fn(() => Buffer.from('final-encrypted')),
  })),
  
  createDecipher: jest.fn((algorithm, password) => ({
    update: jest.fn(() => Buffer.from('decrypted-data')),
    final: jest.fn(() => Buffer.from('final-decrypted')),
  })),
  
  pbkdf2Sync: jest.fn((password, salt, iterations, keylen, digest) => {
    return Buffer.from(`mock-derived-key-${keylen}`, 'utf8');
  }),
  
  timingSafeEqual: jest.fn((a, b) => {
    // Mock always returns true for testing
    return true;
  }),
  
  scrypt: jest.fn((password, salt, keylen, callback) => {
    if (callback) {
      callback(null, Buffer.from(`mock-scrypt-key-${keylen}`));
    } else {
      return Promise.resolve(Buffer.from(`mock-scrypt-key-${keylen}`));
    }
  }),
  
  scryptSync: jest.fn((password, salt, keylen) => {
    return Buffer.from(`mock-scrypt-sync-key-${keylen}`);
  }),
  
  constants: {
    SSL_OP_NO_TLSv1: 0,
    SSL_OP_NO_TLSv1_1: 0,
    SSL_OP_NO_TLSv1_2: 0,
    SSL_OP_NO_SSLv2: 0,
    SSL_OP_NO_SSLv3: 0,
  },
  
  // Webcrypto API mock for modern crypto operations
  webcrypto: {
    getRandomValues: jest.fn((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    }),
    subtle: {
      encrypt: jest.fn(() => Promise.resolve(new ArrayBuffer(32))),
      decrypt: jest.fn(() => Promise.resolve(new ArrayBuffer(32))),
      sign: jest.fn(() => Promise.resolve(new ArrayBuffer(64))),
      verify: jest.fn(() => Promise.resolve(true)),
      digest: jest.fn(() => Promise.resolve(new ArrayBuffer(32))),
      generateKey: jest.fn(() => Promise.resolve({})),
      importKey: jest.fn(() => Promise.resolve({})),
      exportKey: jest.fn(() => Promise.resolve(new ArrayBuffer(32))),
    },
  },
  
  // Additional crypto utilities
  randomInt: jest.fn((max) => Math.floor(Math.random() * max)),
  randomFillSync: jest.fn((buffer) => {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
    return buffer;
  }),
  
  // Test utilities
  _resetCounters: () => {
    uuidCounter = 0;
  },
  
  _getCallCounts: () => ({
    randomUUID: cryptoMock.randomUUID.mock.calls.length,
    randomBytes: cryptoMock.randomBytes.mock.calls.length,
    createHash: cryptoMock.createHash.mock.calls.length,
  }),
};

// Ensure all properties are configurable and writable
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

module.exports = cryptoMock;
