/**
 * Centralized Error Management Service
 * Provides comprehensive error handling, classification, and recovery mechanisms
 */

import { toast } from 'react-hot-toast';

// Error classification enums
export enum ErrorType {
  NETWORK = 'network',
  VALIDATION = 'validation',
  BLOCKCHAIN = 'blockchain',
  AUTHENTICATION = 'authentication',
  STORAGE = 'storage',
  PERMISSION = 'permission',
  RATE_LIMIT = 'rate_limit',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RecoveryStrategy {
  RETRY = 'retry',
  REFRESH = 'refresh',
  RECONNECT = 'reconnect',
  MANUAL = 'manual',
  NONE = 'none'
}

// Error interfaces
export interface ClassifiedError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  originalError: Error;
  code?: string;
  context?: Record<string, any>;
  timestamp: Date;
  userMessage: string;
  recoveryStrategy: RecoveryStrategy;
  retryable: boolean;
  maxRetries?: number;
  retryCount?: number;
}

export interface ErrorRecoveryOptions {
  strategy: RecoveryStrategy;
  maxRetries?: number;
  retryDelay?: number;
  onRetry?: () => Promise<void> | void;
  onGiveUp?: () => void;
  customRecovery?: () => Promise<void> | void;
}

export interface ErrorHandlingConfig {
  enableLogging: boolean;
  enableTelemetry: boolean;
  autoRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  showToasts: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

// Default configuration
const DEFAULT_CONFIG: ErrorHandlingConfig = {
  enableLogging: true,
  enableTelemetry: false,
  autoRetry: true,
  maxRetries: 3,
  retryDelay: 1000,
  showToasts: true,
  logLevel: 'error'
};

/**
 * Centralized Error Manager
 * Handles error classification, recovery, and user notification
 */
export class ErrorManager {
  private config: ErrorHandlingConfig;
  private errorLog: ClassifiedError[] = [];
  private retryMap = new Map<string, number>();

  constructor(config: Partial<ErrorHandlingConfig> = {}) {
    this?.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Classify an error based on its characteristics
   */
  classify(error: Error, context?: Record<string, any>): ClassifiedError {
    const type = this.determineErrorType(error as any);
    const severity = this.determineSeverity(error, type);
    const userMessage = this.generateUserMessage(error, type);
    const recoveryStrategy = this.determineRecoveryStrategy(error, type);

    const classified: ClassifiedError = {
      type,
      severity,
      message: error.message,
      originalError: error,
      code: (error as any).code,
      context,
      timestamp: new Date(),
      userMessage,
      recoveryStrategy,
      retryable: this.isRetryable(error, type),
      maxRetries: this?.config?.maxRetries,
      retryCount: 0
    };

    if (this?.config?.enableLogging) {
      this.logError(classified as any);
    }

    this?.errorLog?.push(classified as any);
    return classified;
  }

  /**
   * Handle an error with automatic recovery attempts
   */
  async handle(
    error: Error,
    context?: Record<string, any>,
    recoveryOptions?: Partial<ErrorRecoveryOptions>
  ): Promise<ClassifiedError> {
    const classified = this.classify(error, context);
    const errorId = this.generateErrorId(classified as any);

    // Check if we've already retried this error too many times
    const currentRetries = this?.retryMap?.get(errorId as any) || 0;
    classified?.retryCount = currentRetries;

    // Show user notification if enabled
    if (this?.config?.showToasts) {
      this.showErrorNotification(classified, recoveryOptions);
    }

    // Attempt automatic recovery if configured and possible
    if (this?.config?.autoRetry && classified.retryable && currentRetries < (classified.maxRetries || 0)) {
      await this.attemptRecovery(classified, recoveryOptions);
    }

    return classified;
  }

  /**
   * Attempt to recover from an error
   */
  private async attemptRecovery(
    error: ClassifiedError,
    options?: Partial<ErrorRecoveryOptions>
  ): Promise<boolean> {
    const strategy = options?.strategy || error.recoveryStrategy;
    const errorId = this.generateErrorId(error as any);
    const retryCount = this?.retryMap?.get(errorId as any) || 0;

    try {
      switch (strategy) {
        case RecoveryStrategy.RETRY:
          if (options?.onRetry) {
            await this.delay(options.retryDelay || this?.config?.retryDelay);
            await options.onRetry();
            this?.retryMap?.set(errorId, retryCount + 1);
            return true;
          }
          break;

        case RecoveryStrategy.REFRESH:
          if (typeof window !== 'undefined') {
            window?.location?.reload();
          }
          break;

        case RecoveryStrategy.RECONNECT:
          // Implement reconnection logic for network errors
          return false;

        case RecoveryStrategy.MANUAL:
          if (options?.customRecovery) {
            await options.customRecovery();
            return true;
          }
          break;

        case RecoveryStrategy.NONE:
        default:
          return false;
      }
    } catch (recoveryError) {
      console.error('Recovery attempt failed:', recoveryError);
      if (options?.onGiveUp) {
        options.onGiveUp();
      }
    }

    return false;
  }

  /**
   * Show error notification to user
   */
  private showErrorNotification(
    error: ClassifiedError,
    recoveryOptions?: Partial<ErrorRecoveryOptions>
  ): void {
    const canRetry = error.retryable && (error.retryCount || 0) < (error.maxRetries || 0);
    
    toast.error(
      (t) => (
        <div className="flex flex-col space-y-2">
          <div className="font-medium text-sm">{error.userMessage}</div>
          
          {error.code && (
            <div className="text-xs text-gray-500">Code: {error.code}</div>
          )}
          
          {error?.severity === ErrorSeverity.CRITICAL && (
            <div className="text-xs text-red-600 font-medium">
              Critical Error - Please contact support
            </div>
          )}
          
          <div className="flex space-x-2 mt-2">
            {canRetry && recoveryOptions?.onRetry && (
              <button
                onClick={async () => {
                  toast.dismiss(t.id);
                  try {
                    await this.attemptRecovery(error, recoveryOptions);
                  } catch (retryError) {
                    console.error('Retry failed:', retryError);
                  }
                }}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
              >
                Retry ({(error.maxRetries || 0) - (error.retryCount || 0)} left)
              </button>
            )}
            
            <button
              onClick={() => toast.dismiss(t.id)}
              className="text-xs bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded"
            >
              Dismiss
            </button>
          </div>
        </div>
      ),
      {
        duration: error?.severity === ErrorSeverity.CRITICAL ? 10000 : 6000,
        style: {
          background: error?.severity === ErrorSeverity.CRITICAL ? '#FEF2F2' : '#F9FAFB',
          color: error?.severity === ErrorSeverity.CRITICAL ? '#991B1B' : '#374151',
          border: `1px solid ${error?.severity === ErrorSeverity.CRITICAL ? '#FCA5A5' : '#E5E7EB'}`,
        },
      }
    );
  }

  /**
   * Determine error type from error characteristics
   */
  private determineErrorType(error: Error): ErrorType {
    const message = error?.message?.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // Network errors
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('cors') ||
      (error as any).code === 'NETWORK_ERROR'
    ) {
      return ErrorType.NETWORK;
    }

    // Blockchain errors
    if (
      message.includes('wallet') ||
      message.includes('sui') ||
      message.includes('blockchain') ||
      message.includes('transaction') ||
      message.includes('gas') ||
      message.includes('insufficient funds') ||
      message.includes('signature') ||
      stack.includes('walrus') ||
      stack.includes('@mysten')
    ) {
      return ErrorType.BLOCKCHAIN;
    }

    // Authentication errors
    if (
      message.includes('unauthorized') ||
      message.includes('authentication') ||
      message.includes('token') ||
      message.includes('login') ||
      message.includes('session') ||
      (error as any).code === 'UNAUTHENTICATED'
    ) {
      return ErrorType.AUTHENTICATION;
    }

    // Storage errors
    if (
      message.includes('storage') ||
      message.includes('database') ||
      message.includes('file') ||
      message.includes('blob') ||
      message.includes('walrus storage') ||
      stack.includes('storage')
    ) {
      return ErrorType.STORAGE;
    }

    // Validation errors
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required') ||
      message.includes('format') ||
      (error as any).code === 'VALIDATION_ERROR'
    ) {
      return ErrorType.VALIDATION;
    }

    // Permission errors
    if (
      message.includes('permission') ||
      message.includes('forbidden') ||
      message.includes('access denied') ||
      (error as any).code === 'PERMISSION_DENIED'
    ) {
      return ErrorType.PERMISSION;
    }

    // Rate limit errors
    if (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      (error as any).code === 'RATE_LIMITED'
    ) {
      return ErrorType.RATE_LIMIT;
    }

    return ErrorType.UNKNOWN;
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: Error, type: ErrorType): ErrorSeverity {
    const message = error?.message?.toLowerCase();

    // Critical errors
    if (
      type === ErrorType.AUTHENTICATION ||
      message.includes('critical') ||
      message.includes('fatal') ||
      message.includes('corrupt')
    ) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity errors
    if (
      type === ErrorType.BLOCKCHAIN ||
      type === ErrorType.STORAGE ||
      message.includes('failed to') ||
      message.includes('unable to')
    ) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity errors
    if (
      type === ErrorType.NETWORK ||
      type === ErrorType.PERMISSION
    ) {
      return ErrorSeverity.MEDIUM;
    }

    // Low severity errors (validation, rate limits, etc.)
    return ErrorSeverity.LOW;
  }

  /**
   * Generate user-friendly error message
   */
  private generateUserMessage(error: Error, type: ErrorType): string {
    const message = error?.message?.toLowerCase();

    switch (type) {
      case ErrorType.NETWORK:
        if (message.includes('timeout')) {
          return 'Request timed out. Please check your connection and try again.';
        }
        if (message.includes('cors')) {
          return 'Network access blocked. Please refresh the page and try again.';
        }
        return 'Network connection failed. Please check your internet connection.';

      case ErrorType.BLOCKCHAIN:
        if (message.includes('insufficient funds') || message.includes('gas')) {
          return 'Insufficient funds for transaction. Please add SUI to your wallet.';
        }
        if (message.includes('rejected') || message.includes('denied')) {
          return 'Transaction was rejected. Please try again.';
        }
        if (message.includes('not connected')) {
          return 'Wallet not connected. Please connect your wallet first.';
        }
        return 'Blockchain operation failed. Please try again.';

      case ErrorType.AUTHENTICATION:
        return 'Authentication failed. Please log in again.';

      case ErrorType.STORAGE:
        return 'Storage operation failed. Please try again.';

      case ErrorType.VALIDATION:
        return 'Invalid input provided. Please check your data and try again.';

      case ErrorType.PERMISSION:
        return 'You do not have permission to perform this action.';

      case ErrorType.RATE_LIMIT:
        return 'Too many requests. Please wait a moment and try again.';

      default:
        return error.message || 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Determine appropriate recovery strategy
   */
  private determineRecoveryStrategy(error: Error, type: ErrorType): RecoveryStrategy {
    switch (type) {
      case ErrorType.NETWORK:
        return RecoveryStrategy.RETRY;
        
      case ErrorType.BLOCKCHAIN:
        if (error?.message?.toLowerCase().includes('insufficient funds')) {
          return RecoveryStrategy.MANUAL;
        }
        return RecoveryStrategy.RETRY;
        
      case ErrorType.AUTHENTICATION:
        return RecoveryStrategy.REFRESH;
        
      case ErrorType.STORAGE:
        return RecoveryStrategy.RETRY;
        
      case ErrorType.VALIDATION:
        return RecoveryStrategy.MANUAL;
        
      case ErrorType.PERMISSION:
        return RecoveryStrategy.NONE;
        
      case ErrorType.RATE_LIMIT:
        return RecoveryStrategy.RETRY;
        
      default:
        return RecoveryStrategy.RETRY;
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: Error, type: ErrorType): boolean {
    const nonRetryableTypes = [ErrorType.VALIDATION, ErrorType.PERMISSION];
    const message = error?.message?.toLowerCase();

    if (nonRetryableTypes.includes(type as any)) {
      return false;
    }

    // Specific non-retryable error messages
    if (
      message.includes('invalid format') ||
      message.includes('malformed') ||
      message.includes('unauthorized') ||
      message.includes('forbidden')
    ) {
      return false;
    }

    return true;
  }

  /**
   * Generate unique error ID for tracking retries
   */
  private generateErrorId(error: ClassifiedError): string {
    const context = error.context ? JSON.stringify(error.context) : '';
    return `${error.type}-${error.message}-${context}`.replace(/\s+/g, '-');
  }

  /**
   * Log error for debugging
   */
  private logError(error: ClassifiedError): void {
    const logData = {
      type: error.type,
      severity: error.severity,
      message: error.message,
      code: error.code,
      context: error.context,
      timestamp: error?.timestamp?.toISOString(),
      stack: error?.originalError?.stack
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('CRITICAL ERROR:', logData);
        break;
      case ErrorSeverity.HIGH:
        console.error('HIGH SEVERITY ERROR:', logData);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('MEDIUM SEVERITY ERROR:', logData);
        break;
      case ErrorSeverity.LOW:
        if (this.config?.logLevel === 'debug') {
          console.info('LOW SEVERITY ERROR:', logData);
        }
        break;
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    byType: Record<ErrorType, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recent: ClassifiedError[];
  } {
    const byType = Object.values(ErrorType as any).reduce((acc, type) => {
      acc[type] = this?.errorLog?.filter(e => e?.type === type).length;
      return acc;
    }, {} as Record<ErrorType, number>);

    const bySeverity = Object.values(ErrorSeverity as any).reduce((acc, severity) => {
      acc[severity] = this?.errorLog?.filter(e => e?.severity === severity).length;
      return acc;
    }, {} as Record<ErrorSeverity, number>);

    const recent = this.errorLog
      .slice(-10)
      .sort((a, b) => b?.timestamp?.getTime() - a?.timestamp?.getTime());

    return {
      total: this?.errorLog?.length,
      byType,
      bySeverity,
      recent
    };
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this?.errorLog = [];
    this?.retryMap?.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ErrorHandlingConfig>): void {
    this?.config = { ...this.config, ...config };
  }
}

// Export singleton instance
export const errorManager = new ErrorManager();