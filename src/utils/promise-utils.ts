/**
 * Utility functions for better promise handling
 */
import './polyfills/aggregate-error';
import { CLIError } from '../types/error';

/**
 * Executes a promise with a timeout
 * @param promise The promise to execute
 * @param timeoutMs Timeout in milliseconds
 * @param operationName Name of the operation for error messages
 * @returns Result of the promise
 * @throws TimeoutError if the operation times out
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  // Create a timeout promise that rejects after the specified time
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new TimeoutError(
          `Operation '${operationName}' timed out after ${timeoutMs}ms`,
          { operationName, timeoutMs }
        )
      );
    }, timeoutMs);
  });

  try {
    // Race the original promise against the timeout
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    return result;
  } catch (error) {
    // Always clear the timeout to prevent memory leaks
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (error instanceof TimeoutError) {
      throw error;
    }

    throw new OperationError(
      `Operation '${operationName}' failed: ${error instanceof Error ? error.message : String(error)}`,
      { operationName, cause: error }
    );
  }
}

/**
 * Safely executes multiple promises in parallel with proper error handling
 * @param promises Array of promises to execute
 * @param operationName Name of the overall operation
 * @returns Array of results from successful promises
 * @throws AggregateError if any promise fails
 */
export async function safeParallel<T>(
  promises: Array<Promise<T>>,
  operationName: string
): Promise<Array<T>> {
  if (promises.length === 0) {
    return [];
  }

  const results = await Promise.allSettled(promises);
  const successResults: T[] = [];
  const errors: Error[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successResults.push(result.value);
    } else {
      const error =
        result.reason instanceof Error
          ? result.reason
          : new Error(String(result.reason));

      errors.push(
        new OperationError(`Operation ${index} failed: ${error.message}`, {
          operationName: `${operationName}[${index}]`,
          cause: error,
        })
      );
    }
  });

  if (errors.length > 0) {
    // Create an AggregateError to contain all the individual errors
    throw new AggregateOperationError(
      `${errors.length} of ${promises.length} operations failed during ${operationName}`,
      errors,
      { operationName }
    );
  }

  return successResults;
}

/**
 * Retries a function multiple times with exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum number of retries
 * @param initialDelay Initial delay in milliseconds
 * @param operationName Name of the operation
 * @param shouldRetry Function to determine if an error is retryable
 * @returns Result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000,
  operationName = 'operation',
  shouldRetry = (error: Error): boolean => true
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const typedError =
        error instanceof Error ? error : new Error(String(error));

      lastError = new OperationError(
        `Attempt ${attempt} failed: ${typedError.message}`,
        { operationName, cause: typedError }
      );

      if (attempt > maxRetries || !shouldRetry(typedError)) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = initialDelay * Math.pow(2, attempt - 1);

      // Add jitter to prevent thundering herd
      const jitteredDelay = delay * (0.8 + Math.random() * 0.4);

      // Wait before next retry
      await new Promise(resolve => setTimeout(resolve, jitteredDelay));
    }
  }

  throw new RetryError(
    `All ${maxRetries} retries failed for operation '${operationName}'`,
    { operationName, maxRetries, lastError }
  );
}

/**
 * Custom error for timeout failures
 */
export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly context: {
      operationName: string;
      timeoutMs: number;
    }
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Custom error for operation failures
 */
export class OperationError extends Error {
  constructor(
    message: string,
    public readonly context: {
      operationName: string;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = 'OperationError';
    this.cause = context.cause;
  }
}

/**
 * Custom error for retry failures
 */
export class RetryError extends Error {
  constructor(
    message: string,
    public readonly context: {
      operationName: string;
      maxRetries: number;
      lastError: Error | null;
    }
  ) {
    super(message);
    this.name = 'RetryError';
    this.cause = context.lastError;
  }
}

/**
 * Custom error for aggregating multiple failures
 */
export class AggregateOperationError extends AggregateError {
  constructor(
    message: string,
    errors: Error[],
    public readonly context: { operationName: string }
  ) {
    super(errors, message);
    this.name = 'AggregateOperationError';
  }
}
