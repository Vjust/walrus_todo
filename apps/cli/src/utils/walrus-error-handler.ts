import { Logger } from './Logger';
import {
  BaseError as WalrusError,
  NetworkError,
  StorageError,
  BlockchainError,
  TransactionError,
  AuthorizationError,
  ValidationError,
  CLIError,
} from '../types/errors/consolidated';

const logger = new Logger('walrus-error-handler');

/**
 * Categorized error types for Walrus operations
 */
export enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  STORAGE = 'storage',
  BLOCKCHAIN = 'blockchain',
  TRANSACTION = 'transaction',
  AUTHORIZATION = 'authorization',
  UNKNOWN = 'unknown',
}

/**
 * Options for the AsyncOperationHandler
 */
export interface AsyncOperationOptions {
  /** Operation name for error context */
  operation: string;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Base delay in ms between retries */
  baseDelay?: number;
  /** Timeout in ms for the operation */
  timeout?: number;
  /** Error categorization function */
  categorizeError?: (error: unknown) => ErrorCategory;
  /** Whether to throw errors or return them */
  throwErrors?: boolean;
  /** Whether to log retry attempts */
  logRetries?: boolean;
  /** Custom error mapper function */
  errorMapper?: (
    error: unknown,
    category: ErrorCategory,
    context: string
  ) => Error;
  /** Abort signal for cancelable operations */
  signal?: AbortSignal;
}

/**
 * Result of an async operation
 */
export interface AsyncOperationResult<T> {
  /** Whether the operation was successful */
  success: boolean;
  /** The result data if successful */
  data?: T;
  /** The error if unsuccessful */
  error?: Error;
  /** Attempt count */
  attempts: number;
  /** Error category if applicable */
  errorCategory?: ErrorCategory;
  /** Total operation time in ms */
  timeTaken?: number;
}

/**
 * Categorizes errors based on their message and type
 */
export function categorizeWalrusError(error: unknown): ErrorCategory {
  // Early return for known error types
  if (error instanceof NetworkError) return ErrorCategory.NETWORK;
  if (error instanceof StorageError) return ErrorCategory.STORAGE;
  if (error instanceof ValidationError) return ErrorCategory.VALIDATION;
  if (error instanceof BlockchainError) return ErrorCategory.BLOCKCHAIN;
  if (error instanceof TransactionError) return ErrorCategory.TRANSACTION;
  if (error instanceof AuthorizationError) return ErrorCategory.AUTHORIZATION;

  // Categorize by error message patterns for unknown error types
  const errorMessage =
    error instanceof Error
      ? error?.message?.toLowerCase()
      : String(error as any).toLowerCase();

  if (
    errorMessage.includes('network') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('econnreset') ||
    errorMessage.includes('socket') ||
    errorMessage.includes('dns') ||
    errorMessage.includes('fetch failed') ||
    errorMessage.includes('aborted')
  ) {
    return ErrorCategory.NETWORK;
  }

  if (
    errorMessage.includes('validation') ||
    errorMessage.includes('invalid') ||
    errorMessage.includes('schema') ||
    errorMessage.includes('required field') ||
    errorMessage.includes('must be')
  ) {
    return ErrorCategory.VALIDATION;
  }

  if (
    errorMessage.includes('storage') ||
    errorMessage.includes('blob') ||
    errorMessage.includes('object not found') ||
    errorMessage.includes('disk') ||
    errorMessage.includes('allocation') ||
    errorMessage.includes('not certified')
  ) {
    return ErrorCategory.STORAGE;
  }

  if (
    errorMessage.includes('blockchain') ||
    errorMessage.includes('sui') ||
    errorMessage.includes('walrus') ||
    errorMessage.includes('consensus')
  ) {
    return ErrorCategory.BLOCKCHAIN;
  }

  if (
    errorMessage.includes('transaction') ||
    errorMessage.includes('gas budget') ||
    errorMessage.includes('insufficient funds') ||
    errorMessage.includes('execution') ||
    errorMessage.includes('state')
  ) {
    return ErrorCategory.TRANSACTION;
  }

  if (
    errorMessage.includes('permission') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('access denied') ||
    errorMessage.includes('forbidden') ||
    errorMessage.includes('auth')
  ) {
    return ErrorCategory.AUTHORIZATION;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Maps an error to a standardized WalrusError subclass based on category
 */
export function mapToWalrusError(
  error: unknown,
  category: ErrorCategory,
  operation: string
): Error {
  // If already a WalrusError subclass, just ensure operation is set
  if (error instanceof WalrusError) {
    return error;
  }

  // If we have a CLIError, extract the message but convert to typed error
  const errorMessage = error instanceof Error ? error.message : String(error as any);

  switch (category) {
    case ErrorCategory.NETWORK:
      return new NetworkError(errorMessage, {
        code: getErrorCode(category, operation),
        recoverable: true, // Network errors are typically recoverable
        cause: error instanceof Error ? error : undefined,
      });

    case ErrorCategory.STORAGE:
      return new StorageError(errorMessage, {
        code: getErrorCode(category, operation),
        recoverable: true, // Most storage errors are recoverable
        cause: error instanceof Error ? error : undefined,
      });

    case ErrorCategory.VALIDATION:
      return new ValidationError(errorMessage, {
        message: errorMessage,
        recoverable: false, // Validation errors typically require user intervention
        cause: error instanceof Error ? error : undefined,
      });

    case ErrorCategory.BLOCKCHAIN:
      return new BlockchainError(errorMessage, {
        code: getErrorCode(category, operation),
        recoverable: false, // Blockchain errors are often not recoverable automatically
        cause: error instanceof Error ? error : undefined,
      });

    case ErrorCategory.TRANSACTION:
      return new TransactionError(errorMessage, {
        code: getErrorCode(category, operation),
        recoverable: false, // Transaction errors typically need review
        cause: error instanceof Error ? error : undefined,
      });

    case ErrorCategory.AUTHORIZATION:
      return new AuthorizationError(errorMessage, {
        code: getErrorCode(category, operation),
        recoverable: false, // Authorization errors typically require user intervention
        cause: error instanceof Error ? error : undefined,
      });

    default:
      // Map to CLI error for backward compatibility
      return new CLIError(`Error during ${operation}: ${errorMessage}`, {
        code: `WALRUS_${operation.toUpperCase()}_ERROR`,
        recoverable: false,
      });
  }
}

/**
 * Maps error strings to appropriate WalrusErrorCode
 */
export function getErrorCode(
  category: ErrorCategory,
  operation: string
): string {
  const opCode = operation.replace(/\s+/g, '_').toUpperCase();

  switch (category) {
    case ErrorCategory.NETWORK:
      return `WALRUS_NETWORK_${opCode}_ERROR`;
    case ErrorCategory.STORAGE:
      return `WALRUS_STORAGE_${opCode}_ERROR`;
    case ErrorCategory.VALIDATION:
      return `WALRUS_VALIDATION_${opCode}_ERROR`;
    case ErrorCategory.BLOCKCHAIN:
      return `WALRUS_BLOCKCHAIN_${opCode}_ERROR`;
    case ErrorCategory.TRANSACTION:
      return `WALRUS_TRANSACTION_${opCode}_ERROR`;
    case ErrorCategory.AUTHORIZATION:
      return `WALRUS_AUTH_${opCode}_ERROR`;
    default:
      return `WALRUS_${opCode}_ERROR`;
  }
}

/**
 * Determines if an error is retryable based on its category and properties
 */
export function isRetryableError(
  error: unknown,
  category: ErrorCategory
): boolean {
  // If it's a WalrusError, use its shouldRetry property
  if (error instanceof WalrusError) {
    return error.shouldRetry;
  }

  // Network errors are almost always retryable
  if (category === ErrorCategory.NETWORK) {
    return true;
  }

  // Some storage errors are retryable
  if (category === ErrorCategory.STORAGE) {
    const msg = String(error as any).toLowerCase();
    return (
      msg.includes('timeout') ||
      msg.includes('connection') ||
      msg.includes('temporary') ||
      msg.includes('retry') ||
      msg.includes('429') || // Too many requests
      msg.includes('503') || // Service unavailable
      msg.includes('504') // Gateway timeout
    );
  }

  // Certain transaction errors may be retryable
  if (category === ErrorCategory.TRANSACTION) {
    const msg = String(error as any).toLowerCase();
    return (
      msg.includes('gas') || msg.includes('retry') || msg.includes('timeout')
    );
  }

  // By default, other categories are not retryable
  return false;
}

/**
 * A class that handles async operations with standardized error handling
 */
export class AsyncOperationHandler {
  /**
   * Execute an async operation with standardized error handling
   */
  public static async execute<T>(
    operation: () => Promise<T>,
    options: AsyncOperationOptions
  ): Promise<AsyncOperationResult<T>> {
    const {
      operation: operationName,
      maxRetries = 3,
      baseDelay = 1000,
      timeout,
      categorizeError = categorizeWalrusError,
      throwErrors = true,
      logRetries = true,
      errorMapper = mapToWalrusError,
      signal,
    } = options;

    let attempts = 0;
    let lastError: Error | undefined;
    const startTime = Date.now();

    while (attempts < maxRetries) {
      // Check if the operation was canceled
      if (signal?.aborted) {
        const abortError = new Error(`Operation ${operationName} was canceled`);
        return {
          success: false,
          error: abortError,
          attempts,
          errorCategory: ErrorCategory.UNKNOWN,
          timeTaken: Date.now() - startTime,
        };
      }

      attempts++;

      try {
        // Handle timeout if specified
        let result: T;
        if (timeout) {
          const timeoutPromise = new Promise<never>((_, reject) => {
            const timeoutId = setTimeout(() => {
              reject(
                new Error(
                  `Operation ${operationName} timed out after ${timeout}ms`
                )
              );
            }, timeout);

            // Clean up timeout if operation is aborted
            if (signal) {
              signal.addEventListener(
                'abort',
                () => {
                  clearTimeout(timeoutId as any);
                  reject(new Error(`Operation ${operationName} was canceled`));
                },
                { once: true }
              );
            }
          });

          result = await Promise.race([operation(), timeoutPromise]);
        } else {
          result = await operation();
        }

        // Operation succeeded
        return {
          success: true,
          data: result,
          attempts,
          timeTaken: Date.now() - startTime,
        };
      } catch (_error) {
        // Check for abort signal again in case it was triggered during operation
        if (signal?.aborted) {
          const abortError = new Error(
            `Operation ${operationName} was canceled`
          );
          return {
            success: false,
            error: abortError,
            attempts,
            errorCategory: ErrorCategory.UNKNOWN,
            timeTaken: Date.now() - startTime,
          };
        }

        // Categorize the error
        const category = categorizeError(_error as any);

        // Map to standardized error
        lastError = errorMapper(_error, category, operationName);

        // Check if error is retryable
        const shouldRetry =
          attempts < maxRetries && isRetryableError(_error, category);

        if (!shouldRetry) {
          break;
        }

        // Calculate backoff delay with exponential backoff and jitter
        const delay =
          baseDelay * Math.pow(2, attempts - 1) * (0.8 + Math.random() * 0.4);

        if (logRetries) {
          logger.info(
            `Operation ${operationName} failed (attempt ${attempts}/${maxRetries}), retrying in ${Math.round(delay as any)}ms...`
          );
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // All attempts failed
    const result: AsyncOperationResult<T> = {
      success: false,
      error: lastError,
      attempts,
      errorCategory:
        lastError instanceof WalrusError
          ? lastError?.code?.toLowerCase().includes('network')
            ? ErrorCategory.NETWORK
            : lastError?.code?.toLowerCase().includes('storage')
              ? ErrorCategory.STORAGE
              : lastError?.code?.toLowerCase().includes('validation')
                ? ErrorCategory.VALIDATION
                : lastError?.code?.toLowerCase().includes('blockchain')
                  ? ErrorCategory.BLOCKCHAIN
                  : lastError?.code?.toLowerCase().includes('transaction')
                    ? ErrorCategory.TRANSACTION
                    : ErrorCategory.UNKNOWN
          : ErrorCategory.UNKNOWN,
      timeTaken: Date.now() - startTime,
    };

    if (throwErrors) {
      throw result.error;
    }

    return result;
  }

  /**
   * Wraps an async function with standardized error handling
   */
  public static wrap<T, Args extends unknown[]>(
    fn: (...args: Args) => Promise<T>,
    options: AsyncOperationOptions
  ): (...args: Args) => Promise<AsyncOperationResult<T>> {
    return async (...args: Args) => {
      return this.execute(() => fn(...args), options);
    };
  }
}
