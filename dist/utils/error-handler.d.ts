/**
 * Custom CLI error class for application-specific errors
 */
export declare class CLIError extends Error {
    code: string;
    constructor(message: string, code?: string);
}
/**
 * Centralized error handler for the application
 */
export declare function handleError(messageOrError: string | unknown, error?: unknown): void;
/**
 * Wraps an async function with retry logic for transient errors
 */
export declare function withRetry<T>(fn: () => Promise<T>, maxRetries?: number, baseDelay?: number): Promise<T>;
export declare function assert(condition: boolean, message: string): asserts condition;
