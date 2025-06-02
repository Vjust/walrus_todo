'use client';

import React, { Component, ReactNode } from 'react';

interface ProviderErrorBoundaryProps {
  children: ReactNode;
  providerName: string;
  fallback?: ReactNode;
}

interface ProviderErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * ProviderErrorBoundary - Specialized error boundary for provider initialization failures
 * 
 * This handles specific errors that occur during provider setup:
 * - Wallet provider initialization failures
 * - Network configuration errors
 * - Query client setup errors
 */
export class ProviderErrorBoundary extends Component<ProviderErrorBoundaryProps, ProviderErrorBoundaryState> {
  constructor(props: ProviderErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ProviderErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`${this.props.providerName} provider error:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="text-orange-600 mb-4">
              <svg className="h-16 w-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {this.props.providerName} Initialization Failed
            </h2>
            <p className="text-gray-600 mb-4">
              There was an issue setting up the {this.props.providerName.toLowerCase()}. 
              This might be due to network connectivity or browser compatibility.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Suggested fixes:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Check your internet connection</li>
                <li>• Refresh the page</li>
                <li>• Try a different browser</li>
                <li>• Disable browser extensions</li>
              </ul>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Refresh Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: undefined })}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Try Again
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-sm text-gray-500 cursor-pointer">Technical details</summary>
                <pre className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto max-h-32">
                  {this.state.error.message}
                  {this.state.error.stack && '\n\n' + this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}