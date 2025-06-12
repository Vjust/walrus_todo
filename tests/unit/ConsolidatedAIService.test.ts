/**
 * Test for Consolidated AI Service
 *
 * This tests the new consolidated AIService implementation to ensure it maintains
 * the functionality of both the original aiService and EnhancedAIService classes.
 */

import { AIService, aiService } from '../../apps/cli/src/services/ai';
import { AIProvider } from '../../apps/cli/src/types/adapters/AIModelAdapter';
import { Todo } from '../../apps/cli/src/types/todo';
import { AIVerificationService } from '../../apps/cli/src/services/ai/AIVerificationService';
import { ResultCache } from '../../apps/cli/src/services/ai/ResultCache';
import { AIConfigManager } from '../../apps/cli/src/services/ai/AIConfigManager';
import { PromptManager } from '../../apps/cli/src/services/ai/PromptManager';

// Mock secureCredentialService
jest.mock('../../apps/cli/src/services/ai/SecureCredentialService', () => ({
  secureCredentialService: {
    getCredential: jest
      .fn()
      .mockResolvedValue({ key: 'mock-api-key', provider: 'xai' }),
    getAllCredentials: jest
      .fn()
      .mockResolvedValue([{ key: 'mock-api-key', provider: 'xai' }]),
    storeCredential: jest.fn().mockResolvedValue(true as any),
    removeCredential: jest.fn().mockResolvedValue(true as any),
    rotateCredential: jest.fn().mockResolvedValue(true as any),
    validateCredential: jest.fn().mockResolvedValue(true as any),
  },
}));

// Create mocks
jest.mock('../../apps/cli/src/services/ai/AIProviderFactory', () => ({
  createDefaultAdapter: jest.fn().mockReturnValue({
    getProviderName: jest.fn().mockReturnValue('mock-provider'),
    processWithPromptTemplate: jest
      .fn()
      .mockResolvedValue({ result: 'Mock response' }),
    completeStructured: jest.fn().mockResolvedValue({ result: {} }),
  }),
  createFallbackAdapter: jest.fn().mockReturnValue({
    getProviderName: jest.fn().mockReturnValue('fallback-provider'),
    processWithPromptTemplate: jest
      .fn()
      .mockResolvedValue({ result: 'Fallback response' }),
    completeStructured: jest.fn().mockResolvedValue({ result: {} }),
  }),
  createProvider: jest.fn().mockResolvedValue({
    getProviderName: jest.fn().mockReturnValue('created-provider'),
    processWithPromptTemplate: jest
      .fn()
      .mockResolvedValue({ result: 'Created response' }),
    completeStructured: jest.fn().mockImplementation(({ metadata }) => {
      switch (metadata.operation) {
        case 'categorize':
          return Promise.resolve({ result: { category1: ['todo1'] } });
        case 'prioritize':
          return Promise.resolve({ result: { todo1: 8 } });
        case 'suggest':
          return Promise.resolve({
            result: ['Suggested todo 1', 'Suggested todo 2'],
          });
        case 'analyze':
          return Promise.resolve({
            result: { themes: ['theme1'], bottlenecks: ['bottleneck1'] },
          });
        case 'group':
          return Promise.resolve({
            result: {
              sequentialTracks: { track1: ['todo1'] },
              parallelOpportunities: [['todo2', 'todo3']],
            },
          });
        case 'schedule':
          return Promise.resolve({
            result: { todo1: { start: 0, duration: 2, due: 5 } },
          });
        case 'detect_dependencies':
          return Promise.resolve({
            result: { dependencies: {}, blockers: {} },
          });
        case 'estimate_effort':
          return Promise.resolve({
            result: { todo1: { effort: 3, reasoning: 'Moderate complexity' } },
          });
        default:
          return Promise.resolve({ result: {} });
      }
    }),
  }),
  getDefaultProvider: jest.fn().mockResolvedValue({
    provider: 'default-provider',
    modelName: 'default-model',
  }),
}));

jest.mock('../../apps/cli/src/services/ai/ResultCache', () => {
  const mockInstance = {
    configure: jest.fn(),
    getConfig: jest.fn().mockReturnValue({
      enabled: true,
      ttlMs: 900000,
      maxEntries: 100,
    }),
    get: jest.fn().mockReturnValue(null as any),
    set: jest.fn(),
    clear: jest.fn(),
    clearOperation: jest.fn(),
    getStats: jest.fn().mockReturnValue({
      size: 0,
      hitRate: 0,
      operations: {},
    }),
    recordHit: jest.fn(),
    recordMiss: jest.fn(),
  };

  return {
    ResultCache: jest.fn().mockImplementation(() => ({
      configure: mockInstance.configure,
      getConfig: mockInstance.getConfig,
      get: mockInstance.get,
      set: mockInstance.set,
      clear: mockInstance.clear,
      clearOperation: mockInstance.clearOperation,
      getStats: mockInstance.getStats,
      recordHit: mockInstance.recordHit,
      recordMiss: mockInstance.recordMiss,
    })),
    getInstance: jest.fn().mockReturnValue(mockInstance as any),
  };
});

// Add getInstance static method to ResultCache
jest.spyOn(ResultCache, 'getInstance').mockReturnValue({
  configure: jest.fn(),
  getConfig: jest.fn().mockReturnValue({
    enabled: true,
    ttlMs: 900000,
    maxEntries: 100,
  }),
  get: jest.fn().mockReturnValue(null as any),
  set: jest.fn(),
  clear: jest.fn(),
  clearOperation: jest.fn(),
  getStats: jest.fn().mockReturnValue({
    size: 0,
    hitRate: 0,
    operations: {},
  }),
  recordHit: jest.fn(),
  recordMiss: jest.fn(),
});

jest.mock('../../apps/cli/src/services/ai/PromptManager', () => {
  const mockInstance = {
    getPromptTemplate: jest.fn().mockReturnValue({
      format: jest.fn().mockResolvedValue('Mock formatted prompt'),
      promptText: 'Mock prompt template',
    }),
    setPromptOverride: jest.fn(),
    clearAllPromptOverrides: jest.fn(),
    clearPromptOverride: jest.fn(),
  };

  return {
    PromptManager: jest.fn().mockImplementation(() => ({
      getPromptTemplate: mockInstance.getPromptTemplate,
      setPromptOverride: mockInstance.setPromptOverride,
      clearAllPromptOverrides: mockInstance.clearAllPromptOverrides,
      clearPromptOverride: mockInstance.clearPromptOverride,
    })),
    getInstance: jest.fn().mockReturnValue(mockInstance as any),
  };
});

// Add getInstance static method to PromptManager
jest.spyOn(PromptManager, 'getInstance').mockReturnValue({
  getPromptTemplate: jest.fn().mockReturnValue({
    format: jest.fn().mockResolvedValue('Mock formatted prompt'),
    promptText: 'Mock prompt template',
  }),
  setPromptOverride: jest.fn(),
  clearAllPromptOverrides: jest.fn(),
  clearPromptOverride: jest.fn(),
});

jest.mock('../../apps/cli/src/services/ai/AIConfigManager', () => {
  const mockInstance = {
    getGlobalConfig: jest.fn().mockReturnValue({
      defaultProvider: 'xai',
      fallbackProviders: ['openai', 'anthropic'],
      cacheEnabled: true,
      maxCacheEntries: 100,
      defaultTtl: 900000,
      defaultTemperature: 0.7,
      defaultMaxTokens: 2000,
      useEnhancedPrompts: true,
      retryEnabled: true,
      defaultRetryCount: 2,
      defaultTimeout: 30000,
      rateLimit: {
        enabled: true,
        requestsPerMinute: 20,
      },
    }),
    updateGlobalConfig: jest.fn(),
    getOperationConfig: jest.fn().mockReturnValue({
      cacheTtl: 900000,
      temperature: 0.7,
      maxTokens: 2000,
      enhanced: true,
      retryCount: 2,
      timeout: 30000,
    }),
    getModelOptions: jest.fn().mockReturnValue({
      temperature: 0.7,
      maxTokens: 2000,
    }),
    getAllOperationConfigs: jest.fn().mockReturnValue({}),
    updateOperationConfig: jest.fn(),
    resetToDefaults: jest.fn(),
  };

  return {
    AIConfigManager: jest.fn().mockImplementation(() => ({
      getGlobalConfig: mockInstance.getGlobalConfig,
      updateGlobalConfig: mockInstance.updateGlobalConfig,
      getOperationConfig: mockInstance.getOperationConfig,
      getModelOptions: mockInstance.getModelOptions,
      getAllOperationConfigs: mockInstance.getAllOperationConfigs,
      updateOperationConfig: mockInstance.updateOperationConfig,
      resetToDefaults: mockInstance.resetToDefaults,
    })),
    getInstance: jest.fn().mockReturnValue(mockInstance as any),
  };
});

// Add getInstance static method to AIConfigManager
jest.spyOn(AIConfigManager, 'getInstance').mockReturnValue({
  getGlobalConfig: jest.fn().mockReturnValue({
    defaultProvider: 'xai',
    fallbackProviders: ['openai', 'anthropic'],
    cacheEnabled: true,
    maxCacheEntries: 100,
    defaultTtl: 900000,
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
    useEnhancedPrompts: true,
    retryEnabled: true,
    defaultRetryCount: 2,
    defaultTimeout: 30000,
    rateLimit: {
      enabled: true,
      requestsPerMinute: 20,
    },
  }),
  updateGlobalConfig: jest.fn(),
  getOperationConfig: jest.fn().mockReturnValue({
    cacheTtl: 900000,
    temperature: 0.7,
    maxTokens: 2000,
    enhanced: true,
    retryCount: 2,
    timeout: 30000,
  }),
  getModelOptions: jest.fn().mockReturnValue({
    temperature: 0.7,
    maxTokens: 2000,
  }),
  getAllOperationConfigs: jest.fn().mockReturnValue({}),
  updateOperationConfig: jest.fn(),
  resetToDefaults: jest.fn(),
});

jest.mock('../../apps/cli/src/utils/Logger', () => {
  return {
    Logger: jest.fn().mockImplementation(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
    LogLevel: {
      DEBUG: 'debug',
      INFO: 'info',
      WARN: 'warn',
      ERROR: 'error',
    },
  };
});

// Import Logger first
import { Logger } from '../../apps/cli/src/utils/Logger';

// Add a getInstance mock to Logger
// Unused imports removed during TypeScript cleanup
// import { getMockWalrusClient, type CompleteWalrusClientMock } from '../../helpers/complete-walrus-client-mock';
jest.spyOn(Logger, 'getInstance').mockReturnValue({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('Consolidated AIService', () => {
  let mockTodos: Todo[];

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock todos
    mockTodos = [
      {
        id: 'todo1',
        title: 'First todo',
        description: 'This is the first todo',
        completed: false,
        priority: 'medium' as const,
        tags: [],
        private: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'todo2',
        title: 'Second todo',
        description: 'This is the second todo',
        completed: false,
      },
    ];
  });

  it('should be a singleton', () => {
    // Get multiple instances and confirm they're the same
    const instance1 = AIService.getInstance();
    const instance2 = AIService.getInstance();

    expect(instance1 as any).toBe(instance2 as any);

    // Verify the exported singleton instance
    expect(aiService as any).toBe(instance1 as any);
  });

  it('should provide access to the provider', () => {
    const provider = aiService.getProvider();
    expect(provider as any).toBeDefined();
  });

  it('should allow changing the provider', async () => {
    await aiService.setProvider(AIProvider.OPENAI, 'gpt-4');
    const provider = aiService.getProvider();
    expect(provider.getProviderName()).toBe('created-provider');
  });

  it('should allow configuring service behavior', () => {
    const configManagerSpy = jest.spyOn(
      aiService?.["configManager"],
      'updateGlobalConfig'
    );
    const resultCacheSpy = jest.spyOn(aiService?.["resultCache"], 'configure');

    aiService.configure({
      cacheEnabled: false,
      useEnhancedPrompts: true,
      defaultTemperature: 0.5,
      defaultMaxTokens: 1000,
    });

    expect(configManagerSpy as any).toHaveBeenCalledWith({
      useEnhancedPrompts: true,
      defaultTemperature: 0.5,
      defaultMaxTokens: 1000,
    });

    expect(resultCacheSpy as any).toHaveBeenCalledWith({
      enabled: false,
    });
  });

  // Test core operations
  describe('Core Operations', () => {
    it('should summarize todos', async () => {
      const result = await aiService.summarize(mockTodos as any);
      expect(result as any).toBe('Created response');
    });

    it('should categorize todos', async () => {
      const result = await aiService.categorize(mockTodos as any);
      expect(result as any).toEqual({ category1: ['todo1'] });
    });

    it('should prioritize todos', async () => {
      const result = await aiService.prioritize(mockTodos as any);
      expect(result as any).toEqual({ todo1: 8 });
    });

    it('should suggest new todos', async () => {
      const result = await aiService.suggest(mockTodos as any);
      expect(result as any).toEqual(['Suggested todo 1', 'Suggested todo 2']);
    });

    it('should analyze todos', async () => {
      const result = await aiService.analyze(mockTodos as any);
      expect(result as any).toEqual({
        themes: ['theme1'],
        bottlenecks: ['bottleneck1'],
      });
    });
  });

  // Test advanced operations
  describe('Advanced Operations', () => {
    it('should group todos', async () => {
      const result = await aiService.group(mockTodos as any);
      expect(result as any).toEqual({
        sequentialTracks: { track1: ['todo1'] },
        parallelOpportunities: [['todo2', 'todo3']],
      });
    });

    it('should schedule todos', async () => {
      const result = await aiService.schedule(mockTodos as any);
      expect(result as any).toEqual({ todo1: { start: 0, duration: 2, due: 5 } });
    });

    it('should detect dependencies', async () => {
      const result = await aiService.detectDependencies(mockTodos as any);
      expect(result as any).toEqual({ dependencies: {}, blockers: {} });
    });

    it('should estimate effort', async () => {
      const result = await aiService.estimateEffort(mockTodos as any);
      expect(result as any).toEqual({
        todo1: { effort: 3, reasoning: 'Moderate complexity' },
      });
    });
  });

  // Test single-todo operations
  describe('Single Todo Operations', () => {
    let mockTodo: Todo;

    beforeEach(() => {
      mockTodo = {
        id: 'singleTodo',
        title: 'Single todo',
        description: 'This is a single todo',
        completed: false,
        priority: 'medium' as const,
        tags: [],
        private: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Todo;
    });

    it('should suggest tags for a todo', async () => {
      // Mock JSON parsing
      const mockResponse = { result: '["tag1", "tag2"]' };
      jest
        .spyOn(aiService?.["modelAdapter"], 'processWithPromptTemplate')
        .mockResolvedValueOnce(mockResponse as any);

      const result = await aiService.suggestTags(mockTodo as any);
      expect(result as any).toEqual(['tag1', 'tag2']);
    });

    it('should suggest priority for a todo', async () => {
      // Mock response with a valid priority
      const mockResponse = { result: 'high' };
      jest
        .spyOn(aiService?.["modelAdapter"], 'processWithPromptTemplate')
        .mockResolvedValueOnce(mockResponse as any);

      const result = await aiService.suggestPriority(mockTodo as any);
      expect(result as any).toBe('high');
    });
  });

  // Test verification operations
  describe('Verification Operations', () => {
    let mockVerificationService: Partial<AIVerificationService>;

    beforeEach(() => {
      mockVerificationService = {
        createVerifiedSummary: jest.fn().mockResolvedValue({
          result: 'Verified summary',
          proof: 'mock-proof',
          operation: 'summarize',
        }),
        createVerifiedCategorization: jest.fn().mockResolvedValue({
          result: { category1: ['todo1'] },
          proof: 'mock-proof',
          operation: 'categorize',
        }),
        createVerifiedPrioritization: jest.fn().mockResolvedValue({
          result: { todo1: 8 },
          proof: 'mock-proof',
          operation: 'prioritize',
        }),
        createVerifiedSuggestion: jest.fn().mockResolvedValue({
          result: ['Suggested todo 1'],
          proof: 'mock-proof',
          operation: 'suggest',
        }),
        createVerifiedAnalysis: jest.fn().mockResolvedValue({
          result: { themes: ['theme1'] },
          proof: 'mock-proof',
          operation: 'analyze',
        }),
      };

      // Set the verification service
      (
        aiService as { verificationService: AIVerificationService }
      ).verificationService = mockVerificationService as AIVerificationService;
    });

    it('should summarize with verification', async () => {
      const result = await aiService.summarizeWithVerification(mockTodos as any);
      expect(mockVerificationService.createVerifiedSummary).toHaveBeenCalled();
      expect(result.result).toBe('Verified summary');
    });

    it('should categorize with verification', async () => {
      const result = await aiService.categorizeWithVerification(mockTodos as any);
      expect(
        mockVerificationService.createVerifiedCategorization
      ).toHaveBeenCalled();
      expect(result.result).toEqual({ category1: ['todo1'] });
    });

    it('should prioritize with verification', async () => {
      const result = await aiService.prioritizeWithVerification(mockTodos as any);
      expect(
        mockVerificationService.createVerifiedPrioritization
      ).toHaveBeenCalled();
      expect(result.result).toEqual({ todo1: 8 });
    });

    it('should suggest with verification', async () => {
      const result = await aiService.suggestWithVerification(mockTodos as any);
      expect(
        mockVerificationService.createVerifiedSuggestion
      ).toHaveBeenCalled();
      expect(result.result).toEqual(['Suggested todo 1']);
    });

    it('should analyze with verification', async () => {
      const result = await aiService.analyzeWithVerification(mockTodos as any);
      expect(mockVerificationService.createVerifiedAnalysis).toHaveBeenCalled();
      expect(result.result).toEqual({ themes: ['theme1'] });
    });
  });

  // Test cache operations
  describe('Cache Operations', () => {
    it('should clear the cache', () => {
      const clearSpy = jest.spyOn(aiService?.["resultCache"], 'clear');
      aiService.clearCache();
      expect(clearSpy as any).toHaveBeenCalled();
    });

    it('should clear specific operation cache', () => {
      const clearOperationSpy = jest.spyOn(
        aiService?.["resultCache"],
        'clearOperation'
      );
      aiService.clearCache('summarize');
      expect(clearOperationSpy as any).toHaveBeenCalledWith('summarize');
    });

    it('should get cache stats', () => {
      const getStatsSpy = jest.spyOn(aiService?.["resultCache"], 'getStats');
      const stats = aiService.getCacheStats();
      expect(getStatsSpy as any).toHaveBeenCalled();
      expect(stats as any).toEqual({
        size: 0,
        hitRate: 0,
        operations: {},
      });
    });
  });
});
