/**
 * AI Provider Factory
 *
 * Creates and manages AI provider adapters with secure credential handling
 */

import { AIModelAdapter, AIProvider as AIProviderEnum, AIModelOptions, AIProviderCreationParams } from '../../types/adapters/AIModelAdapter';
import { OpenAIModelAdapter } from './adapters/OpenAIModelAdapter';
import { XAIModelAdapter } from './adapters/XAIModelAdapter';
import { secureCredentialService } from './SecureCredentialService';
import { AI_CONFIG } from '../../constants';
import { Logger, LogLevel } from '../../utils/Logger';
import { getProviderString, getProviderEnum } from '../../utils/adapters';

export class AIProviderFactory {
  private static readonly logger = Logger.getInstance();
  private static isAIFeatureRequested = false;

  /**
   * Set the AI feature request flag
   * This should be called when AI features are explicitly requested
   */
  public static setAIFeatureRequested(value: boolean = true): void {
    this.isAIFeatureRequested = value;
  }

  /**
   * Check if AI features were requested
   */
  public static isAIRequested(): boolean {
    return this.isAIFeatureRequested;
  }

  /**
   * Create a default adapter for initial setup
   */
  public static createDefaultAdapter(): AIModelAdapter {
    try {
      // Default to the simplest adapter
      const apiKey = process.env.XAI_API_KEY || 'missing-key';
      return new XAIModelAdapter(apiKey, 'grok-beta', { temperature: 0.7 });
    } catch (error) {
      this.logger.error(`Failed to create default adapter: ${error.message}`);
      return this.createFallbackAdapter();
    }
  }

  /**
   * Create a minimal fallback adapter for error cases
   */
  public static createFallbackAdapter(): AIModelAdapter {
    // Return a minimal adapter that logs errors instead of failing
    return {
      getProviderName: () => AIProviderEnum.XAI,
      getModelName: () => 'fallback-model',
      complete: async () => {
        return {
          result: 'Sorry, AI service is currently unavailable.',
          modelName: 'fallback-model',
          provider: AIProviderEnum.XAI,
          timestamp: Date.now()
        };
      },
      completeStructured: async () => {
        return {
          result: {} as any,
          modelName: 'fallback-model',
          provider: AIProviderEnum.XAI,
          timestamp: Date.now()
        };
      },
      processWithPromptTemplate: async () => {
        return {
          result: 'Sorry, AI service is currently unavailable.',
          modelName: 'fallback-model',
          provider: AIProviderEnum.XAI,
          timestamp: Date.now()
        };
      },
      cancelAllRequests: () => {}
    };
  }

  /**
   * Create an AI provider adapter
   */
  public static async createProvider(params: AIProviderCreationParams): Promise<AIModelAdapter> {
    const { provider, modelName, options, credentialService } = params;

    // Use the provided credential service or the default one
    const credService = credentialService || secureCredentialService;

    try {
      // Ensure provider is a valid enum value by converting string to enum if needed
      const providerEnum = typeof provider === 'string' ? getProviderEnum(provider as string) : provider;

      // Convert enum to string for credential service
      const providerString = getProviderString(providerEnum);

      // Verify that we have credentials for this provider
      const hasCredential = await credService.hasCredential(providerString as unknown as AIProviderEnum);

      if (!hasCredential) {
        // Only log warnings if AI features were explicitly requested
        if (this.isAIFeatureRequested) {
          this.logger.warn(`No credentials found for ${providerString}. Using fallback provider.`);
        } else {
          this.logger.debug(`No credentials found for ${providerString}.`);
        }
        return this.createFallbackProvider(options);
      }

      // Get the API key for the provider
      const apiKey = await credService.getCredential(providerString as unknown as AIProviderEnum);

      // Create the appropriate adapter based on provider
      switch (providerEnum) {
        case AIProviderEnum.XAI:
          return new XAIModelAdapter(
            apiKey,
            modelName || AI_CONFIG.MODELS.xai[0],
            options
          );

        case AIProviderEnum.OPENAI:
          return new OpenAIModelAdapter(
            apiKey,
            modelName || AI_CONFIG.MODELS.openai[0],
            options
          );

        case AIProviderEnum.ANTHROPIC:
          // Would implement AnthropicModelAdapter here
          this.logger.warn('Anthropic adapter not yet implemented, using fallback provider');
          return this.createFallbackProvider(options);

        default:
          this.logger.warn(`Unknown provider: ${providerEnum}, using fallback provider`);
          return this.createFallbackProvider(options);
      }
    } catch (error) {
      this.logger.error(`Failed to create provider adapter: ${error.message}`);
      return this.createFallbackProvider(options);
    }
  }

  /**
   * Get the default provider and model configuration
   */
  public static async getDefaultProvider(): Promise<{ provider: AIProviderEnum; modelName: string }> {
    const defaultProviderString = AI_CONFIG.DEFAULT_PROVIDER;
    const defaultModel = AI_CONFIG.DEFAULT_MODEL;

    // Check if we have credentials for the default provider
    try {
      // Convert string to enum for type safety
      const defaultProviderEnum = getProviderEnum(defaultProviderString as string);
      const hasCredential = await secureCredentialService.hasCredential(defaultProviderString as unknown as AIProviderEnum);

      if (hasCredential) {
        return {
          provider: defaultProviderEnum,
          modelName: defaultModel || AI_CONFIG.MODELS[defaultProviderString][0]
        };
      }

      // If no credentials for default, try fallback providers
      for (const fallbackProvider of AI_CONFIG.FALLBACK_PROVIDERS) {
        const hasCredential = await secureCredentialService.hasCredential(fallbackProvider as unknown as AIProviderEnum);

        if (hasCredential) {
          const fallbackProviderEnum = getProviderEnum(fallbackProvider as string);
          return {
            provider: fallbackProviderEnum,
            modelName: AI_CONFIG.MODELS[fallbackProvider][0]
          };
        }
      }

      // If no credentials anywhere, return default anyway (will fail later but with helpful message)
      return {
        provider: defaultProviderEnum,
        modelName: defaultModel || AI_CONFIG.MODELS[defaultProviderString][0]
      };
    } catch (error) {
      this.logger.error(`Error determining default provider: ${error.message}`);

      // Fall back to default even if there's an error
      const fallbackEnum = getProviderEnum(defaultProviderString as string);
      return {
        provider: fallbackEnum,
        modelName: defaultModel || AI_CONFIG.MODELS[defaultProviderString][0]
      };
    }
  }

  /**
   * Create a fallback provider when the requested one is unavailable
   */
  private static async createFallbackProvider(options?: AIModelOptions): Promise<AIModelAdapter> {
    // Try each fallback provider in order
    for (const fallbackProvider of AI_CONFIG.FALLBACK_PROVIDERS) {
      try {
        const hasCredential = await secureCredentialService.hasCredential(fallbackProvider as unknown as AIProviderEnum);

        if (hasCredential) {
          this.logger.info(`Using fallback provider: ${fallbackProvider}`);
          const apiKey = await secureCredentialService.getCredential(fallbackProvider as unknown as AIProviderEnum);

          // Convert string provider to enum
          const providerEnum = getProviderEnum(fallbackProvider as string);

          if (providerEnum === AIProviderEnum.OPENAI) {
            return new OpenAIModelAdapter(
              apiKey,
              AI_CONFIG.MODELS.openai[0],
              options
            );
          }

          if (providerEnum === AIProviderEnum.XAI) {
            return new XAIModelAdapter(
              apiKey,
              AI_CONFIG.MODELS.xai[0],
              options
            );
          }

          // Add other provider adapters as needed
        }
      } catch (error) {
        // Only log debug messages if we actually requested AI features
        if (this.isAIFeatureRequested) {
          this.logger.debug(`Failed to use fallback provider ${fallbackProvider}: ${error.message}`);
        }
        // Continue to next fallback
      }
    }

    // Only log a warning if AI features were explicitly requested
    if (this.isAIFeatureRequested) {
      this.logger.warn(
        'No valid AI provider credentials found. AI features will be limited. ' +
        'Add API credentials using: walrus_todo ai credentials add <provider> --key YOUR_API_KEY'
      );
    } else {
      // Otherwise, just log at debug level
      this.logger.debug(
        'No valid AI provider credentials found. AI features not available.'
      );
    }
    return this.createFallbackAdapter();
  }
}