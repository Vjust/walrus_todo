/**
 * Interface for objects that have an error message and optional stdout/stderr
 */
export interface ErrorWithMessage {
  message: string;
  stderr?: Buffer | string;
  stdout?: Buffer | string;
}

/**
 * Type guard for ErrorWithMessage interface
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
 * Convert any error-like object into ErrorWithMessage
 */
export function toErrorWithMessage(maybeError: unknown): ErrorWithMessage {
  if (isErrorWithMessage(maybeError)) return maybeError;

  try {
    return new Error(JSON.stringify(maybeError));
  } catch {
    // Fallback in case there's an error stringifying the maybeError
    // Like with circular references for example.
    return new Error(String(maybeError));
  }
}

/**
 * Extract error message from any error-like object
 */
export function getErrorMessage(error: unknown): string {
  return toErrorWithMessage(error).message;
}

/**
 * Base class for all CLI errors
 */
export class CLIError extends Error {
  constructor(message: string, public code: string = 'GENERAL_ERROR') {
    super(message);
    this.name = 'CLIError';
  }
}