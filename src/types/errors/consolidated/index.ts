/**
 * @file Consolidated error handling framework
 * Exports a unified set of error classes for consistent error handling throughout the application.
 */

// Base error infrastructure
export { BaseError } from './BaseError';
export type { BaseErrorOptions, PublicErrorResponse, ErrorLogEntry } from './BaseError';

// Domain-specific error classes
export { ValidationError } from './ValidationError';
export type { ValidationErrorOptions } from './ValidationError';

export { NetworkError } from './NetworkError';
export type { NetworkErrorOptions } from './NetworkError';

export { StorageError } from './StorageError';
export type { StorageErrorOptions } from './StorageError';

export { BlockchainError } from './BlockchainError';
export type { BlockchainErrorOptions } from './BlockchainError';

export { CLIError } from './CLIError';
export type { CLIErrorOptions } from './CLIError';

export { TransactionError } from './TransactionError';
export type { TransactionErrorOptions } from './TransactionError';

export { AuthorizationError } from './AuthorizationError';
export type { AuthorizationErrorOptions } from './AuthorizationError';

// Error utilities

/**
 * Checks if a value is an error with a message
 * @param error Value to check
 * @returns true if the value is an error with a message
 */
export function isErrorWithMessage(error: unknown): error is Error {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

/**
 * Gets a string error message from any value
 * @param error Value to get error message from
 * @returns Error message string
 */
export function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  
  try {
    return String(error);
  } catch (e) {
    return 'Unknown error';
  }
}

/**
 * Determines if an error is a specific type
 * @param error Error to check
 * @param errorClass Error class to check against
 * @returns true if the error is an instance of the error class
 */
export function isErrorType<T extends typeof BaseError>(
  error: unknown,
  errorClass: T
): error is InstanceType<T> {
  return error instanceof (errorClass as any);
}

/**
 * Safely extracts the error code from any error
 * @param error Error to get code from
 * @param defaultCode Default code if not found
 * @returns Error code
 */
export function getErrorCode(error: unknown, defaultCode = 'UNKNOWN_ERROR'): string {
  if (error instanceof BaseError) {
    return error.code;
  }
  
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string'
  ) {
    return (error as Record<string, string>).code;
  }
  
  return defaultCode;
}

/**
 * Determines if an error is likely transient and can be retried
 * @param error Error to check
 * @returns true if the error is likely transient
 */
export function isTransientError(error: unknown): boolean {
  // For BaseError-derived errors, use the shouldRetry property
  if (error instanceof BaseError) {
    return error.shouldRetry;
  }
  
  // For network errors, check common patterns
  const message = String(error).toLowerCase();
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('429') ||
    message.includes('too many requests') ||
    message.includes('rate limit')
  );
}

/**
 * Converts any error-like object to a BaseError
 * @param error Error to convert
 * @param defaultMessage Default message if not an error
 * @param defaultCode Default code if not a BaseError
 * @returns A BaseError
 */
export function toBaseError(
  error: unknown,
  defaultMessage = 'An unknown error occurred',
  defaultCode = 'UNKNOWN_ERROR'
): BaseError {
  if (error instanceof BaseError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new BaseError({
      message: error.message,
      code: getErrorCode(error, defaultCode),
      cause: error
    });
  }
  
  return new BaseError({
    message: isErrorWithMessage(error) ? error.message : defaultMessage,
    code: getErrorCode(error, defaultCode),
    context: { originalError: error }
  });
}