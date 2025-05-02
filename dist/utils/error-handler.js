"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIError = void 0;
exports.handleError = handleError;
exports.withRetry = withRetry;
exports.assert = assert;
const tslib_1 = require("tslib");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const error_1 = require("../types/error");
/**
 * Custom CLI error class for application-specific errors
 */
class CLIError extends Error {
    constructor(message, code = 'GENERAL_ERROR') {
        super(message);
        this.code = code;
        this.name = 'CLIError';
    }
}
exports.CLIError = CLIError;
/**
 * Centralized error handler for the application
 */
function handleError(messageOrError, error) {
    // Handle the case where only one parameter is passed
    if (error === undefined) {
        error = messageOrError;
        messageOrError = '';
    }
    const contextMessage = typeof messageOrError === 'string' ? messageOrError : '';
    if (error instanceof CLIError) {
        console.error(`\n❌ ${contextMessage ? contextMessage + ': ' : ''}CLI Error: ${error.message}`);
        return;
    }
    if (error instanceof Error) {
        console.error(`\n❌ ${contextMessage ? contextMessage + ': ' : ''}Error: ${error.message}`);
        return;
    }
    // Handle unknown error types with a message
    if ((0, error_1.isErrorWithMessage)(error)) {
        console.error(`\n❌ ${contextMessage ? contextMessage + ': ' : ''}Error: ${error.message}`);
        return;
    }
    // Handle completely unknown error types
    console.error(`\n❌ ${contextMessage ? contextMessage + ': ' : ''}Unknown error occurred: ${(0, error_1.getErrorMessage)(error)}`);
}
/**
 * Wraps an async function with retry logic for transient errors
 */
async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            // Only retry on network errors or specific transient errors
            if (!isTransientError(error) || attempt >= maxRetries) {
                throw error;
            }
            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.log(chalk_1.default.yellow(`Request failed, retrying (${attempt}/${maxRetries}) after ${delay}ms...`));
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}
/**
 * Determines if an error is likely transient and can be retried
 */
function isTransientError(error) {
    var _a;
    const message = ((_a = error === null || error === void 0 ? void 0 : error.message) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
    return (message.includes('network') ||
        message.includes('timeout') ||
        message.includes('connection') ||
        message.includes('econnrefused') ||
        message.includes('econnreset') ||
        message.includes('429'));
}
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
