/**
 * ValidationError - Error thrown by validation operations
 * Provides consistent error handling for validation failures
 */

import { BaseError } from './BaseError';

/**
 * Options for ValidationError construction
 */
export interface ValidationErrorOptions {
  /** Field that failed validation */
  field?: string;

  /** Value that failed validation (will be sanitized in logs) */
  value?: unknown;

  /** Validation constraint that was violated */
  constraint?: string;

  /** Whether the operation can be recovered from this error */
  recoverable?: boolean;

  /** Operation that was being performed when validation failed */
  operation?: string;

  /** Additional context information */
  context?: Record<string, unknown>;

  /** Original error that caused this error */
  cause?: Error;

  /** Attempt number for retryable operations */
  attempt?: number;
}

/**
 * Error thrown for validation failures
 * Consolidates both previous ValidationError implementations into a single consistent class
 */
export class ValidationError extends BaseError {
  /**
   * The field that failed validation
   * @private Stored privately to prevent sensitive data exposure
   */
  private readonly _field?: string;

  /**
   * Create a new ValidationError
   * @param message Error message
   * @param options Options for the error
   */
  constructor(
    message: string,
    optionsOrField?: ValidationErrorOptions | string,
    additionalContext?: Record<string, unknown>
  ) {
    // Handle both constructor signatures (for backward compatibility)
    let options: ValidationErrorOptions = {};

    if (typeof optionsOrField === 'string') {
      // Support previous signature: (message, field, context)
      options = {
        field: optionsOrField,
        context: additionalContext,
      };
    } else if (optionsOrField && typeof optionsOrField === 'object') {
      // Support object-based options
      options = optionsOrField;
    }

    const {
      field,
      value,
      constraint,
      recoverable = false,
      operation,
      context,
      cause,
      attempt,
    } = options;

    // Build context object
    const errorContext: Record<string, unknown> = {
      ...(context || {}),
      ...(value !== undefined ? { value } : {}),
      ...(constraint !== undefined ? { constraint } : {}),
      ...(operation !== undefined ? { operation } : {}),
      ...(attempt !== undefined ? { attempt } : {}),
    };

    // Ensure message includes field if provided
    const errorMessage = field
      ? `Validation error for ${field}: ${message}`
      : `Validation error: ${message}`;

    // Call BaseError constructor
    super({
      message: errorMessage,
      code: 'VALIDATION_ERROR',
      context: errorContext,
      cause,
      recoverable,
      shouldRetry: recoverable,
    });

    // Store field privately
    this?._field = field;

    // Set error name
    this?.name = 'ValidationError';
  }

  /**
   * Get the field that failed validation
   * @returns Field name if available, undefined otherwise
   */
  get field(): string | undefined {
    return this._field;
  }

  /**
   * Create a ValidationError with a field prefix
   * @param message Error message
   * @param field Field name
   * @param options Additional options
   * @returns New ValidationError instance
   */
  static forField(
    message: string,
    field: string,
    options: Omit<ValidationErrorOptions, 'field'> = {}
  ): ValidationError {
    return new ValidationError(message, {
      ...options,
      field,
    });
  }
}
