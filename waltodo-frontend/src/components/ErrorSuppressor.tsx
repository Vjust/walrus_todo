'use client';

import { useEffect } from 'react';

/**
 * Component that suppresses known wallet extension errors
 * This handles errors that occur at the Next.js/React level
 */
export function ErrorSuppressor() {
  useEffect(() => {
    // List of error patterns to suppress
    const suppressedPatterns = [
      'dApp.connect',
      'query #1',
      'query #2',
      'query #3',
      'dapp-interface.js',
      'opcgpfmipidbgpenhmajoajpbobppdil',
      'chrome-extension://',
      '[[ << query #',
      'Error: [[ << query #',
      'Invalid prop `type` supplied to `React.Fragment`',
      'React.Fragment can only have `key` and `children` props',
    ];

    // Store original error handler
    const originalErrorHandler = window.onerror;
    const originalUnhandledRejection = window.onunhandledrejection;

    // Override window.onerror
    window.onerror = (message, source, lineno, colno, error) => {
      const errorMessage = String(message);

      // Check if this error should be suppressed
      const shouldSuppress = suppressedPatterns.some(
        pattern =>
          errorMessage.includes(pattern) || (source && source.includes(pattern))
      );

      if (shouldSuppress) {
        // Prevent the error from being logged
        return true;
      }

      // Call original handler for genuine errors
      if (originalErrorHandler) {
        return originalErrorHandler.call(
          window,
          message,
          source,
          lineno,
          colno,
          error
        );
      }

      return false;
    };

    // Override unhandled promise rejection
    window.onunhandledrejection = event => {
      const errorMessage = String(event.reason);

      // Check if this error should be suppressed
      const shouldSuppress = suppressedPatterns.some(pattern =>
        errorMessage.includes(pattern)
      );

      if (shouldSuppress) {
        event.preventDefault();
        return;
      }

      // Call original handler for genuine errors
      if (originalUnhandledRejection) {
        return originalUnhandledRejection.call(window, event);
      }
    };

    // Override console.error to catch React/Next.js errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const errorMessage = args.join(' ');

      // Check if this error should be suppressed
      const shouldSuppress = suppressedPatterns.some(pattern =>
        errorMessage.includes(pattern)
      );

      if (shouldSuppress) {
        // Silently suppress the error
        return;
      }

      // Call original console.error for genuine errors
      originalConsoleError.apply(console, args);
    };

    // Cleanup function
    return () => {
      window.onerror = originalErrorHandler;
      window.onunhandledrejection = originalUnhandledRejection;
      console.error = originalConsoleError;
    };
  }, []);

  // This component doesn't render anything
  return null;
}
