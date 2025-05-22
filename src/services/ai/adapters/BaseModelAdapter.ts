/**
 * BaseModelAdapter - Abstract base class for AI model adapters
 *
 * This class provides common functionality for AI model adapters,
 * including error handling, rate limiting, retry logic, and proper timeout handling.
 */

import { PromptTemplate } from '@langchain/core/prompts';
import {
  AIModelAdapter,
  AIProvider,
  AICompletionParams,
  AIResponse,
  AIModelOptions
} from '../../../types/adapters/AIModelAdapter';
import { ResponseParser } from '../ResponseParser';
import { NetworkManager, EnhancedFetchOptions } from '../../../utils/NetworkManager';

export abstract class BaseModelAdapter implements AIModelAdapter {
  protected provider: AIProvider;
  protected apiKey: string;
  protected modelName: string;
  protected defaultOptions: AIModelOptions;

  // Network and rate limiting parameters
  protected rateLimitRetryCount: number = 3;
  protected rateLimitRetryDelay: number = 1000;
  protected lastRequestTime: number = 0;
  protected minRequestInterval: number = 100; // milliseconds

  // Request timeout defaults
  protected defaultTimeout: number = 30000; // 30 seconds default timeout
  protected defaultRetries: number = 3;     // 3 retry attempts by default

  // Active request controllers for cancellation
  protected activeRequests: AbortController[] = [];

  constructor(
    provider: AIProvider,
    apiKey: string,
    modelName: string,
    defaultOptions: AIModelOptions = {}
  ) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.modelName = modelName;
    this.defaultOptions = {
      temperature: 0.7,
      maxTokens: 1000,
      timeout: this.defaultTimeout,
      retries: this.defaultRetries,
      ...defaultOptions
    };
  }

  /**
   * Get the name of the provider
   */
  public getProviderName(): AIProvider {
    return this.provider;
  }

  /**
   * Get the name of the current model being used
   */
  public getModelName(): string {
    return this.modelName;
  }

  /**
   * Set the model name
   */
  public setModelName(modelName: string): void {
    this.modelName = modelName;
  }

  /**
   * Generate a completion from the AI model
   */
  public abstract complete(params: AICompletionParams): Promise<AIResponse>;

  /**
   * Generate a structured response from the AI model
   */
  public abstract completeStructured<T>(params: AICompletionParams): Promise<AIResponse<T>>;

  /**
   * Process a prompt through a LangChain chain
   */
  public abstract processWithPromptTemplate(
    promptTemplate: PromptTemplate,
    input: Record<string, any>
  ): Promise<AIResponse>;

  /**
   * Cancel all pending requests
   */
  public cancelAllRequests(reason: string = 'User cancelled operation'): void {
    this.activeRequests.forEach(controller => {
      if (!controller.signal.aborted) {
        controller.abort(reason);
      }
    });

    // Clear the list of active requests
    this.activeRequests = [];
  }

  /**
   * Create a base response object with common fields
   */
  protected createBaseResponse<T>(result: T): AIResponse<T> {
    return {
      result,
      modelName: this.modelName,
      provider: this.provider,
      timestamp: Date.now(),
      metadata: {}
    };
  }

  /**
   * Handle errors with the appropriate wrapped error types
   */
  protected handleError(error: any, operation: string): never {
    // Check for AbortError (timeout or cancellation)
    if (error.name === 'AbortError' || (error.cause && error.cause.name === 'AbortError')) {
      throw new Error(`Operation ${operation} was cancelled or timed out`);
    }

    if (error.status === 429 || (error.response && error.response.status === 429)) {
      throw new Error(`Rate limit exceeded for ${this.provider} during ${operation}`);
    }

    if (error.status === 401 || (error.response && error.response.status === 401)) {
      throw new Error(`Authentication failed for ${this.provider}: Invalid API key`);
    }

    throw new Error(`Error with ${this.provider} during ${operation}: ${error.message || 'Unknown error'}`);
  }

  /**
   * Implement rate limiting to prevent hitting API limits
   */
  protected async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Execute a network request with proper timeout and retry handling
   */
  protected async executeRequest<T>(
    url: string,
    requestOptions: RequestInit & { body?: any },
    options: {
      timeout?: number;
      retries?: number;
      operation?: string;
      parseJson?: boolean;
    } = {}
  ): Promise<T> {
    await this.enforceRateLimit();

    const controller = new AbortController();
    this.activeRequests.push(controller);

    try {
      const fetchOptions: EnhancedFetchOptions = {
        ...requestOptions,
        signal: controller.signal,
        timeout: options.timeout || this.defaultOptions.timeout || this.defaultTimeout,
        retries: options.retries || this.defaultOptions.retries || this.defaultRetries,
        operationName: options.operation || 'AI model request',
        parseJson: options.parseJson !== false,
        headers: {
          'Content-Type': 'application/json',
          ...(requestOptions.headers || {})
        }
      };

      // If body is an object, stringify it
      if (requestOptions.body && typeof requestOptions.body === 'object') {
        fetchOptions.body = JSON.stringify(requestOptions.body);
      }

      const response = await NetworkManager.fetch<T>(url, fetchOptions);

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
      }

      return response.data as T;
    } finally {
      // Remove this controller from active requests
      const index = this.activeRequests.indexOf(controller);
      if (index !== -1) {
        this.activeRequests.splice(index, 1);
      }

      // Ensure controller is aborted to free resources
      if (!controller.signal.aborted) {
        controller.abort('Request completed');
      }
    }
  }

  /**
   * Parse a string prompt or apply a LangChain prompt template
   * @param promptInput - The prompt string or PromptTemplate
   * @param input - Input values to format the template with
   * @returns Formatted prompt string
   */
  protected async resolvePrompt(
    promptInput: string | PromptTemplate,
    input?: Record<string, any>
  ): Promise<string> {
    if (typeof promptInput === 'string') {
      return promptInput;
    }

    if (!input) {
      throw new Error('Input is required when using a prompt template');
    }

    try {
      return await promptInput.format(input);
    } catch (_error) {
      throw new Error(`Error formatting prompt template: ${_error instanceof Error ? _error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse a response as a specific data type
   */
  protected parseResponse<T>(response: string, defaultValue: T): T {
    return ResponseParser.parseJson<T>(response, defaultValue);
  }
}