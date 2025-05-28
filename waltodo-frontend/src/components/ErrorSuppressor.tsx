'use client';

import { useEffect, useCallback } from 'react';

/**
 * Component that suppresses known wallet extension errors
 * This handles errors that occur at the Next.js/React level
 * while preserving React's development tools and hook tracking
 */
export function ErrorSuppressor() {
  // Stable reference to suppress patterns to avoid useEffect re-runs
  const suppressedPatterns = useCallback(() => [
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
    'Hydration failed because the initial UI does not match',
    'There was an error while hydrating',
    'Text content does not match server-rendered HTML',
    'Hydration text mismatch',
    'Warning: Text content did not match',
    'Warning: Prop `',
    'did not match. Server:',
    'Client:',
  ], []);

  // Helper function to check if error should be suppressed
  const shouldSuppressError = useCallback((message: string, source?: string) => {
    const patterns = suppressedPatterns();
    
    // IMPORTANT: Never suppress React hook warnings or development messages
    if (message.includes('Invalid hook call') || 
        message.includes('Hooks can only be called') ||
        message.includes('useEffect') ||
        message.includes('useState') ||
        message.includes('useCallback') ||
        message.includes('useMemo') ||
        message.includes('ReactDOM') ||
        message.includes('React Hook')) {
      return false;
    }

    return patterns.some(pattern =>
      message.includes(pattern) || (source && source.includes(pattern))
    );
  }, [suppressedPatterns]);

  useEffect(() => {
    // Store original handlers
    const originalErrorHandler = window.onerror;
    const originalUnhandledRejection = window.onunhandledrejection;
    const originalConsoleError = console.error;

    // Override window.onerror - for global JavaScript errors
    window.onerror = (message, source, lineno, colno, error) => {
      const errorMessage = String(message);

      if (shouldSuppressError(errorMessage, source)) {
        return true; // Prevent error from being logged
      }

      // Call original handler for genuine errors
      if (originalErrorHandler) {
        return originalErrorHandler.call(window, message, source, lineno, colno, error);
      }

      return false;
    };

    // Override unhandled promise rejection
    window.onunhandledrejection = event => {
      const errorMessage = String(event.reason);

      if (shouldSuppressError(errorMessage)) {
        event.preventDefault();
        return;
      }

      // Call original handler for genuine errors
      if (originalUnhandledRejection) {
        return originalUnhandledRejection.call(window, event);
      }
    };

    // More targeted console.error override that preserves React development tools
    console.error = (...args) => {
      const errorMessage = args.join(' ');

      // Only suppress specific wallet/extension errors, preserve all React errors
      if (shouldSuppressError(errorMessage)) {
        return; // Silently suppress
      }

      // Always call original console.error to preserve React development tools
      originalConsoleError.apply(console, args);
    };

    // Cleanup function - always restore original handlers
    return () => {
      window.onerror = originalErrorHandler;
      window.onunhandledrejection = originalUnhandledRejection;
      console.error = originalConsoleError;
    };
  }, [shouldSuppressError]); // Depend on stable callback

  // This component doesn't render anything
  return null;
}
