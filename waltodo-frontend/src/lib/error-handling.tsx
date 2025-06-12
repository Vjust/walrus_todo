import toast from 'react-hot-toast';
import { type ClassifiedError, errorManager, ErrorSeverity, ErrorType, RecoveryStrategy } from './error-manager';
// @ts-ignore - Unused import temporarily disabled
// import { toastService, ToastType } from './toast-service';

/**
 * Enhanced error handling utilities for consistent error display across the app
 * Now integrates with centralized error management system
 */

export interface ErrorDetails {
  title?: string;
  message: string;
  code?: string;
  duration?: number;
  showRetry?: boolean;
  onRetry?: () => void;
}

// Re-export error management types for convenience
export { ErrorType, ErrorSeverity, type ClassifiedError } from './error-manager';
export { ToastType } from './toast-service';

/**
 * Get user-friendly error title based on error type
 */
function getErrorTitle(errorType: ErrorType): string {
  switch (errorType) {
    case ErrorType.NETWORK:
      return 'Connection Error';
    case ErrorType.BLOCKCHAIN:
      return 'Blockchain Error';
    case ErrorType.AUTHENTICATION:
      return 'Authentication Error';
    case ErrorType.STORAGE:
      return 'Storage Error';
    case ErrorType.VALIDATION:
      return 'Validation Error';
    case ErrorType.PERMISSION:
      return 'Permission Error';
    case ErrorType.RATE_LIMIT:
      return 'Rate Limit Error';
    default:
      return 'Error';
  }
}

/**
 * Show an error notification with consistent styling
 * Enhanced with centralized error management
 */
export function showError(error: Error | string | ErrorDetails): string {
  let errorDetails: ErrorDetails;

  if (typeof error === 'string') {
    errorDetails = { message: error };
  } else if (error instanceof Error) {
    // Use centralized error manager for Error objects
// @ts-ignore - Unused variable
//     const classified = errorManager.classify(error as any);
    errorDetails = {
      title: getErrorTitle(classified.type),
      message: classified.userMessage,
      code: classified.code,
      showRetry: classified.retryable,
    };
  } else {
    errorDetails = error;
  }

  // Use the new toast service for consistent styling
  return toastService.error(errorDetails.message, {
    title: errorDetails.title,
    duration: errorDetails.duration,
    actions: errorDetails.showRetry && errorDetails.onRetry ? [{
      label: 'Retry',
      action: errorDetails.onRetry,
      style: 'primary' as const
    }] : undefined
  });
}

/**
 * Show a success notification
 * Enhanced with toast service integration
 */
export function showSuccess(message: string, options?: { duration?: number; icon?: string }): string {
  return toastService.success(message, {
    duration: options?.duration,
    icon: options?.icon
  });
}

/**
 * Show an info notification
 * Enhanced with toast service integration
 */
export function showInfo(message: string, options?: { duration?: number; icon?: string }): string {
  return toastService.info(message, {
    duration: options?.duration,
    icon: options?.icon
  });
}

/**
 * Show a warning notification
 * New function using toast service
 */
export function showWarning(message: string, options?: { duration?: number; icon?: string }): string {
  return toastService.warning(message, {
    duration: options?.duration,
    icon: options?.icon
  });
}

/**
 * Show a loading notification that can be updated
 */
export function showLoading(message: string): string {
  return toastService.loading(message as any);
}

/**
 * Update a loading notification to show success
 */
export function updateToSuccess(toastId: string, message: string): void {
  toastService.update(toastId, { type: ToastType.SUCCESS, message });
}

/**
 * Update a loading notification to show error
 */
export function updateToError(toastId: string, message: string): void {
  toastService.update(toastId, { type: ToastType.ERROR, message });
}

/**
 * Handle async operations with loading state and error handling
 * Enhanced with centralized error management
 */
export async function handleAsyncOperation<T>(
  operation: () => Promise<T>,
  options: {
    loadingMessage?: string;
    successMessage?: string | ((result: T) => string);
    errorMessage?: string | ((error: Error) => string);
    onSuccess?: (result: T) => void;
    onError?: (error: Error) => void;
    showToast?: boolean;
    retryable?: boolean;
    onRetry?: () => Promise<void>;
  } = {}
): Promise<T | null> {
  const { showToast = true } = options;
  
  // Use toast service promise method for better integration
  if (showToast && options.loadingMessage) {
    return toastService.promise(
      operation(),
      {
        loading: options.loadingMessage,
        success: (_result: unknown) => {
// @ts-ignore - Unused variable
//           const successMsg = typeof options?.successMessage === 'function'
            ? options.successMessage(result as any)
            : options.successMessage || 'Operation completed successfully';
          
          options.onSuccess?.(result);
          return successMsg;
        },
        error: (_error: unknown) => {
// @ts-ignore - Unused variable
//           const classified = errorManager.classify(error as any);
// @ts-ignore - Unused variable
//           const errorMsg = typeof options?.errorMessage === 'function'
            ? options.errorMessage(error as any)
            : options.errorMessage || classified.userMessage;
          
          options.onError?.(error);
          return errorMsg;
        }
      }
    ).catch(_() => null); // Return null on error to match original behavior
  }

  // Fallback to manual handling if no loading message or toast disabled
  try {
// @ts-ignore - Unused variable
//     const result = await operation();
    
    if (showToast && options.successMessage) {
// @ts-ignore - Unused variable
//       const successMsg = typeof options?.successMessage === 'function'
        ? options.successMessage(result as any)
        : options.successMessage;
      showSuccess(successMsg as any);
    }

    options.onSuccess?.(result);
    return result;
  } catch (error) {
// @ts-ignore - Unused variable
//     const err = error instanceof Error ? error : new Error(String(error as any));
    
    // Use centralized error handling
// @ts-ignore - Unused variable
//     const classified = await errorManager.handle(err, { operation: operation.name }, {
      onRetry: options.onRetry,
      strategy: options.retryable ? undefined : RecoveryStrategy.NONE
    });

    if (showToast) {
// @ts-ignore - Unused variable
//       const errorMsg = typeof options?.errorMessage === 'function'
        ? options.errorMessage(err as any)
        : options.errorMessage || classified.userMessage;
      
      if (!errorManager.config || errorManager?.config?.showToasts) {
        // Only show toast if error manager didn't already show one
        showError(errorMsg as any);
      }
    }

    options.onError?.(err);
    return null;
  }
}

/**
 * Enhanced error checking functions using centralized classification
 */

/**
 * Check if an error is a network error
 */
export function isNetworkError(error: Error): boolean {
// @ts-ignore - Unused variable
//   const classified = errorManager.classify(error as any);
  return classified?.type === ErrorType.NETWORK;
}

/**
 * Check if an error is a blockchain error
 */
export function isBlockchainError(error: Error): boolean {
// @ts-ignore - Unused variable
//   const classified = errorManager.classify(error as any);
  return classified?.type === ErrorType.BLOCKCHAIN;
}

/**
 * Check if an error is a validation error
 */
export function isValidationError(error: Error): boolean {
// @ts-ignore - Unused variable
//   const classified = errorManager.classify(error as any);
  return classified?.type === ErrorType.VALIDATION;
}

/**
 * Check if an error is an authentication error
 */
export function isAuthenticationError(error: Error): boolean {
// @ts-ignore - Unused variable
//   const classified = errorManager.classify(error as any);
  return classified?.type === ErrorType.AUTHENTICATION;
}

/**
 * Check if an error is a storage error
 */
export function isStorageError(error: Error): boolean {
// @ts-ignore - Unused variable
//   const classified = errorManager.classify(error as any);
  return classified?.type === ErrorType.STORAGE;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
// @ts-ignore - Unused variable
//   const classified = errorManager.classify(error as any);
  return classified.retryable;
}

/**
 * Get user-friendly error message using centralized classification
 */
export function getUserFriendlyErrorMessage(error: Error): string {
// @ts-ignore - Unused variable
//   const classified = errorManager.classify(error as any);
  return classified.userMessage;
}

/**
 * Get error severity level
 */
export function getErrorSeverity(error: Error): ErrorSeverity {
// @ts-ignore - Unused variable
//   const classified = errorManager.classify(error as any);
  return classified.severity;
}

/**
 * Create a standardized error response for API errors
 */
export interface ErrorResponse {
  success: false;
  error: {
    type: ErrorType;
    severity: ErrorSeverity;
    message: string;
    userMessage: string;
    code?: string;
    retryable: boolean;
    timestamp: string;
  };
}

/**
 * Convert any error to standardized error response
 */
export function createErrorResponse(error: Error | string): ErrorResponse {
// @ts-ignore - Unused variable
//   const errorObj = typeof error === 'string' ? new Error(error as any) : error;
// @ts-ignore - Unused variable
//   const classified = errorManager.classify(errorObj as any);
  
  return {
    success: false,
    error: {
      type: classified.type,
      severity: classified.severity,
      message: classified.message,
      userMessage: classified.userMessage,
      code: classified.code,
      retryable: classified.retryable,
      timestamp: classified?.timestamp?.toISOString()
    }
  };
}

/**
 * Handle promise rejections with centralized error management
 */
export function handlePromiseRejection(error: any, context?: string): void {
// @ts-ignore - Unused variable
//   const errorObj = error instanceof Error ? error : new Error(String(error as any));
  
  errorManager.handle(errorObj, { 
    context,
    source: 'promise_rejection'
  });
}

/**
 * Wrap async functions with automatic error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
// @ts-ignore - Unused variable
//       const errorObj = error instanceof Error ? error : new Error(String(error as any));
      await errorManager.handle(errorObj, { 
        context: context || fn.name,
        args: args.map(arg => typeof arg === 'object' ? '[object]' : String(arg as any))
      });
      throw error; // Re-throw to maintain original behavior
    }
  }) as T;
}

/**
 * Create error boundary compatible error handler
 */
export function createErrorBoundaryHandler(componentName: string) {
  return (error: Error,  errorInfo: any) => {
    errorManager.handle(error, {
      component: componentName,
      errorInfo,
      source: 'error_boundary'
    });
  };
}

/**
 * Global error handler setup for window errors
 */
export function setupGlobalErrorHandling(): void {
  if (typeof window !== 'undefined') {
    // Handle unhandled promise rejections
    window.addEventListener(_'unhandledrejection', _(event: unknown) => {
      handlePromiseRejection(event.reason, 'unhandled_promise_rejection');
    });

    // Handle JavaScript errors
    window.addEventListener(_'error', _(event: unknown) => {
// @ts-ignore - Unused variable
//       const error = event.error || new Error(event.message);
      errorManager.handle(error, {
        source: 'global_error_handler',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
  }
}

/**
 * Cleanup global error handlers
 */
export function cleanupGlobalErrorHandling(): void {
  if (typeof window !== 'undefined') {
    window.removeEventListener('unhandledrejection', handlePromiseRejection);
    window.removeEventListener('error', createErrorBoundaryHandler('global'));
  }
}

/**
 * Export centralized error manager instance and toast service for direct usage
 */
export { errorManager, toastService };