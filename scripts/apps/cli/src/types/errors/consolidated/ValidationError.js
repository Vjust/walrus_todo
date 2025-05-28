"use strict";
/**
 * @file Validation error class for input validation failures
 * Provides consistent error handling for validation failures with
 * field-specific context and handling.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = void 0;
const BaseError_1 = require("./BaseError");
/**
 * Error thrown for validation failures
 * Consolidates validation error handling across the application
 */
class ValidationError extends BaseError_1.BaseError {
    /**
     * Create a new ValidationError
     * @param message Error message
     * @param options Options for the error
     */
    constructor(message, optionsOrField, additionalContext) {
        // Handle both constructor signatures (for backward compatibility)
        let options = {};
        if (typeof optionsOrField === 'string') {
            // Support previous signature: (message, field, context)
            options = {
                field: optionsOrField,
                context: additionalContext,
            };
        }
        else if (optionsOrField && typeof optionsOrField === 'object') {
            // Support object-based options
            options = { ...optionsOrField };
        }
        const { field, value, constraint, recoverable = false, operation, context, cause, attempt, } = options;
        // Build context object
        const errorContext = {
            ...(context || {}),
            ...(value !== undefined ? { value } : {}),
            ...(constraint !== undefined ? { constraint } : {}),
            ...(operation !== undefined ? { operation } : {}),
            ...(attempt !== undefined ? { attempt } : {}),
        };
        // Ensure message includes field if provided
        const errorMessage = field
            ? `Validation error for ${field}: ${message}`
            : `Validation error: ${message}`;
        // Create public message
        const publicMessage = field
            ? `Invalid value for ${field}`
            : 'Validation failed';
        // Call BaseError constructor
        super({
            message: errorMessage,
            code: 'VALIDATION_ERROR',
            context: errorContext,
            cause,
            recoverable,
            shouldRetry: recoverable,
            publicMessage,
        });
        // Store field
        this.field = field;
    }
    /**
     * Create a ValidationError with a field prefix
     * @param message Error message
     * @param field Field name
     * @param options Additional options
     * @returns New ValidationError instance
     */
    static forField(message, field, options = {}) {
        return new ValidationError(message, {
            ...options,
            field,
        });
    }
}
exports.ValidationError = ValidationError;
