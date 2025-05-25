'use client';

import React, { ReactNode, useEffect, useState } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
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

      setError(
        event.error instanceof Error
          ? event.error
          : new Error(String(event.error))
      );
      setHasError(true);

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

      // Only set error state for genuine errors that should show error UI
      setError(
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason))
      );
      setHasError(true);

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

  // Reset error state
  const resetError = () => {
    setHasError(false);
    setError(null);
  };

  // Default fallback UI
  const defaultFallback = (
    <div className='p-4 border border-red-500 rounded bg-red-50 text-red-900 m-4'>
      <h2 className='text-lg font-bold mb-2'>Something went wrong</h2>
      <p className='mb-2'>{error?.message || 'An unexpected error occurred'}</p>
      {process.env.NODE_ENV !== 'production' && error?.stack && (
        <pre className='text-xs mt-2 p-2 bg-red-100 overflow-auto max-h-[200px]'>
          {error.stack}
        </pre>
      )}
      <button
        onClick={resetError}
        className='mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'
      >
        Try Again
      </button>
    </div>
  );

  // Show the fallback UI if there's an error
  if (hasError) {
    return fallback || defaultFallback;
  }

  // Otherwise, render children normally
  return <>{children}</>;
}
