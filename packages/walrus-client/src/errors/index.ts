/**
 * Walrus Client Error Classes
 */

export class WalrusClientError extends Error {
  public code?: string;
  public cause?: Error;
  public timestamp: number;

  constructor(message: string, code?: string, cause?: Error) {
    super(message);
    this.name = 'WalrusClientError';
    this.code = code;
    this.cause = cause;
    this.timestamp = Date.now();

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, WalrusClientError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      stack: this.stack,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack,
      } : undefined,
    };
  }
}

export class WalrusNetworkError extends WalrusClientError {
  public status?: number;
  public url?: string;

  constructor(message: string, status?: number, url?: string, cause?: Error) {
    super(message, 'WALRUS_NETWORK_ERROR', cause);
    this.name = 'WalrusNetworkError';
    this.status = status;
    this.url = url;
    Object.setPrototypeOf(this, WalrusNetworkError.prototype);
  }
}

export class WalrusValidationError extends WalrusClientError {
  public field?: string;
  public value?: unknown;

  constructor(message: string, field?: string, value?: unknown) {
    super(message, 'WALRUS_VALIDATION_ERROR');
    this.name = 'WalrusValidationError';
    this.field = field;
    this.value = value;
    Object.setPrototypeOf(this, WalrusValidationError.prototype);
  }
}

export class WalrusRetryError extends WalrusClientError {
  public attempts: number;
  public lastError?: Error;

  constructor(message: string, attempts: number, lastError?: Error) {
    super(message, 'WALRUS_RETRY_ERROR', lastError);
    this.name = 'WalrusRetryError';
    this.attempts = attempts;
    this.lastError = lastError;
    Object.setPrototypeOf(this, WalrusRetryError.prototype);
  }
}

export class WalrusStorageError extends WalrusClientError {
  public blobId?: string;
  public operation?: string;

  constructor(message: string, operation?: string, blobId?: string, cause?: Error) {
    super(message, 'WALRUS_STORAGE_ERROR', cause);
    this.name = 'WalrusStorageError';
    this.operation = operation;
    this.blobId = blobId;
    Object.setPrototypeOf(this, WalrusStorageError.prototype);
  }
}

export class WalrusTimeoutError extends WalrusClientError {
  public timeout: number;

  constructor(message: string, timeout: number) {
    super(message, 'WALRUS_TIMEOUT_ERROR');
    this.name = 'WalrusTimeoutError';
    this.timeout = timeout;
    Object.setPrototypeOf(this, WalrusTimeoutError.prototype);
  }
}