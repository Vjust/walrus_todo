// WalletContext.tsx - Modern simplified wallet management for Sui blockchain
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { 
  createNetworkConfig,
  SuiClientProvider, 
  WalletProvider,
  useCurrentAccount,
  useConnectWallet,
  useDisconnectWallet,
  useSignAndExecuteTransaction,
  ConnectModal,
  useWallets,
} from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Transaction } from '@mysten/sui/transactions';
import { useInactivityTimer } from '@/hooks/useInactivityTimer';
import { initializeSuiClient } from '@/lib/sui-client';
import { getEffectiveNetworkConfig, switchNetworkConfig, type NetworkName } from '@/config';
// TODO: API client integration temporarily disabled

// Network Configuration using createNetworkConfig
const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl('testnet') },
  devnet: { url: getFullnodeUrl('devnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
});

// Types
export interface WalletContextType {
  // Connection state
  connected: boolean;
  connecting: boolean;
  account: { address: string } | null;
  address: string | null; // Add convenience property
  chainId: string | null;
  name: string | null;
  network: string; // Add convenience property
  
  // Wallet actions
  connect: () => void;
  disconnect: () => void;
  
  // Transaction handling
  signAndExecuteTransaction: (txb: Transaction) => Promise<any>;
  trackTransaction: (promise: Promise<any>, type: string) => Promise<any>;
  
  // Session management
  sessionExpired: boolean;
  resetSession: () => void;
  lastActivity: number;
  resetActivityTimer: () => void;
  
  // Transaction history
  transactionHistory: TransactionRecord[];
  transactions: TransactionRecord[]; // Alias for backward compatibility
  addTransaction: (tx: TransactionRecord) => void;
  
  // Network management
  currentNetwork: string;
  switchNetwork: (network: string) => void;
  
  // Error handling
  error: string | null;
  clearError: () => void;
  setError: (error: string | null) => void;

  // Modal control
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

export interface TransactionRecord {
  id: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: string; // ISO string timestamp
  type: string;
  details?: any;
}

// Create context
export const WalletContext = createContext<WalletContextType | null>(null);

// Hook to use wallet context - safe version that doesn't throw during SSR/initialization
export const useWalletContext = () => {
  const context = useContext(WalletContext);
  if (!context) {
    // Return null instead of throwing during SSR/initialization phase
    // Components should handle null context gracefully
    return null;
  }
  return context;
};

// Session timeout configuration (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Inner wallet context provider that uses the wallet hooks
function WalletContextProvider({ children }: { children: ReactNode }) {
  // Client-side tracking
  const [isClient, setIsClient] = useState(false);
  
  // Mysten dApp Kit hooks
  const account = useCurrentAccount();
  const { mutate: connectWallet, isPending: connecting } = useConnectWallet();
  const { mutate: disconnectWallet } = useDisconnectWallet();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const wallets = useWallets();
  
  // Local state - only initialize with client-safe defaults
  const [transactionHistory, setTransactionHistory] = useState<TransactionRecord[]>([]);
  const [currentNetwork, setCurrentNetwork] = useState('testnet');
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastActivity, setLastActivity] = useState(() => {
    // Only access Date.now() on client to avoid hydration mismatch
    return typeof window !== 'undefined' ? Date.now() : 0;
  });
  
  // TODO: WebSocket integration temporarily disabled
  // const { connect: connectWebSocket, disconnect: disconnectWebSocket, joinRoom, leaveRoom } = useWebSocket();
  
  // Session timeout with localStorage persistence
  const { 
    isActive, 
    resetActivityTimer: inactivityReset,
    lastActivity: inactivityLastActivity,
    timeUntilTimeout 
  } = useInactivityTimer({
    timeout: SESSION_TIMEOUT,
    onTimeout: () => {
      if (connected) {
        console.log('[WalletContext] Session expired due to inactivity');
        setSessionExpired(true);
        // Will trigger disconnect through effect below
      }
    },
    storageKey: 'waltodo-wallet-activity',
  });

  // Update lastActivity state when inactivity timer updates
  useEffect(() => {
    setLastActivity(inactivityLastActivity);
  }, [inactivityLastActivity]);

  // Reset activity timer wrapper that also updates local state
  const resetActivityTimer = useCallback(() => {
    inactivityReset();
    setLastActivity(Date.now());
  }, [inactivityReset]);
  
  // Client-side initialization effect
  useEffect(() => {
    setIsClient(true);
    setLastActivity(Date.now());
  }, []);

  // Connection state
  const connected = Boolean(account);

  // Handle wallet authentication with API
  // API authentication removed - using blockchain-first architecture

  // Simplified auto-reconnect logic - only runs once on component mount
  useEffect(() => {
    // Only run auto-reconnect on client side and when wallets are available
    if (!isClient || connected || connecting || wallets.length === 0) {
      return;
    }
    
    const attemptAutoReconnect = async () => {
      try {
        const lastWallet = localStorage.getItem('sui-wallet-last-connected');
        if (!lastWallet) return;
        
        const wallet = wallets.find(w => w.name === lastWallet);
        if (!wallet) {
          // Clean up invalid wallet reference
          localStorage.removeItem('sui-wallet-last-connected');
          return;
        }
        
        // Simple auto-reconnect attempt
        connectWallet(
          { wallet },
          {
            onSuccess: () => {
              resetActivityTimer();
            },
            onError: () => {
              // Clean up failed connection reference
              localStorage.removeItem('sui-wallet-last-connected');
            }
          }
        );
      } catch (error) {
        // Silent cleanup on error
        localStorage.removeItem('sui-wallet-last-connected');
      }
    };

    // Single attempt with delay to ensure proper initialization
    const timeoutId = setTimeout(attemptAutoReconnect, 1500);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [isClient, connected, connecting, wallets, connectWallet, resetActivityTimer]); // Add missing dependencies

  // Clear error when wallet state changes
  useEffect(() => {
    setError(null);
  }, [connected]);

  // Handle session expiry
  useEffect(() => {
    if (sessionExpired && connected) {
      disconnectWallet();
      try {
        localStorage.removeItem('sui-wallet-last-connected');
        localStorage.removeItem('waltodo-wallet-activity');
      } catch (error) {
        // Ignore localStorage errors
      }
      setTransactionHistory([]);
      setError('Your session has expired due to inactivity. Please reconnect your wallet.');
    }
  }, [sessionExpired, connected, disconnectWallet]);

  // Initialize Sui client when wallet connects
  useEffect(() => {
    if (connected && account?.address) {
      const initClient = async () => {
        try {
          const { isSuiClientInitialized } = await import('@/lib/sui-client');
          if (!isSuiClientInitialized()) {
            await initializeSuiClient(currentNetwork as any);
          }
        } catch (error) {
          setError('Failed to initialize blockchain connection. Some features may not work properly.');
        }
      };
      
      const timeoutId = setTimeout(initClient, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [connected, account?.address, currentNetwork]);

  // TODO: WebSocket connection management temporarily disabled
  // useEffect(() => {
  //   if (connected && account?.address) {
  //     console.log('[WalletContext] Wallet connected, initializing WebSocket...');
  //     connectWebSocket();
  //     
  //     // Join a room based on wallet address for personalized updates
  //     const userRoom = `user_${account.address}`;
  //     joinRoom(userRoom);
  //     
  //     // Also join the general todo updates room
  //     joinRoom('todo_updates');
  //   } else {
  //     console.log('[WalletContext] Wallet disconnected, closing WebSocket...');
  //     disconnectWebSocket();
  //   }
  //   
  //   return () => {
  //     if (account?.address) {
  //       leaveRoom(`user_${account.address}`);
  //       leaveRoom('todo_updates');
  //     }
  //   };
  // }, [connected, account?.address, connectWebSocket, disconnectWebSocket, joinRoom, leaveRoom]);

  const connect = useCallback(() => {
    setError(null);
    setIsModalOpen(true);
  }, []);

  const disconnect = useCallback(async () => {
    try {
      setError(null);
      // Disconnecting wallet...
      
      // TODO: API logout temporarily disabled
      
      disconnectWallet();
      try {
        localStorage.removeItem('sui-wallet-last-connected');
      } catch (error) {
        // Ignore localStorage errors
      }
      setTransactionHistory([]);
      // Wallet disconnected successfully
    } catch (error) {
      // Disconnect error
      setError('Failed to disconnect wallet');
    }
  }, [disconnectWallet]);

  const signAndExecuteTransaction = useCallback(async (txb: Transaction) => {
    try {
      setError(null);
      // Executing transaction...
      
      if (!connected) {
        throw new Error('No wallet connected');
      }
      
      const result = await signAndExecute({ transaction: txb });
      
      // Add to transaction history
      const transaction: TransactionRecord = {
        id: result.digest || Date.now().toString(),
        status: 'success',
        timestamp: new Date().toISOString(),
        type: 'transaction',
        details: result
      };
      
      setTransactionHistory(prev => [transaction, ...prev.slice(0, 49)]); // Keep last 50
      resetActivityTimer();
      
      // Transaction executed successfully
      return result;
    } catch (error) {
      // Transaction error
      setError(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }, [connected, signAndExecute, resetActivityTimer]);

  const addTransaction = useCallback((tx: TransactionRecord) => {
    setTransactionHistory(prev => [tx, ...prev.slice(0, 49)]);
  }, []);

  const switchNetwork = useCallback((network: string) => {
    try {
      // Validate and switch network configuration
      const networkConfig = switchNetworkConfig(network as NetworkName);
      setCurrentNetwork(network);
      setError(null);
      
      // Log successful network switch
      console.log(`Network switched to ${network}`);
      
      // Reset activity timer on network switch
      resetActivityTimer();
      
      // Note: Full network switching requires wallet reconnection
      // This would typically trigger a wallet reconnection flow
    } catch (error) {
      const errorMessage = `Failed to switch to ${network}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setError(errorMessage);
      console.error('Network switch failed:', error);
    }
  }, [resetActivityTimer]);

  const resetSession = useCallback(() => {
    // Resetting session
    setSessionExpired(false);
    resetActivityTimer();
  }, [resetActivityTimer]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // Simple transaction tracker
  const trackTransaction = useCallback(async (promise: Promise<any>, type: string) => {
    const txRecord: TransactionRecord = {
      id: Date.now().toString(),
      status: 'pending',
      timestamp: new Date().toISOString(),
      type,
    };
    
    addTransaction(txRecord);
    
    try {
      const result = await promise;
      txRecord.status = 'success';
      txRecord.details = result;
      setTransactionHistory(prev => prev.map(tx => tx.id === txRecord.id ? txRecord : tx));
      return result;
    } catch (error) {
      txRecord.status = 'failed';
      txRecord.details = { error: error instanceof Error ? error.message : 'Unknown error' };
      setTransactionHistory(prev => prev.map(tx => tx.id === txRecord.id ? txRecord : tx));
      throw error;
    }
  }, [addTransaction]);

  const contextValue: WalletContextType = {
    connected: isClient ? connected : false, // Ensure consistent SSR state
    connecting: isClient ? connecting : false,
    account: isClient ? account : null,
    address: isClient ? (account?.address || null) : null,
    chainId: currentNetwork,
    name: (isClient && connected) ? 'Sui Wallet' : null,
    network: currentNetwork,
    connect,
    disconnect,
    signAndExecuteTransaction,
    trackTransaction,
    sessionExpired: isClient ? sessionExpired : false,
    resetSession,
    transactionHistory: isClient ? transactionHistory : [],
    transactions: isClient ? transactionHistory : [], // Alias for backward compatibility
    addTransaction,
    currentNetwork,
    switchNetwork,
    error: isClient ? error : null,
    clearError,
    setError,
    isModalOpen: isClient ? isModalOpen : false,
    openModal,
    closeModal,
    lastActivity: isClient ? lastActivity : 0,
    resetActivityTimer,
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
      <div>
        <ConnectModal
          trigger={<button style={{ display: 'none' }}>Hidden trigger</button>}
          open={isModalOpen}
          onOpenChange={(open) => {
            setIsModalOpen(open);
            if (!open && connected && account) {
              // Save the connected wallet for future auto-reconnect
              try {
                localStorage.setItem('sui-wallet-last-connected', 'sui-wallet');
                resetActivityTimer();
              } catch (error) {
                // Ignore localStorage errors
              }
            }
          }}
        />
      </div>
    </WalletContext.Provider>
  );
}

// Custom hook for wallet usage
export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletContextProvider');
  }
  return context;
}

// Query client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 30000,
    },
  },
});

// Main app wallet provider component with multi-wallet support
export function AppWalletProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider 
        networks={networkConfig} 
        defaultNetwork="testnet"
      >
        <WalletProvider>
          <WalletContextProvider>
            {children}
          </WalletContextProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}