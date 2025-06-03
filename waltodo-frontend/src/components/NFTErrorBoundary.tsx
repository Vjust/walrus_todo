'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Database, Mail, RefreshCw, Shield, Trash2, WifiOff } from 'lucide-react';
import { classifyError, errorPersistence, ErrorType, retryWithRecovery } from '../lib/error-recovery';
import { showError, showSuccess } from '../lib/error-handling';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorType: 'network' | 'walrus' | 'blockchain' | 'data' | 'unknown';
  showDetails: boolean;
  retryCount: number;
}

export class NFTErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: 'unknown',
      showDetails: false,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Determine error type based on error message or type
    let errorType: State['errorType'] = 'unknown';
    
    if (error.message.toLowerCase().includes('network') || 
        error.message.toLowerCase().includes('fetch') ||
        error.message.toLowerCase().includes('connection')) {
      errorType = 'network';
    } else if (error.message.toLowerCase().includes('walrus') ||
               error.message.toLowerCase().includes('blob') ||
               error.message.toLowerCase().includes('storage')) {
      errorType = 'walrus';
    } else if (error.message.toLowerCase().includes('blockchain') ||
               error.message.toLowerCase().includes('sui') ||
               error.message.toLowerCase().includes('transaction')) {
      errorType = 'blockchain';
    } else if (error.message.toLowerCase().includes('data') ||
               error.message.toLowerCase().includes('parse') ||
               error.message.toLowerCase().includes('invalid')) {
      errorType = 'data';
    }

    return {
      hasError: true,
      error,
      errorType,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('NFT Error Boundary caught an error:', error, errorInfo);
    }

    // Log error to external service in production
    this.logErrorToService(error, errorInfo);

    this.setState({
      errorInfo,
    });
  }

  logErrorToService = async (error: Error, errorInfo: ErrorInfo) => {
    // Use the new error persistence system
    const errorType = classifyError(error);
    
    try {
      await errorPersistence.saveError({
        id: `nft_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        type: errorType,
        message: `NFTErrorBoundary: ${error.message}`,
        stack: error.stack,
        retryCount: this.state.retryCount,
        recovered: false,
        recoveryAttempts: []
      });
    } catch (persistError) {
      console.error('Failed to persist error:', persistError);
    }

    console.log('NFT Error logged:', {
      message: error.message,
      type: errorType,
      timestamp: new Date().toISOString()
    });
  };

  handleRetry = async () => {
    const { error, retryCount } = this.state;
    
    if (error) {
      try {
        // Use error recovery system for retry
        await retryWithRecovery(
          async () => {
            // Reset state to trigger re-render
            this.setState(prevState => ({
              hasError: false,
              error: null,
              errorInfo: null,
              retryCount: prevState.retryCount + 1,
            }));
          },
          {
            errorType: classifyError(error),
            customStrategy: {
              maxRetries: 1,
              baseDelay: 0
            },
            silent: true
          }
        );
        
        showSuccess('Component recovered successfully');
      } catch (retryError) {
        showError({
          title: 'Recovery Failed',
          message: 'Unable to recover from error. Please refresh the page.',
          duration: 5000
        });
      }
    } else {
      // Simple retry without error recovery
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
      }));
    }
  };

  handleRefresh = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleClearCache = async () => {
    if (typeof window !== 'undefined') {
      try {
        // Clear NFT-related cache
        localStorage.removeItem('nft-cache');
        localStorage.removeItem('walrus-blobs');
        localStorage.removeItem('todo-nfts');
        // Clear session storage
        sessionStorage.clear();
        
        // Clear error logs
        await errorPersistence.clearErrors();
        console.log('Cache and error logs cleared');
        
        // Then retry
        await this.handleRetry();
      } catch (error) {
        console.error('Failed to clear cache:', error);
      }
    }
  };

  toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails,
    }));
  };

  getErrorIcon = () => {
    switch (this.state.errorType) {
      case 'network':
        return <WifiOff className="w-12 h-12 text-red-500" />;
      case 'walrus':
        return <Database className="w-12 h-12 text-orange-500" />;
      case 'blockchain':
        return <Shield className="w-12 h-12 text-purple-500" />;
      default:
        return <AlertCircle className="w-12 h-12 text-yellow-500" />;
    }
  };

  getErrorMessage = () => {
    const { error, errorType } = this.state;
    
    switch (errorType) {
      case 'network':
        return {
          title: 'Network Connection Issue',
          description: 'Unable to connect to the NFT service. Please check your internet connection.',
          suggestions: [
            'Check your internet connection',
            'Try refreshing the page',
            'Disable any VPN or proxy',
          ],
        };
      case 'walrus':
        return {
          title: 'Storage Service Error',
          description: 'There was an issue accessing the Walrus storage network.',
          suggestions: [
            'The storage network may be temporarily unavailable',
            'Try clearing your cache',
            'Wait a few moments and retry',
          ],
        };
      case 'blockchain':
        return {
          title: 'Blockchain Connection Error',
          description: 'Unable to interact with the Sui blockchain.',
          suggestions: [
            'Check your wallet connection',
            'Ensure you have sufficient SUI tokens',
            'Try switching to a different RPC endpoint',
          ],
        };
      case 'data':
        return {
          title: 'Data Processing Error',
          description: 'There was an issue processing NFT data.',
          suggestions: [
            'The NFT data may be corrupted',
            'Try clearing your cache',
            'Contact support if the issue persists',
          ],
        };
      default:
        return {
          title: 'Unexpected Error',
          description: error?.message || 'An unexpected error occurred while loading NFT data.',
          suggestions: [
            'Try refreshing the page',
            'Clear your browser cache',
            'Contact support if the issue persists',
          ],
        };
    }
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails, retryCount } = this.state;
      const errorMessage = this.getErrorMessage();
      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-50 to-orange-50 p-6 text-center">
              <div className="flex justify-center mb-4">
                {this.getErrorIcon()}
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {errorMessage.title}
              </h2>
              <p className="text-gray-600">
                {errorMessage.description}
              </p>
              {retryCount > 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  Retry attempt: {retryCount}
                </p>
              )}
            </div>

            {/* Suggestions */}
            <div className="p-6 border-b border-gray-200">
              <h3 className="font-semibold text-gray-700 mb-3">Suggestions:</h3>
              <ul className="space-y-2">
                {errorMessage.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-gray-400 mr-2">•</span>
                    <span className="text-gray-600">{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="p-6 bg-gray-50 flex flex-wrap gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
              
              <button
                onClick={this.handleRefresh}
                className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Page
              </button>
              
              <button
                onClick={this.handleClearCache}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear Cache
              </button>
              
              <a
                href="mailto:support@waltodo.app?subject=NFT Error Report"
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
              >
                <Mail className="w-4 h-4" />
                Contact Support
              </a>
            </div>

            {/* Technical Details (Dev Mode) */}
            {isDevelopment && error && (
              <div className="border-t border-gray-200">
                <button
                  onClick={this.toggleDetails}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-700">Technical Details</span>
                  {showDetails ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                
                {showDetails && (
                  <div className="p-4 bg-gray-900 text-gray-100 font-mono text-sm overflow-x-auto">
                    <div className="mb-4">
                      <h4 className="text-red-400 font-bold mb-2">Error Message:</h4>
                      <pre className="whitespace-pre-wrap">{error.message}</pre>
                    </div>
                    
                    {error.stack && (
                      <div className="mb-4">
                        <h4 className="text-red-400 font-bold mb-2">Stack Trace:</h4>
                        <pre className="whitespace-pre-wrap text-xs">{error.stack}</pre>
                      </div>
                    )}
                    
                    {errorInfo?.componentStack && (
                      <div>
                        <h4 className="text-red-400 font-bold mb-2">Component Stack:</h4>
                        <pre className="whitespace-pre-wrap text-xs">{errorInfo.componentStack}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Convenience hook for functional components
export function useNFTErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return {
    throwError: (error: Error) => setError(error),
    clearError: () => setError(null),
  };
}

// Higher-order component for wrapping components with NFT error boundary
export function withNFTErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithNFTErrorBoundaryComponent(props: P) {
    return (
      <NFTErrorBoundary fallback={fallback}>
        <Component {...props} />
      </NFTErrorBoundary>
    );
  };
}