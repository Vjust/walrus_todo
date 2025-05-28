"use strict";
/**
 * @file Network error class for network-related failures
 * Handles errors related to network connections, API calls, and remote services.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkError = void 0;
const BaseError_1 = require("./BaseError");
/**
 * Error thrown for network-related failures
 */
class NetworkError extends BaseError_1.BaseError {
    /**
     * Create a new NetworkError
     * @param message Error message
     * @param options Options for the error
     */
    constructor(message, options = {}) {
        const { network, operation = 'unknown', statusCode, requestId, recoverable = true, // Network errors are often transient by default
        ...restOptions } = options;
        // Build context with network details
        const context = {
            ...(options.context || {}),
            ...(network ? { network } : {}),
            ...(operation ? { operation } : {}),
            ...(statusCode ? { statusCode } : {}),
            ...(requestId ? { requestId } : {}),
        };
        // Determine if error should be retried based on status code
        // Network errors are generally retriable, except for client errors (4xx)
        // But are not retriable for 401, 403, and 422 status codes
        let shouldRetry = recoverable;
        if (statusCode) {
            if (statusCode === 401 || statusCode === 403 || statusCode === 422) {
                shouldRetry = false;
            }
            else if (statusCode >= 400 && statusCode < 500) {
                shouldRetry = false;
            }
        }
        // Generate code based on operation
        const code = operation
            ? `NETWORK_${operation.toUpperCase()}_ERROR`
            : 'NETWORK_ERROR';
        // Generate public message
        const publicMessage = 'A network operation failed';
        // Call BaseError constructor
        super({
            message,
            code,
            context,
            recoverable,
            shouldRetry,
            retryDelay: shouldRetry ? 1000 : undefined,
            publicMessage,
            ...restOptions,
        });
        // Store operation
        this.operation = operation;
        // Store sensitive properties privately with non-enumerable descriptors
        Object.defineProperties(this, {
            network: {
                value: network,
                enumerable: false,
                writable: false,
                configurable: false,
            },
            statusCode: {
                value: statusCode,
                enumerable: false,
                writable: false,
                configurable: false,
            },
            requestId: {
                value: requestId,
                enumerable: false,
                writable: false,
                configurable: false,
            },
        });
    }
    /**
     * Create a NetworkError from an HTTP status code
     * @param statusCode HTTP status code
     * @param message Error message
     * @param options Additional options
     * @returns New NetworkError instance
     */
    static fromStatusCode(statusCode, message, options = {}) {
        // Generate message based on status code if not provided
        const errorMessage = message || getMessageForStatusCode(statusCode);
        return new NetworkError(errorMessage, {
            ...options,
            statusCode,
        });
    }
}
exports.NetworkError = NetworkError;
/**
 * Get a default error message for an HTTP status code
 * @param statusCode HTTP status code
 * @returns Default error message
 */
function getMessageForStatusCode(statusCode) {
    switch (statusCode) {
        case 400:
            return 'Bad request';
        case 401:
            return 'Unauthorized';
        case 403:
            return 'Forbidden';
        case 404:
            return 'Not found';
        case 409:
            return 'Conflict';
        case 422:
            return 'Unprocessable entity';
        case 429:
            return 'Too many requests';
        case 500:
            return 'Internal server error';
        case 502:
            return 'Bad gateway';
        case 503:
            return 'Service unavailable';
        case 504:
            return 'Gateway timeout';
        default:
            if (statusCode >= 400 && statusCode < 500) {
                return `Client error (${statusCode})`;
            }
            else if (statusCode >= 500) {
                return `Server error (${statusCode})`;
            }
            else {
                return `HTTP error (${statusCode})`;
            }
    }
}
