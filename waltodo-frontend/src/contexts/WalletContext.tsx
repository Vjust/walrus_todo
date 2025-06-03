// WalletContext.tsx - Modern simplified wallet management for Sui blockchain
'use client';

import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { 
  createNetworkConfig,
  SuiClientProvider, 
  useConnectWallet,
  useCurrentAccount,
  useDisconnectWallet,
  useSignAndExecuteTransaction,
  useWallets,
  WalletProvider,
} from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Transaction } from '@mysten/sui/transactions';
import { useInactivityTimer } from '@/hooks/useInactivityTimer';
import { initializeSuiClient } from '@/lib/sui-client';
import { getEffectiveNetworkConfig, type NetworkName, switchNetworkConfig } from '@/config';
// TODO: API client integration temporarily disabled

// Safe network configuration factory - only create when needed on client
function createSafeNetworkConfig() {
  if (typeof window === 'undefined') {
    // Return empty config for SSR - will be properly initialized on client
    return { networkConfig: {} };
  }
  
  try {
    return createNetworkConfig({
      testnet: { url: getFullnodeUrl('testnet') },
      devnet: { url: getFullnodeUrl('devnet') },
      mainnet: { url: getFullnodeUrl('mainnet') },
    });
  } catch (error) {
    // Safe console logging
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[WalletContext] Failed to create network config, using defaults:', error);
    }
    return { networkConfig: {} };
  }
}

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

// Safe default context value for SSR and initialization
const createSafeDefaultContext = (): WalletContextType => ({
  connected: false,
  connecting: false,
  account: null,
  address: null,
  chainId: null,
  name: null,
  network: 'testnet',
  connect: () => {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[WalletContext] Connect called before initialization');
    }
  },
  disconnect: () => Promise.resolve(),
  signAndExecuteTransaction: () => Promise.reject(new Error('Wallet not initialized')),
  trackTransaction: () => Promise.reject(new Error('Wallet not initialized')),
  sessionExpired: false,
  resetSession: () => {},
  lastActivity: 0,
  resetActivityTimer: () => {},
  transactionHistory: [],
  transactions: [],
  addTransaction: () => {},
  currentNetwork: 'testnet',
  switchNetwork: () => {},
  error: null,
  clearError: () => {},
  setError: () => {},
  isModalOpen: false,
  openModal: () => {},
  closeModal: () => {},
});

// Hook to use wallet context - safe version that doesn't throw during SSR/initialization
export const useWalletContext = () => {
  const context = useContext(WalletContext);
  if (!context) {
    // Return safe defaults instead of null during SSR/initialization phase
    return createSafeDefaultContext();
  }
  return context;
};

// Session timeout configuration (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Client-only wrapper for wallet hooks to avoid SSR issues
function ClientOnlyWalletProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) {
    // Render with safe default context during SSR - ensures consistent initial render
    return (
      <WalletContext.Provider value={createSafeDefaultContext()}>
        {children}
      </WalletContext.Provider>
    );
  }
  
  // Only render actual wallet provider on client
  return <ActualWalletContextProvider>{children}</ActualWalletContextProvider>;
}

// Inner wallet context provider that uses the wallet hooks - only runs on client
function ActualWalletContextProvider({ children }: { children: ReactNode }) {
  // Mysten dApp Kit hooks - safe to use here as this only runs on client
  const account = useCurrentAccount();
  const { mutate: connectWallet, isPending: connecting } = useConnectWallet();
  const { mutate: disconnectWallet } = useDisconnectWallet();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const wallets = useWallets();
  
  // Local state - initialize with safe defaults
  const [transactionHistory, setTransactionHistory] = useState<TransactionRecord[]>([]);
  const [currentNetwork, setCurrentNetwork] = useState('testnet');
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastActivity, setLastActivity] = useState(0); // Always start with 0 for consistent SSR
  
  // TODO: WebSocket integration temporarily disabled
  // const { connect: connectWebSocket, disconnect: disconnectWebSocket, joinRoom, leaveRoom } = useWebSocket();
  
  // Session timeout with localStorage persistence - only on client
  const inactivityTimer = useInactivityTimer({
    timeout: SESSION_TIMEOUT,
    onTimeout: () => {
      if (connected && typeof window !== 'undefined') {
        if (typeof console !== 'undefined' && console.log) {
          console.log('[WalletContext] Session expired due to inactivity');
        }
        setSessionExpired(true);
        // Will trigger disconnect through effect below
      }
    },
    storageKey: 'waltodo-wallet-activity',
  });
  
  const { 
    isActive, 
    resetActivityTimer: inactivityReset,
    lastActivity: inactivityLastActivity,
    timeUntilTimeout 
  } = inactivityTimer;

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
    // Initialize lastActivity only on client to avoid hydration mismatch
    setLastActivity(Date.now());
  }, []);

  // Connection state
  const connected = Boolean(account);

  // Handle wallet authentication with API
  // API authentication removed - using blockchain-first architecture

  // Simplified auto-reconnect logic - only runs once on component mount
  useEffect(() => {
    // Only run auto-reconnect when wallets are available and not connected
    if (connected || connecting || wallets.length === 0) {
      return;
    }
    
    const attemptAutoReconnect = async () => {
      try {
        // Safe localStorage access
        const lastWallet = typeof window !== 'undefined' 
          ? localStorage.getItem('sui-wallet-last-connected')
          : null;
        if (!lastWallet) {return;}
        
        const wallet = wallets.find(w => w.name === lastWallet);
        if (!wallet) {
          // Clean up invalid wallet reference
          if (typeof window !== 'undefined') {
            localStorage.removeItem('sui-wallet-last-connected');
          }
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
              if (typeof window !== 'undefined') {
                localStorage.removeItem('sui-wallet-last-connected');
              }
            }
          }
        );
      } catch (error) {
        // Silent cleanup on error
        if (typeof window !== 'undefined') {
          localStorage.removeItem('sui-wallet-last-connected');
        }
      }
    };

    // Single attempt with delay to ensure proper initialization
    const timeoutId = setTimeout(attemptAutoReconnect, 1500);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [connected, connecting, wallets, connectWallet, resetActivityTimer]); // Remove isClient dependency

  // Clear error when wallet state changes
  useEffect(() => {
    setError(null);
  }, [connected]);

  // Handle session expiry
  useEffect(() => {
    if (sessionExpired && connected) {
      disconnectWallet();
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('sui-wallet-last-connected');
          localStorage.removeItem('waltodo-wallet-activity');
        } catch (error) {
          // Ignore localStorage errors
        }
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
    if (wallets.length > 0) {
      // Try to connect to the first available wallet
      const wallet = wallets[0];
      connectWallet(
        { wallet },
        {
          onSuccess: () => {
            resetActivityTimer();
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('sui-wallet-last-connected', wallet.name);
              } catch (error) {
                // Ignore localStorage errors
              }
            }
          },
          onError: (error) => {
            setError(`Failed to connect wallet: ${error.message}`);
          }
        }
      );
    } else {
      setError('No wallets detected. Please install a Sui wallet.');
    }
  }, [wallets, connectWallet, resetActivityTimer]);

  const disconnect = useCallback(async () => {
    try {
      setError(null);
      // Disconnecting wallet...
      
      // TODO: API logout temporarily disabled
      
      disconnectWallet();
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('sui-wallet-last-connected');
        } catch (error) {
          // Ignore localStorage errors
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
    try {
      // Validate and switch network configuration
      const networkConfig = switchNetworkConfig(network as NetworkName);
      setCurrentNetwork(network);
      setError(null);
      
      // Log successful network switch
      if (typeof console !== 'undefined' && console.log) {
        console.log(`Network switched to ${network}`);
      }
      
      // Reset activity timer on network switch
      resetActivityTimer();
      
      // Note: Full network switching requires wallet reconnection
      // This would typically trigger a wallet reconnection flow
    } catch (error) {
      const errorMessage = `Failed to switch to ${network}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setError(errorMessage);
      if (typeof console !== 'undefined' && console.error) {
        console.error('Network switch failed:', error);
      }
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
    connected,
    connecting,
    account,
    address: account?.address || null,
    chainId: currentNetwork,
    name: connected ? 'Sui Wallet' : null,
    network: currentNetwork,
    connect,
    disconnect,
    signAndExecuteTransaction,
    trackTransaction,
    sessionExpired,
    resetSession,
    transactionHistory,
    transactions: transactionHistory, // Alias for backward compatibility
    addTransaction,
    currentNetwork,
    switchNetwork,
    error,
    clearError,
    setError,
    isModalOpen,
    openModal,
    closeModal,
    lastActivity,
    resetActivityTimer,
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
      {/* Custom wallet connection modal will be implemented separately */}
    </WalletContext.Provider>
  );
}

// Custom hook for wallet usage - safe version that provides defaults
export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    // Return safe defaults instead of throwing during SSR/initialization phase
    return createSafeDefaultContext();
  }
  return context;
}

// Safe query client factory
function createSafeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 3,
        staleTime: 30000,
        // Ensure queries don't run during SSR
        enabled: typeof window !== 'undefined',
      },
      mutations: {
        retry: 2,
      },
    },
  });
}

// Error boundary for wallet provider
class WalletProviderErrorBoundary extends React.Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[WalletContext] Provider error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <WalletContext.Provider value={createSafeDefaultContext()}>
          {this.props.children}
        </WalletContext.Provider>
      );
    }

    return this.props.children;
  }
}

// Main app wallet provider component with multi-wallet support
export function AppWalletProvider({ children }: { children: ReactNode }) {
  // Create network config and query client safely
  const networkConfig = useMemo(() => createSafeNetworkConfig().networkConfig, []);
  const queryClient = useMemo(() => createSafeQueryClient(), []);
  
  return (
    <WalletProviderErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SuiClientProvider 
          networks={networkConfig} 
          defaultNetwork={Object.keys(networkConfig)[0] as any || 'testnet'}
        >
          <WalletProvider>
            <ClientOnlyWalletProvider>
              {children}
            </ClientOnlyWalletProvider>
          </WalletProvider>
        </SuiClientProvider>
      </QueryClientProvider>
    </WalletProviderErrorBoundary>
  );
}