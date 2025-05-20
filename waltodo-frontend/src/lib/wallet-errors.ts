/**
 * Custom wallet error classes and handlers
 */

// Base wallet error class
export class WalletError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletError';
  }
}

// Error when no wallet is selected
export class WalletNotSelectedError extends WalletError {
  constructor() {
    super('No wallet selected. Please select a wallet before connecting.');
    this.name = 'WalletNotSelectedError';
  }
}

// Error when wallet is not installed
export class WalletNotInstalledError extends WalletError {
  walletName: string;
  
  constructor(walletName: string) {
    super(`${walletName} wallet is not installed. Please install the extension first.`);
    this.name = 'WalletNotInstalledError';
    this.walletName = walletName;
  }
}

// Error when wallet is not supported in this environment
export class WalletNotSupportedError extends WalletError {
  walletName: string;
  environment: string;
  
  constructor(walletName: string, environment: string) {
    super(`${walletName} wallet is not supported in ${environment}.`);
    this.name = 'WalletNotSupportedError';
    this.walletName = walletName;
    this.environment = environment;
  }
}

// Error when wallet connection is rejected by user
export class WalletConnectionRejectedError extends WalletError {
  constructor() {
    super('Wallet connection was rejected. Please try again.');
    this.name = 'WalletConnectionRejectedError';
  }
}

// Error when wallet is already connected
export class WalletAlreadyConnectedError extends WalletError {
  constructor() {
    super('Wallet is already connected.');
    this.name = 'WalletAlreadyConnectedError';
  }
}

// Helper function to categorize common wallet errors
export function categorizeWalletError(error: unknown): WalletError {
  // If already one of our custom errors, return it
  if (error instanceof WalletError) {
    return error;
  }
  
  // Convert to string for pattern matching
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();
  
  // Common error patterns
  if (lowerMessage.includes('user rejected') || lowerMessage.includes('user denied')) {
    return new WalletConnectionRejectedError();
  }
  
  if (lowerMessage.includes('not selected') || lowerMessage.includes('no wallet selected')) {
    return new WalletNotSelectedError();
  }
  
  if (lowerMessage.includes('not installed') || lowerMessage.includes('not detected')) {
    const walletName = lowerMessage.includes('phantom') ? 'Phantom' : 
                       lowerMessage.includes('sui') ? 'Sui' : 'Wallet';
    return new WalletNotInstalledError(walletName);
  }
  
  // If we can't categorize, return a generic WalletError
  return new WalletError(
    error instanceof Error ? error.message : 'Unknown wallet error occurred'
  );
}

// Get user-friendly error message and suggested action
export function getWalletErrorMessage(error: WalletError): {
  message: string; 
  suggestion: string;
} {
  if (error instanceof WalletNotSelectedError) {
    return {
      message: 'No wallet selected',
      suggestion: 'Please select a wallet before connecting'
    };
  }
  
  if (error instanceof WalletNotInstalledError) {
    return {
      message: `${error.walletName} wallet not installed`,
      suggestion: `Please install the ${error.walletName} browser extension first`
    };
  }
  
  if (error instanceof WalletNotSupportedError) {
    return {
      message: `${error.walletName} not supported`,
      suggestion: `Try using a different browser or environment`
    };
  }
  
  if (error instanceof WalletConnectionRejectedError) {
    return {
      message: 'Connection rejected',
      suggestion: 'Please approve the connection request in your wallet'
    };
  }
  
  if (error instanceof WalletAlreadyConnectedError) {
    return {
      message: 'Already connected',
      suggestion: 'Your wallet is already connected'
    };
  }
  
  // Default case
  return {
    message: error.message || 'Wallet error',
    suggestion: 'Please try again or use a different wallet'
  };
}