import { EnhancedAIService } from '../../src/services/ai/EnhancedAIService';
import { AIProviderFactory } from '../../src/services/ai/AIProviderFactory';
import { AIConfigManager } from '../../src/services/ai/AIConfigManager';
import { PromptManager } from '../../src/services/ai/PromptManager';
import { ResultCache } from '../../src/services/ai/ResultCache';
import {
  AIProvider,
  AIModelAdapter,
} from '../../src/types/adapters/AIModelAdapter';
import { Todo } from '../../src/types/todo';

// Mock the AIModelAdapter
class MockAIModelAdapter implements AIModelAdapter {
  private provider: AIProvider;
  private modelName: string;

  // For tracking calls to methods
  public callHistory: {
    method: string;
    params: unknown;
  }[] = [];

  // For controlling mock responses
  public mockResponses: Record<string, unknown> = {
    summarize: 'Mock summary of todos',
    categorize: { 'Category 1': ['todo1'], 'Category 2': ['todo2'] },
    prioritize: { todo1: 8, todo2: 5 },
    suggest: ['Suggested todo 1', 'Suggested todo 2'],
    analyze: {
      key_themes: ['Theme 1', 'Theme 2'],
      bottlenecks: ['Bottleneck 1'],
    },
    group: {
      sequentialTracks: { 'Track 1': ['todo1', 'todo2'] },
      parallelOpportunities: [['todo1', 'todo2']],
    },
    schedule: {
      todo1: { start: 0, duration: 2, due: 3 },
      todo2: { start: 2, duration: 1, due: 4 },
    },
    detect_dependencies: {
      dependencies: { todo2: ['todo1'] },
      blockers: { todo2: ['todo1'] },
    },
    estimate_effort: {
      todo1: { effort: 3, reasoning: 'Complex task', estimated_hours: 4 },
      todo2: { effort: 2, reasoning: 'Simple task', estimated_hours: 2 },
    },
  };

  constructor(
    provider: AIProvider = AIProvider.XAI,
    modelName: string = 'mock-model'
  ) {
    this.provider = provider;
    this.modelName = modelName;
  }

  getProviderName(): AIProvider {
    return this.provider;
  }

  getModelName(): string {
    return this.modelName;
  }

  async complete(params: unknown): Promise<unknown> {
    this.callHistory.push({ method: 'complete', params });

    // Determine which operation is being called based on the prompt
    const promptStr =
      typeof (params as { prompt?: string }).prompt === 'string' 
        ? (params as { prompt?: string }).prompt 
        : 'unknown';

    let operation = 'unknown';
    if (promptStr.includes('summarize')) operation = 'summarize';
    else if (promptStr.includes('categorize')) operation = 'categorize';
    else if (promptStr.includes('prioritize')) operation = 'prioritize';
    else if (promptStr.includes('suggest')) operation = 'suggest';
    else if (promptStr.includes('analyze')) operation = 'analyze';
    else if (promptStr.includes('group')) operation = 'group';
    else if (promptStr.includes('schedule')) operation = 'schedule';
    else if (promptStr.includes('dependencies'))
      operation = 'detect_dependencies';
    else if (promptStr.includes('effort')) operation = 'estimate_effort';

    return {
      result: this.mockResponses[operation] || 'Mock response',
      modelName: this.modelName,
      provider: this.provider,
      timestamp: Date.now(),
    };
  }

  async completeStructured(params: unknown): Promise<unknown> {
    this.callHistory.push({ method: 'completeStructured', params });

    // Determine which operation is being called based on the prompt
    const paramsObj = params as { prompt?: string; metadata?: { operation?: string } };
    const promptStr =
      typeof paramsObj.prompt === 'string'
        ? paramsObj.prompt
        : paramsObj.metadata?.operation || 'unknown';

    let operation = paramsObj.metadata?.operation || 'unknown';
    if (!operation || operation === 'unknown') {
      if (promptStr.includes('categorize')) operation = 'categorize';
      else if (promptStr.includes('prioritize')) operation = 'prioritize';
      else if (promptStr.includes('suggest')) operation = 'suggest';
      else if (promptStr.includes('analyze')) operation = 'analyze';
      else if (promptStr.includes('group')) operation = 'group';
      else if (promptStr.includes('schedule')) operation = 'schedule';
      else if (promptStr.includes('dependencies'))
        operation = 'detect_dependencies';
      else if (promptStr.includes('effort')) operation = 'estimate_effort';
    }

    return {
      result: this.mockResponses[operation] || {},
      modelName: this.modelName,
      provider: this.provider,
      timestamp: Date.now(),
    };
  }

  async processWithPromptTemplate(
    promptTemplate: unknown,
    input: Record<string, unknown>
  ): Promise<unknown> {
    this.callHistory.push({
      method: 'processWithPromptTemplate',
      params: { promptTemplate, input },
    });

    // Try to determine the operation based on the prompt template format string
    const formatStr = (promptTemplate as { template?: string })?.template || '';
    let operation = 'unknown';

    if (formatStr.includes('summarize')) operation = 'summarize';
    else if (formatStr.includes('categorize')) operation = 'categorize';
    else if (formatStr.includes('prioritize')) operation = 'prioritize';
    else if (formatStr.includes('suggest')) operation = 'suggest';
    else if (formatStr.includes('analyze')) operation = 'analyze';
    else if (formatStr.includes('group')) operation = 'group';
    else if (formatStr.includes('schedule')) operation = 'schedule';
    else if (formatStr.includes('dependencies'))
      operation = 'detect_dependencies';
    else if (formatStr.includes('effort')) operation = 'estimate_effort';

    return {
      result: this.mockResponses[operation] || 'Mock response',
      modelName: this.modelName,
      provider: this.provider,
      timestamp: Date.now(),
    };
  }
}

// Mock the AIProviderFactory
jest.mock('../../src/services/ai/AIProviderFactory', () => {
  const mockAdapter = new MockAIModelAdapter();

  return {
    AIProviderFactory: {
      createProvider: jest.fn().mockReturnValue(mockAdapter),
      getDefaultProvider: jest.fn().mockReturnValue({
        provider: AIProvider.XAI,
        modelName: 'mock-model',
      }),
    },
    __mockAdapter: mockAdapter,
  };
});

// Test data
const sampleTodos: Todo[] = [
  {
    id: 'todo1',
    title: 'Complete project documentation',
    description: 'Write comprehensive docs for the API',
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'todo2',
    title: 'Fix critical bugs',
    description: 'Address high priority issues in the tracker',
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe('EnhancedAIService', () => {
  let aiService: EnhancedAIService;
  let mockAdapter: MockAIModelAdapter;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Reset singletons
    ResultCache.getInstance().clear();
    PromptManager.getInstance().clearAllPromptOverrides();
    AIConfigManager.getInstance().resetToDefaults();

    // Get the mock adapter
    mockAdapter = (AIProviderFactory as { __mockAdapter: MockAIModelAdapter }).__mockAdapter;
    mockAdapter.callHistory = [];

    // Create a new service instance
    aiService = new EnhancedAIService(
      'mock-api-key',
      AIProvider.XAI,
      'mock-model'
    );
  });

  describe('Basic operations', () => {
    it('should summarize todos', async () => {
      const summary = await aiService.summarize(sampleTodos);

      expect(summary).toBe('Mock summary of todos');
      expect(mockAdapter.callHistory.length).toBe(1);
      expect(mockAdapter.callHistory[0].method).toBe(
        'processWithPromptTemplate'
      );
    });

    it('should categorize todos', async () => {
      const categories = await aiService.categorize(sampleTodos);

      expect(categories).toEqual({
        'Category 1': ['todo1'],
        'Category 2': ['todo2'],
      });
      expect(mockAdapter.callHistory.length).toBe(1);
      expect(mockAdapter.callHistory[0].method).toBe('completeStructured');
    });

    it('should prioritize todos', async () => {
      const priorities = await aiService.prioritize(sampleTodos);

      expect(priorities).toEqual({
        todo1: 8,
        todo2: 5,
      });
      expect(mockAdapter.callHistory.length).toBe(1);
    });

    it('should suggest new todos', async () => {
      const suggestions = await aiService.suggest(sampleTodos);

      expect(suggestions).toEqual(['Suggested todo 1', 'Suggested todo 2']);
      expect(mockAdapter.callHistory.length).toBe(1);
    });

    it('should analyze todos', async () => {
      const analysis = await aiService.analyze(sampleTodos);

      expect(analysis).toEqual({
        key_themes: ['Theme 1', 'Theme 2'],
        bottlenecks: ['Bottleneck 1'],
      });
      expect(mockAdapter.callHistory.length).toBe(1);
    });
  });

  describe('New enhanced operations', () => {
    it('should group todos into workflows', async () => {
      const groups = await aiService.group(sampleTodos);

      expect(groups).toEqual({
        sequentialTracks: { 'Track 1': ['todo1', 'todo2'] },
        parallelOpportunities: [['todo1', 'todo2']],
      });
      expect(mockAdapter.callHistory.length).toBe(1);
    });

    it('should create a schedule for todos', async () => {
      const schedule = await aiService.schedule(sampleTodos);

      expect(schedule).toEqual({
        todo1: { start: 0, duration: 2, due: 3 },
        todo2: { start: 2, duration: 1, due: 4 },
      });
      expect(mockAdapter.callHistory.length).toBe(1);
    });

    it('should detect dependencies between todos', async () => {
      const dependencies = await aiService.detectDependencies(sampleTodos);

      expect(dependencies).toEqual({
        dependencies: { todo2: ['todo1'] },
        blockers: { todo2: ['todo1'] },
      });
      expect(mockAdapter.callHistory.length).toBe(1);
    });

    it('should estimate effort for todos', async () => {
      const efforts = await aiService.estimateEffort(sampleTodos);

      expect(efforts).toEqual({
        todo1: { effort: 3, reasoning: 'Complex task', estimated_hours: 4 },
        todo2: { effort: 2, reasoning: 'Simple task', estimated_hours: 2 },
      });
      expect(mockAdapter.callHistory.length).toBe(1);
    });
  });

  describe('Caching mechanism', () => {
    it('should cache and reuse results for identical requests', async () => {
      // First call
      await aiService.summarize(sampleTodos);
      expect(mockAdapter.callHistory.length).toBe(1);

      // Second call should use cache
      await aiService.summarize(sampleTodos);
      expect(mockAdapter.callHistory.length).toBe(1); // Still 1, as cache was used

      // Cache stats should show a hit
      const stats = aiService.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it('should clear cache for a specific operation', async () => {
      // Perform some operations
      await aiService.summarize(sampleTodos);
      await aiService.categorize(sampleTodos);

      // Cache should have 2 entries
      expect(aiService.getCacheStats().size).toBe(2);

      // Clear cache for summarize
      aiService.clearCache('summarize');

      // Cache should now have 1 entry
      expect(aiService.getCacheStats().size).toBe(1);

      // Performing summarize again should make a new API call
      mockAdapter.callHistory = [];
      await aiService.summarize(sampleTodos);
      expect(mockAdapter.callHistory.length).toBe(1);
    });

    it('should disable cache when configured', async () => {
      // Configure to disable cache
      aiService.configure({ cacheEnabled: false });

      // First call
      await aiService.summarize(sampleTodos);
      expect(mockAdapter.callHistory.length).toBe(1);

      // Second call should NOT use cache
      await aiService.summarize(sampleTodos);
      expect(mockAdapter.callHistory.length).toBe(2); // 2 calls, no caching

      // Cache stats should be empty
      const stats = aiService.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Provider configuration', () => {
    it('should allow changing the provider', async () => {
      // Set a different provider
      aiService.setProvider(AIProvider.OPENAI, 'gpt-4');

      // The factory should have been called with the new provider
      expect(AIProviderFactory.createProvider).toHaveBeenCalledWith({
        provider: AIProvider.OPENAI,
        modelName: 'gpt-4',
        options: expect.any(Object),
      });
    });
  });

  describe('Custom prompts', () => {
    it('should support custom prompt overrides', async () => {
      // Get the prompt manager
      const promptManager = PromptManager.getInstance();

      // Set a custom prompt for summarize
      promptManager.setPromptOverride(
        'summarize',
        'Custom summary prompt: {todos}'
      );

      // Make a request
      await aiService.summarize(sampleTodos);

      // The custom prompt should have been used
      const lastCall =
        mockAdapter.callHistory[mockAdapter.callHistory.length - 1];
      expect((lastCall.params as { promptTemplate?: { template?: string } }).promptTemplate?.template).toContain(
        'Custom summary prompt'
      );
    });
  });
});
