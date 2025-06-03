/**
 * Comprehensive type definitions for centralized error handling system
 * Provides type safety for error classification, handling, and recovery
 */

// Import and re-export core types from error manager and toast service
import type {
  ErrorType,
  ErrorSeverity,
  RecoveryStrategy,
  ClassifiedError,
  ErrorRecoveryOptions,
  ErrorHandlingConfig
} from '@/lib/error-manager';

import type {
  ToastType,
  ToastPosition,
  ToastConfig,
  ToastAction,
  ToastTheme
} from '@/lib/toast-service';

import type {
  AsyncErrorConfig,
  AsyncState,
  AsyncActions,
  UseAsyncErrorReturn
} from '@/hooks/useAsyncError';

// Re-export for convenience
export type {
  ErrorType,
  ErrorSeverity,
  RecoveryStrategy,
  ClassifiedError,
  ErrorRecoveryOptions,
  ErrorHandlingConfig,
  ToastType,
  ToastPosition,
  ToastConfig,
  ToastAction,
  ToastTheme,
  AsyncErrorConfig,
  AsyncState,
  AsyncActions,
  UseAsyncErrorReturn
};

// Component-specific error types
export interface ComponentErrorInfo {
  componentStack?: string;
  errorBoundary?: string;
  errorInfo?: {
    componentStack: string;
  };
}

export interface NetworkErrorDetails {
  url?: string;
  method?: string;
  status?: number;
  statusText?: string;
  timeout?: boolean;
  cors?: boolean;
}

export interface BlockchainErrorDetails {
  transaction?: string;
  address?: string;
  gasLimit?: number;
  gasPrice?: number;
  walletType?: string;
  network?: string;
}

export interface StorageErrorDetails {
  operation?: 'read' | 'write' | 'delete' | 'list';
  path?: string;
  size?: number;
  provider?: 'walrus' | 'local' | 'api';
}

export interface ValidationErrorDetails {
  field?: string;
  value?: any;
  constraint?: string;
  expected?: string;
}

// Extended error context for different error types
export type ErrorContext = {
  // Basic context
  operation?: string;
  component?: string;
  source?: string;
  timestamp?: Date;
  
  // Type-specific details
  network?: NetworkErrorDetails;
  blockchain?: BlockchainErrorDetails;
  storage?: StorageErrorDetails;
  validation?: ValidationErrorDetails;
  component_info?: ComponentErrorInfo;
  
  // User context
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  url?: string;
  
  // Additional metadata
  metadata?: Record<string, any>;
};

// Error handling hook configurations
export interface ErrorHandlingHookConfig {
  // Display options
  showToast?: boolean;
  silentErrors?: boolean;
  
  // Retry configuration
  autoRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  retryBackoff?: 'linear' | 'exponential';
  
  // Recovery options
  fallbackValue?: any;
  onRecovery?: () => void | Promise<void>;
  
  // Callbacks
  onError?: (error: ClassifiedError) => void;
  onSuccess?: (data: any) => void;
  onRetry?: (attempt: number) => void;
  
  // Context
  context?: ErrorContext;
}

// Error boundary props
export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: ComponentErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
  isolate?: boolean;
}

// Toast notification configurations
export interface NotificationConfig {
  success?: Partial<ToastConfig>;
  error?: Partial<ToastConfig>;
  warning?: Partial<ToastConfig>;
  info?: Partial<ToastConfig>;
  loading?: Partial<ToastConfig>;
}

// Error reporting interface
export interface ErrorReport {
  id: string;
  error: ClassifiedError;
  context: ErrorContext;
  userAgent?: string;
  url?: string;
  timestamp: Date;
  resolved?: boolean;
  resolvedAt?: Date;
  notes?: string;
}

// Error analytics data
export interface ErrorAnalytics {
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  byComponent: Record<string, number>;
  recent: ClassifiedError[];
  trends: {
    hourly: number[];
    daily: number[];
    weekly: number[];
  };
}

// Global error handling configuration
export interface GlobalErrorConfig {
  // Error manager settings
  errorManager?: Partial<ErrorHandlingConfig>;
  
  // Toast service settings
  toastService?: {
    theme?: Partial<ToastTheme>;
    maxToasts?: number;
    position?: ToastPosition;
  };
  
  // Global handlers
  enableGlobalHandlers?: boolean;
  enableConsoleLogging?: boolean;
  enableErrorReporting?: boolean;
  
  // Development settings
  development?: {
    enableStackTrace?: boolean;
    enableErrorOverlay?: boolean;
    enablePerformanceMonitoring?: boolean;
  };
}

// Utility types for error handling
export type ErrorHandler<T = any> = (error: Error, context?: ErrorContext) => T | Promise<T>;

export type AsyncErrorHandler<T = any> = (
  operation: () => Promise<T>,
  config?: ErrorHandlingHookConfig
) => Promise<T | null>;

export type ErrorBoundaryHandler = (error: Error, errorInfo: ComponentErrorInfo) => void;

// Error response types for API operations
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  metadata?: Record<string, any>;
}

export interface ErrorResponse {
  success: false;
  error: {
    type: string;
    severity: string;
    message: string;
    userMessage: string;
    code?: string;
    retryable: boolean;
    timestamp: string;
    context?: ErrorContext;
  };
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

// Error handling middleware types
export interface ErrorMiddleware {
  onError?: ErrorHandler;
  onSuccess?: (data: any) => void;
  onRetry?: (attempt: number, error: ClassifiedError) => void;
  onGiveUp?: (error: ClassifiedError) => void;
}

// Component error state types
export interface ComponentErrorState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ComponentErrorInfo | null;
  retryCount: number;
  lastError?: Date;
}

// Error recovery strategies
export interface RecoveryStrategies {
  network: () => Promise<void>;
  blockchain: () => Promise<void>;
  authentication: () => Promise<void>;
  storage: () => Promise<void>;
  validation: () => void;
  permission: () => void;
  rate_limit: () => Promise<void>;
  unknown: () => Promise<void>;
}

// Error handling utilities
export interface ErrorUtils {
  classify: (error: Error, context?: ErrorContext) => ClassifiedError;
  handle: (error: Error, context?: ErrorContext) => Promise<ClassifiedError>;
  retry: (operation: () => Promise<any>, maxRetries?: number) => Promise<any>;
  withFallback: <T>(operation: () => Promise<T>, fallback: T) => Promise<T>;
  isRetryable: (error: Error) => boolean;
  getUserMessage: (error: Error) => string;
}

// Export utility functions type
export interface ErrorHandlingLibrary {
  // Core services
  errorManager: any; // ErrorManager instance
  toastService: any; // ToastService instance
  
  // Utility functions
  showError: (error: Error | string) => string;
  showSuccess: (message: string) => string;
  showWarning: (message: string) => string;
  showInfo: (message: string) => string;
  showLoading: (message: string) => string;
  
  // Error checking functions
  isNetworkError: (error: Error) => boolean;
  isBlockchainError: (error: Error) => boolean;
  isValidationError: (error: Error) => boolean;
  isAuthenticationError: (error: Error) => boolean;
  isStorageError: (error: Error) => boolean;
  isRetryableError: (error: Error) => boolean;
  
  // Async operations
  handleAsyncOperation: AsyncErrorHandler;
  withErrorHandling: <T extends (...args: any[]) => Promise<any>>(fn: T, context?: string) => T;
  
  // Global setup
  setupGlobalErrorHandling: () => void;
  cleanupGlobalErrorHandling: () => void;
}