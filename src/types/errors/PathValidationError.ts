/**
 * PathValidationError - Error thrown by path validation operations
 * Specialized validation error for file path security checks
 */

import { BaseError } from './BaseError';

/**
 * Options for PathValidationError construction
 */
export interface PathValidationErrorOptions {
  /** Path that failed validation */
  path?: string;

  /** Operation that was being performed when validation failed */
  operation?: string;

  /** Additional context information */
  context?: Record<string, unknown>;

  /** Original error that caused this error */
  cause?: Error;

  /** Whether the operation can be recovered from this error */
  recoverable?: boolean;
}

/**
 * Error thrown for path validation failures
 */
export class PathValidationError extends BaseError {
  /**
   * Create a new PathValidationError
   * @param message Error message
   * @param options Options for the error
   */
  constructor(message: string, options: PathValidationErrorOptions = {}) {
    const { path, operation, context, cause, recoverable = false } = options;

    // Build context object
    const errorContext: Record<string, unknown> = {
      ...(context || {}),
      ...(path !== undefined ? { path } : {}),
      ...(operation !== undefined ? { operation } : {}),
    };

    // Call BaseError constructor
    super({
      message: `Path validation error: ${message}`,
      code: 'PATH_VALIDATION_ERROR',
      context: errorContext,
      cause,
      recoverable,
      shouldRetry: false,
    });

    // Set error name
    this.name = 'PathValidationError';
  }
}
