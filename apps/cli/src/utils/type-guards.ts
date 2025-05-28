/**
 * Type guard utilities for safe error handling and unknown type checking
 */

/**
 * Type guard to check if a value is an Error object
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Type guard to check if a value has a message property (Error-like)
 */
export function hasMessage(value: unknown): value is { message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as any).message === 'string'
  );
}

/**
 * Type guard to check if a value has a code property
 */
export function hasCode(value: unknown): value is { code: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value as any).code === 'string'
  );
}

/**
 * Type guard to check if a value has both message and code properties
 */
export function hasMessageAndCode(
  value: unknown
): value is { message: string; code: string } {
  return hasMessage(value) && hasCode(value);
}

/**
 * Safely extracts an error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }

  if (hasMessage(error)) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error occurred';
}

/**
 * Safely extracts an error code from unknown error type
 */
export function getErrorCode(error: unknown): string | undefined {
  if (hasCode(error)) {
    return error.code;
  }

  return undefined;
}

/**
 * Type guard for Response objects
 */
export function isResponse(value: unknown): value is Response {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'statusText' in value &&
    typeof (value as any).status === 'number'
  );
}

/**
 * Type guard for objects with properties
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for arrays
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard for strings
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard for numbers
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard for booleans
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Safely converts unknown to Error
 */
export function toError(value: unknown): Error {
  if (isError(value)) {
    return value;
  }

  const message = getErrorMessage(value);
  const error = new Error(message);

  // Preserve original error code if available
  const code = getErrorCode(value);
  if (code) {
    (error as any).code = code;
  }

  return error;
}

/**
 * Type assertion for Error objects (throws if not an error)
 */
export function assertError(value: unknown): asserts value is Error {
  if (!isError(value)) {
    throw new Error(`Expected Error, got ${typeof value}`);
  }
}

/**
 * Type assertion for objects (throws if not an object)
 */
export function assertObject(
  value: unknown
): asserts value is Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error(`Expected object, got ${typeof value}`);
  }
}
