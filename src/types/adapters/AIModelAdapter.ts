/**
 * AI Model Adapter Interface
 * 
 * This file defines the interface for AI model adapters, which provide a consistent
 * way to interact with different AI providers (OpenAI, XAI, Anthropic, etc.).
 * 
 * The adapter pattern isolates the application from specific AI provider implementation
 * details, allowing for:
 * - Consistent interface across different AI services
 * - Easy swapping of providers without changing business logic
 * - Standardized error handling and response formatting
 * - Unified credential management
 * 
 * @module AIModelAdapter
 */

import { PromptTemplate } from '@langchain/core/prompts';
import { SecureCredentialService } from '../../services/ai/SecureCredentialService';

/**
 * Enumeration of supported AI providers
 * 
 * Defines the available AI service providers that can be used with the adapter.
 * This list can be extended as new providers are integrated into the system.
 */
export enum AIProvider {
  XAI = 'xai',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  OLLAMA = 'ollama'
}

/**
 * Configuration options for AI model requests
 * 
 * These parameters control the behavior of the AI model during generation,
 * as well as network operation parameters for resilience and performance.
 */
export interface AIModelOptions {
  /** Controls randomness of outputs (0.0-1.0). Higher values = more random */
  temperature?: number;
  
  /** Maximum number of tokens to generate in the response */
  maxTokens?: number;
  
  /** Nucleus sampling parameter (0.0-1.0). Restricts sampling to tokens with cumulative probability < topP */
  topP?: number;
  
  /** Reduces repetition of token sequences (-2.0 to 2.0). Higher values = less repetition */
  frequencyPenalty?: number;
  
  /** Increases/decreases likelihood of tokens based on presence in prompt (-2.0 to 2.0) */
  presencePenalty?: number;
  
  /** Specific model name to use (e.g., 'gpt-4', 'claude-3-opus-20240229') */
  modelName?: string;

  // Network operation parameters
  /** Request timeout in milliseconds */
  timeout?: number;
  
  /** Number of retry attempts for failed requests */
  retries?: number;
  
  /** Base delay between retries in milliseconds */
  retryDelay?: number;
  
  /** Maximum total time to spend on retries */
  maxRetryTime?: number;
  
  /** Exponential backoff factor for retries (e.g., 2.0 = double delay after each retry) */
  retryBackoffFactor?: number;
  
  // Privacy and operation parameters
  /** Whether differential privacy is enabled for this operation */
  differentialPrivacy?: boolean;
  
  /** Epsilon value for differential privacy (noise factor) */
  epsilon?: number;
  
  /** The operation type being performed (e.g., 'summarize', 'categorize') */
  operation?: string;
}

/**
 * Metadata for AI requests
 * 
 * Provides context and tracking information for AI requests, enabling:
 * - Request auditing and logging
 * - User attribution and session tracking
 * - Additional contextual information for request processing
 * - Operation type identification for monitoring and analytics
 */
export interface AIRequestMetadata {
  /** Unique identifier for the user making the request */
  userId?: string;
  
  /** Unique identifier for the current user session */
  sessionId?: string;
  
  /** Unique identifier for this specific request */
  requestId?: string;
  
  /** Unix timestamp (ms) when the request was initiated */
  timestamp?: number;
  
  /** Optional context data relevant to the request */
  additionalContext?: Record<string, any>;
  
  /** Type of operation being performed (e.g., 'summarize', 'categorize') */
  operation?: string;
}

/**
 * Parameters for AI completion requests
 * 
 * Contains all the information needed to generate a completion from an AI model,
 * including the prompt, input variables, configuration options, and request metadata.
 */
export interface AICompletionParams {
  /** The prompt text or PromptTemplate to send to the AI model */
  prompt: string | PromptTemplate;
  
  /** Input variables to be used with a PromptTemplate */
  input?: Record<string, any>;
  
  /** Configuration options for the AI model and request handling */
  options?: AIModelOptions;
  
  /** Metadata about the request for tracking and auditing */
  metadata?: AIRequestMetadata;
}

/**
 * Response from an AI completion request
 * 
 * Contains the generated text or structured data from the AI model,
 * along with metadata about the request and response.
 * 
 * @template T - The type of the result (defaults to string)
 */
export interface AIResponse<T = string> {
  /** The generated completion or structured data */
  result: T;
  
  /** Name of the specific model that generated the response */
  modelName: string;
  
  /** The AI provider that processed the request */
  provider: AIProvider;
  
  /** Token usage statistics for billing and monitoring */
  tokenUsage?: {
    /** Number of tokens in the prompt */
    prompt: number;
    
    /** Number of tokens in the completion */
    completion: number;
    
    /** Total tokens used (prompt + completion) */
    total: number;
  };
  
  /** Unix timestamp (ms) when the response was generated */
  timestamp: number;
  
  /** Additional metadata about the response */
  metadata?: Record<string, any>;
}

/**
 * Parameters for creating an AI provider adapter
 * 
 * Contains the configuration needed to initialize a specific AI model adapter,
 * including provider selection, model configuration, and credential management.
 */
export interface AIProviderCreationParams {
  /** The AI provider to use */
  provider: AIProvider;
  
  /** Specific model to use with the provider */
  modelName?: string;
  
  /** Configuration options for the model */
  options?: AIModelOptions;
  
  /** Service for securely retrieving and managing API credentials */
  credentialService?: SecureCredentialService;
}

/**
 * Interface for AI model adapters
 * 
 * Defines the standard interface that all AI model adapters must implement.
 * This ensures consistent behavior across different AI providers and allows
 * the application to interact with any supported AI service through a unified API.
 * 
 * Implementations should handle:
 * - Authentication with the AI provider
 * - Formatting requests according to the provider's API
 * - Parsing and standardizing responses
 * - Error handling and retries
 * - Token usage tracking
 */
export interface AIModelAdapter {
  /**
   * Gets the name of the AI provider
   * 
   * @returns The AIProvider enum value for this adapter
   */
  getProviderName(): AIProvider;

  /**
   * Gets the name of the current model being used
   * 
   * @returns The model name string (e.g., 'gpt-4', 'claude-3-opus-20240229')
   */
  getModelName(): string;

  /**
   * Generates a text completion from the AI model
   * 
   * Sends a prompt to the AI model and returns the generated completion.
   * Handles all provider-specific API formatting and error handling.
   * 
   * @param params - The completion parameters including prompt and options
   * @returns Promise resolving to the AI response with generated text
   * @throws May throw errors for network issues, API errors, or invalid parameters
   */
  complete(params: AICompletionParams): Promise<AIResponse>;

  /**
   * Generates a structured response from the AI model
   * 
   * Similar to complete(), but transforms the AI output into a structured
   * data object of type T, such as a JSON object with specific fields.
   * 
   * @template T - The expected structure of the result
   * @param params - The completion parameters including prompt and options
   * @returns Promise resolving to the AI response with structured data
   * @throws May throw errors for parsing failures in addition to standard API errors
   */
  completeStructured<T>(params: AICompletionParams): Promise<AIResponse<T>>;

  /**
   * Processes a prompt using a LangChain prompt template
   * 
   * Uses LangChain's PromptTemplate system to format and process prompts
   * with variable substitution before sending to the AI model.
   * 
   * @param promptTemplate - The LangChain prompt template to use
   * @param input - The input variables to substitute into the template
   * @returns Promise resolving to the AI response
   * @throws May throw errors for template processing issues or API errors
   */
  processWithPromptTemplate(promptTemplate: PromptTemplate, input: Record<string, any>): Promise<AIResponse>;

  /**
   * Checks if the user has provided consent for a specific operation type
   * 
   * Optional method for checking user consent for AI operations.
   * This supports privacy-aware AI usage where different operations
   * may require different levels of user consent.
   * 
   * @param operationType - The type of operation to check consent for
   * @returns true if user has consented to this operation type, false otherwise
   */
  checkConsentFor?(operationType: string): boolean;

  /**
   * Cancels all pending AI requests
   * 
   * Optional method to cancel any in-flight requests, useful for cleaning up
   * when the application is shutting down or user has cancelled an operation.
   * 
   * @param reason - Optional reason for the cancellation (for logging/debugging)
   */
  cancelAllRequests?(reason?: string): void;
}