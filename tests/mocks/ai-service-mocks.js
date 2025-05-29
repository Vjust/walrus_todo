// Comprehensive mocks for AI Service dependencies

const { jest } = require('@jest/globals');

// Setup proper Jest environment
if (typeof jest === 'undefined') {
  global.jest = require('jest-mock');
}

// Mock AIModelAdapter interface
const createMockAIModelAdapter = () => ({
  getProviderName: jest.fn().mockReturnValue('mock-provider'),
  getModelName: jest.fn().mockReturnValue('mock-model'),
  complete: jest.fn().mockResolvedValue('Mock AI response'),
  completeStructured: jest.fn().mockResolvedValue({
    result: {},
    modelName: 'mock-model',
    provider: 'mock-provider',
    timestamp: Date.now(),
  }),
  processWithPromptTemplate: jest.fn().mockResolvedValue({
    result: 'Mock template response',
    modelName: 'mock-model',
    provider: 'mock-provider',
    timestamp: Date.now(),
  }),
  cancelAllRequests: jest.fn(),
});

// Mock AIProviderFactory
const mockAIProviderFactory = {
  createProvider: jest.fn().mockImplementation((params = {}) => {
    return createMockAIModelAdapter();
  }),
  getDefaultProvider: jest.fn().mockReturnValue(createMockAIModelAdapter()),
  isAIFeatureRequested: jest.fn().mockReturnValue(false),
  setAIFeatureRequested: jest.fn(),
};

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
};

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

// Mock SecureCredentialManager
const mockSecureCredentialManager = {
  setCredential: jest.fn().mockResolvedValue({
    id: 'mock-credential-id',
    providerName: 'mock-provider',
  }),
  getCredential: jest.fn().mockImplementation(provider => {
    if (
      provider === 'non-existent' ||
      provider === 'unauthorized' ||
      provider === 'expired'
    ) {
      return Promise.reject(
        new Error(`Credential not found for provider: ${provider}`)
      );
    }
    return Promise.resolve('mock-api-key');
  }),
  getCredentialObject: jest.fn().mockImplementation(provider => {
    if (provider === 'non-existent' || provider === 'unauthorized') {
      return Promise.reject(
        new Error(`Credential not found for provider: ${provider}`)
      );
    }
    if (provider === 'expired') {
      return Promise.reject(
        new Error(`Credential for provider "${provider}" has expired`)
      );
    }
    return Promise.resolve({
      id: 'mock-credential-id',
      providerName: provider,
      credentialType: 'API_KEY',
      credentialValue: 'mock-api-key',
      isVerified: false,
      storageOptions: { encrypt: true },
      createdAt: Date.now(),
      permissionLevel: 'STANDARD',
    });
  }),
  hasCredential: jest.fn().mockResolvedValue(true),
  removeCredential: jest.fn().mockResolvedValue(true),
  verifyCredential: jest.fn().mockResolvedValue(true),
  updatePermissions: jest.fn().mockImplementation((provider, level) => {
    if (provider === 'non-existent') {
      return Promise.reject(new Error('Provider not found'));
    }
    if (level === 'ADMIN') {
      return Promise.reject(
        new Error('Unauthorized permission escalation attempt')
      );
    }
    return Promise.resolve({ providerName: provider, permissionLevel: level });
  }),
  generateCredentialProof: jest.fn().mockResolvedValue('mock-proof'),
  listCredentials: jest.fn().mockResolvedValue([]),
  setBlockchainAdapter: jest.fn(),
};

// Mock SecureCredentialService
const mockSecureCredentialService = {
  getCredential: jest.fn().mockResolvedValue('mock-api-key'),
  setCredential: jest.fn().mockResolvedValue(true),
  hasCredential: jest.fn().mockResolvedValue(true),
};

// Mock Permission Manager
const mockPermissionManager = {
  checkPermission: jest.fn().mockReturnValue(true),
  verifyOperationPermission: jest.fn().mockResolvedValue(true),
};

// Mock initializePermissionManager
const mockInitializePermissionManager = jest
  .fn()
  .mockReturnValue(mockPermissionManager);

// Mock BlockchainVerifier
const mockBlockchainVerifier = {
  verifyPermission: jest.fn().mockResolvedValue(true),
  checkUserPermission: jest.fn().mockResolvedValue(true),
  verifySignature: jest.fn().mockReturnValue(true),
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
};

// Mock Logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  getInstance: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
};

module.exports = {
  createMockAIModelAdapter,
  mockAIProviderFactory,
  mockAIVerificationService,
  mockBlockchainAIVerificationService,
  mockSecureCredentialManager,
  mockSecureCredentialService,
  mockPermissionManager,
  mockInitializePermissionManager,
  mockBlockchainVerifier,
  mockLogger,

  // Export individual classes for Jest mocking
  AIProviderFactory: mockAIProviderFactory,
  AIVerificationService: jest
    .fn()
    .mockImplementation(() => mockAIVerificationService),
  BlockchainAIVerificationService: jest
    .fn()
    .mockImplementation(() => mockBlockchainAIVerificationService),
  SecureCredentialManager: jest
    .fn()
    .mockImplementation(() => mockSecureCredentialManager),
  secureCredentialManager: mockSecureCredentialManager,
  secureCredentialService: mockSecureCredentialService,
  initializePermissionManager: mockInitializePermissionManager,
  BlockchainVerifier: jest
    .fn()
    .mockImplementation(() => mockBlockchainVerifier),
  Logger: jest.fn().mockImplementation(() => mockLogger),
};
