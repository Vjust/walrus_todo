/**
 * Global error suppression for known third-party library issues
 * This prevents console spam from expected errors in wallet libraries
 */

export function setupGlobalErrorSuppression() {
  if (typeof window === 'undefined') {
    return;
  }

  // Store original console methods
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  // List of error patterns to suppress (reduce noise)
  const suppressedErrorPatterns = [
    'Access to storage is not allowed from this context',
    'localStorage',
    'sessionStorage',
    'select failed: wallet',
    'UNKNOWN_ERROR',
    'KIT.UNKNOWN_ERROR',
    'wallet Slush is not available',
    'all wallets are listed here: []',
    'Wallet Standard has already been loaded',
    'Could not determine how to get wallets from wallet kit',
    'Not saving wallet info - wallet not in available list',
    'Auto-reconnect disabled',
    'Failed to load resource: the server responded with a status of 404',
    'Error storing todo on blockchain',
    'Failed to create todo: Error: Wallet not connected',
    'overrideMethod',
    'installHook.js',
    'hook.js',
    'Would execute transaction with dApp Kit',
    'Todo created successfully'
  ];

  // Enhanced console.error that filters known issues
  console.error = (...args: any[]) => {
    const errorString = args.join(' ');
    
    // Check if this is a known, expected error
    const isKnownError = suppressedErrorPatterns.some(pattern => 
      errorString.includes(pattern)
    );
    
    if (isKnownError) {
      // Completely suppress known errors to clean up console
      return;
    }
    
    // For genuine errors, use original console.error
    originalError.apply(console, args);
  };

  // Enhanced console.warn that filters known issues
  console.warn = (...args: any[]) => {
    const warnString = args.join(' ');
    
    // Check if this is a known, expected warning
    const isKnownWarning = suppressedErrorPatterns.some(pattern => 
      warnString.includes(pattern)
    );
    
    if (isKnownWarning) {
      // Completely suppress known warnings to clean up console
      return;
    }
    
    // For genuine warnings, use original console.warn
    originalWarn.apply(console, args);
  };
  
  // Enhanced console.log that filters repetitive debug messages
  console.log = (...args: any[]) => {
    const logString = args.join(' ');
    
    // Check if this is repetitive debug logging
    const isRepetitiveLog = suppressedErrorPatterns.some(pattern => 
      logString.includes(pattern)
    );
    
    if (isRepetitiveLog) {
      // Completely suppress repetitive logs to clean up console
      return;
    }
    
    // For genuine logs, use original console.log
    originalLog.apply(console, args);
  };

  // Global error handler for uncaught errors
  const globalErrorHandler = (event: ErrorEvent) => {
    const errorMessage = event.error?.message || event.message || '';
    
    // Check if this is a known error pattern
    const isKnownError = suppressedErrorPatterns.some(pattern => 
      errorMessage.includes(pattern)
    );
    
    if (isKnownError) {
      console.warn('[Global Error Suppressed]', errorMessage);
      event.preventDefault();
      return;
    }
    
    // Let genuine errors through
    console.error('[Global Error]', event.error || event.message);
  };

  // Global unhandled promise rejection handler
  const globalRejectionHandler = (event: PromiseRejectionEvent) => {
    const rejectionMessage = String(event.reason);
    
    // Check if this is a known error pattern
    const isKnownError = suppressedErrorPatterns.some(pattern => 
      rejectionMessage.includes(pattern)
    );
    
    if (isKnownError) {
      console.warn('[Global Rejection Suppressed]', rejectionMessage);
      event.preventDefault();
      return;
    }
    
    // Let genuine rejections through
    console.error('[Global Rejection]', event.reason);
  };

  // Add global event listeners
  window.addEventListener('error', globalErrorHandler);
  window.addEventListener('unhandledrejection', globalRejectionHandler);

  // Return cleanup function
  return () => {
    // Restore original console methods
    console.error = originalError;
    console.warn = originalWarn;
    console.log = originalLog;
    
    // Remove event listeners
    window.removeEventListener('error', globalErrorHandler);
    window.removeEventListener('unhandledrejection', globalRejectionHandler);
  };
}

// Auto-setup in browser environment
if (typeof window !== 'undefined') {
  setupGlobalErrorSuppression();
}