/**
 * ErrorSimulator - Simulates different types of errors for AI mocking
 */

import { MockErrorOptions, MockErrorType } from './types';

export class ErrorSimulator {
  private errorConfig: MockErrorOptions = {
    enabled: false,
    errorType: MockErrorType.NETWORK,
    probability: 0,
    errorMessage: undefined,
    operationTargets: undefined
  };
  
  constructor(initialConfig?: MockErrorOptions) {
    if (initialConfig) {
      this.configure(initialConfig);
    }
  }
  
  /**
   * Configure error simulation behavior
   */
  public configure(options: MockErrorOptions): void {
    this.errorConfig = {
      ...this.errorConfig,
      ...options
    };
  }
  
  /**
   * Potentially throw an error based on configuration
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
   * Generate an appropriate error based on the error type
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