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
  trackTransaction?: (promise: Promise<any>, type: string) => Promise<any>;
  
  // Session management
  sessionExpired: boolean;
  resetSession: () => void;
  lastActivity: number;
  resetActivityTimer: () => void;
  
  // Transaction history
  transactionHistory: TransactionRecord[];
  addTransaction: (tx: TransactionRecord) => void;
  
  // Network management
  currentNetwork: string;
  switchNetwork: (network: string) => void;
  
  // Error handling
  error: string | null;
  clearError: () => void;

  // Modal control
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

export interface TransactionRecord {
  id: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: Date;
  type: string;
  details?: any;
}

// Create context
export const WalletContext = createContext<WalletContextType | null>(null);

// Hook to use wallet context
export const useWalletContext = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletContext must be used within a WalletProvider');
  }
  return context;
};

// Session timeout configuration (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Inner wallet context provider that uses the wallet hooks
function WalletContextProvider({ children }: { children: ReactNode }) {
  // Component mount tracking
  const [componentMounted, setComponentMounted] = useState(false);
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
  
  // WebSocket integration - temporarily disabled
  // const { connect: connectWebSocket, disconnect: disconnectWebSocket, joinRoom, leaveRoom } = useWebSocket();
  
  // Session timeout - temporarily disabled for debugging
  const resetActivityTimer = useCallback(() => {
    console.log('[WalletContext] Activity timer reset (disabled)');
    setLastActivity(Date.now());
  }, []);
  const isActive = true;
  
  /*
  const { isActive, resetActivityTimer } = useInactivityTimer({
    timeout: SESSION_TIMEOUT,
    onTimeout: () => {
      if (connected) {
        console.log('[WalletContext] Session expired due to inactivity');
        setSessionExpired(true);
      }
    }
  });
  */
  
  // Client-side initialization effect
  useEffect(() => {
    setIsClient(true);
    setComponentMounted(true);
    // Initialize lastActivity with current time once we're on client
    setLastActivity(Date.now());
    
    return () => {
      setComponentMounted(false);
    };
  }, []);

  // Connection state
  const connected = Boolean(account);

  // Auto-reconnect logic with proper cleanup and mount guard
  useEffect(() => {
    // Only run auto-reconnect on client side
    if (!isClient || !componentMounted) return;
    
    let timeoutId: NodeJS.Timeout | null = null;
    let isMounted = true;

    const autoReconnect = async () => {
      if (!isMounted || !componentMounted || !isClient) return;
      
      try {
        let lastWallet = null;
        try {
          // Safe localStorage access with client-side check
          if (typeof window !== 'undefined' && window.localStorage) {
            lastWallet = localStorage.getItem('sui-wallet-last-connected');
          }
        } catch (storageError) {
          console.warn('[WalletContext] localStorage access failed:', storageError);
          return;
        }

        if (lastWallet && !connected && !connecting && wallets.length > 0 && isMounted && componentMounted && isClient) {
          console.log('[WalletContext] Attempting auto-reconnect to:', lastWallet);
          const wallet = wallets.find(w => w.name === lastWallet);
          if (wallet && isMounted && componentMounted && isClient) {
            connectWallet(
              { wallet },
              {
                onSuccess: () => {
                  if (isMounted) {
                    console.log('[WalletContext] Auto-reconnect successful');
                    resetActivityTimer();
                  }
                },
                onError: (error) => {
                  if (isMounted && typeof window !== 'undefined') {
                    console.error('[WalletContext] Auto-reconnect failed:', error);
                    try {
                      localStorage.removeItem('sui-wallet-last-connected');
                    } catch (storageError) {
                      console.warn('[WalletContext] Failed to remove localStorage item:', storageError);
                    }
                  }
                }
              }
            );
          }
        }
      } catch (error) {
        if (isMounted && typeof window !== 'undefined') {
          console.error('[WalletContext] Auto-reconnect error:', error);
          try {
            localStorage.removeItem('sui-wallet-last-connected');
          } catch (storageError) {
            console.warn('[WalletContext] Failed to remove localStorage item:', storageError);
          }
        }
      }
    };

    timeoutId = setTimeout(autoReconnect, 1000);
    
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [connected, connecting, wallets, connectWallet, resetActivityTimer, componentMounted, isClient]);

  // Clear error when wallet state changes
  useEffect(() => {
    setError(null);
  }, [connected]);

  // Initialize Sui client when wallet connects (but don't duplicate global initialization)
  useEffect(() => {
    if (connected && account?.address) {
      const initClient = async () => {
        try {
          console.log('[WalletContext] Checking Sui client state...');
          
          // Only initialize if not already done globally
          const { isSuiClientInitialized } = await import('@/lib/sui-client');
          if (!isSuiClientInitialized()) {
            console.log('[WalletContext] Sui client not initialized, initializing...');
            await initializeSuiClient(currentNetwork as any);
            console.log('[WalletContext] Sui client initialized successfully');
          } else {
            console.log('[WalletContext] Sui client already initialized');
          }
        } catch (error) {
          console.error('[WalletContext] Failed to initialize Sui client:', error);
          setError('Failed to initialize blockchain connection. Some features may not work properly.');
          // Don't block the app completely, just warn the user
        }
      };
      
      // Small delay to ensure global initialization has had a chance to complete
      const timeoutId = setTimeout(initClient, 200);
      return () => clearTimeout(timeoutId);
    }
  }, [connected, account?.address, currentNetwork]);

  // WebSocket connection management - temporarily disabled
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
    try {
      setError(null);
      console.log('[WalletContext] Opening wallet connection modal...');
      setIsModalOpen(true);
    } catch (error) {
      console.error('[WalletContext] Connect error:', error);
      setError('Failed to open wallet connection');
    }
  }, []);

  const disconnect = useCallback(() => {
    try {
      setError(null);
      console.log('[WalletContext] Disconnecting wallet...');
      disconnectWallet();
      // Safe localStorage access
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.removeItem('sui-wallet-last-connected');
        } catch (storageError) {
          console.warn('[WalletContext] Failed to remove localStorage item:', storageError);
        }
      }
      setTransactionHistory([]);
      console.log('[WalletContext] Wallet disconnected successfully');
    } catch (error) {
      console.error('[WalletContext] Disconnect error:', error);
      setError('Failed to disconnect wallet');
    }
  }, [disconnectWallet]);

  const signAndExecuteTransaction = useCallback(async (txb: Transaction) => {
    try {
      setError(null);
      console.log('[WalletContext] Executing transaction...');
      
      if (!connected) {
        throw new Error('No wallet connected');
      }
      
      const result = await signAndExecute({ transaction: txb });
      
      // Add to transaction history
      const transaction: TransactionRecord = {
        id: result.digest || Date.now().toString(),
        status: 'success',
        timestamp: new Date(),
        type: 'transaction',
        details: result
      };
      
      setTransactionHistory(prev => [transaction, ...prev.slice(0, 49)]); // Keep last 50
      resetActivityTimer();
      
      console.log('[WalletContext] Transaction executed successfully:', result);
      return result;
    } catch (error) {
      console.error('[WalletContext] Transaction error:', error);
      setError(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }, [connected, signAndExecute, resetActivityTimer]);

  const addTransaction = useCallback((tx: TransactionRecord) => {
    setTransactionHistory(prev => [tx, ...prev.slice(0, 49)]);
  }, []);

  const switchNetwork = useCallback((network: string) => {
    console.log('[WalletContext] Switching network to:', network);
    setCurrentNetwork(network);
    // Note: Network switching would require reconnecting with new network config
  }, []);

  const resetSession = useCallback(() => {
    console.log('[WalletContext] Resetting session');
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
      timestamp: new Date(),
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
    addTransaction,
    currentNetwork,
    switchNetwork,
    error: isClient ? error : null,
    clearError,
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
            if (!open) {
              // Modal was closed, save the connected wallet
              if (connected && account && typeof window !== 'undefined' && window.localStorage) {
                try {
                  localStorage.setItem('sui-wallet-last-connected', 'sui-wallet');
                } catch (storageError) {
                  console.warn('[WalletContext] Failed to save wallet to localStorage:', storageError);
                }
                resetActivityTimer();
              }
            }
          }}
        />
      </div>
    </WalletContext.Provider>
  );
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
        <WalletProvider 
          autoConnect
        >
          <WalletContextProvider>
            {children}
          </WalletContextProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}