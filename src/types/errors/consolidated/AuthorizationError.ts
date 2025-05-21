/**
 * @file Authorization error class for authentication and permission failures
 * Handles errors related to user authentication, authorization, and permission checks.
 */

import { BaseError, BaseErrorOptions } from './BaseError';

/**
 * Options for AuthorizationError construction
 */
export interface AuthorizationErrorOptions extends BaseErrorOptions {
  /** Resource that was being accessed */
  resource?: string;
  
  /** Action that was attempted */
  action?: string;
  
  /** User or entity that attempted the action */
  subject?: string;
  
  /** Required permissions or role */
  requiredPermissions?: string[];
  
  /** Current permissions of the user */
  currentPermissions?: string[];
  
  /** Whether this is a login-related error */
  isLoginRequired?: boolean;
}

/**
 * Error thrown for authorization and authentication failures
 */
export class AuthorizationError extends BaseError {
  /** Resource that was being accessed */
  public readonly resource?: string;
  
  /** Action that was attempted */
  public readonly action?: string;
  
  /** User or entity that attempted the action */
  public readonly subject?: string;
  
  /** Required permissions or role */
  public readonly requiredPermissions?: string[];
  
  /** Current permissions of the user */
  public readonly currentPermissions?: string[];
  
  /** Whether this is a login-related error */
  public readonly isLoginRequired: boolean;
  
  /**
   * Create a new AuthorizationError
   * @param message Error message
   * @param options Options for the error
   */
  constructor(message: string, options: Partial<AuthorizationErrorOptions> = {}) {
    const {
      resource,
      action,
      subject,
      requiredPermissions,
      currentPermissions,
      isLoginRequired = false,
      code = 'AUTHORIZATION_ERROR',
      ...restOptions
    } = options;
    
    // Build context with authorization details
    const context = {
      ...(options.context || {}),
      ...(resource ? { resource } : {}),
      ...(action ? { action } : {}),
      ...(subject ? { subject } : {}),
      ...(requiredPermissions ? { requiredPermissions } : {}),
      ...(currentPermissions ? { currentPermissions } : {})
    };
    
    // Call BaseError constructor
    super({
      message,
      code,
      context,
      recoverable: isLoginRequired,  // Login-required errors are potentially recoverable
      shouldRetry: false,  // Authorization errors generally shouldn't be retried automatically
      ...restOptions
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
  static unauthenticated(
    resource?: string,
    options: Omit<AuthorizationErrorOptions, 'isLoginRequired' | 'message'> = {}
  ): AuthorizationError {
    return new AuthorizationError(
      'Authentication required',
      {
        ...options,
        resource,
        isLoginRequired: true,
        code: 'AUTHORIZATION_UNAUTHENTICATED'
      }
    );
  }
  
  /**
   * Create an AuthorizationError for insufficient permissions
   * @param action Action that was attempted
   * @param resource Resource being accessed
   * @param options Additional options
   * @returns New AuthorizationError instance
   */
  static forbidden(
    action: string,
    resource: string,
    options: Omit<AuthorizationErrorOptions, 'action' | 'resource' | 'message'> = {}
  ): AuthorizationError {
    return new AuthorizationError(
      `Permission denied: cannot ${action} ${resource}`,
      {
        ...options,
        action,
        resource,
        code: 'AUTHORIZATION_FORBIDDEN'
      }
    );
  }
  
  /**
   * Create an AuthorizationError for expired session
   * @param options Additional options
   * @returns New AuthorizationError instance
   */
  static sessionExpired(
    options: Omit<AuthorizationErrorOptions, 'isLoginRequired' | 'message'> = {}
  ): AuthorizationError {
    return new AuthorizationError(
      'Session has expired',
      {
        ...options,
        isLoginRequired: true,
        code: 'AUTHORIZATION_SESSION_EXPIRED'
      }
    );
  }
  
  /**
   * Create an AuthorizationError for invalid credentials
   * @param options Additional options
   * @returns New AuthorizationError instance
   */
  static invalidCredentials(
    options: Omit<AuthorizationErrorOptions, 'message'> = {}
  ): AuthorizationError {
    return new AuthorizationError(
      'Invalid credentials',
      {
        ...options,
        code: 'AUTHORIZATION_INVALID_CREDENTIALS'
      }
    );
  }
}