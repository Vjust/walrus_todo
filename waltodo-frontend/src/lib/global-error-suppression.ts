/**
 * Reduced error suppression for wallet debugging
 * Only suppresses the most critical spam while allowing wallet detection errors to surface
 */

export function setupGlobalErrorSuppression() {
  if (typeof window === 'undefined') {
    return;
  }

  // Store original console methods
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  // Debug flag for wallet-related logging
  const WALLET_DEBUG = process.env.NODE_ENV === 'development' || window.localStorage?.getItem('wallet-debug') === 'true';

  // Reduced list - only suppress the most critical spam
  const criticalSuppressionPatterns = [
    // Browser extension injection warnings (pure spam)
    'overrideMethod',
    'installHook.js',
    'hook.js',
    'opcgpfmipidbgpenhmajoajpbobppdil',
    'chrome-extension://',
    
    // Known third-party library debug noise
    'dapp-interface.js',
    '[[ << query #',
    'Error: [[ << query #',
  ];

  // Wallet-related patterns that we now want to see (for debugging)
  const walletPatterns = [
    'wallet',
    'Wallet',
    'WALLET',
    'slush',
    'Slush',
    'SLUSH',
    'sui',
    'Sui',
    'SUI',
  ];

  // Enhanced console.error with wallet debugging
  console.error = (...args: any[]) => {
    const errorString = args.join(' ');

    // Check if this is critical spam that should be suppressed
    const isCriticalSpam = criticalSuppressionPatterns.some(pattern =>
      errorString.includes(pattern)
    );

    if (isCriticalSpam) {
      return; // Suppress critical spam
    }

    // Check if this is wallet-related
    const isWalletRelated = walletPatterns.some(pattern =>
      errorString.toLowerCase().includes(pattern.toLowerCase())
    );

    if (isWalletRelated && WALLET_DEBUG) {
      // Add debug prefix for wallet errors
      originalError('[WALLET-DEBUG]', ...args);
      return;
    }

    // For all other errors, use original console.error
    originalError(...args);
  };

  // Enhanced console.warn with wallet debugging
  console.warn = (...args: any[]) => {
    const warnString = args.join(' ');

    // Check if this is critical spam that should be suppressed
    const isCriticalSpam = criticalSuppressionPatterns.some(pattern =>
      warnString.includes(pattern)
    );

    if (isCriticalSpam) {
      return; // Suppress critical spam
    }

    // Check if this is wallet-related
    const isWalletRelated = walletPatterns.some(pattern =>
      warnString.toLowerCase().includes(pattern.toLowerCase())
    );

    if (isWalletRelated && WALLET_DEBUG) {
      // Add debug prefix for wallet warnings
      originalWarn('[WALLET-DEBUG]', ...args);
      return;
    }

    // For all other warnings, use original console.warn
    originalWarn(...args);
  };

  // Reduced console.log filtering - only suppress critical spam
  console.log = (...args: any[]) => {
    const logString = args.join(' ');

    // Check if this is critical spam that should be suppressed
    const isCriticalSpam = criticalSuppressionPatterns.some(pattern =>
      logString.includes(pattern)
    );

    if (isCriticalSpam) {
      return; // Suppress critical spam
    }

    // Check if this is wallet-related
    const isWalletRelated = walletPatterns.some(pattern =>
      logString.toLowerCase().includes(pattern.toLowerCase())
    );

    if (isWalletRelated && WALLET_DEBUG) {
      // Add debug prefix for wallet logs
      originalLog('[WALLET-DEBUG]', ...args);
      return;
    }

    // For all other logs, use original console.log
    originalLog(...args);
  };

  // Reduced global error handler - only suppress critical spam
  const globalErrorHandler = (event: ErrorEvent) => {
    const errorMessage = event.error?.message || event.message || '';

    // Check if this is critical spam that should be suppressed
    const isCriticalSpam = criticalSuppressionPatterns.some(pattern =>
      errorMessage.includes(pattern)
    );

    if (isCriticalSpam) {
      event.preventDefault();
      return;
    }

    // Check if this is wallet-related
    const isWalletRelated = walletPatterns.some(pattern =>
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );

    if (isWalletRelated && WALLET_DEBUG) {
      originalError('[WALLET-DEBUG] [Global Error]', event.error || event.message);
      return;
    }

    // Let all other errors through
    originalError('[Global Error]', event.error || event.message);
  };

  // Reduced global unhandled promise rejection handler
  const globalRejectionHandler = (event: PromiseRejectionEvent) => {
    const rejectionMessage = String(event.reason);

    // Check if this is critical spam that should be suppressed
    const isCriticalSpam = criticalSuppressionPatterns.some(pattern =>
      rejectionMessage.includes(pattern)
    );

    if (isCriticalSpam) {
      event.preventDefault();
      return;
    }

    // Check if this is wallet-related
    const isWalletRelated = walletPatterns.some(pattern =>
      rejectionMessage.toLowerCase().includes(pattern.toLowerCase())
    );

    if (isWalletRelated && WALLET_DEBUG) {
      originalError('[WALLET-DEBUG] [Global Rejection]', event.reason);
      return;
    }

    // Let all other rejections through
    originalError('[Global Rejection]', event.reason);
  };

  // Add global event listeners
  window.addEventListener('error', globalErrorHandler);
  window.addEventListener('unhandledrejection', globalRejectionHandler);

  // Log wallet debug status
  if (WALLET_DEBUG) {
    originalLog('[WALLET-DEBUG] Wallet debugging enabled. Set localStorage.wallet-debug = "false" to disable.');
  }

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

// Don't auto-setup - let the client component handle it
// This prevents issues during SSR/build
