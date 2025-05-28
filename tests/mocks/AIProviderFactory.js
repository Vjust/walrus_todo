const { jest } = require('@jest/globals');

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

module.exports = {
  AIProviderFactory: mockAIProviderFactory,
  createProvider: mockAIProviderFactory.createProvider,
  getDefaultProvider: mockAIProviderFactory.getDefaultProvider,
  default: mockAIProviderFactory,
};
