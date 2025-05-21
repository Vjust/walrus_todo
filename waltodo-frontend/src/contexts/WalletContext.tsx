'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { WalletProvider, useWallet, AllDefaultWallets } from '@suiet/wallet-kit';
import '@suiet/wallet-kit/style.css';
import { 
  WalletError,
  WalletNotInstalledError,
  WalletConnectionRejectedError,
  categorizeWalletError 
} from '@/lib/wallet-errors';

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
  chainId: number | null; // Fixed: Changed to number | null to match networkId type
  name: string | null;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchNetwork: (network: 'mainnet' | 'testnet' | 'devnet') => Promise<void>;
  
  // Transaction tracking
  transactions: TransactionRecord[];
  trackTransaction: <T extends { digest?: string }>(txPromise: Promise<T>, type: string) => Promise<T>; // Constrained generic type
  
  // Error handling
  error: Error | null;
  setError: (error: Error | null) => void;
  
  // Activity timeout (security)
  lastActivity: number;
  resetActivityTimer: () => void;
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
    if (!isConnected) return;
    
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
  
  // Get wallet from Suiet kit
  const { 
    connected,
    connecting,
    account,
    wallet,
    networkId,
    select,
    connect: suietConnect,
    disconnect: suietDisconnect,
    executeMoveCall,
    executeSerializedMoveCall,
    signMessage,
    signAndExecuteTransaction,
    signTransaction,
    on,
    verifySignedMessage
  } = useWallet();

  // Handle timeout with useCallback to maintain reference stability
  const handleTimeout = useCallback(() => {
    suietDisconnect().catch(error => console.error('Error during auto-disconnect:', error));
  }, [suietDisconnect]);
  
  // Use the inactivity timer hook
  const { lastActivity, resetActivityTimer } = useInactivityTimer(connected, handleTimeout);

  // Persist last connected wallet
  useEffect(() => {
    if (connected && wallet && typeof window !== 'undefined') {
      // Save wallet name for auto-reconnect
      try {
        localStorage.setItem('lastConnectedWallet', wallet.name);
      } catch (error) {
        console.warn('Failed to save wallet info to localStorage:', error);
      }
    }
  }, [connected, wallet]);

  // Try to reconnect with the last used wallet on load
  useEffect(() => {
    const attemptReconnect = async () => {
      // Guard for SSR
      if (typeof window === 'undefined') return;
      
      try {
        const lastWallet = localStorage.getItem('lastConnectedWallet');
        if (lastWallet && !connected && !connecting) {
          // Attempt to select the wallet
          select(lastWallet);
          
          // Give the wallet selection a moment to process
          setTimeout(() => {
            suietConnect().catch(err => {
              console.warn('Auto-reconnect failed:', err);
              // Clear saved wallet if reconnect fails
              try {
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('lastConnectedWallet');
                }
              } catch (e) {
                console.warn('Failed to clear wallet from localStorage:', e);
              }
            });
          }, 500);
        }
      } catch (error) {
        console.warn('Error during wallet auto-reconnect:', error);
      }
    };
    
    attemptReconnect();
  }, [connected, connecting, select, suietConnect]);

  // Enhanced connect function with error handling
  const connect = useCallback(async () => {
    resetActivityTimer();
    setError(null);
    
    try {
      await suietConnect();
    } catch (err) {
      const walletError = categorizeWalletError(err);
      setError(walletError);
      console.error('Wallet connection error:', walletError);
      throw walletError;
    }
  }, [resetActivityTimer, suietConnect]);

  // Enhanced disconnect function with cleanup
  const disconnect = useCallback(async () => {
    resetActivityTimer();
    setError(null);
    
    try {
      await suietDisconnect();
      
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
  }, [resetActivityTimer, suietDisconnect]);

  // Network switching functionality
  const switchNetwork = useCallback(async (network: 'mainnet' | 'testnet' | 'devnet') => {
    resetActivityTimer();
    
    if (!connected || !wallet) {
      const err = new WalletError('Not connected to any wallet');
      setError(err);
      throw err;
    }
    
    try {
      // Handle network switching through the Suiet wallet
      await wallet.switchChain({ chainId: network });
      
      // When using Suiet wallet kit, the switchChain method will handle the switch
      // The UI will update automatically since we're using the Suiet hooks
      
      // For future reference, if we need to implement custom network switching logic:
      // 1. Add additional wallet check based on wallet.name or wallet.adapter
      // 2. Implement wallet-specific network switching logic
      // 3. Update UI state after successful switch
      
      // Example of custom handling for different wallet types:
      // if (wallet.name === 'Phantom' || wallet.name === 'Solflare') {
      //   const cluster = network === 'mainnet' ? 'mainnet-beta' : network;
      //   // Custom Solana network handling would go here
      // }
      
    } catch (err) {
      const walletError = categorizeWalletError(err);
      setError(walletError);
      console.error(`Network switch error:`, walletError);
      throw walletError;
    }
  }, [connected, resetActivityTimer, wallet, setError]);

  // Transaction tracking function
  const trackTransaction = useCallback(async <T extends { digest?: string }>(txPromise: Promise<T>, type: string): Promise<T> => {
    resetActivityTimer();
    
    // Create unique ID for tracking this transaction
    const txId = nanoid();
    
    // Add pending transaction to list
    const pendingTx: TransactionRecord = {
      id: txId,
      status: 'pending',
      timestamp: Date.now(),
      type
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
          tx.id === txId 
            ? { ...tx, status: 'success', hash } 
            : tx
        )
      );
      
      return result;
    } catch (error) {
      // Update transaction status to error
      const message = error instanceof Error ? error.message : String(error);
      
      setTransactions(prev => 
        prev.map(tx => 
          tx.id === txId 
            ? { ...tx, status: 'error', message } 
            : tx
        )
      );
      
      throw error;
    }
  }, [resetActivityTimer]);

  // Create context value with all wallet functions
  const contextValue = useMemo<WalletContextValue>(() => ({
    // Connection state
    connected,
    connecting,
    
    // Wallet info
    address: account?.address || null,
    chainId: networkId ?? null, // Fixed: Changed to match networkId type
    name: wallet?.name || null,
    
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
  }), [
    connected,
    connecting,
    account,
    networkId,
    wallet,
    transactions,
    error,
    lastActivity,
    connect,
    disconnect,
    switchNetwork,
    trackTransaction,
    resetActivityTimer
  ]);

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}

// Wrapper component that includes the Suiet provider
export function AppWalletProvider({ children }: { children: ReactNode }) {
  return (
    <WalletProvider
      defaultWallets={AllDefaultWallets}
      chains={['mainnet', 'testnet', 'devnet']}
      autoConnect={false}
    >
      <WalletContextProvider>
        {children}
      </WalletContextProvider>
    </WalletProvider>
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