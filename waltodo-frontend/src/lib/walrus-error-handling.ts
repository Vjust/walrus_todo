/**
 * Comprehensive Error Handling for Walrus Protocol Integration
 *
 * This module provides specialized error handling, recovery strategies,
 * and user-friendly error messages for Walrus Protocol operations.
 */

import { WalrusClientError } from './walrus-client';

// Error categories for better handling
export enum WalrusErrorCategory {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  STORAGE = 'storage',
  VALIDATION = 'validation',
  QUOTA = 'quota',
  PERMISSION = 'permission',
  UNKNOWN = 'unknown',
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// User-facing error information
export interface UserErrorInfo {
  title: string;
  message: string;
  suggestion: string;
  canRetry: boolean;
  severity: ErrorSeverity;
  category: WalrusErrorCategory;
  technicalDetails?: string;
  helpUrl?: string;
}

// Recovery action interface
export interface RecoveryAction {
  label: string;
  action: () => Promise<void> | void;
  isPrimary?: boolean;
}

/**
 * Comprehensive error analyzer for Walrus operations
 */
export class WalrusErrorAnalyzer {
  /**
   * Analyze error and return user-friendly information
   */
  static analyzeError(error: unknown): UserErrorInfo {
    if (error instanceof WalrusClientError) {
      return this.analyzeWalrusClientError(error);
    }

    if (error instanceof Error) {
      return this.analyzeGenericError(error);
    }

    return this.createUnknownErrorInfo(String(error));
  }

  /**
   * Analyze WalrusClientError specifically
   */
  private static analyzeWalrusClientError(
    error: WalrusClientError
  ): UserErrorInfo {
    const code = error.code?.toLowerCase() || '';
    const message = error.message.toLowerCase();

    // Network-related errors
    if (
      code.includes('network') ||
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('timeout')
    ) {
      return {
        title: 'Network Connection Error',
        message: 'Unable to connect to Walrus Protocol network.',
        suggestion:
          'Check your internet connection and try again. The Walrus network may be temporarily unavailable.',
        canRetry: true,
        severity: ErrorSeverity.MEDIUM,
        category: WalrusErrorCategory.NETWORK,
        technicalDetails: error.message,
        helpUrl: 'https://docs.walrus.site/troubleshooting/network',
      };
    }

    // Insufficient funds
    if (
      code.includes('funds') ||
      message.includes('insufficient') ||
      message.includes('balance') ||
      message.includes('wal')
    ) {
      return {
        title: 'Insufficient WAL Tokens',
        message:
          "You don't have enough WAL tokens to complete this storage operation.",
        suggestion:
          'Get more WAL tokens from the testnet faucet or check your wallet balance.',
        canRetry: false,
        severity: ErrorSeverity.HIGH,
        category: WalrusErrorCategory.QUOTA,
        technicalDetails: error.message,
        helpUrl: 'https://docs.walrus.site/usage/web-api#testnet-wal-faucet',
      };
    }

    // Authentication/signer errors
    if (
      code.includes('signer') ||
      message.includes('signer') ||
      message.includes('signature') ||
      message.includes('auth')
    ) {
      return {
        title: 'Wallet Authentication Error',
        message:
          'Failed to authenticate with your wallet for the storage operation.',
        suggestion:
          'Make sure your wallet is connected and try signing the transaction again.',
        canRetry: true,
        severity: ErrorSeverity.HIGH,
        category: WalrusErrorCategory.AUTHENTICATION,
        technicalDetails: error.message,
      };
    }

    // Blob not found errors
    if (
      code.includes('not_found') ||
      message.includes('not found') ||
      (message.includes('blob') && message.includes('exist'))
    ) {
      return {
        title: 'Todo Not Found',
        message: 'The requested todo could not be found in Walrus storage.',
        suggestion:
          "Check the blob ID and make sure the todo hasn't expired or been deleted.",
        canRetry: false,
        severity: ErrorSeverity.MEDIUM,
        category: WalrusErrorCategory.STORAGE,
        technicalDetails: error.message,
      };
    }

    // Validation errors
    if (
      code.includes('validation') ||
      message.includes('invalid') ||
      message.includes('size') ||
      message.includes('format')
    ) {
      return {
        title: 'Invalid Data',
        message: 'The todo data is invalid or exceeds size limits.',
        suggestion:
          'Check that your todo content is under 13MB and properly formatted.',
        canRetry: false,
        severity: ErrorSeverity.MEDIUM,
        category: WalrusErrorCategory.VALIDATION,
        technicalDetails: error.message,
      };
    }

    // Storage quota errors
    if (
      message.includes('quota') ||
      message.includes('limit') ||
      (message.includes('storage') && message.includes('exceeded'))
    ) {
      return {
        title: 'Storage Quota Exceeded',
        message: 'You have exceeded your storage quota on Walrus Protocol.',
        suggestion:
          'Delete some older todos or purchase additional storage capacity.',
        canRetry: false,
        severity: ErrorSeverity.HIGH,
        category: WalrusErrorCategory.QUOTA,
        technicalDetails: error.message,
      };
    }

    // Generic Walrus error
    return {
      title: 'Walrus Storage Error',
      message: 'An error occurred while communicating with Walrus Protocol.',
      suggestion: 'Please try again. If the problem persists, contact support.',
      canRetry: true,
      severity: ErrorSeverity.MEDIUM,
      category: WalrusErrorCategory.STORAGE,
      technicalDetails: error.message,
    };
  }

  /**
   * Analyze generic JavaScript errors
   */
  private static analyzeGenericError(error: Error): UserErrorInfo {
    const message = error.message.toLowerCase();

    // Network errors
    if (
      message.includes('fetch') ||
      message.includes('network') ||
      message.includes('cors') ||
      message.includes('timeout')
    ) {
      return {
        title: 'Network Error',
        message: 'A network error occurred while processing your request.',
        suggestion: 'Check your internet connection and try again.',
        canRetry: true,
        severity: ErrorSeverity.MEDIUM,
        category: WalrusErrorCategory.NETWORK,
        technicalDetails: error.message,
      };
    }

    // Permission errors
    if (
      message.includes('permission') ||
      message.includes('denied') ||
      message.includes('forbidden') ||
      message.includes('unauthorized')
    ) {
      return {
        title: 'Permission Denied',
        message: "You don't have permission to perform this operation.",
        suggestion:
          'Make sure your wallet is connected and you have the necessary permissions.',
        canRetry: false,
        severity: ErrorSeverity.HIGH,
        category: WalrusErrorCategory.PERMISSION,
        technicalDetails: error.message,
      };
    }

    // Generic error
    return {
      title: 'Unexpected Error',
      message: 'An unexpected error occurred.',
      suggestion: 'Please try again. If the problem persists, contact support.',
      canRetry: true,
      severity: ErrorSeverity.MEDIUM,
      category: WalrusErrorCategory.UNKNOWN,
      technicalDetails: error.message,
    };
  }

  /**
   * Create error info for unknown errors
   */
  private static createUnknownErrorInfo(errorString: string): UserErrorInfo {
    return {
      title: 'Unknown Error',
      message: 'An unknown error occurred.',
      suggestion: 'Please try again. If the problem persists, contact support.',
      canRetry: true,
      severity: ErrorSeverity.LOW,
      category: WalrusErrorCategory.UNKNOWN,
      technicalDetails: errorString,
    };
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: unknown): boolean {
    const errorInfo = this.analyzeError(error);
    return errorInfo.canRetry;
  }

  /**
   * Get suggested retry delay based on error type
   */
  static getRetryDelay(error: unknown, attempt: number): number {
    const errorInfo = this.analyzeError(error);

    // Base delays by category (in milliseconds)
    const baseDelays = {
      [WalrusErrorCategory.NETWORK]: 1000,
      [WalrusErrorCategory.STORAGE]: 2000,
      [WalrusErrorCategory.AUTHENTICATION]: 1500,
      [WalrusErrorCategory.QUOTA]: 5000,
      [WalrusErrorCategory.PERMISSION]: 3000,
      [WalrusErrorCategory.VALIDATION]: 0, // Don't retry validation errors
      [WalrusErrorCategory.UNKNOWN]: 2000,
    };

    const baseDelay = baseDelays[errorInfo.category] || 2000;

    // Exponential backoff with jitter
    return baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
  }
}

/**
 * Error recovery manager
 */
export class WalrusErrorRecovery {
  /**
   * Get recovery actions for an error
   */
  static getRecoveryActions(
    error: unknown,
    context?: {
      refreshWallet?: () => Promise<void>;
      refreshBalance?: () => Promise<void>;
      retryOperation?: () => Promise<void>;
      switchNetwork?: () => Promise<void>;
    }
  ): RecoveryAction[] {
    const errorInfo = WalrusErrorAnalyzer.analyzeError(error);
    const actions: RecoveryAction[] = [];

    switch (errorInfo.category) {
      case WalrusErrorCategory.NETWORK:
        if (context?.retryOperation) {
          actions.push({
            label: 'Retry',
            action: context.retryOperation,
            isPrimary: true,
          });
        }
        if (context?.switchNetwork) {
          actions.push({
            label: 'Switch Network',
            action: context.switchNetwork,
          });
        }
        break;

      case WalrusErrorCategory.AUTHENTICATION:
        if (context?.refreshWallet) {
          actions.push({
            label: 'Reconnect Wallet',
            action: context.refreshWallet,
            isPrimary: true,
          });
        }
        break;

      case WalrusErrorCategory.QUOTA:
        if (context?.refreshBalance) {
          actions.push({
            label: 'Check Balance',
            action: context.refreshBalance,
            isPrimary: true,
          });
        }
        actions.push({
          label: 'Get Test Tokens',
          action: () => {
            window.open(
              'https://docs.walrus.site/usage/web-api#testnet-wal-faucet',
              '_blank'
            );
          },
        });
        break;

      case WalrusErrorCategory.STORAGE:
        if (context?.retryOperation && errorInfo.canRetry) {
          actions.push({
            label: 'Retry',
            action: context.retryOperation,
            isPrimary: true,
          });
        }
        break;

      default:
        if (context?.retryOperation && errorInfo.canRetry) {
          actions.push({
            label: 'Try Again',
            action: context.retryOperation,
            isPrimary: true,
          });
        }
        break;
    }

    // Always add a help action if help URL is available
    if (errorInfo.helpUrl) {
      actions.push({
        label: 'Get Help',
        action: () => {
          window.open(errorInfo.helpUrl, '_blank');
        },
      });
    }

    return actions;
  }

  /**
   * Auto-recovery for certain error types
   */
  static async attemptAutoRecovery(
    error: unknown,
    context: {
      refreshWallet?: () => Promise<void>;
      refreshBalance?: () => Promise<void>;
      retryOperation?: () => Promise<void>;
    }
  ): Promise<boolean> {
    const errorInfo = WalrusErrorAnalyzer.analyzeError(error);

    // Don't auto-recover from high severity errors
    if (
      errorInfo.severity === ErrorSeverity.HIGH ||
      errorInfo.severity === ErrorSeverity.CRITICAL
    ) {
      return false;
    }

    try {
      switch (errorInfo.category) {
        case WalrusErrorCategory.NETWORK:
          if (context.retryOperation) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            await context.retryOperation();
            return true;
          }
          break;

        case WalrusErrorCategory.AUTHENTICATION:
          if (context.refreshWallet) {
            await context.refreshWallet();
            return true;
          }
          break;

        default:
          return false;
      }
    } catch (recoveryError) {
      console.warn('Auto-recovery failed:', recoveryError);
      return false;
    }

    return false;
  }
}

/**
 * Error logging and analytics
 */
export class WalrusErrorLogger {
  private static logs: Array<{
    timestamp: number;
    error: UserErrorInfo;
    context?: any;
  }> = [];

  /**
   * Log an error occurrence
   */
  static logError(error: unknown, context?: any): void {
    const errorInfo = WalrusErrorAnalyzer.analyzeError(error);

    this.logs.push({
      timestamp: Date.now(),
      error: errorInfo,
      context,
    });

    // Console log for development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🔴 Walrus Error: ${errorInfo.title}`);
      console.error('Message:', errorInfo.message);
      console.warn('Suggestion:', errorInfo.suggestion);
      console.log('Category:', errorInfo.category);
      console.log('Severity:', errorInfo.severity);
      if (errorInfo.technicalDetails) {
        console.log('Technical Details:', errorInfo.technicalDetails);
      }
      if (context) {
        console.log('Context:', context);
      }
      console.groupEnd();
    }

    // Here you could send to analytics service in production
    // this.sendToAnalytics(errorInfo, context);
  }

  /**
   * Get error statistics
   */
  static getErrorStats(): {
    totalErrors: number;
    errorsByCategory: Record<WalrusErrorCategory, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    recentErrors: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const recentErrors = this.logs.filter(
      log => log.timestamp > oneHourAgo
    ).length;

    const errorsByCategory = Object.values(WalrusErrorCategory).reduce(
      (acc, category) => {
        acc[category] = this.logs.filter(
          log => log.error.category === category
        ).length;
        return acc;
      },
      {} as Record<WalrusErrorCategory, number>
    );

    const errorsBySeverity = Object.values(ErrorSeverity).reduce(
      (acc, severity) => {
        acc[severity] = this.logs.filter(
          log => log.error.severity === severity
        ).length;
        return acc;
      },
      {} as Record<ErrorSeverity, number>
    );

    return {
      totalErrors: this.logs.length,
      errorsByCategory,
      errorsBySeverity,
      recentErrors,
    };
  }

  /**
   * Clear error logs
   */
  static clearLogs(): void {
    this.logs = [];
  }
}

// Export utility function for easy error handling
export function handleWalrusError(
  error: unknown,
  context?: any
): UserErrorInfo {
  WalrusErrorLogger.logError(error, context);
  return WalrusErrorAnalyzer.analyzeError(error);
}

// Classes and types are already exported above
