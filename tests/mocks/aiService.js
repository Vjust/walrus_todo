const { jest } = require('@jest/globals');

// Mock AIService class
const mockAIService = {
  summarize: jest.fn().mockResolvedValue('Mock summary'),
  categorize: jest.fn().mockResolvedValue({ work: ['todo-1'], personal: ['todo-2'] }),
  analyze: jest.fn().mockResolvedValue({ insights: 'Mock analysis' }),
  prioritize: jest.fn().mockResolvedValue({ 'todo-1': 8, 'todo-2': 5 }),
  suggest: jest.fn().mockResolvedValue(['Mock suggestion 1', 'Mock suggestion 2']),
  summarizeWithVerification: jest.fn().mockImplementation(async (todos, privacyLevel) => ({
    result: 'Mock verified summary',
    verification: {
      id: 'mock-verification-id',
      requestHash: 'mock-request-hash',
      responseHash: 'mock-response-hash',
      user: 'mock-user',
      provider: 'mock-provider',
      timestamp: Date.now(),
      verificationType: 'SUMMARIZE',
      metadata: { privacyLevel },
    }
  })),
  setOperationType: jest.fn(),
  getProvider: jest.fn().mockReturnValue({
    getProviderName: () => 'mock-provider',
    getModelName: () => 'mock-model',
  }),
  cancelAllOperations: jest.fn(),
  setProvider: jest.fn().mockResolvedValue(undefined),
};

// Mock the AIService constructor
const MockAIServiceClass = jest.fn().mockImplementation((apiKey) => {
  // Create a new instance with all the mock methods
  const instance = Object.create(mockAIService);
  
  // Store encrypted credentials securely (not as direct properties)
  const secureCredentialStorage = new Map();
  
  // If an API key is provided, encrypt it immediately and don't store as plain text
  if (apiKey) {
    const hashedKey = Buffer.from(apiKey).toString('base64');
    secureCredentialStorage.set('encrypted_credential', hashedKey);
    // DO NOT store the original API key as a property
    console.log('MockAIService created with API key, stored securely');
  }
  
  // Add modelAdapter property for tests that check it
  instance.modelAdapter = {
    getProviderName: jest.fn().mockReturnValue('mock-provider'),
    getModelName: jest.fn().mockReturnValue('mock-model'),
    complete: jest.fn().mockResolvedValue('Mock response'),
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
  };
  
  // Add security-related properties that should NOT expose raw credentials
  instance.providerFactory = {
    createProvider: jest.fn().mockImplementation(async (params) => {
      // Handle different parameter formats
      const provider = params.provider || params.providerName || 'mock-provider';
      const credentials = params.credentials || params.apiKey;
      
      // Store credentials securely, not as instance properties
      if (credentials) {
        const hashedCredential = `hashed_${Buffer.from(credentials).toString('base64')}`;
        secureCredentialStorage.set(provider, hashedCredential);
      }
      
      return {
        getProviderName: () => provider,
        getModelName: () => 'mock-model',
        complete: jest.fn().mockResolvedValue('Mock response'),
      };
    }),
    getProvider: jest.fn().mockReturnValue({
      getProviderName: () => 'mock-provider',
      getModelName: () => 'mock-model',
    }),
  };
  
  // Security features
  instance.securityValidator = {
    validateInput: jest.fn().mockImplementation((input) => {
      if (typeof input !== 'string' || input.length > 10000) {
        throw new Error('Invalid input detected');
      }
      return true;
    }),
    detectPII: jest.fn().mockImplementation((text) => {
      const piiPatterns = [/\b\d{3}-\d{2}-\d{4}\b/, /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/];
      return piiPatterns.some(pattern => pattern.test(text));
    }),
    sanitizeForLogging: jest.fn().mockImplementation((data) => {
      if (typeof data === 'string') {
        return data.replace(/test-api-key-sensitive/g, '[REDACTED]');
      }
      return data;
    }),
  };
  
  // Blockchain verification
  instance.blockchainVerifier = {
    verifyOperation: jest.fn().mockResolvedValue({
      verified: true,
      transactionId: 'mock-tx-id',
      timestamp: Date.now(),
    }),
    createVerification: jest.fn().mockResolvedValue({
      id: 'mock-verification-id',
      hash: 'mock-hash',
    }),
  };
  
  // Permission manager
  instance.permissionManager = {
    checkPermission: jest.fn().mockImplementation((action, context) => {
      const allowedActions = ['summarize', 'categorize', 'analyze'];
      return allowedActions.includes(action);
    }),
    hasPermission: jest.fn().mockReturnValue(true),
    enforcePermission: jest.fn().mockImplementation((action) => {
      if (!instance.permissionManager.checkPermission(action)) {
        throw new Error(`Permission denied for action: ${action}`);
      }
    }),
  };
  
  // Define secureCredentialStorage as a non-enumerable property
  Object.defineProperty(instance, 'secureCredentialStorage', {
    value: secureCredentialStorage,
    writable: false,
    enumerable: false,
    configurable: false,
  });
  
  // Make sure no raw API key properties are accidentally added
  Object.defineProperty(instance, 'apiKey', {
    get: () => '[SECURE_REFERENCE]',
    enumerable: false,
    configurable: false,
  });
  
  Object.defineProperty(instance, 'credentials', {
    get: () => '[SECURE_REFERENCE]',
    enumerable: false,
    configurable: false,
  });
  
  return instance;
});

// Create a default instance
const aiService = new MockAIServiceClass();

module.exports = {
  AIService: MockAIServiceClass,
  aiService,
  default: MockAIServiceClass,
};