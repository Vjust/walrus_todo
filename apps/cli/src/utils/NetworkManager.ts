import {
  AsyncOperationHandler,
  AsyncOperationOptions,
} from './walrus-error-handler';
import { NetworkError } from '../types/errors';

/**
 * Enhanced fetch options with timeout and retry configuration
 */
export interface EnhancedFetchOptions extends RequestInit {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts */
  retries?: number;
  /** Base delay between retries in milliseconds */
  retryDelay?: number;
  /** Operation name for logging and error messages */
  operationName?: string;
  /** Status codes that should trigger a retry */
  retryableStatusCodes?: number[];
  /** Whether to log retry attempts */
  logRetries?: boolean;
  /** Custom headers to add to the request */
  headers?: HeadersInit;
  /** Whether to automatically parse JSON response */
  parseJson?: boolean;
  /** Whether to throw errors (if false, returns response with ok: false) */
  throwErrors?: boolean;
}

/**
 * Enhanced fetch response with additional metadata
 */
export interface EnhancedFetchResponse<T = unknown> {
  /** Whether the request was successful */
  ok: boolean;
  /** The response data (parsed if parseJson was true) */
  data?: T;
  /** The original Response object if available */
  response?: Response;
  /** Error information if the request failed */
  error?: Error;
  /** Number of retry attempts made */
  attempts: number;
  /** Total operation time in milliseconds */
  timeTaken: number;
  /** Original status code if available */
  status?: number;
  /** Status text if available */
  statusText?: string;
  /** Response headers if available */
  headers?: Headers;
}

/**
 * Default fetch options
 */
const DEFAULT_FETCH_OPTIONS: EnhancedFetchOptions = {
  timeout: 30000, // 30 seconds
  retries: 3,
  retryDelay: 1000,
  operationName: 'fetch',
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  logRetries: true,
  parseJson: true,
  throwErrors: true,
};

/**
 * NetworkManager - A utility class for handling network operations with
 * robust timeout handling, cancellation support, and retry mechanisms.
 *
 * Features:
 * - Configurable timeouts with AbortController for proper cancellation
 * - Automatic retries with exponential backoff and jitter
 * - Customizable retry conditions based on status codes and error patterns
 * - Built-in JSON parsing with error handling
 * - Detailed operation metadata and logging
 * - Support for concurrent request cancellation
 */
export class NetworkManager {
  /**
   * Enhanced fetch implementation with robust error handling, timeouts, and retries
   */
  public static async fetch<T = unknown>(
    url: string,
    options: EnhancedFetchOptions = {}
  ): Promise<EnhancedFetchResponse<T>> {
    const opts = { ...DEFAULT_FETCH_OPTIONS, ...options };
    const {
      timeout,
      retries,
      retryDelay,
      operationName,
      retryableStatusCodes,
      logRetries,
      parseJson,
      throwErrors,
      ...fetchOptions
    } = opts;

    // Create a parent AbortController for the overall operation
    const controller = new AbortController();
    const { signal } = controller;

    // If there's an existing signal, propagate its aborted state
    if (options.signal) {
      if (options?.signal?.aborted) {
        controller.abort(options?.signal?.reason);
      }
      options?.signal?.addEventListener('abort', () => {
        controller.abort(options?.signal?.reason);
      });
    }

    // Add signal to fetch options
    const fetchOptsWithSignal = {
      ...fetchOptions,
      signal,
    };

    // Define the async operation to execute with retries
    const fetchOperation = async () => {
      // Set up timeout if specified
      let timeoutId: NodeJS.Timeout | undefined;

      if (timeout) {
        timeoutId = setTimeout(() => {
          controller.abort(
            new Error(`Operation ${operationName} timed out after ${timeout}ms`)
          );
        }, timeout);
      }

      try {
        const response = await fetch(url, fetchOptsWithSignal);

        // Clear timeout if it was set
        if (timeoutId) {
          clearTimeout(timeoutId as any);
        }

        // Check if we should retry based on status code
        if (retryableStatusCodes?.includes(response.status)) {
          throw new NetworkError(
            `HTTP ${response.status}: ${response.statusText}`,
            {
              operation: operationName || 'fetch',
              recoverable: true,
            }
          );
        }

        // Process successful response
        let data: T | undefined;

        if (parseJson && response.ok) {
          try {
            data = await response.clone().json();
          } catch (parseError) {
            if (throwErrors) {
              throw new Error(
                `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError as any)}`
              );
            }
          }
        }

        return {
          ok: response.ok,
          data,
          response,
          attempts: 0, // Will be updated by AsyncOperationHandler
          timeTaken: 0, // Will be updated by AsyncOperationHandler
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        } as EnhancedFetchResponse<T>;
      } catch (error) {
        // Clear timeout if it was set
        if (timeoutId) {
          clearTimeout(timeoutId as any);
        }

        // Check if operation was aborted due to timeout
        if (error instanceof Error && error?.name === 'AbortError') {
          throw new NetworkError(`Request aborted: ${error.message}`, {
            operation: operationName || 'fetch',
            recoverable: true,
            cause: error,
          });
        }

        // Rethrow other errors to be handled by AsyncOperationHandler
        throw error;
      }
    };

    // Configure AsyncOperationHandler options
    const asyncOptions: AsyncOperationOptions = {
      operation: operationName || 'fetch',
      maxRetries: retries || 3,
      baseDelay: retryDelay || 1000,
      logRetries: logRetries !== false,
      signal,
      throwErrors: false, // We'll handle this ourselves
    };

    try {
      // Execute with retry logic
      const result = await AsyncOperationHandler.execute(
        fetchOperation,
        asyncOptions
      );

      const enhancedResponse: EnhancedFetchResponse<T> = {
        ...(result.data as EnhancedFetchResponse<T>),
        attempts: result.attempts,
        timeTaken: result.timeTaken || 0,
        ok: result.success && (result.data as EnhancedFetchResponse<T>)?.ok,
      };

      // Handle errors based on throwErrors option
      if (!enhancedResponse.ok && throwErrors) {
        const errorMessage = enhancedResponse.response
          ? `HTTP ${enhancedResponse.status}: ${enhancedResponse.statusText}`
          : result.error?.message || 'Unknown network error';

        throw new NetworkError(errorMessage, {
          operation: operationName || 'fetch',
          recoverable: false,
          cause: result.error,
        });
      }

      return enhancedResponse;
    } catch (error) {
      // This will only be reached if AsyncOperationHandler has an internal error
      const errorResponse: EnhancedFetchResponse<T> = {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error as any)),
        attempts: 1,
        timeTaken: 0,
      };

      if (throwErrors) {
        throw errorResponse.error;
      }

      return errorResponse;
    } finally {
      // Ensure we abort the controller to clean up resources
      if (!signal.aborted) {
        controller.abort('Operation complete');
      }
    }
  }

  /**
   * Executes multiple fetch operations in parallel with cancellation support
   * @param operations Array of fetch operations to execute
   * @param options Options for concurrent execution
   * @returns Array of fetch responses in the same order as the operations
   */
  public static async fetchAll<T = unknown[]>(
    operations: Array<{
      url: string;
      options?: EnhancedFetchOptions;
    }>,
    options: {
      /**
       * Timeout for all operations combined
       */
      timeout?: number;
      /**
       * Abort all remaining operations if one fails
       */
      abortOnError?: boolean;
      /**
       * Operation name for logging and error messages
       */
      operationName?: string;
      /**
       * Whether to throw errors (if false, returns responses with ok: false)
       */
      throwErrors?: boolean;
    } = {}
  ): Promise<EnhancedFetchResponse<T>[]> {
    const {
      timeout,
      abortOnError = false,
      operationName = 'concurrent fetch',
      throwErrors = true,
    } = options;

    // Create a parent AbortController for all operations
    const controller = new AbortController();
    const { signal } = controller;

    // Set up timeout if specified
    let timeoutId: NodeJS.Timeout | undefined;
    if (timeout) {
      timeoutId = setTimeout(() => {
        controller.abort(
          new Error(`Operation ${operationName} timed out after ${timeout}ms`)
        );
      }, timeout);
    }

    try {
      const startTime = Date.now();

      // Execute all operations with shared AbortController
      const promises = operations.map(op => {
        const opOptions = {
          ...op.options,
          signal,
          throwErrors: false, // We'll handle errors at this level
        };
        return this.fetch(op.url, opOptions);
      });

      // Wait for all promises to complete or fail
      let results: EnhancedFetchResponse<T>[];

      if (abortOnError) {
        // Execute sequentially if we need to abort on first error
        results = [];
        for (const promise of promises) {
          const result = await promise;
          results.push(result as EnhancedFetchResponse<T>);

          if (!result.ok) {
            controller.abort(
              `Operation failed: ${result.error?.message || 'Unknown error'}`
            );
            break;
          }
        }
      } else {
        // Execute all in parallel
        results = (await Promise.all(promises as any)) as EnhancedFetchResponse<T>[];
      }

      // Add total time information
      const timeTaken = Date.now() - startTime;
      results.forEach(result => {
        result?.timeTaken = timeTaken;
      });

      // Check if any operation failed
      const hasErrors = results.some(result => !result.ok);
      if (hasErrors && throwErrors) {
        const firstError = results.find(result => !result.ok)?.error;
        throw firstError || new Error('One or more operations failed');
      }

      return results;
    } catch (error) {
      if (throwErrors) {
        throw error;
      }

      // Return error responses if not throwing
      return operations.map(() => ({
        ok: false,
        error: error instanceof Error ? error : new Error(String(error as any)),
        attempts: 0,
        timeTaken: 0,
      }));
    } finally {
      // Clear timeout if it was set
      if (timeoutId) {
        clearTimeout(timeoutId as any);
      }

      // Ensure we abort the controller to clean up resources
      if (!signal.aborted) {
        controller.abort('Operation complete');
      }
    }
  }

  /**
   * Creates a cancellable fetch operation that can be executed later
   */
  public static createCancellableFetch<T = unknown>(
    url: string,
    options: EnhancedFetchOptions = {}
  ): {
    execute: () => Promise<EnhancedFetchResponse<T>>;
    abort: (reason?: unknown) => void;
  } {
    const controller = new AbortController();

    return {
      execute: () =>
        this.fetch<T>(url, { ...options, signal: controller.signal }),
      abort: (reason?: unknown) => controller.abort(reason as any),
    };
  }
}
