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
};

const MockBlockchainAIVerificationServiceClass = jest
  .fn()
  .mockImplementation(() => mockBlockchainAIVerificationService);

module.exports = {
  BlockchainAIVerificationService: MockBlockchainAIVerificationServiceClass,
  default: MockBlockchainAIVerificationServiceClass,
};
