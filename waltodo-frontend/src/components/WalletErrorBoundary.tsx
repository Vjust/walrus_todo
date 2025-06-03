'use client';

/**
 * WalletErrorBoundary - Error boundary specifically for wallet-related failures
 * 
 * Catches and handles errors from wallet operations, providing graceful fallbacks
 * and recovery options for users when wallet features fail
 */

import React, { Component, ReactNode } from 'react';
import { analytics } from '@/lib/analytics';

interface WalletErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
  retryCount: number;
}

interface WalletErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
  maxRetries?: number;
  showRetry?: boolean;
  className?: string;
}

export class WalletErrorBoundary extends Component<WalletErrorBoundaryProps, WalletErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: WalletErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<WalletErrorBoundaryState> {
    // Update state to trigger fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log error details
    console.error('[WalletErrorBoundary] Wallet error caught:', error, errorInfo);
    
    this.setState({
      errorInfo,
    });

    // Track error in analytics
    if (analytics) {
      analytics.trackError(error);
    }

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    
    if (this.state.retryCount >= maxRetries) {
      console.warn('[WalletErrorBoundary] Max retries reached');
      return;
    }

    console.log('[WalletErrorBoundary] Retrying wallet operation...');
    
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
    }));

    // Track retry attempt
    if (analytics) {
      analytics.trackWallet({
        action: 'error' as const,
        success: false,
      });
    }
  };

  handleReset = () => {
    console.log('[WalletErrorBoundary] Resetting error state...');
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    });

    // Track reset
    if (analytics) {
      analytics.trackWallet({
        action: 'connect' as const,
        success: true,
      });
    }
  };

  render() {
    if (this.state.hasError) {
      const { fallback, maxRetries = 3, showRetry = true, className = '' } = this.props;
      const { error, retryCount } = this.state;

      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Determine error type and provide appropriate messaging
      const isConnectionError = error?.message?.toLowerCase().includes('connect') || 
                              error?.message?.toLowerCase().includes('network') ||
                              error?.message?.toLowerCase().includes('timeout');
      
      const isWalletNotFound = error?.message?.toLowerCase().includes('not found') ||
                              error?.message?.toLowerCase().includes('not installed') ||
                              error?.message?.toLowerCase().includes('unavailable');

      const canRetry = showRetry && retryCount < maxRetries;

      return (
        <div className={`wallet-error-boundary bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
          <div className="flex items-start space-x-3">
            {/* Error Icon */}
            <div className="flex-shrink-0">
              <svg 
                className="w-6 h-6 text-red-500" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.348 15.5c-.77.833.192 2.5 1.732 2.5z" 
                />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-medium text-red-800 mb-2">
                {isWalletNotFound ? 'Wallet Not Available' : 
                 isConnectionError ? 'Connection Error' : 
                 'Wallet Error'}
              </h3>
              
              <div className="text-sm text-red-700 mb-4">
                {isWalletNotFound ? (
                  <p>
                    Your wallet extension was not detected. Please make sure you have a Sui wallet installed and enabled.
                  </p>
                ) : isConnectionError ? (
                  <p>
                    Unable to connect to your wallet. Please check your connection and try again.
                  </p>
                ) : (
                  <p>
                    An error occurred while interacting with your wallet. This may be temporary.
                  </p>
                )}
                
                {process.env.NODE_ENV === 'development' && error && (
                  <details className="mt-3 p-3 bg-red-100 rounded border text-xs">
                    <summary className="cursor-pointer font-medium">Technical Details</summary>
                    <pre className="mt-2 whitespace-pre-wrap text-red-800">
                      {error.message}
                      {error.stack && `\n\nStack:\n${error.stack}`}
                    </pre>
                  </details>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                {canRetry && (
                  <button
                    onClick={this.handleRetry}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Try Again ({maxRetries - retryCount} left)
                  </button>
                )}

                <button
                  onClick={this.handleReset}
                  className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Dismiss
                </button>

                {isWalletNotFound && (
                  <button
                    onClick={() => window.open('https://chromewebstore.google.com/detail/slush-%E2%80%94-a-sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil', '_blank')}
                    className="inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Install Wallet
                  </button>
                )}
              </div>

              {retryCount >= maxRetries && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800">
                    <strong>Still having issues?</strong> Try refreshing the page or check your wallet extension settings.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export function useWalletErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    console.error('[useWalletErrorBoundary] Error captured:', error);
    setError(error);
    
    if (analytics) {
      analytics.trackError(error);
    }
  }, []);

  return {
    error,
    resetError,
    captureError,
    hasError: error !== null,
  };
}

export default WalletErrorBoundary;