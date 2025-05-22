/**
 * Safe wallet operations with comprehensive error handling
 * Prevents common wallet errors from crashing the application
 */

export type WalletOperationResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  isExpectedError?: boolean; // True for errors like "wallet not installed"
};

/**
 * Safely execute a wallet operation with comprehensive error handling
 */
export async function safeWalletOperation<T>(
  operation: () => Promise<T>,
  operationName: string = 'wallet operation'
): Promise<WalletOperationResult<T>> {
  try {
    const result = await operation();
    return {
      success: true,
      data: result
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Categorize errors as expected or unexpected
    const isExpectedError = 
      errorMessage.includes('select failed: wallet') ||
      errorMessage.includes('is not available') ||
      errorMessage.includes('UNKNOWN_ERROR') ||
      errorMessage.includes('KIT.UNKNOWN_ERROR') ||
      errorMessage.includes('not installed') ||
      errorMessage.includes('rejected') ||
      errorMessage.includes('cancelled') ||
      errorMessage.includes('Access to storage is not allowed');
    
    if (isExpectedError) {
      console.warn(`[SafeWallet] Expected error in ${operationName}:`, errorMessage);
    } else {
      console.error(`[SafeWallet] Unexpected error in ${operationName}:`, error);
    }
    
    return {
      success: false,
      error: errorMessage,
      isExpectedError
    };
  }
}

/**
 * Check if a wallet is available before attempting operations
 */
export function isWalletAvailable(walletName: string, availableWallets: any[]): boolean {
  if (!Array.isArray(availableWallets)) {
    console.warn('[SafeWallet] Available wallets list is not an array:', availableWallets);
    return false;
  }
  
  return availableWallets.some(wallet => {
    if (!wallet || typeof wallet !== 'object') {
      return false;
    }
    
    // Check both name and label properties as different wallet kits use different property names
    return wallet.name === walletName || wallet.label === walletName;
  });
}

/**
 * Safely get available wallets with error handling
 */
export function safeGetWallets(walletKit: any): any[] {
  try {
    if (!walletKit) {
      return [];
    }
    
    // Try different methods that different wallet kits might use
    if (typeof walletKit.getWallets === 'function') {
      const result = walletKit.getWallets();
      return Array.isArray(result) ? result : [];
    }
    
    if (Array.isArray(walletKit.wallets)) {
      return walletKit.wallets;
    }
    
    if (typeof walletKit.configuredWallets === 'function') {
      const result = walletKit.configuredWallets();
      return Array.isArray(result) ? result : [];
    }
    
    // Check for Suiet wallet kit specific properties
    if (walletKit.store && typeof walletKit.store.getState === 'function') {
      const state = walletKit.store.getState();
      if (Array.isArray(state.wallets)) {
        return state.wallets;
      }
    }
    
    // Silently return empty array instead of warning to reduce console noise
    return [];
  } catch (error) {
    // Silently handle errors to reduce console noise
    return [];
  }
}

/**
 * Safely attempt to clear wallet data from storage
 */
export function safeClearWalletStorage(walletName?: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    if (walletName) {
      localStorage.removeItem('lastConnectedWallet');
    }
    
    // Clear any other wallet-related storage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('wallet') || key.includes('sui') || key.includes('phantom'))) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn(`[SafeWallet] Failed to remove storage key ${key}:`, e);
      }
    });
    
  } catch (error) {
    console.warn('[SafeWallet] Error clearing wallet storage:', error);
  }
}

/**
 * Create a safer version of wallet select with validation
 */
export async function safeWalletSelect(
  walletKit: any,
  walletName: string
): Promise<WalletOperationResult<void>> {
  return safeWalletOperation(async () => {
    // First check if wallet is available
    const availableWallets = safeGetWallets(walletKit);
    
    if (!isWalletAvailable(walletName, availableWallets)) {
      throw new Error(`Wallet "${walletName}" is not available. Available wallets: ${availableWallets.map(w => w.name || w.label).join(', ')}`);
    }
    
    // Attempt to select the wallet
    if (typeof walletKit.select === 'function') {
      await walletKit.select(walletName);
    } else {
      throw new Error('Wallet kit does not support select operation');
    }
  }, `select wallet "${walletName}"`);
}