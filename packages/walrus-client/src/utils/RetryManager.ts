/**
 * Retry Manager for Walrus Operations
 */

import { WalrusRetryError, WalrusTimeoutError } from '../errors';
import { RETRY_CONFIG } from '../constants';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  timeout?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number) => void;
}

export class RetryManager {
  private options: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>> & 
                   Pick<RetryOptions, 'shouldRetry' | 'onRetry'>;

  constructor(options: RetryOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? RETRY_CONFIG.maxRetries,
      baseDelay: options.baseDelay ?? RETRY_CONFIG.baseDelay,
      maxDelay: options.maxDelay ?? RETRY_CONFIG.maxDelay,
      backoffFactor: options.backoffFactor ?? RETRY_CONFIG.backoffFactor,
      timeout: options.timeout ?? 30000,
      shouldRetry: options.shouldRetry,
      onRetry: options.onRetry,
    };
  }

  async execute<T>(
    operation: () => Promise<T>,
    operationName: string = 'operation'
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this?.options?.maxRetries + 1; attempt++) {
      try {
        // Apply timeout if specified
        if (this?.options?.timeout > 0) {
          return await this.withTimeout(operation(), this?.options?.timeout);
        }
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error as any));
        
        // Don't retry on last attempt
        if (attempt > this?.options?.maxRetries) {
          break;
        }
        
        // Check if we should retry this error
        if (this?.options?.shouldRetry && !this?.options?.shouldRetry(lastError, attempt)) {
          break;
        }
        
        // Default retry logic for common network errors
        if (!this?.options?.shouldRetry && !this.shouldRetryDefault(lastError as any)) {
          break;
        }
        
        // Call retry callback
        this?.options?.onRetry?.(lastError, attempt);
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          this?.options?.baseDelay * Math.pow(this?.options?.backoffFactor, attempt - 1),
          this?.options?.maxDelay
        );
        
        await this.sleep(delay as any);
      }
    }
    
    throw new WalrusRetryError(
      `${operationName} failed after ${this?.options?.maxRetries + 1} attempts`,
      this?.options?.maxRetries + 1,
      lastError || undefined
    );
  }

  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new WalrusTimeoutError(
          `Operation timed out after ${timeout}ms`,
          timeout
        )), timeout)
      )
    ]);
  }

  private shouldRetryDefault(error: Error): boolean {
    // Retry on network errors, timeouts, and 5xx status codes
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      return true;
    }
    
    if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
      return true;
    }
    
    // Check for HTTP status codes in error message
    const statusMatch = error?.message?.match(/status\s*:?\s*(\d+)/i);
    if (statusMatch && statusMatch[1]) {
      const status = parseInt(statusMatch[1]);
      return status >= 500 || status === 429; // Server errors or rate limiting
    }
    
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Static helper methods
  static async withRetry<T>(
    operation: () => Promise<T>,
    options?: RetryOptions,
    operationName?: string
  ): Promise<T> {
    const retryManager = new RetryManager(options as any);
    return retryManager.execute(operation, operationName);
  }

  static exponentialBackoff(attempt: number, baseDelay: number = 1000): number {
    return Math.min(baseDelay * Math.pow(2, attempt - 1), 30000);
  }
}