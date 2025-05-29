'use client';

import React, { ReactNode, useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

export function ErrorBoundary({ children, fallback, onError }: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [mounted, setMounted] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // Track mounting for hydration safety
    setMounted(true);
    
    // Only run in the browser
    if (typeof window === 'undefined') return;

    // Set up global error handler for uncaught errors
    const errorHandler = (event: ErrorEvent) => {
      console.error('[ErrorBoundary] Caught error:', event.error);

      // Special handling for storage access errors
      if (
        event.error?.message?.includes('Access to storage is not allowed') ||
        event.error?.message?.includes('localStorage') ||
        event.error?.message?.includes('sessionStorage')
      ) {
        console.warn(
          '[ErrorBoundary] Storage access error caught. Using in-memory fallback.'
        );
        // Don't set error state for these specific errors
        // They'll be handled by the storage utility's fallback

        // Still prevent default to stop error propagation
        event.preventDefault();
        return;
      }

      // Check if this is a critical error that needs user attention
      const criticalErrors = [
        'Error storing todo on blockchain',
        'Failed to create todo',
        'Failed to update todo',
        'Failed to delete todo',
        '404',
        '500',
        '503',
      ];

      const errorMessage = event.error?.message || '';
      const isCriticalError = criticalErrors.some(pattern => 
        errorMessage.includes(pattern)
      );

      const errorInstance = event.error instanceof Error
        ? event.error
        : new Error(String(event.error));

      if (isCriticalError) {
        // Show toast notification for critical errors
        toast.error(errorMessage || 'An unexpected error occurred', {
          duration: 5000,
          position: 'top-right',
        });
      }

      setError(errorInstance);
      setHasError(true);
      onError?.(errorInstance);

      // Prevent the error from propagating
      event.preventDefault();
    };

    // Set up handler for unhandled promise rejections
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      console.error('[ErrorBoundary] Unhandled rejection:', event.reason);

      // Special handling for storage access rejections
      const rejectionString = String(event.reason);
      if (
        rejectionString.includes('Access to storage is not allowed') ||
        rejectionString.includes('localStorage') ||
        rejectionString.includes('sessionStorage')
      ) {
        console.warn(
          '[ErrorBoundary] Storage access rejection caught. Using in-memory fallback.'
        );
        // Don't set error state for these specific errors

        // Still prevent default to stop error propagation
        event.preventDefault();
        return;
      }

      // Special handling for wallet errors that should not crash the app
      if (
        rejectionString.includes('select failed: wallet') ||
        rejectionString.includes('UNKNOWN_ERROR') ||
        rejectionString.includes('KIT.UNKNOWN_ERROR') ||
        rejectionString.includes('is not available') ||
        rejectionString.includes('wallet Slush') ||
        rejectionString.includes('all wallets are listed here: []') ||
        rejectionString.includes('Wallet Standard has already been loaded')
      ) {
        console.warn(
          '[ErrorBoundary] Wallet availability error suppressed. This is expected when wallets are not installed.'
        );
        // Don't set error state for wallet availability issues

        // Still prevent default to stop error propagation
        event.preventDefault();
        return;
      }

      // Check if this is a critical error
      const criticalErrors = [
        'Error storing todo on blockchain',
        'Failed to create todo',
        'Failed to update todo',
        'Failed to delete todo',
        '404',
        '500',
        '503',
      ];

      const isCriticalError = criticalErrors.some(pattern => 
        rejectionMessage.includes(pattern)
      );

      const errorInstance = event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));

      if (isCriticalError) {
        // Show toast notification for critical errors
        toast.error(rejectionMessage || 'An unexpected error occurred', {
          duration: 5000,
          position: 'top-right',
        });
      }

      // Only set error state for genuine errors that should show error UI
      setError(errorInstance);
      setHasError(true);
      onError?.(errorInstance);

      // Prevent the error from propagating
      event.preventDefault();
    };

    // Add event listeners
    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);

    // Clean up on unmount
    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
    };
  }, []);

  // Reset error state with retry functionality
  const resetError = useCallback(() => {
    setHasError(false);
    setError(null);
    setRetryCount(prev => prev + 1);
    
    // Show a toast that we're retrying
    toast.success('Retrying...', {
      duration: 2000,
      position: 'top-right',
    });
  }, []);

  // Enhanced default fallback UI with better error display
  const defaultFallback = (
    <div className='max-w-2xl mx-auto p-6 m-4'>
      <div className='bg-red-50 border border-red-200 rounded-lg p-6'>
        <div className='flex items-start'>
          <div className='flex-shrink-0'>
            <svg className='h-6 w-6 text-red-400' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' />
            </svg>
          </div>
          <div className='ml-3 flex-1'>
            <h3 className='text-lg font-medium text-red-800'>
              Oops! Something went wrong
            </h3>
            <div className='mt-2 text-sm text-red-700'>
              <p className='mb-2'>
                {error?.message || 'An unexpected error occurred while processing your request.'}
              </p>
              {retryCount > 0 && (
                <p className='text-xs text-red-600 mt-2'>
                  Retry attempts: {retryCount}
                </p>
              )}
            </div>
            {process.env.NODE_ENV !== 'production' && error?.stack && (
              <details className='mt-4'>
                <summary className='cursor-pointer text-sm text-red-600 hover:text-red-700'>
                  Show technical details
                </summary>
                <pre className='text-xs mt-2 p-3 bg-red-100 rounded overflow-auto max-h-[200px]'>
                  {error.stack}
                </pre>
              </details>
            )}
            <div className='mt-4 flex space-x-3'>
              <button
                onClick={resetError}
                className='px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors'
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className='px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors'
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className='mt-4 text-sm text-gray-500 text-center'>
        If this problem persists, please contact support.
      </div>
    </div>
  );

  // Always render consistent structure to prevent hydration mismatch
  // Use suppressHydrationWarning since error state differs between server/client
  return (
    <div suppressHydrationWarning>
      {hasError ? (fallback || defaultFallback) : children}
    </div>
  );
}
