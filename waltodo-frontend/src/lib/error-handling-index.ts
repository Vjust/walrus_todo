/**
 * Centralized Error Handling Library - Main Export
 * 
 * This file provides a single entry point for all error handling utilities,
 * services, and hooks in the WalTodo frontend application.
 */

import React from 'react';

// Core Services
export {
  ErrorManager,
  errorManager,
  ErrorType,
  ErrorSeverity,
  RecoveryStrategy,
  type ClassifiedError,
  type ErrorRecoveryOptions,
  type ErrorHandlingConfig
} from './error-manager';

export {
  ToastService,
  toastService,
  ToastType,
  ToastPosition,
  type ToastConfig,
  type ToastAction,
  type ToastTheme,
  
  // Convenience functions
  showSuccess,
  showError as showErrorToast,
  showWarning,
  showInfo,
  showLoading as showLoadingToast,
  dismissToast,
  dismissAllToasts
} from './toast-service';

// React Hooks
export {
  useAsyncError,
  useAsyncOperation,
  useMultipleAsyncErrors,
  useAsyncErrorWithDeps,
  type AsyncErrorConfig,
  type AsyncState,
  type AsyncActions,
  type UseAsyncErrorReturn
} from '../hooks/useAsyncError';

// Enhanced Error Handling Utilities
export {
  // Display functions
  showError,
  showSuccess,
  showInfo,
  showWarning,
  showLoading,
  updateToSuccess,
  updateToError,
  
  // Async operations
  handleAsyncOperation,
  
  // Error classification
  isNetworkError,
  isBlockchainError,
  isValidationError,
  isAuthenticationError,
  isStorageError,
  isRetryableError,
  getUserFriendlyErrorMessage,
  getErrorSeverity,
  
  // Advanced utilities
  createErrorResponse,
  handlePromiseRejection,
  withErrorHandling,
  createErrorBoundaryHandler,
  setupGlobalErrorHandling,
  cleanupGlobalErrorHandling,
  
  // Re-exported types
  type ErrorDetails,
  type ErrorResponse
} from './error-handling';

// Type Definitions
export type {
  // Core types
  ErrorContext,
  ErrorHandlingHookConfig,
  ErrorBoundaryProps,
  NotificationConfig,
  ErrorReport,
  ErrorAnalytics,
  GlobalErrorConfig,
  
  // Utility types
  ErrorHandler,
  AsyncErrorHandler,
  ErrorBoundaryHandler,
  ApiResponse,
  SuccessResponse,
  
  // Component types
  ComponentErrorInfo,
  ComponentErrorState,
  ErrorMiddleware,
  RecoveryStrategies,
  ErrorUtils,
  ErrorHandlingLibrary,
  
  // Specific error details
  NetworkErrorDetails,
  BlockchainErrorDetails,
  StorageErrorDetails,
  ValidationErrorDetails
} from '../types/error-handling';

// Default configurations
export const DEFAULT_ERROR_CONFIG: GlobalErrorConfig = {
  errorManager: {
    enableLogging: true,
    enableTelemetry: false,
    autoRetry: true,
    maxRetries: 3,
    retryDelay: 1000,
    showToasts: true,
    logLevel: 'error'
  },
  toastService: {
    maxToasts: 5,
    position: ToastPosition.TOP_RIGHT
  },
  enableGlobalHandlers: true,
  enableConsoleLogging: true,
  enableErrorReporting: false,
  development: {
    enableStackTrace: true,
    enableErrorOverlay: true,
    enablePerformanceMonitoring: false
  }
};

/**
 * Initialize the error handling system with custom configuration
 */
export function initializeErrorHandling(config: Partial<GlobalErrorConfig> = {}): void {
// @ts-ignore - Unused variable
//   const mergedConfig = { ...DEFAULT_ERROR_CONFIG, ...config };
  
  // Configure error manager
  if (mergedConfig.errorManager) {
    errorManager.updateConfig(mergedConfig.errorManager);
  }
  
  // Configure toast service
  if (mergedConfig.toastService) {
    if (mergedConfig?.toastService?.theme) {
      toastService.updateTheme(mergedConfig?.toastService?.theme);
    }
  }
  
  // Setup global handlers if enabled
  if (mergedConfig.enableGlobalHandlers) {
    setupGlobalErrorHandling();
  }
  
  // Development-specific setup
  if (process?.env?.NODE_ENV === 'development' && mergedConfig.development) {
    if (mergedConfig?.development?.enableStackTrace) {
      errorManager.updateConfig({ logLevel: 'debug' });
    }
  }
}

/**
 * Get current error handling statistics
 */
export function getErrorHandlingStats() {
  return {
    errorManager: errorManager.getErrorStats(),
    toastService: {
      activeToasts: toastService.getActiveCount()
    }
  };
}

/**
 * Reset all error handling state
 */
export function resetErrorHandling(): void {
  errorManager.clearErrorLog();
  toastService.dismissAll();
}

/**
 * Create a pre-configured error handler for specific contexts
 */
export function createContextualErrorHandler(
  context: string,
  config: Partial<AsyncErrorConfig> = {}
) {
  return {
    handle: (error: Error) => errorManager.handle(error, { context }),
    
    async: <T>(operation: () => Promise<T>) => 
      handleAsyncOperation(operation, { ...config, retryable: true }),
    
    withRetry: <T>(operation: () => Promise<T>, maxRetries = 3) =>
      handleAsyncOperation(operation, { 
        ...config, 
        retryable: true,
        showToast: true,
        loadingMessage: `${context}...`
      }),
    
    toast: {
      success: (message: string) => showSuccess(`${context}: ${message}`),
      error: (error: Error | string) => showError(typeof error === 'string' ? error : error),
      loading: (message: string = context) => showLoading(`${message}...`)
    }
  };
}

/**
 * Utility for creating type-safe error responses
 */
export function createApiErrorResponse<T = any>(
  error: Error,
  context?: string
): ErrorResponse {
  return createErrorResponse(error as any);
}

export function createApiSuccessResponse<T>(
  data: T,
  metadata?: Record<string, any>
): SuccessResponse<T> {
  return {
    success: true,
    data,
    metadata
  };
}

/**
 * Higher-order component for error boundary integration
 * Note: This is a utility function. For actual ErrorBoundary component,
 * use the ErrorBoundary component from the components directory.
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>, 
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>
) {
  return function WrappedComponent(props: P) {
// @ts-ignore - Unused variable
//     const errorHandler = createErrorBoundaryHandler(Component.displayName || 'Component');
    
    // This is a conceptual implementation
    // In practice, you would use the actual ErrorBoundary component
    return React.createElement(Component, props);
  };
}

// Default export for convenience
export default {
  // Core services
  errorManager,
  toastService,
  
  // Main functions
  showError,
  showSuccess,
  showWarning,
  showInfo,
  handleAsyncOperation,
  
  // Hooks
  useAsyncError,
  
  // Setup functions
  initializeErrorHandling,
  setupGlobalErrorHandling,
  cleanupGlobalErrorHandling,
  
  // Utilities
  createContextualErrorHandler,
  getErrorHandlingStats,
  resetErrorHandling,
  
  // Types (for convenience, though should use named imports)
  ErrorType,
  ErrorSeverity,
  ToastType,
  RecoveryStrategy
};