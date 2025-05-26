import {
  AIProvider,
  AIModelOptions,
} from '../../src/types/adapters/AIModelAdapter';
import { AIProviderFactory } from '../../src/services/ai/AIProviderFactory';
import { PromptTemplate } from '@langchain/core/prompts';
import { createMockAIModelAdapter } from '../mocks/AIModelAdapter.mock';

// Mock adapters for XAI and OpenAI
jest.mock('../../src/services/ai/adapters/XAIModelAdapter', () => {
  return {
    XAIModelAdapter: jest
      .fn()
      .mockImplementation(() => createMockAIModelAdapter()),
  };
});

jest.mock('../../src/services/ai/adapters/OpenAIModelAdapter', () => {
  return {
    OpenAIModelAdapter: jest
      .fn()
      .mockImplementation(() => createMockAIModelAdapter()),
  };
});

// Import the mocked classes
import { XAIModelAdapter } from '../../src/services/ai/adapters/XAIModelAdapter';
import { OpenAIModelAdapter } from '../../src/services/ai/adapters/OpenAIModelAdapter';

describe('AI Provider Abstraction', () => {
  // Environment setup
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // SECTION: Factory tests
  describe('AIProviderFactory', () => {
    it('should create an XAI provider when specified', () => {
      const provider = AIProviderFactory.createProvider({
        provider: AIProvider.XAI,
        modelName: 'grok-beta',
        options: { temperature: 0.7 },
      });

      expect(provider).toBeDefined();
      expect(XAIModelAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: 'grok-beta',
          temperature: 0.7,
        })
      );
    });

    it('should create an OpenAI provider when specified', () => {
      const provider = AIProviderFactory.createProvider({
        provider: AIProvider.OPENAI,
        modelName: 'gpt-4',
        options: { temperature: 0.5 },
      });

      expect(provider).toBeDefined();
      expect(OpenAIModelAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: 'gpt-4',
          temperature: 0.5,
        })
      );
    });

    it('should throw an error for unsupported providers', () => {
      expect(() => {
        AIProviderFactory.createProvider({
          provider: 'unsupported-provider' as AIProvider,
          modelName: 'model',
        });
      }).toThrow('Unsupported AI provider');
    });

    it('should get the default provider from environment variables', () => {
      // Setup environment variables
      process.env.AI_PROVIDER = 'openai';
      process.env.AI_MODEL = 'gpt-4-turbo';

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toEqual({
        provider: AIProvider.OPENAI,
        modelName: 'gpt-4-turbo',
      });
    });

    it('should fall back to XAI when no environment variables are set', () => {
      delete process.env.AI_PROVIDER;
      delete process.env.AI_MODEL;

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toEqual({
        provider: AIProvider.XAI,
        modelName: 'grok-beta',
      });
    });
  });

  // SECTION: Provider adapter implementation tests
  describe('Provider Adapter Implementations', () => {
    const testOptions: AIModelOptions = {
      temperature: 0.7,
      maxTokens: 1000,
    };

    // Common tests for all provider adapters
    const runProviderTests = (providerName: AIProvider, modelName: string) => {
      let adapter: XAIModelAdapter | OpenAIModelAdapter;

      beforeEach(() => {
        // Create the appropriate adapter type
        if (providerName === AIProvider.XAI) {
          adapter = new XAIModelAdapter({ modelName, ...testOptions });
        } else {
          // Default to OpenAI for all other cases
          adapter = new OpenAIModelAdapter({ modelName, ...testOptions });
        }
      });

      it(`should create a ${providerName} adapter with the correct model name`, () => {
        expect(adapter.getProviderName()).toBe(providerName);
        expect(adapter.getModelName()).toBe(modelName);
      });

      it(`should execute text completion on ${providerName}`, async () => {
        const result = await adapter.complete({
          prompt: 'Test prompt',
          options: { temperature: 0.5 },
        });

        expect(result).toBeDefined();
        expect(result.result).toBeDefined();
        expect(result.provider).toBe(providerName);
      });

      it(`should execute structured completion on ${providerName}`, async () => {
        const result = await adapter.completeStructured({
          prompt: 'Test prompt for structured data',
          options: { temperature: 0.3 },
        });

        expect(result).toBeDefined();
        expect(result.result).toBeDefined();
        expect(typeof result.result).toBe('object');
        expect(result.provider).toBe(providerName);
      });

      it(`should process with prompt template on ${providerName}`, async () => {
        const promptTemplate = PromptTemplate.fromTemplate(
          'This is a template with a {variable}'
        );

        const result = await adapter.processWithPromptTemplate(promptTemplate, {
          variable: 'test value',
        });

        expect(result).toBeDefined();
        expect(result.result).toBeDefined();
        expect(typeof result.result).toBe('string');
        expect(result.provider).toBe(providerName);
      });
    };

    // Run tests for each provider
    describe('XAI Provider', () => {
      runProviderTests(AIProvider.XAI, 'grok-beta');
    });

    describe('OpenAI Provider', () => {
      runProviderTests(AIProvider.OPENAI, 'gpt-4');
    });
  });

  // SECTION: Edge cases and error handling
  describe('Edge Cases and Error Handling', () => {
    it('should handle missing API key for providers that require it', () => {
      // Mock implementation that throws error for missing API key
      XAIModelAdapter.mockImplementationOnce(() => {
        throw new Error('API key is required');
      });

      expect(() => {
        AIProviderFactory.createProvider({
          provider: AIProvider.XAI,
          modelName: 'grok-beta',
        });
      }).toThrow('API key is required');
    });

    it('should handle invalid model names', () => {
      // Mock implementation that throws error for invalid model
      OpenAIModelAdapter.mockImplementationOnce(() => {
        throw new Error('Invalid model name');
      });

      expect(() => {
        AIProviderFactory.createProvider({
          provider: AIProvider.OPENAI,
          modelName: 'invalid-model',
        });
      }).toThrow('Invalid model name');
    });
  });
});
