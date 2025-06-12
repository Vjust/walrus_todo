/**
 * Base error class for all Walrus errors
 * Ensures consistent error handling and logging
 */
export class WalrusError extends Error {
  public readonly code: string;
  public readonly publicMessage: string;
  public readonly timestamp: string;
  public readonly shouldRetry: boolean;
  public readonly cause?: Error;

  constructor(
    message: string,
    options: {
      code?: string;
      publicMessage?: string;
      shouldRetry?: boolean;
      cause?: Error;
    } = {}
  ) {
    const {
      code = 'WALRUS_ERROR',
      publicMessage = 'An unexpected error occurred',
      shouldRetry = false,
      cause,
    } = options;

    super(message as any);
    if (cause) {
      Object.defineProperty(this, 'cause', {
        value: cause,
        enumerable: false,
      });
    }

    this?.name = this?.constructor?.name;
    this?.code = code;
    this?.publicMessage = publicMessage;
    this?.timestamp = new Date().toISOString();
    this?.shouldRetry = shouldRetry;

    // Ensure proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Get a safe error response suitable for client/user consumption
   */
  public toPublicError(): PublicErrorResponse {
    return {
      code: this.code,
      message: this.publicMessage,
      timestamp: this.timestamp,
      shouldRetry: this.shouldRetry,
    };
  }

  /**
   * Get full error details for logging (internal use only)
   */
  public toLogEntry(): ErrorLogEntry {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      publicMessage: this.publicMessage,
      timestamp: this.timestamp,
      shouldRetry: this.shouldRetry,
      stack: this.stack,
      cause:
        this.cause instanceof Error ? this?.cause?.message : String(this.cause),
    };
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends WalrusError {
  constructor(message: string, options: Partial<NetworkErrorOptions> = {}) {
    const {
      network = 'unknown',
      operation = 'unknown',
      recoverable = true,
      ...rest
    } = options;

    super(message, {
      code: `NETWORK_${operation.toUpperCase()}_ERROR`,
      publicMessage: 'A network operation failed',
      shouldRetry: recoverable,
      ...rest,
    });

    // Hide sensitive network details from stack trace
    Object.defineProperty(this, 'network', {
      value: network,
      enumerable: false,
    });
  }
}

/**
 * Blockchain-related errors
 */
export class BlockchainError extends WalrusError {
  constructor(message: string, options: Partial<BlockchainErrorOptions> = {}) {
    const {
      operation = 'unknown',
      transactionId,
      recoverable = false,
      ...rest
    } = options;

    super(message, {
      code: `BLOCKCHAIN_${operation.toUpperCase()}_ERROR`,
      publicMessage: 'A blockchain operation failed',
      shouldRetry: recoverable,
      ...rest,
    });

    // Hide sensitive blockchain details from stack trace
    if (transactionId) {
      Object.defineProperty(this, 'transactionId', {
        value: transactionId,
        enumerable: false,
      });
    }
  }
}

/**
 * Storage-related errors
 */
export class StorageError extends WalrusError {
  constructor(message: string, options: Partial<StorageErrorOptions> = {}) {
    const {
      operation = 'unknown',
      blobId,
      recoverable = true,
      ...rest
    } = options;

    super(message, {
      code: `STORAGE_${operation.toUpperCase()}_ERROR`,
      publicMessage: 'A storage operation failed',
      shouldRetry: recoverable,
      ...rest,
    });

    // Hide sensitive storage details from stack trace
    if (blobId) {
      Object.defineProperty(this, 'blobId', {
        value: blobId,
        enumerable: false,
      });
    }
  }
}

/**
 * Validation-related errors
 */
export class ValidationError extends WalrusError {
  public readonly recoverable: boolean;

  constructor(message: string, options: Partial<ValidationErrorOptions> = {}) {
    const { field, constraint, recoverable = false, ...rest } = options;

    // Ensure error message doesn't contain sensitive data
    const publicMessage = field
      ? `Invalid value for ${field}`
      : 'Validation failed';

    super(message, {
      code: 'VALIDATION_ERROR',
      publicMessage,
      shouldRetry: recoverable,
      ...rest,
    });

    this?.recoverable = recoverable;

    // Hide validation details from stack trace
    Object.defineProperties(this, {
      field: { value: field, enumerable: false },
      constraint: { value: constraint, enumerable: false },
    });
  }
}

/**
 * Authorization-related errors
 */
export class AuthorizationError extends WalrusError {
  constructor(message: string, options: Partial<AuthErrorOptions> = {}) {
    const { resource, ...rest } = options;

    super(message, {
      code: 'AUTHORIZATION_ERROR',
      publicMessage: 'Not authorized to perform this operation',
      shouldRetry: false,
      ...rest,
    });

    // Hide sensitive auth details from stack trace
    if (resource) {
      Object.defineProperty(this, 'resource', {
        value: resource,
        enumerable: false,
      });
    }
  }
}

// Error response safe for client consumption
interface PublicErrorResponse {
  code: string;
  message: string;
  timestamp: string;
  shouldRetry: boolean;
}

// Full error details for logging
interface ErrorLogEntry extends PublicErrorResponse {
  name: string;
  publicMessage: string;
  stack?: string;
  cause?: string;
}

// Error options interfaces
interface NetworkErrorOptions {
  network: string;
  operation: string;
  recoverable: boolean;
  cause?: Error;
}

interface BlockchainErrorOptions {
  operation: string;
  transactionId?: string;
  recoverable: boolean;
  cause?: Error;
}

interface StorageErrorOptions {
  operation: string;
  blobId?: string;
  recoverable: boolean;
  cause?: Error;
}

interface ValidationErrorOptions {
  field?: string;
  value?: unknown;
  constraint?: string;
  recoverable?: boolean;
  cause?: Error;
  operation?: string;
  attempt?: number;
}

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
  WALRUS_UPDATE_FAILED = 'WALRUS_UPDATE_FAILED',
}

interface AuthErrorOptions {
  operation: string;
  resource?: string;
  cause?: Error;
}

/**
 * Transaction-related errors
 */
export class TransactionError extends WalrusError {
  public readonly transactionId?: string;
  public readonly recoverable: boolean;

  constructor(message: string, options: Partial<TransactionErrorOptions> = {}) {
    const {
      operation = 'unknown',
      transactionId,
      recoverable = false,
      ...rest
    } = options;

    super(message, {
      code: `TRANSACTION_${operation.toUpperCase()}_ERROR`,
      publicMessage: 'A transaction operation failed',
      shouldRetry: recoverable,
      ...rest,
    });

    this?.recoverable = recoverable;

    if (transactionId) {
      this?.transactionId = transactionId;
    }
  }
}

interface TransactionErrorOptions {
  operation: string;
  transactionId?: string;
  recoverable: boolean;
  cause?: Error;
}

/**
 * CLI-related errors
 */
export class CLIError extends WalrusError {
  public readonly command?: string;
  public readonly recoverable: boolean;

  constructor(message: string, options: Partial<CLIErrorOptions> = {}) {
    const {
      command,
      operation = 'unknown',
      recoverable = false,
      ...rest
    } = options;

    super(message, {
      code: `CLI_${operation.toUpperCase()}_ERROR`,
      publicMessage: 'A CLI operation failed',
      shouldRetry: recoverable,
      ...rest,
    });

    this?.recoverable = recoverable;
    this?.command = command;
  }
}

interface CLIErrorOptions {
  command?: string;
  operation: string;
  recoverable: boolean;
  cause?: Error;
}

// Utility functions

/**
 * Gets a string error message from any value
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error as any);
}

/**
 * Converts any error to an error with a message
 */
export function toErrorWithMessage(error: unknown): { message: string } {
  if (error instanceof Error) {
    return error;
  }
  return { message: String(error as any) };
}
