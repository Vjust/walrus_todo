"use strict";
/**
 * @file CLI error class for command-line interface errors
 * Handles errors related to command execution, user input, and CLI operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIError = void 0;
const BaseError_1 = require("./BaseError");
/**
 * Error thrown for CLI-related failures
 */
class CLIError extends BaseError_1.BaseError {
    /**
     * Create a new CLIError
     * @param message Error message
     * @param options Options for the error
     */
    constructor(message, codeOrOptions = {}) {
        // Support old constructor signature (message, code)
        let options;
        if (typeof codeOrOptions === 'string') {
            options = { code: codeOrOptions, message };
        }
        else {
            options = { ...codeOrOptions, message };
        }
        const { command, exitCode = 1, input, invalidParams, code = 'CLI_ERROR', ...restOptions } = options;
        // Build context with CLI details
        const context = {
            ...(options.context || {}),
            ...(command ? { command } : {}),
            ...(invalidParams ? { invalidParams } : {}),
        };
        // Call BaseError constructor
        super({
            message,
            code,
            context,
            recoverable: false, // CLI errors are generally not recoverable
            shouldRetry: false,
            ...restOptions,
        });
        // Store properties
        this.command = command;
        this.exitCode = exitCode;
        this.invalidParams = invalidParams;
        // Store input privately to avoid leaking sensitive data
        if (input) {
            this._input = input;
        }
    }
    /**
     * Create a CLIError for invalid flag/parameter
     * @param paramName Parameter name
     * @param message Error message
     * @param options Additional options
     * @returns New CLIError instance
     */
    static invalidParameter(paramName, message, options = {}) {
        return new CLIError(message || `Invalid parameter: ${paramName}`, {
            ...options,
            invalidParams: [paramName],
            code: 'CLI_INVALID_PARAMETER',
        });
    }
    /**
     * Create a CLIError for missing required parameter
     * @param paramName Parameter name
     * @param options Additional options
     * @returns New CLIError instance
     */
    static missingParameter(paramName, options = {}) {
        return new CLIError(`Missing required parameter: ${paramName}`, {
            ...options,
            invalidParams: [paramName],
            code: 'CLI_MISSING_PARAMETER',
        });
    }
    /**
     * Create a CLIError for command not found
     * @param command Command name
     * @param options Additional options
     * @returns New CLIError instance
     */
    static commandNotFound(command, options = {}) {
        return new CLIError(`Command not found: ${command}`, {
            ...options,
            command,
            code: 'CLI_COMMAND_NOT_FOUND',
        });
    }
}
exports.CLIError = CLIError;
