/**
 * Custom error classes for Waltodo
 * Provides specific error types for different failure scenarios
 */

/**
 * Base error class for Waltodo
 */
export class WaltodoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WaltodoError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when Walrus operations fail
 */
export class WalrusError extends WaltodoError {
  public statusCode: number | undefined;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'WalrusError';
    this.statusCode = statusCode;
  }
}

/**
 * Error thrown when configuration operations fail
 */
export class ConfigError extends WaltodoError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends WaltodoError {
  public field: string | undefined;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Error thrown when storage operations fail
 */
export class StorageError extends WaltodoError {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Error thrown when encryption/decryption fails
 */
export class EncryptionError extends WaltodoError {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

/**
 * Error thrown when network operations fail
 */
export class NetworkError extends WaltodoError {
  public code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'NetworkError';
    this.code = code;
  }
}

/**
 * Error thrown when a resource is not found
 */
export class NotFoundError extends WaltodoError {
  public resource: string | undefined;
  public id: string | undefined;

  constructor(message: string, resource?: string, id?: string) {
    super(message);
    this.name = 'NotFoundError';
    this.resource = resource;
    this.id = id;
  }
}

/**
 * Error thrown when an operation conflicts with existing data
 */
export class ConflictError extends WaltodoError {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

/**
 * Error thrown when authentication/authorization fails
 */
export class AuthError extends WaltodoError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Check if an error is a specific Waltodo error type
 */
export function isWaltodoError(error: unknown): error is WaltodoError {
  return error instanceof WaltodoError;
}

/**
 * Check if an error is a Walrus error
 */
export function isWalrusError(error: unknown): error is WalrusError {
  return error instanceof WalrusError;
}

/**
 * Check if an error is a validation error
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Check if an error is a not found error
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

/**
 * Format error for user display
 */
export function formatError(error: unknown): string {
  if (error instanceof ValidationError) {
    return `Validation error${error.field ? ` in ${error.field}` : ''}: ${error.message}`;
  }

  if (error instanceof WalrusError) {
    return `Walrus error${error.statusCode ? ` (${error.statusCode})` : ''}: ${error.message}`;
  }

  if (error instanceof NotFoundError) {
    return `Not found: ${error.resource || 'Resource'}${error.id ? ` with ID ${error.id}` : ''}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown error occurred';
}

/**
 * Create a standardized error response
 */
export interface ErrorResponse {
  error: string;
  message: string;
  details?: any;
}

/**
 * Convert an error to a standardized response format
 */
export function toErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof WaltodoError) {
    return {
      error: error.name,
      message: error.message,
      details: {
        ...(error instanceof WalrusError && { statusCode: error.statusCode }),
        ...(error instanceof ValidationError && { field: error.field }),
        ...(error instanceof NotFoundError && { 
          resource: error.resource,
          id: error.id,
        }),
        ...(error instanceof NetworkError && { code: error.code }),
      },
    };
  }

  if (error instanceof Error) {
    return {
      error: 'Error',
      message: error.message,
    };
  }

  return {
    error: 'UnknownError',
    message: 'An unknown error occurred',
  };
}