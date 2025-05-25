/**
 * ResourceManagerError - Error thrown by resource management operations
 * Used for tracking and handling resource lifecycle issues
 */

import { BaseError } from './BaseError';

/**
 * Options for ResourceManagerError construction
 */
export interface ResourceManagerErrorOptions {
  /** Resource ID that had an issue */
  resourceId?: string;

  /** Resource type that had an issue */
  resourceType?: string;

  /** Resource description */
  resourceDescription?: string;

  /** Operation that was being performed when error occurred */
  operation?: string;

  /** Additional context information */
  context?: Record<string, unknown>;

  /** Original error that caused this error */
  cause?: Error;

  /** Whether the operation can be recovered from this error */
  recoverable?: boolean;
}

/**
 * Error thrown for resource management failures
 */
export class ResourceManagerError extends BaseError {
  /**
   * Create a new ResourceManagerError
   * @param message Error message
   * @param options Options for the error or cause error
   */
  constructor(
    message: string,
    optionsOrCause?: ResourceManagerErrorOptions | Error
  ) {
    // Handle both constructor signatures for backward compatibility
    let options: ResourceManagerErrorOptions = {};

    if (optionsOrCause instanceof Error) {
      // Support previous signature: (message, cause)
      options = {
        cause: optionsOrCause,
      };
    } else if (optionsOrCause && typeof optionsOrCause === 'object') {
      // Support object-based options
      options = optionsOrCause;
    }

    const {
      resourceId,
      resourceType,
      resourceDescription,
      operation,
      context,
      cause,
      recoverable = false,
    } = options;

    // Build context object
    const errorContext: Record<string, unknown> = {
      ...(context || {}),
      ...(resourceId !== undefined ? { resourceId } : {}),
      ...(resourceType !== undefined ? { resourceType } : {}),
      ...(resourceDescription !== undefined ? { resourceDescription } : {}),
      ...(operation !== undefined ? { operation } : {}),
    };

    // Call BaseError constructor
    super({
      message: `ResourceManager Error: ${message}`,
      code: 'RESOURCE_MANAGER_ERROR',
      context: errorContext,
      cause,
      recoverable,
      shouldRetry: false,
    });

    // Set error name
    this.name = 'ResourceManagerError';
  }
}
