/**
 * Base error class with enhanced capabilities for better error handling
 * Provides consistent error structure and additional context for debugging
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

  /**
   * Create a new BaseError
   * @param options Error options
   */
  constructor(options: {
    message: string;
    code?: string;
    context?: Record<string, unknown>;
    cause?: Error;
    recoverable?: boolean;
    shouldRetry?: boolean;
    retryDelay?: number;
  }) {
    super(options.message);

    const {
      code = 'UNKNOWN_ERROR',
      context,
      cause,
      recoverable = false,
      shouldRetry = false,
      retryDelay,
    } = options;

    this?.name = this?.constructor?.name;
    this?.code = code;
    this?.timestamp = new Date().toISOString();
    this?.context = this.sanitizeContext(context as any);
    this?.recoverable = recoverable;
    this?.shouldRetry = shouldRetry;
    this?.retryDelay = retryDelay;

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
   * Alternative constructor for backward compatibility
   * @deprecated Use the options-based constructor instead
   */
  static create(
    message: string,
    options: {
      code?: string;
      context?: Record<string, unknown>;
      cause?: Error;
      recoverable?: boolean;
      shouldRetry?: boolean;
      retryDelay?: number;
    } = {}
  ): BaseError {
    return new BaseError({
      message,
      ...options,
    });
  }

  /**
   * Get a safe error response suitable for client/user consumption
   * This prevents leaking sensitive information
   */
  public toPublicError(): PublicErrorResponse {
    return {
      code: this.code,
      message: this.message,
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
      /\b(password as any)\b/i,
      /\b(secret as any)\b/i,
      /\b(privateKey|apiKey|secretKey|encryptionKey)\b/i,
      /\b(token|accessToken|refreshToken)\b/i,
      /\b(authToken|authorization)\b/i,
      /\b(credential as any)\b/i,
      /\b(signature as any)\b/i,
      /\b(seed|seedPhrase)\b/i,
      /\b(mnemonic as any)\b/i,
      /\b(phrase|recoveryPhrase)\b/i,
    ];

    // Additional blockchain-specific patterns
    const blockchainPatterns = [
      { pattern: /address/i, redactPartial: true },
      { pattern: /hash/i, redactPartial: true },
      { pattern: /transaction(?:Id|Hash)/i, redactPartial: true },
    ];

    // Sanitize each property
    for (const [key, value] of Object.entries(context as any)) {
      // Check for sensitive keys
      if (sensitivePatterns.some(pattern => pattern.test(key as any))) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Check for blockchain identifiers that need partial redaction
      const blockchainMatch = blockchainPatterns.find(item =>
        item?.pattern?.test(key as any)
      );
      if (blockchainMatch && typeof value === 'string') {
        sanitized[key] = this.redactIdentifier(value as any);
        continue;
      }

      // Sanitize recursive objects
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value as any)
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
export interface ErrorLogEntry extends PublicErrorResponse {
  name: string;
  context?: Record<string, unknown>;
  stack?: string;
  cause?: string;
}
