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
  
  // TODO: WebSocket integration temporarily disabled
  // const { connect: connectWebSocket, disconnect: disconnectWebSocket, joinRoom, leaveRoom } = useWebSocket();
  
  // Session timeout - temporarily disabled for debugging
  const resetActivityTimer = useCallback(() => {
    // Activity timer reset (disabled)
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

  // Handle wallet authentication with API
  // API authentication removed - using blockchain-first architecture

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
          // localStorage access failed
          return;
        }

        if (lastWallet && !connected && !connecting && wallets.length > 0 && isMounted && componentMounted && isClient) {
          // Attempting auto-reconnect
          const wallet = wallets.find(w => w.name === lastWallet);
          if (wallet && isMounted && componentMounted && isClient) {
            connectWallet(
              { wallet },
              {
                onSuccess: async () => {
                  if (isMounted) {
                    // Auto-reconnect successful
                    resetActivityTimer();
                    // TODO: Re-authenticate with API after auto-reconnect
                    if (account?.address) {
                      // TODO: API authentication temporarily disabled
                    }
                  }
                },
                onError: (error) => {
                  if (isMounted && typeof window !== 'undefined') {
                    // Auto-reconnect failed
                    try {
                      localStorage.removeItem('sui-wallet-last-connected');
                    } catch (storageError) {
                      // Failed to remove localStorage item
                    }
                  }
                }
              }
            );
          }
        }
      } catch (error) {
        if (isMounted && typeof window !== 'undefined') {
          // Auto-reconnect error
          try {
            localStorage.removeItem('sui-wallet-last-connected');
          } catch (storageError) {
            // Failed to remove localStorage item
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
  }, [connected, connecting, wallets, connectWallet, resetActivityTimer, componentMounted, isClient, account?.address]);

  // Clear error when wallet state changes
  useEffect(() => {
    setError(null);
  }, [connected]);

  // Initialize Sui client and authenticate with API when wallet connects
  useEffect(() => {
    if (connected && account?.address) {
      const initClient = async () => {
        try {
          // Checking Sui client state...
          
          // Only initialize if not already done globally
          const { isSuiClientInitialized } = await import('@/lib/sui-client');
          if (!isSuiClientInitialized()) {
            // Sui client not initialized, initializing...
            await initializeSuiClient(currentNetwork as any);
            // Sui client initialized successfully
          } else {
            // Sui client already initialized
          }
          
          // TODO: Authenticate with API
          // TODO: API authentication temporarily disabled
        } catch (error) {
          // Failed to initialize
          setError('Failed to initialize blockchain connection. Some features may not work properly.');
          // Don't block the app completely, just warn the user
        }
      };
      
      // Small delay to ensure global initialization has had a chance to complete
      const timeoutId = setTimeout(initClient, 200);
      return () => clearTimeout(timeoutId);
    } else if (!connected) {
      // TODO: Clear API authentication when wallet disconnects
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
    try {
      setError(null);
      // Opening wallet connection modal...
      setIsModalOpen(true);
    } catch (error) {
      // Connect error
      setError('Failed to open wallet connection');
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      setError(null);
      // Disconnecting wallet...
      
      // TODO: API logout temporarily disabled
      
      disconnectWallet();
      // Safe localStorage access
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.removeItem('sui-wallet-last-connected');
        } catch (storageError) {
          // Failed to remove localStorage item
        }
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
    // Switching network
    setCurrentNetwork(network);
    // Note: Network switching would require reconnecting with new network config
  }, []);

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
          onOpenChange={async (open) => {
            setIsModalOpen(open);
            if (!open) {
              // Modal was closed, save the connected wallet
              if (connected && account && typeof window !== 'undefined' && window.localStorage) {
                try {
                  localStorage.setItem('sui-wallet-last-connected', 'sui-wallet');
                  // TODO: Authenticate with API when wallet first connects
                } catch (storageError) {
                  // Failed to save wallet to localStorage
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