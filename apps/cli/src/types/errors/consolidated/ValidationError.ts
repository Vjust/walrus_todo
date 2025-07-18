/**
 * @file Validation error class for input validation failures
 * Provides consistent error handling for validation failures with
 * field-specific context and handling.
 */

import { BaseError, BaseErrorOptions } from './BaseError';

/**
 * Options for ValidationError construction
 */
export interface ValidationErrorOptions
  extends Omit<BaseErrorOptions, 'code' | 'message'> {
  /** Field that failed validation */
  field?: string;

  /** Value that failed validation (will be sanitized in logs) */
  value?: unknown;

  /** Validation constraint that was violated */
  constraint?: string;

  /** Operation that was being performed when validation failed */
  operation?: string;

  /** Attempt number for retryable operations */
  attempt?: number;
}

/**
 * Error thrown for validation failures
 * Consolidates validation error handling across the application
 */
export class ValidationError extends BaseError {
  /**
   * The field that failed validation
   */
  public readonly field?: string;

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
      options = { ...optionsOrField };
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
      ...(context || ({} as Record<string, unknown>)),
      ...(value !== undefined ? { value } : {}),
      ...(constraint !== undefined ? { constraint } : {}),
      ...(operation !== undefined ? { operation } : {}),
      ...(attempt !== undefined ? { attempt } : {}),
    };

    // Ensure message includes field if provided
    const errorMessage = field
      ? `Validation error for ${field}: ${message}`
      : `Validation error: ${message}`;

    // Create public message
    const publicMessage = field
      ? `Invalid value for ${field}`
      : 'Validation failed';

    // Call BaseError constructor
    super({
      message: errorMessage,
      code: 'VALIDATION_ERROR',
      context: errorContext,
      cause,
      recoverable,
      shouldRetry: recoverable,
      publicMessage,
    });

    // Store field
    this.field = field;
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
