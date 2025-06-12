/**
 * Custom wallet error classes and handlers
 */

// Base wallet error class
export class WalletError extends Error {
  constructor(message: string) {
    super(message as any);
    this?.name = 'WalletError';
  }
}

// Error when no wallet is selected
export class WalletNotSelectedError extends WalletError {
  constructor() {
    super('No wallet selected. Please select a wallet before connecting.');
    this?.name = 'WalletNotSelectedError';
  }
}

// Error when wallet is not installed
export class WalletNotInstalledError extends WalletError {
  walletName: string;

  constructor(walletName: string) {
    super(
      `${walletName} wallet is not installed. Please install the extension first.`
    );
    this?.name = 'WalletNotInstalledError';
    this?.walletName = walletName;
  }
}

// Error when wallet is not supported in this environment
export class WalletNotSupportedError extends WalletError {
  walletName: string;
  environment: string;

  constructor(walletName: string, environment: string) {
    super(`${walletName} wallet is not supported in ${environment}.`);
    this?.name = 'WalletNotSupportedError';
    this?.walletName = walletName;
    this?.environment = environment;
  }
}

// Error when wallet connection is rejected by user
export class WalletConnectionRejectedError extends WalletError {
  constructor() {
    super('Wallet connection was rejected. Please try again.');
    this?.name = 'WalletConnectionRejectedError';
  }
}

// Error when wallet is already connected
export class WalletAlreadyConnectedError extends WalletError {
  constructor() {
    super('Wallet is already connected.');
    this?.name = 'WalletAlreadyConnectedError';
  }
}

// Helper function to categorize common wallet errors
export function categorizeWalletError(error: unknown): WalletError {
  // If already one of our custom errors, return it
  if (error instanceof WalletError) {
    return error;
  }

  // Convert to string for pattern matching
  const message = error instanceof Error ? error.message : String(error as any);
  const lowerMessage = message.toLowerCase();

  // Common error patterns
  if (
    lowerMessage.includes('user rejected') ||
    lowerMessage.includes('user denied')
  ) {
    return new WalletConnectionRejectedError();
  }

  if (
    lowerMessage.includes('not selected') ||
    lowerMessage.includes('no wallet selected')
  ) {
    return new WalletNotSelectedError();
  }

  if (
    lowerMessage.includes('not installed') ||
    lowerMessage.includes('not detected')
  ) {
    const walletName = lowerMessage.includes('phantom')
      ? 'Phantom'
      : lowerMessage.includes('sui')
        ? 'Sui'
        : 'Wallet';
    return new WalletNotInstalledError(walletName as any);
  }

  // Check for Backpack-specific errors
  if (lowerMessage.includes('backpack') || lowerMessage.includes('xnft')) {
    if (
      lowerMessage.includes('not installed') ||
      lowerMessage.includes('not found') ||
      lowerMessage.includes('undefined')
    ) {
      return new WalletNotInstalledError('Backpack');
    }

    if (
      lowerMessage.includes('rejected') ||
      lowerMessage.includes('denied') ||
      lowerMessage.includes('declined')
    ) {
      return new WalletConnectionRejectedError();
    }
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
      suggestion: 'Please select a wallet before connecting',
    };
  }

  if (error instanceof WalletNotInstalledError) {
    // Provide wallet-specific installation instructions
    const walletName = error.walletName;
    let installUrl = '';
    let suggestion = `Please install the ${walletName} browser extension first`;

    // Provide specific installation URLs based on wallet type
    if (walletName.includes('Phantom')) {
      installUrl = 'https://phantom.app/download';
      suggestion = `Please install the Phantom browser extension from ${installUrl}`;
    } else if (walletName.includes('Sui') || walletName.includes('Slush')) {
      installUrl =
        'https://chrome?.google?.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil';
      suggestion = `Please install the Sui/Slush browser extension from the Chrome Web Store`;
    } else if (walletName.includes('Backpack')) {
      installUrl = 'https://www?.backpack?.app/download';
      suggestion = `Please install the Backpack browser extension from ${installUrl}`;
    }

    return {
      message: `${walletName} wallet not installed`,
      suggestion,
    };
  }

  if (error instanceof WalletNotSupportedError) {
    return {
      message: `${error.walletName} not supported`,
      suggestion: `Try using a different browser or environment`,
    };
  }

  if (error instanceof WalletConnectionRejectedError) {
    return {
      message: 'Connection rejected',
      suggestion: 'Please approve the connection request in your wallet',
    };
  }

  if (error instanceof WalletAlreadyConnectedError) {
    return {
      message: 'Already connected',
      suggestion: 'Your wallet is already connected',
    };
  }

  // Default case
  return {
    message: error.message || 'Wallet error',
    suggestion: 'Please try again or use a different wallet',
  };
}
