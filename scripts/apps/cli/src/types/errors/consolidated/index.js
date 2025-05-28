"use strict";
/**
 * @file Consolidated error handling framework
 * Exports a unified set of error classes for consistent error handling throughout the application.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalrusError = exports.AuthorizationError = exports.TransactionError = exports.CLIError = exports.BlockchainError = exports.StorageError = exports.NetworkError = exports.ValidationError = exports.BaseError = void 0;
exports.isErrorWithMessage = isErrorWithMessage;
exports.isRetryableError = isRetryableError;
exports.getErrorMessage = getErrorMessage;
exports.isErrorType = isErrorType;
exports.getErrorCode = getErrorCode;
exports.toBaseError = toBaseError;
// Base error infrastructure
const BaseError_1 = require("./BaseError");
var BaseError_2 = require("./BaseError");
Object.defineProperty(exports, "BaseError", { enumerable: true, get: function () { return BaseError_2.BaseError; } });
// Domain-specific error classes
var ValidationError_1 = require("./ValidationError");
Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return ValidationError_1.ValidationError; } });
var NetworkError_1 = require("./NetworkError");
Object.defineProperty(exports, "NetworkError", { enumerable: true, get: function () { return NetworkError_1.NetworkError; } });
var StorageError_1 = require("./StorageError");
Object.defineProperty(exports, "StorageError", { enumerable: true, get: function () { return StorageError_1.StorageError; } });
var BlockchainError_1 = require("./BlockchainError");
Object.defineProperty(exports, "BlockchainError", { enumerable: true, get: function () { return BlockchainError_1.BlockchainError; } });
var CLIError_1 = require("./CLIError");
Object.defineProperty(exports, "CLIError", { enumerable: true, get: function () { return CLIError_1.CLIError; } });
var TransactionError_1 = require("./TransactionError");
Object.defineProperty(exports, "TransactionError", { enumerable: true, get: function () { return TransactionError_1.TransactionError; } });
var AuthorizationError_1 = require("./AuthorizationError");
Object.defineProperty(exports, "AuthorizationError", { enumerable: true, get: function () { return AuthorizationError_1.AuthorizationError; } });
// Import all error classes at the top level for use in utilities
const NetworkError_2 = require("./NetworkError");
const BlockchainError_2 = require("./BlockchainError");
// Error utilities
/**
 * Checks if a value is an error with a message
 * @param error Value to check
 * @returns true if the value is an error with a message
 */
function isErrorWithMessage(error) {
    return (typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string');
}
/**
 * Alias for backwards compatibility
 */
var BaseError_3 = require("./BaseError");
Object.defineProperty(exports, "WalrusError", { enumerable: true, get: function () { return BaseError_3.BaseError; } });
/**
 * Check if an error is a transient error that can be retried
 */
function isRetryableError(error) {
    // Check if error is a NetworkError
    if (error instanceof NetworkError_2.NetworkError) {
        return error.recoverable === true;
    }
    // Check if error is a BlockchainError
    if (error instanceof BlockchainError_2.BlockchainError) {
        return ['NETWORK_ERROR', 'TIMEOUT', 'RATE_LIMIT'].includes(error.code || '');
    }
    // Check if it's a BaseError with shouldRetry flag
    if (error instanceof BaseError_1.BaseError) {
        return error.shouldRetry === true;
    }
    if (isErrorWithMessage(error)) {
        const errorMessage = error.message.toLowerCase();
        return (errorMessage.includes('timeout') ||
            errorMessage.includes('network') ||
            errorMessage.includes('connection') ||
            errorMessage.includes('retry') ||
            errorMessage.includes('unavailable'));
    }
    return false;
}
/**
 * Gets a string error message from any value
 * @param error Value to get error message from
 * @returns A string error message
 */
function getErrorMessage(error) {
    if (isErrorWithMessage(error)) {
        return error.message;
    }
    try {
        return String(error);
    }
    catch (e) {
        return 'Unknown error';
    }
}
/**
 * Determines if an error is a specific type
 * @param error Error to check
 * @param errorClass Error class to check against
 * @returns true if the error is an instance of the error class
 */
function isErrorType(error, errorClass) {
    return error instanceof errorClass;
}
/**
 * Safely extracts the error code from any error
 * @param error Error to get code from
 * @param defaultCode Default code if not found
 * @returns Error code
 */
function getErrorCode(error, defaultCode = 'UNKNOWN_ERROR') {
    if (error instanceof BaseError_1.BaseError) {
        return error.code;
    }
    if (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string') {
        return error.code;
    }
    return defaultCode;
}
// Using isRetryableError from above
/**
 * Converts any error-like object to a BaseError
 * @param error Error to convert
 * @param defaultMessage Default message if not an error
 * @param defaultCode Default code if not a BaseError
 * @returns A BaseError
 */
function toBaseError(error, defaultMessage = 'An unknown error occurred', defaultCode = 'UNKNOWN_ERROR') {
    if (error instanceof BaseError_1.BaseError) {
        return error;
    }
    if (error instanceof Error) {
        return new BaseError_1.BaseError({
            message: error.message,
            code: getErrorCode(error, defaultCode),
            cause: error,
        });
    }
    return new BaseError_1.BaseError({
        message: isErrorWithMessage(error) ? error.message : defaultMessage,
        code: getErrorCode(error, defaultCode),
        context: { originalError: error },
    });
}
