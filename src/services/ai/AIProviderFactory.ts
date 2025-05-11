/**
 * AI Provider Factory
 * 
 * Implements the Factory design pattern to create and manage AI provider adapters
 * with secure credential handling. This class centralizes the instantiation logic
 * for different AI model adapters, providing a consistent interface for obtaining
 * provider instances based on configuration and available credentials.
 * 
 * Key responsibilities:
 * - Creates appropriate AI provider adapters based on requested provider type
 * - Manages credential verification through SecureCredentialService
 * - Provides fallback mechanisms when requested providers are unavailable
 * - Tracks whether AI features were explicitly requested to adjust logging verbosity
 * 
 * @module services/ai/AIProviderFactory
 */

import { AIModelAdapter, AIProvider as AIProviderEnum, AIModelOptions, AIProviderCreationParams } from '../../types/adapters/AIModelAdapter';
import { OpenAIModelAdapter } from './adapters/OpenAIModelAdapter';
import { XAIModelAdapter } from './adapters/XAIModelAdapter';
import { secureCredentialService } from './SecureCredentialService';
import { AI_CONFIG } from '../../constants';
import { Logger, LogLevel } from '../../utils/Logger';
import { getProviderString, getProviderEnum } from '../../utils/adapters';

/**
 * Factory class responsible for creating and configuring AI provider adapters
 * based on requested provider type, available credentials, and configuration options.
 * 
 * Uses the Factory design pattern to abstract the complex creation logic from
 * client code, ensuring consistent provider instantiation throughout the application.
 */
export class AIProviderFactory {
  /** Logger instance for tracking factory operations */
  private static readonly logger = Logger.getInstance();
  
  /** Flag to track whether AI features were explicitly requested by the user */
  private static isAIFeatureRequested = false;

  /**
   * Sets the flag indicating AI features have been explicitly requested
   * This affects logging verbosity for credential warnings and errors
   * 
   * @param value - Boolean indicating if AI features were requested, defaults to true
   */
  public static setAIFeatureRequested(value: boolean = true): void {
    this.isAIFeatureRequested = value;
  }

  /**
   * Returns whether AI features were explicitly requested
   * Used to determine appropriate logging levels for warnings and errors
   * 
   * @returns True if AI features were explicitly requested, false otherwise
   */
  public static isAIRequested(): boolean {
    return this.isAIFeatureRequested;
  }

  /**
   * Creates a default adapter for initial system setup
   * Uses environment variables for initial configuration if available
   * 
   * @returns A configured XAIModelAdapter instance or fallback adapter if creation fails
   */
  public static createDefaultAdapter(): AIModelAdapter {
    try {
      // Default to the simplest adapter
      const apiKey = process.env.XAI_API_KEY;

      // If we have an actual API key (not empty), use it
      if (apiKey && apiKey.length > 10) {
        this.logger.debug(`Using XAI API key from environment variables`);
        return new XAIModelAdapter(apiKey, 'grok-beta', { temperature: 0.7 });
      }

      // If no API key, log a warning and return fallback
      this.logger.debug(`No XAI API key found in environment variables, using fallback adapter`);
      return this.createFallbackAdapter();
    } catch (error) {
      this.logger.error(`Failed to create default adapter: ${error.message}`);
      return this.createFallbackAdapter();
    }
  }

  /**
   * Creates a minimal implementation of AIModelAdapter that doesn't throw exceptions
   * Used as a last resort when no working adapters can be created
   * 
   * @returns A minimal AIModelAdapter implementation that returns error messages instead of failing
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
   * Main factory method that creates an appropriate AI provider adapter
   * based on the requested provider type and available credentials
   * 
   * @param params - Configuration parameters for creating the provider
   * @param params.provider - The AI provider to use (enum or string)
   * @param params.modelName - Optional model name to use, defaults to first model in config
   * @param params.options - Optional configuration options for the model
   * @param params.credentialService - Optional credential service override
   * 
   * @returns A promise resolving to a configured AIModelAdapter instance
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
   * Determines the default provider and model configuration based on
   * available credentials and application configuration
   * 
   * This method tries to find credentials for the default provider,
   * then falls back to alternative providers if needed
   * 
   * @returns Promise resolving to an object containing provider enum and model name
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
   * Attempts to create a working provider adapter from the configured fallback providers
   * Tries each fallback provider in sequence until one with valid credentials is found
   * 
   * @param options - Optional configuration options to pass to the provider adapter
   * @returns Promise resolving to a configured AIModelAdapter or minimal fallback adapter
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