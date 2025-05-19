/**
 * @file Backward compatibility layer for the error handling system
 * This module provides adapters and utilities to ensure backward compatibility
 * with older error handling patterns in the codebase.
 */

import {
  BaseError,
  ValidationError,
  NetworkError,
  StorageError,
  BlockchainError,
  CLIError,
  TransactionError,
  AuthorizationError,
  isErrorWithMessage as consolidatedIsErrorWithMessage,
  getErrorMessage as consolidatedGetErrorMessage,
  toBaseError
} from './consolidated';

// Re-export consolidated error types
export {
  BaseError,
  ValidationError,
  NetworkError,
  StorageError,
  BlockchainError,
  CLIError,
  TransactionError,
  AuthorizationError,
  // Re-export utility functions
  consolidatedIsErrorWithMessage as isErrorWithMessage,
  consolidatedGetErrorMessage as getErrorMessage,
  toBaseError
};

// Export legacy WalrusError enum for backward compatibility
export enum WalrusErrorCode {
  WALRUS_NOT_CONNECTED = 'WALRUS_NOT_CONNECTED',
  WALRUS_INIT_FAILED = 'WALRUS_INIT_FAILED',
  WALRUS_OPERATION_FAILED = 'WALRUS_OPERATION_FAILED',
  WALRUS_VALIDATION_FAILED = 'WALRUS_VALIDATION_FAILED',
  WALRUS_SERIALIZATION_FAILED = 'WALRUS_SERIALIZATION_FAILED',
  WALRUS_DATA_TOO_LARGE = 'WALRUS_DATA_TOO_LARGE',
  WALRUS_INSUFFICIENT_TOKENS = 'WALRUS_INSUFFICIENT_TOKENS',
  WALRUS_STORAGE_ALLOCATION_FAILED = 'WALRUS_STORAGE_ALLOCATION_FAILED',
  WALRUS_VERIFICATION_FAILED = 'WALRUS_VERIFICATION_FAILED',
  WALRUS_STORE_FAILED = 'WALRUS_STORE_FAILED',
  WALRUS_INVALID_INPUT = 'WALRUS_INVALID_INPUT',
  WALRUS_RETRIEVE_FAILED = 'WALRUS_RETRIEVE_FAILED',
  WALRUS_PARSE_FAILED = 'WALRUS_PARSE_FAILED',
  WALRUS_INVALID_TODO_DATA = 'WALRUS_INVALID_TODO_DATA',
  WALRUS_UPDATE_FAILED = 'WALRUS_UPDATE_FAILED'
}

/**
 * Legacy WalrusError class implementation for backward compatibility
 * This redirects to the consolidated BaseError system.
 * @deprecated Use the consolidated error system instead
 */
export class WalrusError extends BaseError {
  /**
   * Create a new WalrusError instance with backward compatibility support
   * @param message Error message
   * @param codeOrOptions Error code or options
   */
  constructor(
    message: string,
    codeOrOptions: string | Partial<{
      code: string;
      publicMessage?: string;
      shouldRetry?: boolean;
      cause?: Error;
    }> = {}
  ) {
    // Process the legacy constructor parameters
    let options: {
      code: string;
      publicMessage?: string;
      recoverable?: boolean;
      shouldRetry?: boolean;
      cause?: Error;
    };

    if (typeof codeOrOptions === 'string') {
      options = {
        code: codeOrOptions,
        publicMessage: 'An unexpected error occurred',
        shouldRetry: false
      };
    } else {
      const {
        code = 'WALRUS_ERROR',
        publicMessage = 'An unexpected error occurred',
        shouldRetry = false,
        cause
      } = codeOrOptions;

      options = {
        code,
        publicMessage,
        shouldRetry,
        cause
      };
    }

    // Call BaseError constructor with converted options
    super({
      message,
      code: options.code,
      publicMessage: options.publicMessage,
      shouldRetry: options.shouldRetry,
      recoverable: options.shouldRetry,
      cause: options.cause
    });
  }

  /**
   * For backward compatibility with code that expects toPublicError method
   */
  public toPublicError(): {
    code: string;
    message: string;
    timestamp: string;
    shouldRetry: boolean;
  } {
    return {
      code: this.code,
      message: this.publicMessage,
      timestamp: this.timestamp,
      shouldRetry: this.shouldRetry
    };
  }

  /**
   * For backward compatibility with code that expects toLogEntry method
   */
  public toLogEntry(): {
    name: string;
    code: string;
    message: string;
    publicMessage: string;
    timestamp: string;
    shouldRetry: boolean;
    stack?: string;
    cause?: string;
  } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      publicMessage: this.publicMessage,
      timestamp: this.timestamp,
      shouldRetry: this.shouldRetry,
      stack: this.stack,
      cause: this.cause instanceof Error ? this.cause.message : String(this.cause)
    };
  }
}


/**
 * Legacy toErrorWithMessage implementation for backward compatibility
 * @deprecated Use the consolidated toBaseError function instead
 */
export function toErrorWithMessage(maybeError: unknown): { message: string } {
  if (isErrorWithMessage(maybeError)) return maybeError;
  try {
    return new Error(JSON.stringify(maybeError));
  } catch {
    return new Error(String(maybeError));
  }
}