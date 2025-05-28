const { jest } = require('@jest/globals');

// Mock BlockchainAIVerificationService
const mockBlockchainAIVerificationService = {
  verifyExternalProof: jest.fn().mockResolvedValue(true),
  createVerifiedSummary: jest
    .fn()
    .mockImplementation(async (todos, summary, privacyLevel) => ({
      summary,
      verification: {
        id: 'mock-verification-id',
        requestHash: 'mock-request-hash',
        responseHash: 'mock-response-hash',
        user: 'mock-user',
        provider: 'mock-provider',
        timestamp: Date.now(),
        verificationType: 'SUMMARIZE',
        metadata: { privacyLevel },
      },
      metadata: { privacyLevel },
    })),
  
  // Additional security methods for comprehensive testing
  verifyAIOperation: jest.fn().mockImplementation(async (operation) => {
    // Simulate content integrity checking
    if (operation.content && operation.expectedHash) {
      const contentHash = Buffer.from(operation.content).toString('hex');
      if (contentHash !== operation.expectedHash) {
        throw new Error('Content integrity verification failed - content has been tampered with');
      }
    }
    
    return {
      verified: true,
      transactionId: 'mock-tx-id',
      timestamp: Date.now(),
      contentHash: operation.expectedHash || 'mock-hash',
    };
  }),
  
  createVerification: jest.fn().mockImplementation(async (params) => {
    // Simulate signature verification
    if (params.signature && !params.signature.startsWith('valid_')) {
      throw new Error('Invalid signature for verification');
    }
    
    // Simulate replay attack prevention
    if (params.timestamp) {
      const now = Date.now();
      const timestamp = parseInt(params.timestamp);
      if (now - timestamp > 300000) { // 5 minutes
        throw new Error('Timestamp too old - potential replay attack');
      }
    }
    
    return {
      id: 'mock-verification-id',
      hash: 'mock-hash',
      timestamp: Date.now(),
    };
  }),
  
  validateSignature: jest.fn().mockImplementation((signature, message, publicKey) => {
    // Mock signature validation
    if (signature === 'invalid_signature') {
      return false;
    }
    if (!signature || !message || !publicKey) {
      return false;
    }
    return signature.startsWith('valid_');
  }),
  
  getVerificationHistory: jest.fn().mockResolvedValue([
    {
      id: 'verification-1',
      timestamp: Date.now() - 1000,
      operation: 'summarize',
      verified: true,
    }
  ]),
  
  checkPermissions: jest.fn().mockImplementation((user, action) => {
    const adminUsers = ['admin', 'system'];
    const privilegedActions = ['delete_verification', 'modify_verification'];
    
    if (privilegedActions.includes(action) && !adminUsers.includes(user)) {
      throw new Error('Insufficient permissions for blockchain verification action');
    }
    
    return true;
  }),
  
  // Content integrity methods
  verifyContentIntegrity: jest.fn().mockImplementation(async (content, expectedHash) => {
    const actualHash = Buffer.from(content).toString('hex');
    if (actualHash !== expectedHash) {
      throw new Error('Content integrity verification failed');
    }
    return true;
  }),
  
  detectTampering: jest.fn().mockImplementation(async (originalData, currentData) => {
    const originalHash = Buffer.from(JSON.stringify(originalData)).toString('hex');
    const currentHash = Buffer.from(JSON.stringify(currentData)).toString('hex');
    return originalHash !== currentHash;
  }),
  
  // Replay attack prevention
  validateTimestamp: jest.fn().mockImplementation((timestamp, maxAge = 300000) => {
    const now = Date.now();
    const diff = now - parseInt(timestamp);
    if (diff > maxAge) {
      throw new Error('Timestamp too old - potential replay attack');
    }
    return true;
  }),
  
  // Permission enforcement
  enforcePermissions: jest.fn().mockImplementation(async (user, action, context) => {
    if (!mockBlockchainAIVerificationService.checkPermissions(user, action)) {
      throw new Error(`Permission denied for user ${user} to perform ${action}`);
    }
    return true;
  }),
};

const MockBlockchainAIVerificationServiceClass = jest
  .fn()
  .mockImplementation(() => mockBlockchainAIVerificationService);

module.exports = {
  BlockchainAIVerificationService: MockBlockchainAIVerificationServiceClass,
  default: MockBlockchainAIVerificationServiceClass,
};
