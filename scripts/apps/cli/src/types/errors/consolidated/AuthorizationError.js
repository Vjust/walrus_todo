"use strict";
/**
 * @file Authorization error class for authentication and permission failures
 * Handles errors related to user authentication, authorization, and permission checks.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthorizationError = void 0;
const BaseError_1 = require("./BaseError");
/**
 * Error thrown for authorization and authentication failures
 */
class AuthorizationError extends BaseError_1.BaseError {
    /**
     * Create a new AuthorizationError
     * @param message Error message
     * @param options Options for the error
     */
    constructor(message, options = {}) {
        const { resource, action, subject, requiredPermissions, currentPermissions, isLoginRequired = false, code = 'AUTHORIZATION_ERROR', ...restOptions } = options;
        // Build context with authorization details
        const context = {
            ...(options.context || {}),
            ...(resource ? { resource } : {}),
            ...(action ? { action } : {}),
            ...(subject ? { subject } : {}),
            ...(requiredPermissions ? { requiredPermissions } : {}),
            ...(currentPermissions ? { currentPermissions } : {}),
        };
        // Call BaseError constructor
        super({
            message,
            code,
            context,
            recoverable: isLoginRequired, // Login-required errors are potentially recoverable
            shouldRetry: false, // Authorization errors generally shouldn't be retried automatically
            ...restOptions,
        });
        // Store properties
        this.resource = resource;
        this.action = action;
        this.subject = subject;
        this.requiredPermissions = requiredPermissions;
        this.currentPermissions = currentPermissions;
        this.isLoginRequired = isLoginRequired;
    }
    /**
     * Create an AuthorizationError for missing authentication
     * @param resource Resource that requires authentication
     * @param options Additional options
     * @returns New AuthorizationError instance
     */
    static unauthenticated(resource, options = {}) {
        return new AuthorizationError('Authentication required', {
            ...options,
            resource,
            isLoginRequired: true,
            code: 'AUTHORIZATION_UNAUTHENTICATED',
        });
    }
    /**
     * Create an AuthorizationError for insufficient permissions
     * @param action Action that was attempted
     * @param resource Resource being accessed
     * @param options Additional options
     * @returns New AuthorizationError instance
     */
    static forbidden(action, resource, options = {}) {
        return new AuthorizationError(`Permission denied: cannot ${action} ${resource}`, {
            ...options,
            action,
            resource,
            code: 'AUTHORIZATION_FORBIDDEN',
        });
    }
    /**
     * Create an AuthorizationError for expired session
     * @param options Additional options
     * @returns New AuthorizationError instance
     */
    static sessionExpired(options = {}) {
        return new AuthorizationError('Session has expired', {
            ...options,
            isLoginRequired: true,
            code: 'AUTHORIZATION_SESSION_EXPIRED',
        });
    }
    /**
     * Create an AuthorizationError for invalid credentials
     * @param options Additional options
     * @returns New AuthorizationError instance
     */
    static invalidCredentials(options = {}) {
        return new AuthorizationError('Invalid credentials', {
            ...options,
            code: 'AUTHORIZATION_INVALID_CREDENTIALS',
        });
    }
}
exports.AuthorizationError = AuthorizationError;
