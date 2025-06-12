/**
 * @fileoverview Storage Operation Handler - Utilities for storage operations with retry support
 *
 * This module provides helper functions for executing storage operations with
 * automatic retries, timeouts, and proper error handling. It builds on the AsyncOperationHandler
 * but adds storage-specific error mapping and context.
 */

import {
  StorageError,
  NetworkError,
  BlockchainError,
} from '../../../types/errors';
import { ValidationError } from '../../../types/errors/ValidationError';
import {
  AsyncOperationHandler,
  ErrorCategory,
} from '../../walrus-error-handler';

/**
 * Result of a storage operation
 */
export interface StorageOperationResult<T> {
  /** Whether the operation was successful */
  success: boolean;

  /** The result data if successful */
  data?: T;

  /** The error if unsuccessful */
  error?: Error;

  /** Number of retry attempts made */
  attempts: number;

  /** Total time taken for the operation in milliseconds */
  durationMs: number;
}

/**
 * Categorizes a storage error based on its type and message.
 *
 * @param error - The error to categorize
 * @returns The category of the error
 */
export function categorizeStorageError(
  error: unknown
): 'validation' | 'storage' | 'network' | 'blockchain' | 'unknown' {
  if (error instanceof ValidationError) {
    return 'validation';
  }

  if (error instanceof StorageError) {
    return 'storage';
  }

  if (error instanceof NetworkError) {
    return 'network';
  }

  if (error instanceof BlockchainError) {
    return 'blockchain';
  }

  const errorMsg = error instanceof Error ? error.message : String(error as any);

  // Check for network-related errors
  if (
    errorMsg.includes('network') ||
    errorMsg.includes('timeout') ||
    errorMsg.includes('connection') ||
    errorMsg.includes('unreachable') ||
    errorMsg.includes('refused')
  ) {
    return 'network';
  }

  // Check for blockchain-related errors
  if (
    errorMsg.includes('transaction') ||
    errorMsg.includes('blockchain') ||
    errorMsg.includes('gas') ||
    errorMsg.includes('bal') ||
    errorMsg.includes('token') ||
    errorMsg.includes('insufficient') ||
    errorMsg.includes('sui') ||
    errorMsg.includes('walrus')
  ) {
    return 'blockchain';
  }

  // Check for storage-related errors
  if (
    errorMsg.includes('storage') ||
    errorMsg.includes('blob') ||
    errorMsg.includes('object') ||
    errorMsg.includes('metadata') ||
    errorMsg.includes('corrupt') ||
    errorMsg.includes('integrity')
  ) {
    return 'storage';
  }

  return 'unknown';
}

/**
 * Maps an error to the appropriate storage error type based on its category.
 *
 * @param error - The error to map
 * @param category - The category of the error
 * @param operation - The operation being performed
 * @returns The mapped error
 */
export function mapToStorageError(
  error: unknown,
  category: 'validation' | 'storage' | 'network' | 'blockchain' | 'unknown',
  operation: string
): Error {
  // If already a known error type, just return it
  if (
    error instanceof ValidationError ||
    error instanceof StorageError ||
    error instanceof NetworkError ||
    error instanceof BlockchainError
  ) {
    return error;
  }

  const errorMsg = error instanceof Error ? error.message : String(error as any);

  switch (category) {
    case 'validation':
      return new ValidationError(errorMsg, {
        operation,
        recoverable: false,
        cause: error instanceof Error ? error : undefined,
      });

    case 'storage':
      return new StorageError(errorMsg, {
        operation,
        recoverable: true,
        cause: error instanceof Error ? error : undefined,
      });

    case 'network':
      return new NetworkError(errorMsg, {
        operation,
        recoverable: true,
        cause: error instanceof Error ? error : undefined,
      });

    case 'blockchain':
      return new BlockchainError(errorMsg, {
        operation,
        recoverable: false,
        cause: error instanceof Error ? error : undefined,
      });

    default:
      return new StorageError(
        `Unknown error during ${operation}: ${errorMsg}`,
        {
          operation,
          recoverable: false,
          cause: error instanceof Error ? error : undefined,
        }
      );
  }
}

/**
 * Options for storage operations
 */
export interface StorageOperationOptions {
  /** Maximum number of retries */
  maxRetries?: number;

  /** Base delay between retries in milliseconds */
  baseDelay?: number;

  /** Maximum delay between retries in milliseconds */
  maxDelay?: number;

  /** Timeout for the operation in milliseconds */
  timeout?: number;

  /** Function to determine if an error is retryable */
  retryIf?: (error: unknown) => boolean;

  /** Function called on retry attempt */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;

  /** Whether to throw errors instead of returning them */
  throwErrors?: boolean;

  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Storage Operation Handler - Executes storage operations with automatic retries.
 */
export class StorageOperationHandler {
  /**
   * Executes a storage operation with automatic retries.
   *
   * @param operation - The operation to execute
   * @param options - Options for the operation
   * @returns Promise resolving to the operation result
   */
  public static async execute<T>(
    operation: () => Promise<T>,
    options: StorageOperationOptions & { operation: string }
  ): Promise<StorageOperationResult<T>> {
    const startTime = Date.now();
    let attempts = 0;

    try {
      // Use AsyncOperationHandler for the actual execution
      const result = await AsyncOperationHandler.execute(operation, {
        operation: options.operation,
        maxRetries: options.maxRetries,
        baseDelay: options.baseDelay,
        timeout: options.timeout,
        throwErrors: options.throwErrors,
        signal: options.signal,
        // Custom mapper for error categorization
        errorMapper: (error, _, context) => {
          const category = categorizeStorageError(error as any);
          return mapToStorageError(error, category, context);
        },
        categorizeError: error => {
          const category = categorizeStorageError(error as any);
          // Map our categories to ErrorCategory enum
          const mappedCategory = (() => {
            switch (category) {
              case 'validation':
                return ErrorCategory.VALIDATION;
              case 'storage':
                return ErrorCategory.STORAGE;
              case 'network':
                return ErrorCategory.NETWORK;
              case 'blockchain':
                return ErrorCategory.BLOCKCHAIN;
              default:
                return ErrorCategory.UNKNOWN;
            }
          })();
          return mappedCategory;
        },
      });

      // Get the number of attempts from the AsyncOperationHandler
      attempts = result.attempts || 1;

      // Map result back to StorageOperationResult
      return {
        success: result.success,
        data: result.data,
        error: result.error
          ? this.mapError(result.error, options.operation)
          : undefined,
        attempts,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      // If AsyncOperationHandler rethrows, map and rethrow
      const mappedError = this.mapError(error, options.operation);
      throw mappedError;
    }
  }

  /**
   * Maps an error to the appropriate storage error type.
   *
   * @param error - The error to map
   * @param operation - The operation being performed
   * @returns The mapped error
   */
  private static mapError(error: unknown, operation: string): Error {
    const category = categorizeStorageError(error as any);
    return mapToStorageError(error, category, operation);
  }

  /**
   * Executes a function with retries for storage operations.
   *
   * @param fn - The function to execute
   * @param options - Options for the operation
   * @returns Promise resolving to the function result
   */
  public static async withRetry<T>(
    fn: () => Promise<T>,
    options: StorageOperationOptions & { operation: string }
  ): Promise<T> {
    const result = await this.execute(fn, {
      ...options,
      throwErrors: true,
    });

    if (result?.data === undefined) {
      throw new Error('Operation completed but returned no data');
    }
    return result.data;
  }
}
