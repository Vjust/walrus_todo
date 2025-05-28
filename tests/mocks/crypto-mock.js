/**
 * Mock for Node.js crypto module to fix UUID issues in tests
 */

// Mock crypto functions for testing
const cryptoMock = {
  randomUUID: () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9),
  randomBytes: size => Buffer.alloc(size, 0),
  createHash: algorithm => ({
    update: () => cryptoMock.createHash(algorithm),
    digest: encoding =>
      encoding === 'hex' ? 'mock-hash-hex' : Buffer.from('mock-hash'),
  }),
  createCipher: () => ({
    update: () => Buffer.from('encrypted'),
    final: () => Buffer.from(''),
  }),
  createDecipher: () => ({
    update: () => Buffer.from('decrypted'),
    final: () => Buffer.from(''),
  }),
  pbkdf2Sync: () => Buffer.from('mock-derived-key'),
  timingSafeEqual: () => true,
  constants: {
    SSL_OP_NO_TLSv1: 0,
    SSL_OP_NO_TLSv1_1: 0,
  },
};

module.exports = cryptoMock;
