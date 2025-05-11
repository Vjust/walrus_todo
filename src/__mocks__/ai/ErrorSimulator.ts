/**
 * ErrorSimulator - A utility class that simulates different types of errors for AI mocking
 *
 * This class provides a configurable way to simulate various error scenarios that might
 * occur when interacting with AI services. It allows test code to verify error handling
 * logic by injecting controlled errors with specific characteristics.
 *
 * Features:
 * - Configurable error types (network, authentication, rate limiting, etc.)
 * - Probabilistic error triggering
 * - Operation-specific error targeting
 * - Custom error messages
 *
 * @example
 * ```typescript
 * // Create error simulator with rate limiting errors
 * const errorSimulator = new ErrorSimulator({
 *   enabled: true,
 *   errorType: MockErrorType.RATE_LIMIT,
 *   probability: 0.5, // 50% chance of error
 *   operationTargets: ['summarize', 'categorize'] // Only affect these operations
 * });
 *
 * // Use in your mock provider
 * try {
 *   errorSimulator.maybeThrowError('summarize'); // Might throw an error
 *   // Proceed with normal operation if no error
 * } catch (error) {
 *   // Handle the error
 * }
 * ```
 */

import { MockErrorOptions, MockErrorType } from './types';

export class ErrorSimulator {
  /**
   * The current error configuration
   * @private
   */
  private errorConfig: MockErrorOptions = {
    enabled: false,
    errorType: MockErrorType.NETWORK,
    probability: 0,
    errorMessage: undefined,
    operationTargets: undefined
  };

  /**
   * Creates a new ErrorSimulator instance
   *
   * @param initialConfig - Optional initial configuration for the error simulator
   */
  constructor(initialConfig?: MockErrorOptions) {
    if (initialConfig) {
      this.configure(initialConfig);
    }
  }

  /**
   * Configures error simulation behavior
   *
   * Updates the current configuration with the provided options.
   * Any properties not specified in the options parameter will retain their existing values.
   *
   * @param options - The configuration options to apply
   * @example
   * ```typescript
   * // Enable error simulation with 100% probability
   * errorSimulator.configure({
   *   enabled: true,
   *   errorType: MockErrorType.NETWORK,
   *   probability: 1.0
   * });
   *
   * // Later, disable error simulation
   * errorSimulator.configure({ enabled: false });
   * ```
   */
  public configure(options: MockErrorOptions): void {
    this.errorConfig = {
      ...this.errorConfig,
      ...options
    };
  }

  /**
   * Potentially throws an error based on the current configuration
   *
   * This method evaluates the current error configuration and operational context
   * to determine if an error should be thrown. The decision is based on:
   * 1. Whether error simulation is enabled
   * 2. Whether the specified operation is targeted
   * 3. Random probability check
   *
   * @param operation - The name of the operation being performed (e.g., 'summarize', 'categorize')
   * @throws Error with the appropriate type and message if conditions are met
   * @example
   * ```typescript
   * // In your AI service mock
   * public async summarize(todos: Todo[]): Promise<string> {
   *   // This might throw based on configuration
   *   errorSimulator.maybeThrowError('summarize');
   *
   *   // If no error was thrown, continue with normal operation
   *   return "Summary of todos...";
   * }
   * ```
   */
  public maybeThrowError(operation: string): void {
    if (!this.errorConfig.enabled) {
      return;
    }

    // Check if this operation should trigger errors
    if (this.errorConfig.operationTargets &&
        !this.errorConfig.operationTargets.includes(operation)) {
      return;
    }

    // Random chance based on probability
    if (Math.random() < (this.errorConfig.probability || 0)) {
      throw this.generateError();
    }
  }

  /**
   * Generates an appropriate error based on the configured error type
   *
   * This private method creates an Error object with the message appropriate for
   * the configured error type. If a custom error message is provided in the configuration,
   * it will be used instead of the default message for that error type.
   *
   * @returns An Error object with the appropriate message
   * @private
   */
  private generateError(): Error {
    const errorType = this.errorConfig.errorType || MockErrorType.NETWORK;
    const customMessage = this.errorConfig.errorMessage;

    switch (errorType) {
      case MockErrorType.AUTHENTICATION:
        return new Error(customMessage || '401 Unauthorized: Invalid API key');

      case MockErrorType.RATE_LIMIT:
        return new Error(customMessage || '429 Too Many Requests: Rate limit exceeded');

      case MockErrorType.TIMEOUT:
        return new Error(customMessage || 'Request timed out after 30000ms');

      case MockErrorType.SERVER:
        return new Error(customMessage || '500 Internal Server Error: Something went wrong');

      case MockErrorType.TOKEN_LIMIT:
        return new Error(customMessage || 'Input exceeds maximum token limit');

      case MockErrorType.CONTENT_POLICY:
        return new Error(customMessage || 'Your request was rejected as a result of our safety system');

      case MockErrorType.INVALID_REQUEST:
        return new Error(customMessage || '400 Bad Request: Invalid request parameters');

      case MockErrorType.INTERNAL:
        return new Error(customMessage || 'Internal error occurred while processing request');

      case MockErrorType.NETWORK:
      default:
        return new Error(customMessage || 'Network error: Unable to connect to the API');
    }
  }
}