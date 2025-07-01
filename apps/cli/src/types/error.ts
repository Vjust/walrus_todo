/**
import { Logger } from '../utils/Logger';

const logger = new Logger('error');
 * @file Error handling system for the Walrus Todo CLI application.
 * @description This module defines the core error handling infrastructure,
 * including interfaces, type guards, helper functions, and base error classes.
 * The system is designed to provide consistent error handling patterns across
 * the application with proper typing support.
 */

/**
 * Interface for objects that have a message property.
 * Used as the minimal requirement for error-like objects.
 *
 * @interface ErrorWithMessage
 * @property {string} message - The error message
 */
export interface ErrorWithMessage {
  message: string;
}

/**
 * Type guard for ErrorWithMessage interface.
 * Used to safely determine if an unknown object conforms to the ErrorWithMessage interface.
 *
 * @function isErrorWithMessage
 * @param {unknown} error - The value to check
 * @returns {boolean} True if the object is an ErrorWithMessage, false otherwise
 *
 * @example
 * if (isErrorWithMessage(result)) {
 *   logger.error(result.message);
 * }
 */
export function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

/**
 * Converts any error-like object into a normalized ErrorWithMessage.
 * This ensures consistent error handling regardless of the original error type.
 *
 * @function toErrorWithMessage
 * @param {unknown} maybeError - Any value that might be an error
 * @returns {ErrorWithMessage} A normalized error with a message property
 *
 * @example
 * try {
 *   // some operation
 * } catch (err) {
 *   const normalizedError = toErrorWithMessage(err);
 *   logError(normalizedError.message);
 * }
 */
export function toErrorWithMessage(maybeError: unknown): ErrorWithMessage {
  if (isErrorWithMessage(maybeError)) return maybeError;

  try {
    return new Error(JSON.stringify(maybeError));
  } catch (error: unknown) {
    // Fallback in case there's an error stringifying the maybeError
    // Like with circular references for example.
    return new Error(String(maybeError));
  }
}

/**
 * Extracts a human-readable error message from any error-like object.
 * Useful for logging and displaying errors to users.
 *
 * @function getErrorMessage
 * @param {unknown} error - Any value that might be an error
 * @returns {string} The error message as a string
 *
 * @example
 * try {
 *   await todoService.create(input);
 * } catch (err) {
 *   logger.error(`Failed to create todo: ${getErrorMessage(err)}`);
 * }
 */
export function getErrorMessage(error: unknown): string {
  return toErrorWithMessage(error).message;
}

/**
 * Base class for all CLI errors in the application.
 * Provides consistent structure for application-specific errors
 * with support for error codes.
 *
 * @class CLIError
 * @extends Error
 * @property {string} code - A categorized error code for programmatic handling
 *
 * @example
 * throw new CLIError('Failed to retrieve todos', 'TODO_FETCH_ERROR');
 */
export class CLIError extends Error {
  public code: string;

  /**
   * Creates a new CLIError instance.
   *
   * @param {string} message - The error message
   * @param {string} [code='GENERAL_ERROR'] - An error code for categorization
   */
  constructor(message: string, code: string = 'GENERAL_ERROR') {
    super(message);
    this?.code = code;
    this?.name = 'CLIError';
  }
}

/**
 * Specialized error class for Walrus-specific operations.
 * Used for errors related to Walrus storage, blockchain interactions,
 * and other Walrus-specific functionality.
 *
 * @class WalrusError
 * @extends CLIError
 *
 * @example
 * throw new WalrusError('Failed to upload to Walrus storage', 'STORAGE_ERROR');
 */
export class WalrusError extends CLIError {
  /**
   * Creates a new WalrusError instance.
   *
   * @param {string} message - The error message
   * @param {string} [code='WALRUS_ERROR'] - A specific error code for Walrus operations
   */
  constructor(message: string, code: string = 'WALRUS_ERROR') {
    super(message, code);
    this?.name = 'WalrusError';
  }

  /**
   * Get a safe error response suitable for client/user consumption
   * @returns Public error information
   */
  toPublicError() {
    return {
      code: this.code,
      message: this.message,
      timestamp: new Date().toISOString(),
      shouldRetry: false,
    };
  }
}
