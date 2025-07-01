/**
 * @file Base error class for the error handling framework
 * Provides a consistent foundation for all application errors with enhanced
 * capabilities for error classification, chaining, serialization, and handling.
 */

/**
 * Options for BaseError construction
 */
export interface BaseErrorOptions {
  /** Error message */
  message: string;

  /** Error code for programmatic handling */
  code?: string;

  /** Additional context for debugging */
  context?: Record<string, unknown>;

  /** Original error that caused this error */
  cause?: Error;

  /** Whether the operation can be recovered from this error */
  recoverable?: boolean;

  /** Whether the operation should be retried */
  shouldRetry?: boolean;

  /** Suggested delay before retrying (ms) */
  retryDelay?: number;

  /** User-friendly message that can be safely displayed to end users */
  publicMessage?: string;
}

/**
 * Base error class for all application errors
 * Provides consistent structure and behavior for error handling
 */
export class BaseError extends Error {
  /** Unique error code for programmatic handling */
  public readonly code: string;

  /** Timestamp when the error occurred */
  public readonly timestamp: string;

  /** Additional context for debugging (safely sanitized) */
  public readonly context?: Record<string, unknown>;

  /** Original error that caused this error */
  public readonly cause?: Error;

  /** Whether the operation can be recovered from this error */
  public readonly recoverable: boolean;

  /** Whether the operation should be retried */
  public readonly shouldRetry: boolean;

  /** Suggested delay before retrying (ms) */
  public readonly retryDelay?: number;

  /** User-friendly message that can be safely displayed to end users */
  public readonly publicMessage: string;

  /**
   * Create a new BaseError
   * @param options Error options
   */
  constructor(options: BaseErrorOptions) {
    // Initialize with the error message
    super(options.message);

    const {
      code = 'UNKNOWN_ERROR',
      context,
      cause,
      recoverable = false,
      shouldRetry = false,
      retryDelay,
      publicMessage,
    } = options;

    // Set error properties
    this?.name = this?.constructor?.name;
    this?.code = code;
    this?.timestamp = new Date().toISOString();
    this?.context = this.sanitizeContext(context);
    this?.recoverable = recoverable;
    this?.shouldRetry = shouldRetry;
    this?.retryDelay = retryDelay;

    // Use provided public message or default to the internal message
    this?.publicMessage = publicMessage || options.message;

    // Set cause with proper error chaining
    if (cause) {
      Object.defineProperty(this, 'cause', {
        value: cause,
        enumerable: false,
        writable: false,
        configurable: false,
      });
    }

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Create a new error instance with a cause
   * @param message The error message
   * @param cause The error that caused this error
   * @param options Additional error options
   * @returns A new error instance with the cause
   */
  static fromCause(
    message: string,
    cause: Error,
    options: Omit<BaseErrorOptions, 'message' | 'cause'> = {}
  ): BaseError {
    return new BaseError({
      message,
      cause,
      ...options,
    });
  }

  /**
   * Create a new error with additional context
   * @param context Additional context to add to the error
   * @returns A new error instance with the additional context
   */
  withContext(context: Record<string, unknown>): BaseError {
    return new BaseError({
      message: this.message,
      code: this.code,
      context: {
        ...(this.context || ({} as Record<string, unknown>)),
        ...context,
      },
      cause: this.cause,
      recoverable: this.recoverable,
      shouldRetry: this.shouldRetry,
      retryDelay: this.retryDelay,
      publicMessage: this.publicMessage,
    });
  }

  /**
   * Get a safe error response suitable for client/user consumption
   * This prevents leaking sensitive information
   */
  public toPublicError(): PublicErrorResponse {
    return {
      code: this.code,
      message: this.publicMessage,
      timestamp: this.timestamp,
      recoverable: this.recoverable,
      shouldRetry: this.shouldRetry,
      retryDelay: this.retryDelay,
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
      recoverable: this.recoverable,
      shouldRetry: this.shouldRetry,
      retryDelay: this.retryDelay,
      context: this.context,
      stack: this.stack,
      cause: this.cause
        ? this.cause instanceof Error
          ? this?.cause?.message
          : String(this.cause)
        : undefined,
    };
  }

  /**
   * Sanitize context to remove sensitive information
   * @param context Context object to sanitize
   * @returns Sanitized context or undefined
   */
  protected sanitizeContext(
    context?: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    if (!context) return undefined;

    const sanitized: Record<string, unknown> = {};
    const sensitivePatterns = [
      /\b(password)\b/i,
      /\b(secret)\b/i,
      /\b(privateKey|apiKey|secretKey|encryptionKey)\b/i,
      /\b(token|accessToken|refreshToken)\b/i,
      /\b(authToken|authorization)\b/i,
      /\b(credential)\b/i,
      /\b(signature)\b/i,
      /\b(seed|seedPhrase)\b/i,
      /\b(mnemonic)\b/i,
      /\b(phrase|recoveryPhrase)\b/i,
    ];

    // Additional blockchain-specific patterns
    const blockchainPatterns = [
      { pattern: /address/i, redactPartial: true },
      { pattern: /hash/i, redactPartial: true },
      { pattern: /transaction(?:Id|Hash)/i, redactPartial: true },
    ];

    // Sanitize each property
    for (const [key, value] of Object.entries(context)) {
      // Check for sensitive keys
      if (sensitivePatterns.some(pattern => pattern.test(key))) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Check for blockchain identifiers that need partial redaction
      const blockchainMatch = blockchainPatterns.find(item =>
        item?.pattern?.test(key)
      );
      if (blockchainMatch && typeof value === 'string') {
        sanitized[key] = this.redactIdentifier(value);
        continue;
      }

      // Sanitize recursive objects
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        sanitized[key] = this.sanitizeContext(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Redacts part of an identifier (like an address or transaction hash)
   * keeping only the first and last few characters
   * @param identifier The string to redact
   * @returns Partially redacted string
   */
  protected redactIdentifier(identifier: string): string {
    if (!identifier || identifier.length <= 8) return identifier;

    const firstChars = identifier.slice(0, 6);
    const lastChars = identifier.slice(-4);
    return `${firstChars}...${lastChars}`;
  }
}

/**
 * Public error response safe for client consumption
 */
export interface PublicErrorResponse {
  code: string;
  message: string;
  timestamp: string;
  recoverable: boolean;
  shouldRetry: boolean;
  retryDelay?: number;
}

/**
 * Full error details for internal logging
 */
export interface ErrorLogEntry extends Omit<PublicErrorResponse, 'message'> {
  name: string;
  message: string;
  publicMessage: string;
  context?: Record<string, unknown>;
  stack?: string;
  cause?: string;
}
