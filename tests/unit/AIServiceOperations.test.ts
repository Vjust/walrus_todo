import { AIService } from '../../src/services/ai/aiService';
import { AIVerificationService } from '../../src/services/ai/AIVerificationService';
import { AIProvider, AIModelOptions } from '../../src/types/adapters/AIModelAdapter';
import { AIPrivacyLevel } from '../../src/types/adapters/AIVerifierAdapter';
import { createMockAIModelAdapter } from '../mocks/AIModelAdapter.mock';
import { createMockAIVerifierAdapter } from '../mocks/AIVerifierAdapter.mock';
import { 
  createSampleTodos, 
  expectedResults,
  verificationHelper
} from '../helpers/ai-test-utils';

// Mock the AIProviderFactory
jest.mock('../../src/services/ai/AIProviderFactory', () => {
  const mockAdapter = {
    getProviderName: () => 'XAI',
    getModelName: () => 'grok-beta',
    generateCompletion: jest.fn().mockResolvedValue('Mock AI response'),
    isAvailable: () => Promise.resolve(true)
  };
  
  return {
    AIProviderFactory: {
      createProvider: jest.fn().mockResolvedValue(mockAdapter),
      createDefaultAdapter: jest.fn().mockReturnValue(mockAdapter),
      createFallbackAdapter: jest.fn().mockReturnValue(mockAdapter),
      getDefaultProvider: jest.fn().mockReturnValue({
        provider: 'XAI',
        modelName: 'grok-beta'
      })
    }
  };
});

describe('AIService Operations', () => {
  // Environment setup
  const originalEnv = process.env;
  
  beforeEach(() => {
    process.env = { ...originalEnv, XAI_API_KEY: 'mock-api-key' };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Test samples
  const sampleTodos = createSampleTodos(3);

  // SECTION: Basic initialization and configuration tests
  
  describe('Initialization', () => {
    it('should initialize with API key and default provider', () => {
      const aiService = new AIService('test-api-key');
      expect(aiService).toBeDefined();
      expect(aiService.getProvider()).toBeDefined();
    });

    it('should initialize with specified provider and model', () => {
      const aiService = new AIService('test-api-key', AIProvider.OPENAI, 'gpt-4');
      expect(aiService).toBeDefined();
      expect(aiService.getProvider()).toBeDefined();
    });

    it('should set a different provider after initialization', () => {
      const aiService = new AIService('test-api-key', AIProvider.XAI);
      expect(aiService.getProvider().getProviderName()).toBe(AIProvider.XAI);
      
      // Use spy to verify the provider change
      const getProviderNameSpy = jest.spyOn(aiService.getProvider(), 'getProviderName');
      getProviderNameSpy.mockReturnValue(AIProvider.OPENAI);
      
      aiService.setProvider(AIProvider.OPENAI, 'gpt-4');
      expect(aiService.getProvider().getProviderName()).toBe(AIProvider.OPENAI);
    });
  });

  // SECTION: Basic AI operations (without verification)
  
  describe('AI Operations - Basic', () => {
    it('should summarize todos', async () => {
      const mockAdapter = createMockAIModelAdapter();
      mockAdapter.processWithPromptTemplate = jest.fn().mockResolvedValue({
        result: expectedResults.summarize,
        modelName: 'mock-model',
        provider: AIProvider.XAI,
        timestamp: Date.now()
      });
      
      // Create service with mock adapter
      const aiService = new AIService('test-api-key');
      (aiService as any).modelAdapter = mockAdapter;
      
      const result = await aiService.summarize(sampleTodos);
      
      expect(result).toBe(expectedResults.summarize);
      expect(mockAdapter.processWithPromptTemplate).toHaveBeenCalledTimes(1);
    });

    it('should categorize todos', async () => {
      const mockAdapter = createMockAIModelAdapter();
      mockAdapter.completeStructured = jest.fn().mockResolvedValue({
        result: expectedResults.categorize,
        modelName: 'mock-model',
        provider: AIProvider.XAI,
        timestamp: Date.now()
      });
      
      // Create service with mock adapter
      const aiService = new AIService('test-api-key');
      (aiService as any).modelAdapter = mockAdapter;
      
      const result = await aiService.categorize(sampleTodos);
      
      expect(result).toEqual(expectedResults.categorize);
      expect(mockAdapter.completeStructured).toHaveBeenCalledTimes(1);
    });

    it('should prioritize todos', async () => {
      const mockAdapter = createMockAIModelAdapter();
      mockAdapter.completeStructured = jest.fn().mockResolvedValue({
        result: expectedResults.prioritize,
        modelName: 'mock-model',
        provider: AIProvider.XAI,
        timestamp: Date.now()
      });
      
      // Create service with mock adapter
      const aiService = new AIService('test-api-key');
      (aiService as any).modelAdapter = mockAdapter;
      
      const result = await aiService.prioritize(sampleTodos);
      
      expect(result).toEqual(expectedResults.prioritize);
      expect(mockAdapter.completeStructured).toHaveBeenCalledTimes(1);
    });

    it('should suggest new todos', async () => {
      const mockAdapter = createMockAIModelAdapter();
      mockAdapter.completeStructured = jest.fn().mockResolvedValue({
        result: expectedResults.suggest,
        modelName: 'mock-model',
        provider: AIProvider.XAI,
        timestamp: Date.now()
      });
      
      // Create service with mock adapter
      const aiService = new AIService('test-api-key');
      (aiService as any).modelAdapter = mockAdapter;
      
      const result = await aiService.suggest(sampleTodos);
      
      expect(result).toEqual(expectedResults.suggest);
      expect(mockAdapter.completeStructured).toHaveBeenCalledTimes(1);
    });

    it('should analyze todos', async () => {
      const mockAdapter = createMockAIModelAdapter();
      mockAdapter.completeStructured = jest.fn().mockResolvedValue({
        result: expectedResults.analyze,
        modelName: 'mock-model',
        provider: AIProvider.XAI,
        timestamp: Date.now()
      });
      
      // Create service with mock adapter
      const aiService = new AIService('test-api-key');
      (aiService as any).modelAdapter = mockAdapter;
      
      const result = await aiService.analyze(sampleTodos);
      
      expect(result).toEqual(expectedResults.analyze);
      expect(mockAdapter.completeStructured).toHaveBeenCalledTimes(1);
    });
  });

  // SECTION: AI operations with verification
  
  describe('AI Operations - With Verification', () => {
    let mockVerificationService: AIVerificationService;
    
    beforeEach(() => {
      const mockVerifierAdapter = createMockAIVerifierAdapter();
      mockVerificationService = new AIVerificationService(mockVerifierAdapter);
    });
    
    it('should throw error when verification service is not initialized', async () => {
      const aiService = new AIService('test-api-key');
      
      await expect(
        aiService.summarizeWithVerification(sampleTodos)
      ).rejects.toThrow('Verification service not initialized');
    });

    it('should create verified summary', async () => {
      // Setup
      const mockAdapter = createMockAIModelAdapter();
      mockAdapter.processWithPromptTemplate = jest.fn().mockResolvedValue({
        result: expectedResults.summarize,
        modelName: 'mock-model',
        provider: AIProvider.XAI,
        timestamp: Date.now()
      });
      
      // Spy on verification service
      const createVerifiedSummarySpy = jest.spyOn(mockVerificationService, 'createVerifiedSummary');
      createVerifiedSummarySpy.mockResolvedValue({
        result: expectedResults.summarize,
        verification: {
          id: 'ver-123',
          actionType: 'summarize',
          requestHash: 'req-hash',
          responseHash: 'resp-hash',
          timestamp: Date.now(),
          provider: 'mock-provider',
          privacyLevel: AIPrivacyLevel.HASH_ONLY,
          metadata: { todoCount: '3' },
          signature: 'mock-sig'
        }
      });
      
      // Create service with mocks
      const aiService = new AIService(
        'test-api-key',
        AIProvider.XAI,
        'mock-model',
        {},
        mockVerificationService
      );
      (aiService as any).modelAdapter = mockAdapter;
      
      // Test
      const result = await aiService.summarizeWithVerification(
        sampleTodos,
        AIPrivacyLevel.HASH_ONLY
      );
      
      // Assertions
      expect(result.result).toBe(expectedResults.summarize);
      expect(createVerifiedSummarySpy).toHaveBeenCalledTimes(1);
      expect(createVerifiedSummarySpy).toHaveBeenCalledWith(
        sampleTodos,
        expectedResults.summarize,
        AIPrivacyLevel.HASH_ONLY
      );
      
      verificationHelper.validateVerificationRecord(
        'summarize',
        AIPrivacyLevel.HASH_ONLY,
        { todoCount: '3' }
      )(result.verification);
    });

    it('should create verified categorization', async () => {
      // Setup
      const mockAdapter = createMockAIModelAdapter();
      mockAdapter.completeStructured = jest.fn().mockResolvedValue({
        result: expectedResults.categorize,
        modelName: 'mock-model',
        provider: AIProvider.XAI,
        timestamp: Date.now()
      });
      
      // Spy on verification service
      const createVerifiedCategorizationSpy = jest.spyOn(mockVerificationService, 'createVerifiedCategorization');
      createVerifiedCategorizationSpy.mockResolvedValue({
        result: expectedResults.categorize,
        verification: {
          id: 'ver-456',
          actionType: 'categorize',
          requestHash: 'req-hash',
          responseHash: 'resp-hash',
          timestamp: Date.now(),
          provider: 'mock-provider',
          privacyLevel: AIPrivacyLevel.HASH_ONLY,
          metadata: { 
            todoCount: '3',
            categoryCount: '3'
          },
          signature: 'mock-sig'
        }
      });
      
      // Create service with mocks
      const aiService = new AIService(
        'test-api-key',
        AIProvider.XAI,
        'mock-model',
        {},
        mockVerificationService
      );
      (aiService as any).modelAdapter = mockAdapter;
      
      // Test
      const result = await aiService.categorizeWithVerification(
        sampleTodos,
        AIPrivacyLevel.HASH_ONLY
      );
      
      // Assertions
      expect(result.result).toEqual(expectedResults.categorize);
      expect(createVerifiedCategorizationSpy).toHaveBeenCalledTimes(1);
      
      verificationHelper.validateVerificationRecord(
        'categorize',
        AIPrivacyLevel.HASH_ONLY,
        { 
          todoCount: '3',
          categoryCount: '3'
        }
      )(result.verification);
    });

    it('should create verified prioritization', async () => {
      // Setup similar to above tests
      const mockAdapter = createMockAIModelAdapter();
      mockAdapter.completeStructured = jest.fn().mockResolvedValue({
        result: expectedResults.prioritize,
        modelName: 'mock-model',
        provider: AIProvider.XAI,
        timestamp: Date.now()
      });
      
      const createVerifiedPrioritizationSpy = jest.spyOn(mockVerificationService, 'createVerifiedPrioritization');
      createVerifiedPrioritizationSpy.mockResolvedValue({
        result: expectedResults.prioritize,
        verification: {
          id: 'ver-789',
          actionType: 'prioritize',
          requestHash: 'req-hash',
          responseHash: 'resp-hash',
          timestamp: Date.now(),
          provider: 'mock-provider',
          privacyLevel: AIPrivacyLevel.HASH_ONLY,
          metadata: { todoCount: '3' },
          signature: 'mock-sig'
        }
      });
      
      const aiService = new AIService(
        'test-api-key',
        AIProvider.XAI,
        'mock-model',
        {},
        mockVerificationService
      );
      (aiService as any).modelAdapter = mockAdapter;
      
      const result = await aiService.prioritizeWithVerification(
        sampleTodos,
        AIPrivacyLevel.HASH_ONLY
      );
      
      expect(result.result).toEqual(expectedResults.prioritize);
      expect(createVerifiedPrioritizationSpy).toHaveBeenCalledTimes(1);
      
      verificationHelper.validateVerificationRecord(
        'prioritize',
        AIPrivacyLevel.HASH_ONLY,
        { todoCount: '3' }
      )(result.verification);
    });

    it('should create verified suggestions', async () => {
      // Setup
      const mockAdapter = createMockAIModelAdapter();
      mockAdapter.completeStructured = jest.fn().mockResolvedValue({
        result: expectedResults.suggest,
        modelName: 'mock-model',
        provider: AIProvider.XAI,
        timestamp: Date.now()
      });
      
      const createVerifiedSuggestionSpy = jest.spyOn(mockVerificationService, 'createVerifiedSuggestion');
      createVerifiedSuggestionSpy.mockResolvedValue({
        result: expectedResults.suggest,
        verification: {
          id: 'ver-101',
          actionType: 'suggest',
          requestHash: 'req-hash',
          responseHash: 'resp-hash',
          timestamp: Date.now(),
          provider: 'mock-provider',
          privacyLevel: AIPrivacyLevel.HASH_ONLY,
          metadata: { 
            todoCount: '3',
            suggestionCount: '3'
          },
          signature: 'mock-sig'
        }
      });
      
      const aiService = new AIService(
        'test-api-key',
        AIProvider.XAI,
        'mock-model',
        {},
        mockVerificationService
      );
      (aiService as any).modelAdapter = mockAdapter;
      
      const result = await aiService.suggestWithVerification(
        sampleTodos,
        AIPrivacyLevel.HASH_ONLY
      );
      
      expect(result.result).toEqual(expectedResults.suggest);
      expect(createVerifiedSuggestionSpy).toHaveBeenCalledTimes(1);
      
      verificationHelper.validateVerificationRecord(
        'suggest',
        AIPrivacyLevel.HASH_ONLY,
        { 
          todoCount: '3',
          suggestionCount: '3'
        }
      )(result.verification);
    });

    it('should create verified analysis', async () => {
      // Setup
      const mockAdapter = createMockAIModelAdapter();
      mockAdapter.completeStructured = jest.fn().mockResolvedValue({
        result: expectedResults.analyze,
        modelName: 'mock-model',
        provider: AIProvider.XAI,
        timestamp: Date.now()
      });
      
      const createVerifiedAnalysisSpy = jest.spyOn(mockVerificationService, 'createVerifiedAnalysis');
      createVerifiedAnalysisSpy.mockResolvedValue({
        result: expectedResults.analyze,
        verification: {
          id: 'ver-112',
          actionType: 'analyze',
          requestHash: 'req-hash',
          responseHash: 'resp-hash',
          timestamp: Date.now(),
          provider: 'mock-provider',
          privacyLevel: AIPrivacyLevel.HASH_ONLY,
          metadata: { 
            todoCount: '3',
            analysisKeys: 'themes,bottlenecks,timeEstimates,workflow'
          },
          signature: 'mock-sig'
        }
      });
      
      const aiService = new AIService(
        'test-api-key',
        AIProvider.XAI,
        'mock-model',
        {},
        mockVerificationService
      );
      (aiService as any).modelAdapter = mockAdapter;
      
      const result = await aiService.analyzeWithVerification(
        sampleTodos,
        AIPrivacyLevel.HASH_ONLY
      );
      
      expect(result.result).toEqual(expectedResults.analyze);
      expect(createVerifiedAnalysisSpy).toHaveBeenCalledTimes(1);
      
      verificationHelper.validateVerificationRecord(
        'analyze',
        AIPrivacyLevel.HASH_ONLY,
        { 
          todoCount: '3',
          analysisKeys: 'themes,bottlenecks,timeEstimates,workflow'
        }
      )(result.verification);
    });
  });

  // SECTION: Error handling tests
  
  describe('Error Handling', () => {
    it('should handle model adapter errors', async () => {
      const mockAdapter = createMockAIModelAdapter();
      mockAdapter.processWithPromptTemplate = jest.fn().mockRejectedValue(
        new Error('API connection error')
      );
      
      const aiService = new AIService('test-api-key');
      (aiService as any).modelAdapter = mockAdapter;
      
      await expect(aiService.summarize(sampleTodos)).rejects.toThrow('API connection error');
    });

    it('should handle structured data parsing errors', async () => {
      const mockAdapter = createMockAIModelAdapter();
      mockAdapter.completeStructured = jest.fn().mockResolvedValue({
        result: null, // Simulate null result
        modelName: 'mock-model',
        provider: AIProvider.XAI,
        timestamp: Date.now()
      });
      
      const aiService = new AIService('test-api-key');
      (aiService as any).modelAdapter = mockAdapter;
      
      // Should return empty object rather than throwing
      const result = await aiService.categorize(sampleTodos);
      expect(result).toEqual({});
    });
  });
});