'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
  useCallback,
} from 'react';
import { nanoid } from 'nanoid';
import {
  WalletProvider,
  useWallet,
  AllDefaultWallets,
} from '@suiet/wallet-kit';
import {
  createNetworkConfig,
  SuiClientProvider,
  WalletProvider as SuiWalletProvider,
  useCurrentAccount,
  useConnectWallet,
  useDisconnectWallet,
  useWallets,
} from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@suiet/wallet-kit/style.css';
import {
  WalletError,
  WalletNotInstalledError,
  WalletConnectionRejectedError,
  categorizeWalletError,
} from '@/lib/wallet-errors';
import {
  safeWalletOperation,
  safeGetWallets,
  isWalletAvailable,
  safeClearWalletStorage,
  safeWalletSelect,
} from '@/lib/wallet-safe-operations';
import { WalletType } from '@/types/wallet';

// Configure networks for Sui
const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
  devnet: { url: getFullnodeUrl('devnet') },
});

// Transaction status type
type TransactionStatus = 'pending' | 'success' | 'error';

// Transaction record interface
interface TransactionRecord {
  id: string;
  hash?: string;
  status: TransactionStatus;
  timestamp: number;
  type: string;
  message?: string;
}

// Enhanced context with additional features
interface WalletContextValue {
  // Connection state
  connected: boolean;
  connecting: boolean;

  // Wallet info
  address: string | null;
  chainId: string | null; // Network ID as string
  name: string | null;
  network: string | null;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchNetwork: (network: 'mainnet' | 'testnet' | 'devnet') => Promise<void>;

  // Transaction tracking
  transactions: TransactionRecord[];
  trackTransaction: <T extends { digest?: string }>(
    txPromise: Promise<T>,
    type: string
  ) => Promise<T>;

  // Error handling
  error: Error | null;
  setError: (error: Error | null) => void;

  // Activity timeout (security)
  lastActivity: number;
  resetActivityTimer: () => void;

  // Wallet capabilities
  signTransaction?: (transaction: unknown) => Promise<{ signature: Uint8Array; transactionBlockBytes: Uint8Array }>;
  signAndExecuteTransaction?: (transaction: unknown) => Promise<{ digest: string; effects?: unknown }>;
  signMessage?: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
}

// Create context with default values
const WalletContext = createContext<WalletContextValue | null>(null);

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Custom hook for inactivity timer
function useInactivityTimer(isConnected: boolean, onTimeout: () => void) {
  const [lastActivity, setLastActivity] = useState<number>(Date.now());

  const resetActivityTimer = useCallback(() => {
    setLastActivity(Date.now());
  }, []);

  useEffect(() => {
    if (!isConnected || typeof window === 'undefined') return;

    // Set up event listeners to track activity
    const activityEvents = ['mousedown', 'keydown', 'touchstart'];
    const handleActivity = () => resetActivityTimer();

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Auto-disconnect after inactivity
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastActivity > SESSION_TIMEOUT) {
        console.log('Session timeout due to inactivity');
        onTimeout();
      }
    }, 60000); // Check every minute

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(interval);
    };
  }, [isConnected, lastActivity, onTimeout, resetActivityTimer]);

  return { lastActivity, resetActivityTimer };
}

// Main wallet context provider component
function WalletContextProvider({ children }: { children: ReactNode }) {
  // Track wallet state
  const [error, setError] = useState<Error | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [currentNetwork, setCurrentNetwork] = useState<string>('testnet');

  // Get wallet from Mysten dApp Kit (primary wallet)
  const currentAccount = useCurrentAccount();
  const { mutate: connectWallet } = useConnectWallet();
  const { mutate: disconnectWallet } = useDisconnectWallet();
  const wallets = useWallets();

  // Fallback to Suiet kit for compatibility
  const suietWallet = useWallet();

  // Determine connection state prioritizing dApp Kit
  const connected = !!currentAccount || suietWallet.connected;
  const connecting = suietWallet.connecting; // Use Suiet's connecting state
  const account = currentAccount || suietWallet.account;
  const wallet = wallets[0] || null;

  // Debug wallet connection state (disabled to reduce console spam)
  // console.log('Checking sui wallet availability:', !!suietWallet);
  // console.log('Wallet connected state:', connected);
  // console.log('Current account:', !!currentAccount);
  // console.log('Suiet wallet connected:', suietWallet.connected);
  // console.log('Address:', account?.address || 'none');

  // Handle timeout with useCallback to maintain reference stability
  const handleTimeout = useCallback(() => {
    suietWallet
      .disconnect()
      .catch(_error => console.error('Error during auto-disconnect:', _error));
  }, [suietWallet]);

  // Use the inactivity timer hook
  const { lastActivity, resetActivityTimer } = useInactivityTimer(
    connected,
    handleTimeout
  );

  // Persist last connected wallet
  useEffect(() => {
    if (connected && wallet && typeof window !== 'undefined') {
      // Save wallet name for auto-reconnect, but only if the wallet is actually available
      try {
        const availableWallets = safeGetWallets(suietWallet);

        if (isWalletAvailable(wallet.name, availableWallets)) {
          localStorage.setItem('lastConnectedWallet', wallet.name);
        } else {
          console.warn(
            'Not saving wallet info - wallet not in available list:',
            wallet.name
          );
        }
      } catch (error) {
        console.warn('Failed to save wallet info to localStorage:', error);
      }
    }
  }, [connected, wallet, suietWallet]);

  // Clear any invalid wallet data on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Immediately clear any stored wallet data to prevent auto-selection issues
      try {
        const lastWallet = localStorage.getItem('lastConnectedWallet');
        if (lastWallet) {
          console.log(
            '[WalletContext] Found stored wallet:',
            lastWallet,
            'Clearing to prevent selection errors'
          );
          localStorage.removeItem('lastConnectedWallet');
        }
      } catch (error) {
        console.warn(
          '[WalletContext] Could not access storage to clear wallet data:',
          error
        );
      }
    }
  }, []); // Run only once on mount

  // Try to reconnect with the last used wallet on load (DISABLED for now to prevent errors)
  useEffect(() => {
    // TEMPORARILY DISABLED: Auto-reconnect is causing infinite error loops
    // Will re-enable once wallet selection is more stable
    console.log(
      '[WalletContext] Auto-reconnect disabled to prevent wallet selection errors'
    );
    return;

    const attemptReconnect = async () => {
      // Guard for SSR and ensure we have access to storage
      if (typeof window === 'undefined') return;

      try {
        const lastWallet = localStorage.getItem('lastConnectedWallet');
        if (lastWallet && !connected && !connecting) {
          // Use safe wallet operations to check availability and select
          const availableWallets = safeGetWallets(suietWallet);

          if (!isWalletAvailable(lastWallet, availableWallets)) {
            console.warn(
              `Saved wallet "${lastWallet}" is not available. Available wallets:`,
              availableWallets.map(w => w.name || w.label)
            );
            safeClearWalletStorage();
            return;
          }

          // Attempt to select the wallet safely
          const selectResult = await safeWalletSelect(suietWallet, lastWallet);

          if (!selectResult.success) {
            if (selectResult.isExpectedError) {
              console.warn(
                'Expected wallet selection error, clearing storage:',
                selectResult.error
              );
            } else {
              console.error(
                'Unexpected wallet selection error:',
                selectResult.error
              );
            }
            safeClearWalletStorage();
            return;
          }

          // Give the wallet selection a moment to process, then try to connect
          setTimeout(() => {
            if (
              'connect' in suietWallet &&
              typeof suietWallet.connect === 'function'
            ) {
              safeWalletOperation(
                () => (suietWallet.connect as Function)(),
                'auto-reconnect'
              ).then(connectResult => {
                if (!connectResult.success) {
                  console.warn('Auto-reconnect failed:', connectResult.error);
                  safeClearWalletStorage();
                }
              });
            }
          }, 500);
        }
      } catch (error) {
        console.warn('Error during wallet auto-reconnect:', error);
        // If there's any storage error, just skip auto-reconnect
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (errorMessage && errorMessage.includes('storage')) {
          console.warn('Storage access restricted, skipping auto-reconnect');
        }
      }
    };

    attemptReconnect();
  }, [connected, connecting, suietWallet]);

  // Enhanced connect function with error handling
  const connect = useCallback(async () => {
    resetActivityTimer();
    setError(null);

    try {
      // Try dApp Kit first, then fallback to Suiet
      if (wallets.length > 0) {
        connectWallet({ wallet: wallets[0] });
      } else {
        if (
          'connect' in suietWallet &&
          typeof suietWallet.connect === 'function'
        ) {
          await suietWallet.connect();
        }
      }
    } catch (err) {
      const walletError = categorizeWalletError(err);
      setError(walletError);
      console.error('Wallet connection error:', walletError);
      throw walletError;
    }
  }, [resetActivityTimer, connectWallet, wallets, suietWallet]);

  // Enhanced disconnect function with cleanup
  const disconnect = useCallback(async () => {
    resetActivityTimer();
    setError(null);

    try {
      // Disconnect from both providers
      if (currentAccount) {
        disconnectWallet();
      }
      if (suietWallet.connected) {
        await suietWallet.disconnect();
      }

      // Clear persisted wallet
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('lastConnectedWallet');
        }
      } catch (e) {
        console.warn('Failed to clear wallet from localStorage:', e);
      }
    } catch (err) {
      const walletError = categorizeWalletError(err);
      setError(walletError);
      console.error('Wallet disconnect error:', walletError);
      throw walletError;
    }
  }, [resetActivityTimer, disconnectWallet, currentAccount, suietWallet]);

  // Network switching functionality
  const switchNetwork = useCallback(
    async (network: 'mainnet' | 'testnet' | 'devnet') => {
      resetActivityTimer();

      if (!connected) {
        const err = new WalletError('Not connected to any wallet');
        setError(err);
        throw err;
      }

      try {
        // Update local network state
        setCurrentNetwork(network);

        // For Sui wallets, network switching is handled at the provider level
        // Emit custom event for network change
        if (typeof window !== 'undefined') {
          const networkEvent = new CustomEvent('walletNetworkChange', {
            detail: { network },
          });
          window.dispatchEvent(networkEvent);
        }
      } catch (err) {
        const walletError = categorizeWalletError(err);
        setError(walletError);
        console.error(`Network switch error:`, walletError);
        throw walletError;
      }
    },
    [connected, resetActivityTimer, setError]
  );

  // Transaction tracking function
  const trackTransaction = useCallback(
    async <T extends { digest?: string }>(
      txPromise: Promise<T>,
      type: string
    ): Promise<T> => {
      resetActivityTimer();

      // Create unique ID for tracking this transaction
      const txId = nanoid();

      // Add pending transaction to list
      const pendingTx: TransactionRecord = {
        id: txId,
        status: 'pending',
        timestamp: Date.now(),
        type,
      };

      setTransactions(prev => [pendingTx, ...prev]);

      try {
        // Wait for transaction to complete
        const result = await txPromise;

        // Get hash if available (results vary by transaction type)
        const hash = result.digest ? String(result.digest) : undefined;

        // Update transaction status to success
        setTransactions(prev =>
          prev.map(tx =>
            tx.id === txId ? { ...tx, status: 'success', hash } : tx
          )
        );

        return result;
      } catch (error) {
        // Update transaction status to error
        const message = error instanceof Error ? error.message : String(error);

        setTransactions(prev =>
          prev.map(tx =>
            tx.id === txId ? { ...tx, status: 'error', message } : tx
          )
        );

        throw error;
      }
    },
    [resetActivityTimer]
  );

  // Create context value with all wallet functions
  const contextValue = useMemo<WalletContextValue>(
    () => ({
      // Connection state
      connected,
      connecting,

      // Wallet info
      address: account?.address || null,
      chainId: currentNetwork,
      name: wallet?.name || null,
      network: currentNetwork,

      // Actions
      connect,
      disconnect,
      switchNetwork,

      // Transaction tracking
      transactions,
      trackTransaction,

      // Error handling
      error,
      setError,

      // Activity timeout (security)
      lastActivity,
      resetActivityTimer,

      // Wallet capabilities - prioritize dApp Kit when available
      signTransaction: currentAccount ? undefined : suietWallet.signTransaction,
      signAndExecuteTransaction: async (transaction: unknown) => {
        // Use the appropriate wallet provider for transaction execution
        if (currentAccount) {
          // For dApp Kit, we need to use the signAndExecuteTransactionBlock from the hooks
          // Since we can't use hooks here, we'll rely on the wallet being connected
          // and pass through to the Suiet wallet which handles both providers
          if (suietWallet.signAndExecuteTransaction) {
            return await suietWallet.signAndExecuteTransaction(transaction);
          }
          throw new Error('No transaction execution method available');
        } else {
          // Use Suiet wallet directly
          if (suietWallet.signAndExecuteTransaction) {
            return await suietWallet.signAndExecuteTransaction(transaction);
          }
          throw new Error(
            'Wallet not connected or signAndExecuteTransaction not available'
          );
        }
      },
      signMessage: async (message: Uint8Array) => {
        if (currentAccount) {
          // dApp Kit message signing would go here
          throw new Error('dApp Kit message signing not implemented');
        }
        // Convert Uint8Array to the expected format for Suiet wallet
        if (
          'signMessage' in suietWallet &&
          typeof suietWallet.signMessage === 'function'
        ) {
          return await suietWallet.signMessage({ message });
        }
        throw new Error('signMessage not available');
      },
    }),
    [
      connected,
      connecting,
      account,
      currentAccount,
      currentNetwork,
      wallet,
      transactions,
      error,
      lastActivity,
      connect,
      disconnect,
      switchNetwork,
      trackTransaction,
      resetActivityTimer,
      suietWallet,
    ]
  );

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}

// Query client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

// Wrapper component that includes both providers
export function AppWalletProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork='testnet'>
        <SuiWalletProvider>
          <WalletProvider
            defaultWallets={AllDefaultWallets}
            chains={[
              {
                id: 'mainnet',
                name: 'Mainnet',
                rpcUrl: 'https://fullnode.mainnet.sui.io:443',
              },
              {
                id: 'testnet',
                name: 'Testnet',
                rpcUrl: 'https://fullnode.testnet.sui.io:443',
              },
              {
                id: 'devnet',
                name: 'Devnet',
                rpcUrl: 'https://fullnode.devnet.sui.io:443',
              },
            ]}
            autoConnect={false}
          >
            <WalletContextProvider>{children}</WalletContextProvider>
          </WalletProvider>
        </SuiWalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

// Hook to use wallet context
export function useWalletContext() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletContext must be used within AppWalletProvider');
  }
  return context;
}

// Export types
export type { TransactionRecord, TransactionStatus, WalletContextValue };
