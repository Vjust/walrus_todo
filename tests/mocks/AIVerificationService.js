// Mock AIVerificationService
const mockAIVerificationService = {
  createVerification: jest.fn().mockResolvedValue({
    id: 'mock-verification-id',
    requestHash: 'mock-request-hash',
    responseHash: 'mock-response-hash',
    user: 'mock-user',
    provider: 'mock-provider',
    timestamp: Date.now(),
    verificationType: 'SUMMARIZE',
    metadata: {},
  }),
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
  listVerifications: jest.fn().mockResolvedValue([]),
  verifyRecord: jest.fn().mockResolvedValue(true),

  // Additional methods for security tests
  generateProof: jest.fn().mockImplementation(async (actionType, request, response) => {
    return {
      proofId: 'mock-proof-id',
      signature: 'valid_mock-signature',
      data: { actionType, request, response },
    };
  }),

  verifyProof: jest.fn().mockImplementation(async (proofId, signature, data) => {
    if (signature === 'tampered-signature') return false;
    if (data.response === 'tampered response') return false;
    return signature.startsWith('valid_');
  }),
};

const MockAIVerificationServiceClass = jest
  .fn()
  .mockImplementation(() => mockAIVerificationService);

module.exports = {
  AIVerificationService: MockAIVerificationServiceClass,
  default: MockAIVerificationServiceClass,
};
