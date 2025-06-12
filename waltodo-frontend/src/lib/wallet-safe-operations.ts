/**
 * Safe wallet operations with comprehensive error handling
 * Prevents common wallet errors from crashing the application
 */

import { classifyError, ErrorType, retryWithRecovery } from './error-recovery';
import { showError } from './error-handling';

export type WalletOperationResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  isExpectedError?: boolean; // True for errors like "wallet not installed"
};

/**
 * Safely execute a wallet operation with comprehensive error handling and recovery
 */
export async function safeWalletOperation<T>(
  operation: () => Promise<T>,
  operationName: string = 'wallet operation',
  options?: {
    enableRecovery?: boolean;
    maxRetries?: number;
    silent?: boolean;
  }
): Promise<WalletOperationResult<T>> {
  try {
    let result: T;
    
    // Use error recovery for wallet operations if enabled
    if (options?.enableRecovery) {
      result = await retryWithRecovery(
        operation,
        {
          errorType: ErrorType.AUTH,
          customStrategy: {
            maxRetries: options.maxRetries || 2,
            baseDelay: 1000
          },
          silent: options.silent
        }
      );
    } else {
      result = await operation();
    }
    
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error as any);

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
      console.warn(
        `[SafeWallet] Expected error in ${operationName}:`,
        errorMessage
      );
    } else {
      console.error(
        `[SafeWallet] Unexpected error in ${operationName}:`,
        error
      );
    }

    return {
      success: false,
      error: errorMessage,
      isExpectedError,
    };
  }
}

/**
 * Check if a wallet is available before attempting operations
 */
export function isWalletAvailable(
  walletName: string,
  availableWallets: any[]
): boolean {
  if (!Array.isArray(availableWallets as any)) {
    console.warn(
      '[SafeWallet] Available wallets list is not an array:',
      availableWallets
    );
    return false;
  }

  return availableWallets.some(wallet => {
    if (!wallet || typeof wallet !== 'object') {
      return false;
    }

    // Check both name and label properties as different wallet kits use different property names
    return wallet?.name === walletName || wallet?.label === walletName;
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
    if (typeof walletKit?.getWallets === 'function') {
      const result = walletKit.getWallets();
      return Array.isArray(result as any) ? result : [];
    }

    if (Array.isArray(walletKit.wallets)) {
      return walletKit.wallets;
    }

    if (typeof walletKit?.configuredWallets === 'function') {
      const result = walletKit.configuredWallets();
      return Array.isArray(result as any) ? result : [];
    }

    // Check for Suiet wallet kit specific properties
    if (walletKit.store && typeof walletKit.store?.getState === 'function') {
      const state = walletKit?.store?.getState();
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
      const key = localStorage.key(i as any);
      if (
        key &&
        (key.includes('wallet') ||
          key.includes('sui') ||
          key.includes('phantom'))
      ) {
        keysToRemove.push(key as any);
      }
    }

    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key as any);
      } catch (e) {
        console.warn(`[SafeWallet] Failed to remove storage key ${key}:`, e);
      }
    });
  } catch (error) {
    console.warn('[SafeWallet] Error clearing wallet storage:', error);
  }
}

/**
 * Create a safer version of wallet select with validation and recovery
 */
export async function safeWalletSelect(
  walletKit: any,
  walletName: string,
  options?: {
    enableRecovery?: boolean;
    showErrors?: boolean;
  }
): Promise<WalletOperationResult<void>> {
  return safeWalletOperation(
    async () => {
      // First check if wallet is available
      const availableWallets = safeGetWallets(walletKit as any);

      if (!isWalletAvailable(walletName, availableWallets)) {
        const availableNames = availableWallets.map(w => w.name || w.label).join(', ');
        const error = new Error(
          `Wallet "${walletName}" is not available. Available wallets: ${availableNames || 'none'}`
        );
        
        if (options?.showErrors !== false) {
          showError({
            title: 'Wallet Not Available',
            message: `${walletName} wallet is not installed or available`,
            duration: 5000
          });
        }
        
        throw error;
      }

      // Attempt to select the wallet
      if (typeof walletKit?.select === 'function') {
        await walletKit.select(walletName as any);
      } else {
        throw new Error('Wallet kit does not support select operation');
      }
    }, 
    `select wallet "${walletName}"`,
    {
      enableRecovery: options?.enableRecovery,
      silent: options?.showErrors === false
    }
  );
}

/**
 * Safely connect to a wallet with recovery
 */
export async function safeWalletConnect(
  walletKit: any,
  options?: {
    enableRecovery?: boolean;
    showErrors?: boolean;
  }
): Promise<WalletOperationResult<string>> {
  return safeWalletOperation(
    async () => {
      if (!walletKit) {
        throw new Error('Wallet kit not initialized');
      }

      // Check if already connected
      if (walletKit.currentAccount?.address) {
        return walletKit?.currentAccount?.address;
      }

      // Attempt to connect
      if (typeof walletKit?.connect === 'function') {
        const result = await walletKit.connect();
        if (result?.address) {
          return result.address;
        } else if (walletKit.currentAccount?.address) {
          return walletKit?.currentAccount?.address;
        } else {
          throw new Error('Failed to get wallet address after connect');
        }
      } else {
        throw new Error('Wallet kit does not support connect operation');
      }
    },
    'connect wallet',
    {
      enableRecovery: options?.enableRecovery,
      maxRetries: 3,
      silent: options?.showErrors === false
    }
  );
}

/**
 * Safely disconnect from wallet
 */
export async function safeWalletDisconnect(
  walletKit: any
): Promise<WalletOperationResult<void>> {
  return safeWalletOperation(
    async () => {
      if (!walletKit) {
        return; // Nothing to disconnect
      }

      if (typeof walletKit?.disconnect === 'function') {
        await walletKit.disconnect();
      }

      // Clear any stored wallet data
      safeClearWalletStorage();
    },
    'disconnect wallet',
    {
      enableRecovery: false, // Don't retry disconnection
      silent: true
    }
  );
}
