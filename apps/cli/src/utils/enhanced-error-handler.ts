/**
 * Enhanced Error Handler - Comprehensive error processing and normalization
 *
 * This utility provides improved error handling with:
 * - Context-aware error messages
 * - Error type identification
 * - Fallback handling for different error types
 * - Consistent error formatting across the application
 */

import { Logger } from './Logger';
import { CLIError } from '../types/errors/consolidated';

export interface ErrorContext {
  operation?: string;
  component?: string;
  userId?: string;
  provider?: string;
  commandName?: string;
  additionalInfo?: Record<string, unknown>;
}

export interface EnhancedErrorInfo {
  message: string;
  type: string;
  originalError?: Error;
  context?: ErrorContext;
  suggestions?: string[];
  isRecoverable?: boolean;
}

/**
 * Enhanced error handler that provides better error messages and context
 */
export class EnhancedErrorHandler {
  private static logger = new Logger('EnhancedErrorHandler');

  /**
   * Normalize any error into a structured format with enhanced context
   */
  static normalizeError(
    error: unknown,
    context?: ErrorContext
  ): EnhancedErrorInfo {
    if (error instanceof Error) {
      return this.normalizeKnownError(error, context);
    }

    if (error === null) {
      return {
        message: `Null error occurred${context?.operation ? ` during ${context.operation}` : ''}`,
        type: 'NullError',
        context,
        suggestions: ['Check for null reference issues in the code'],
        isRecoverable: false,
      };
    }

    if (error === undefined) {
      return {
        message: `Undefined error occurred${context?.operation ? ` during ${context.operation}` : ''}`,
        type: 'UndefinedError',
        context,
        suggestions: ['Check for undefined reference issues in the code'],
        isRecoverable: false,
      };
    }

    if (typeof error === 'string') {
      const message = error || 'Empty string error';
      return {
        message: `String error: ${message}${context?.operation ? ` (during ${context.operation})` : ''}`,
        type: 'StringError',
        context,
        suggestions: [
          'Check error throwing logic to ensure proper Error objects are used',
        ],
        isRecoverable: true,
      };
    }

    if (typeof error === 'object') {
      try {
        const stringified = JSON.stringify(error);
        const message =
          stringified === '{}'
            ? 'Empty object error'
            : `Object error: ${stringified}`;
        return {
          message: `${message}${context?.operation ? ` (during ${context.operation})` : ''}`,
          type: 'ObjectError',
          context,
          suggestions: ['Convert object errors to proper Error instances'],
          isRecoverable: true,
        };
      } catch (serializationError) {
        return {
          message: `Non-serializable object error${context?.operation ? ` during ${context.operation}` : ''}`,
          type: 'NonSerializableObjectError',
          context,
          suggestions: ['Check object structure and circular references'],
          isRecoverable: false,
        };
      }
    }

    // Last resort for unknown error types
    try {
      const errorStr = String(error);
      return {
        message: `Unknown error of type ${typeof error}: ${errorStr}${context?.operation ? ` (during ${context.operation})` : ''}`,
        type: `UnknownError_${typeof error}`,
        context,
        suggestions: [
          'Investigate error source and ensure proper error handling',
        ],
        isRecoverable: false,
      };
    } catch (conversionError) {
      return {
        message: `Unconvertible error of type ${typeof error}${context?.operation ? ` during ${context.operation}` : ''}`,
        type: 'UnconvertibleError',
        context,
        suggestions: [
          'Check error object for circular references or non-standard properties',
        ],
        isRecoverable: false,
      };
    }
  }

  /**
   * Handle known Error instances with enhanced context
   */
  private static normalizeKnownError(
    error: Error,
    context?: ErrorContext
  ): EnhancedErrorInfo {
    const errorType = error.constructor.name;
    const baseMessage = error.message || 'No error message provided';

    // Add context to the message
    let enhancedMessage = baseMessage;
    if (context?.operation) {
      enhancedMessage += ` (during ${context.operation})`;
    }
    if (context?.component) {
      enhancedMessage += ` in ${context.component}`;
    }

    // Generate context-aware suggestions
    const suggestions = this.generateSuggestions(error, context);

    // Determine if error is recoverable
    const isRecoverable = this.isErrorRecoverable(error, context);

    return {
      message: enhancedMessage,
      type: errorType,
      originalError: error,
      context,
      suggestions,
      isRecoverable,
    };
  }

  /**
   * Generate helpful suggestions based on error type and context
   */
  private static generateSuggestions(
    error: Error,
    context?: ErrorContext
  ): string[] {
    const suggestions: string[] = [];
    const errorMessage = error.message.toLowerCase();
    const errorType = error.constructor.name;

    // Network-related errors
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('econnrefused')
    ) {
      suggestions.push('Check your internet connection');
      suggestions.push('Verify service endpoints are accessible');
      suggestions.push('Try again in a few moments');
      if (context?.operation?.includes('walrus')) {
        suggestions.push('Check Walrus network status');
      }
    }

    // Authentication/Authorization errors
    if (
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('forbidden') ||
      errorMessage.includes('api key') ||
      errorMessage.includes('authentication')
    ) {
      suggestions.push('Check your API key configuration');
      suggestions.push('Verify your credentials are valid and not expired');
      if (context?.provider) {
        suggestions.push(
          `Use 'walrus_todo ai credentials add ${context.provider} --key YOUR_API_KEY' to update credentials`
        );
      }
    }

    // Validation errors
    if (
      errorMessage.includes('validation') ||
      errorMessage.includes('invalid') ||
      errorType.includes('Validation')
    ) {
      suggestions.push('Check the format of your input parameters');
      suggestions.push('Refer to command help with --help flag');
      suggestions.push('Use --verbose for detailed validation info');
    }

    // Blockchain/Transaction errors
    if (
      errorMessage.includes('transaction') ||
      errorMessage.includes('blockchain') ||
      errorMessage.includes('gas') ||
      errorMessage.includes('sui')
    ) {
      suggestions.push('Check your wallet balance and gas fees');
      suggestions.push('Verify transaction parameters');
      suggestions.push('Check blockchain network status');
    }

    // Storage errors
    if (
      errorMessage.includes('storage') ||
      errorMessage.includes('walrus') ||
      errorMessage.includes('blob')
    ) {
      suggestions.push('Check your Walrus storage allocation');
      suggestions.push('Verify you have sufficient WAL tokens');
      suggestions.push('Ensure blob size is within limits');
    }

    // AI/Provider errors
    if (
      context?.provider ||
      errorMessage.includes('ai') ||
      errorMessage.includes('model')
    ) {
      suggestions.push('Check AI provider service status');
      suggestions.push('Verify model availability and parameters');
      if (context?.provider) {
        suggestions.push(`Verify ${context.provider} API key is valid`);
      }
    }

    // Generic fallback suggestions
    if (suggestions.length === 0) {
      suggestions.push('Try running the command again');
      suggestions.push('Use --debug for detailed error information');
      suggestions.push('Check the command documentation');
      if (context?.commandName) {
        suggestions.push(
          `Use '${context.commandName} --help' for usage information`
        );
      }
    }

    return suggestions;
  }

  /**
   * Determine if an error is likely recoverable
   */
  private static isErrorRecoverable(
    error: Error,
    context?: ErrorContext
  ): boolean {
    const errorMessage = error.message.toLowerCase();

    // Non-recoverable errors
    if (
      errorMessage.includes('fatal') ||
      errorMessage.includes('critical') ||
      errorMessage.includes('corrupted') ||
      errorMessage.includes('permission denied')
    ) {
      return false;
    }

    // Recoverable errors
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('retry') ||
      errorMessage.includes('temporary')
    ) {
      return true;
    }

    // Context-based recovery assessment
    if (
      context?.operation?.includes('network') ||
      context?.operation?.includes('fetch')
    ) {
      return true;
    }

    // Default to recoverable for most errors
    return true;
  }

  /**
   * Create a CLIError with enhanced error information
   */
  static createCLIError(error: unknown, context?: ErrorContext): CLIError {
    const errorInfo = this.normalizeError(error, context);

    const cliError = new CLIError(
      errorInfo.message,
      errorInfo.type.toUpperCase().replace(/ERROR$/, '') + '_ERROR'
    );

    // Add suggestions as a property if the CLIError supports it
    if ('suggestions' in cliError) {
      (cliError as CLIError & { suggestions: string[] }).suggestions =
        errorInfo.suggestions || [];
    }

    return cliError;
  }

  /**
   * Log an error with appropriate level and context
   */
  static logError(error: unknown, context?: ErrorContext): void {
    const errorInfo = this.normalizeError(error, context);

    const logContext = {
      errorType: errorInfo.type,
      operation: context?.operation,
      component: context?.component,
      isRecoverable: errorInfo.isRecoverable,
      ...context?.additionalInfo,
    };

    if (errorInfo.isRecoverable) {
      this.logger.warn(errorInfo.message, errorInfo.originalError, logContext);
    } else {
      this.logger.error(errorInfo.message, errorInfo.originalError, logContext);
    }
  }

  /**
   * Get a user-friendly error message with suggestions
   */
  static getUserFriendlyMessage(
    error: unknown,
    context?: ErrorContext
  ): string {
    const errorInfo = this.normalizeError(error, context);

    let message = errorInfo.message;

    if (errorInfo.suggestions && errorInfo.suggestions.length > 0) {
      message += '\n\nSuggestions:';
      errorInfo.suggestions.forEach(suggestion => {
        message += `\n• ${suggestion}`;
      });
    }

    return message;
  }
}

/**
 * Convenience function to wrap operations with enhanced error handling
 */
export async function withEnhancedErrorHandling<T>(
  operation: () => Promise<T>,
  context?: ErrorContext
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    EnhancedErrorHandler.logError(error, context);
    throw EnhancedErrorHandler.createCLIError(error, context);
  }
}

/**
 * Convenience function for synchronous operations
 */
export function withEnhancedErrorHandlingSync<T>(
  operation: () => T,
  context?: ErrorContext
): T {
  try {
    return operation();
  } catch (error) {
    EnhancedErrorHandler.logError(error, context);
    throw EnhancedErrorHandler.createCLIError(error, context);
  }
}
