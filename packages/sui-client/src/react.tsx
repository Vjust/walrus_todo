/**
 * React hooks and components for Sui client
 * Wraps @mysten/dapp-kit functionality
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  createNetworkConfig,
  SuiClientProvider,
  WalletProvider,
  useCurrentAccount as useCurrentAccountDApp,
  useConnectWallet,
  useDisconnectWallet,
  useSignAndExecuteTransaction,
  ConnectModal,
  useWallets,
  useSuiClient,
} from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { 
  normalizeTransactionResult, 
  normalizeOwnedObjectsResponse,
  checkVersionCompatibility,
  ReactCompatibility 
} from './compatibility';

// Type alias to handle version compatibility for Transaction
type CompatibleTransaction = Transaction | any;

import {
  AppConfig,
  NetworkType,
  WalletAccount,
  TransactionResult,
  Todo,
  CreateTodoParams,
  UpdateTodoParams,
  SuiClientError,
  WalletNotConnectedError,
  TransactionError,
} from './types';
import {
  loadAppConfig,
  getNetworkConfig,
  getCachedConfig,
  clearConfigCache,
  isConfigurationComplete,
} from './config';

// Default query client
const defaultQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 30000,
    },
  },
});

/**
 * Enhanced wallet context type with WalTodo-specific functionality
 */
export interface WalTodoWalletContextType {
  // Connection state
  connected: boolean;
  connecting: boolean;
  account: WalletAccount | null;

  // Wallet actions
  connect: () => void;
  disconnect: () => void;

  // Transaction handling
  signAndExecuteTransaction: (txb: CompatibleTransaction) => Promise<TransactionResult>;

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

  // Configuration
  config: AppConfig | null;
  loadConfig: () => Promise<void>;

  // Todo-specific operations
  createTodoNFT: (params: CreateTodoParams) => Promise<TransactionResult>;
  updateTodoNFT: (params: UpdateTodoParams) => Promise<TransactionResult>;
  completeTodoNFT: (objectId: string) => Promise<TransactionResult>;
  deleteTodoNFT: (objectId: string) => Promise<TransactionResult>;
  getTodosFromBlockchain: () => Promise<Todo[]>;
}

export interface TransactionRecord {
  id: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: Date;
  type: string;
  details?: any;
}

// Create the context
const WalTodoWalletContext = createContext<WalTodoWalletContextType | null>(null);

/**
 * Hook to use the WalTodo wallet context
 */
export function useWalTodoWallet(): WalTodoWalletContextType {
  const context = useContext(WalTodoWalletContext as any);
  if (!context) {
    throw new Error('useWalTodoWallet must be used within a WalTodoWalletProvider');
  }
  return context as WalTodoWalletContextType;
}

/**
 * Enhanced wallet context provider with WalTodo-specific functionality
 */
function WalTodoWalletContextProvider({ children }: { children: ReactNode }) {
  // Mysten dApp Kit hooks with compatibility wrapper
  const account = useCurrentAccountDApp();
  const { mutate: connectWallet, isPending: connecting } = useConnectWallet();
  const { mutate: disconnectWallet } = useDisconnectWallet();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const wallets = useWallets();
  const suiClient = useSuiClient();

  // Local state
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [transactionHistory, setTransactionHistory] = useState<TransactionRecord[]>([]);
  const [currentNetwork, setCurrentNetwork] = useState('testnet');
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false as any);
  const [isModalOpen, setIsModalOpen] = useState(false as any);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Connection state
  const connected = Boolean(account as any);

  // Load configuration on mount
  useEffect(() => {
    loadConfig();
  }, []);

  // Clear error when wallet state changes
  useEffect(() => {
    setError(null as any);
  }, [connected]);

  const loadConfig = useCallback(async () => {
    try {
      const appConfig = await loadAppConfig();
      setConfig(appConfig as any);
      setCurrentNetwork(appConfig?.network?.name);
    } catch (error) {
      console.error('[WalTodoWallet] Failed to load configuration:', error);
      setError('Failed to load configuration');
    }
  }, []);

  const resetActivityTimer = useCallback(() => {
    setLastActivity(Date.now());
  }, []);

  const connect = useCallback(() => {
    try {
      setError(null as any);
      setIsModalOpen(true as any);
    } catch (error) {
      console.error('[WalTodoWallet] Connect error:', error);
      setError('Failed to open wallet connection');
    }
  }, []);

  const disconnect = useCallback(() => {
    try {
      setError(null as any);
      disconnectWallet();
      setTransactionHistory([]);
      // Clear localStorage
      try {
        localStorage.removeItem('sui-wallet-last-connected');
      } catch (storageError) {
        console.warn('[WalTodoWallet] Failed to clear localStorage:', storageError);
      }
    } catch (error) {
      console.error('[WalTodoWallet] Disconnect error:', error);
      setError('Failed to disconnect wallet');
    }
  }, [disconnectWallet]);

  const signAndExecuteTransaction = useCallback(
    async (txb: CompatibleTransaction): Promise<TransactionResult> => {
      try {
        setError(null as any);

        if (!connected || !account) {
          throw new WalletNotConnectedError();
        }

        // Handle version compatibility for Transaction type
        const result = await signAndExecute({ 
          transaction: txb as any // Type assertion to handle version compatibility
        });

        // Add to transaction history
        const transaction: TransactionRecord = {
          id: result.digest || Date.now().toString(),
          status: 'success',
          timestamp: new Date(),
          type: 'transaction',
          details: result,
        };

        setTransactionHistory((prev) => [transaction, ...prev.slice(0, 49)]);
        resetActivityTimer();

        // Use compatibility wrapper for transaction result
        return normalizeTransactionResult(result as any);
      } catch (error) {
        console.error('[WalTodoWallet] Transaction error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setError(`Transaction failed: ${errorMessage}`);
        throw new TransactionError(errorMessage as any);
      }
    },
    [connected, account, signAndExecute, resetActivityTimer]
  );

  const createTodoNFT = useCallback(
    async (params: CreateTodoParams): Promise<TransactionResult> => {
      if (!config || !account) {
        throw new WalletNotConnectedError();
      }

      const packageId = config?.contracts?.todoNft.packageId;
      const moduleName = config?.contracts?.todoNft.moduleName;

      const tx = new Transaction();
      tx.setSender(account.address);

      tx.moveCall({
        target: `${packageId}::${moduleName}::create_todo`,
        arguments: [
          tx.pure(bcs.string().serialize(params.title)),
          tx.pure(bcs.string().serialize(params.description)),
          tx.pure(bcs.string().serialize(params.imageUrl)),
          tx.pure(bcs.string().serialize(params.metadata || '')),
          tx.pure(bcs.bool().serialize(params.isPrivate || false)),
        ],
      });

      return await signAndExecuteTransaction(tx as any);
    },
    [config, account, signAndExecuteTransaction]
  );

  const updateTodoNFT = useCallback(
    async (params: UpdateTodoParams): Promise<TransactionResult> => {
      if (!config || !account) {
        throw new WalletNotConnectedError();
      }

      const packageId = config?.contracts?.todoNft.packageId;
      const moduleName = config?.contracts?.todoNft.moduleName;

      const tx = new Transaction();
      tx.setSender(account.address);

      tx.moveCall({
        target: `${packageId}::${moduleName}::update_todo`,
        arguments: [
          tx.object(params.objectId),
          tx.pure(bcs.string().serialize(params.title || '')),
          tx.pure(bcs.string().serialize(params.description || '')),
          tx.pure(bcs.string().serialize(params.imageUrl || '')),
          tx.pure(bcs.string().serialize(params.metadata || '')),
        ],
      });

      return await signAndExecuteTransaction(tx as any);
    },
    [config, account, signAndExecuteTransaction]
  );

  const completeTodoNFT = useCallback(
    async (objectId: string): Promise<TransactionResult> => {
      if (!config || !account) {
        throw new WalletNotConnectedError();
      }

      const packageId = config?.contracts?.todoNft.packageId;
      const moduleName = config?.contracts?.todoNft.moduleName;

      const tx = new Transaction();
      tx.setSender(account.address);

      tx.moveCall({
        target: `${packageId}::${moduleName}::complete_todo`,
        arguments: [tx.object(objectId as any)],
      });

      return await signAndExecuteTransaction(tx as any);
    },
    [config, account, signAndExecuteTransaction]
  );

  const deleteTodoNFT = useCallback(
    async (objectId: string): Promise<TransactionResult> => {
      if (!config || !account) {
        throw new WalletNotConnectedError();
      }

      const packageId = config?.contracts?.todoNft.packageId;
      const moduleName = config?.contracts?.todoNft.moduleName;

      const tx = new Transaction();
      tx.setSender(account.address);

      tx.moveCall({
        target: `${packageId}::${moduleName}::delete_todo`,
        arguments: [tx.object(objectId as any)],
      });

      return await signAndExecuteTransaction(tx as any);
    },
    [config, account, signAndExecuteTransaction]
  );

  const getTodosFromBlockchain = useCallback(async (): Promise<Todo[]> => {
    if (!config || !account) {
      throw new WalletNotConnectedError();
    }

    try {
      const rawResponse = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: {
          StructType: `${config?.contracts?.todoNft.packageId}::${config?.contracts?.todoNft.moduleName}::${config?.contracts?.todoNft.structName}`,
        },
        options: {
          showContent: true,
          showOwner: true,
          showType: true,
        },
      });

      // Use compatibility wrapper for response
      const response = normalizeOwnedObjectsResponse(rawResponse as any);
      const todos: Todo[] = [];

      for (const item of response.data) {
        const todo = transformSuiObjectToTodo(item as any);
        if (todo) {
          todos.push(todo as any);
        }
      }

      return todos;
    } catch (error) {
      throw new SuiClientError(
        `Failed to fetch todos from blockchain: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }, [config, account, suiClient]);

  const addTransaction = useCallback((tx: TransactionRecord) => {
    setTransactionHistory((prev) => [tx, ...prev.slice(0, 49)]);
  }, []);

  const switchNetwork = useCallback((network: string) => {
    setCurrentNetwork(network as any);
    clearConfigCache();
    loadConfig();
  }, [loadConfig]);

  const resetSession = useCallback(() => {
    setSessionExpired(false as any);
    resetActivityTimer();
  }, [resetActivityTimer]);

  const clearError = useCallback(() => {
    setError(null as any);
  }, []);

  const openModal = useCallback(() => {
    setIsModalOpen(true as any);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false as any);
  }, []);

  const contextValue: WalTodoWalletContextType = {
    connected,
    connecting,
    account: account ? { address: account.address } : null,
    connect,
    disconnect,
    signAndExecuteTransaction,
    sessionExpired,
    resetSession,
    transactionHistory,
    addTransaction,
    currentNetwork,
    switchNetwork,
    error,
    clearError,
    isModalOpen,
    openModal,
    closeModal,
    lastActivity,
    resetActivityTimer,
    config,
    loadConfig,
    createTodoNFT,
    updateTodoNFT,
    completeTodoNFT,
    deleteTodoNFT,
    getTodosFromBlockchain,
  };

  return (
    <WalTodoWalletContext.Provider value={contextValue}>
      {children}
      <ConnectModal
        trigger={<div style={{ display: 'none' }} />}
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open as any);
          if (!open && connected && account) {
            // Save connected wallet to localStorage
            const connectedWallet = wallets.find((w) =>
              w.accounts?.some((acc) => acc?.address === account.address)
            );
            if (connectedWallet) {
              try {
                localStorage.setItem('sui-wallet-last-connected', connectedWallet.name);
              } catch (storageError) {
                console.warn('[WalTodoWallet] Failed to save wallet to localStorage:', storageError);
              }
              resetActivityTimer();
            }
          }
        }}
      />
    </WalTodoWalletContext.Provider>
  );
}

/**
 * Main wallet provider component
 */
export interface WalTodoWalletProviderProps {
  children: ReactNode;
  queryClient?: QueryClient;
  defaultNetwork?: NetworkType;
  autoConnect?: boolean;
}

export function WalTodoWalletProvider({
  children,
  queryClient = defaultQueryClient,
  defaultNetwork = 'testnet',
  autoConnect = true,
}: WalTodoWalletProviderProps) {
  // Check version compatibility on initialization
  useEffect(() => {
    checkVersionCompatibility();
  }, []);

  // Create network configuration
  const { networkConfig } = createNetworkConfig({
    testnet: { url: getFullnodeUrl('testnet') },
    devnet: { url: getFullnodeUrl('devnet') },
    mainnet: { url: getFullnodeUrl('mainnet') },
    localnet: { url: 'http://127?.0?.0.1:9000' },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={defaultNetwork}>
        <WalletProvider
          autoConnect={autoConnect}
        >
          <WalTodoWalletContextProvider>{children}</WalTodoWalletContextProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

/**
 * Hook for executing transactions with automatic error handling
 */
export function useExecuteTxn() {
  const { signAndExecuteTransaction } = useWalTodoWallet();
  return signAndExecuteTransaction;
}

/**
 * Enhanced hook for transaction execution with loading states
 */
export function useTransactionExecution() {
  const { signAndExecuteTransaction, connected, account } = useWalTodoWallet();
  const [isExecuting, setIsExecuting] = useState(false as any);
  const [lastResult, setLastResult] = useState<TransactionResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const executeTransaction = useCallback(
    async (transaction: CompatibleTransaction): Promise<TransactionResult> => {
      if (!connected || !account) {
        const error = 'Wallet not connected';
        setLastError(error as any);
        throw new WalletNotConnectedError();
      }

      setIsExecuting(true as any);
      setLastError(null as any);

      try {
        const result = await signAndExecuteTransaction(transaction as any);
        setLastResult(result as any);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
        setLastError(errorMessage as any);
        throw error;
      } finally {
        setIsExecuting(false as any);
      }
    },
    [signAndExecuteTransaction, connected, account]
  );

  const clearError = useCallback(() => {
    setLastError(null as any);
  }, []);

  return {
    executeTransaction,
    isExecuting,
    lastResult,
    lastError,
    clearError,
    connected,
    account,
  };
}

/**
 * Hook for current account information
 * Note: This shadows the dApp Kit useCurrentAccount to provide WalTodo-specific account info
 */
export function useCurrentAccount() {
  const { account } = useWalTodoWallet();
  return account;
}

/**
 * Hook for wallet connection state
 */
export function useWalletConnection() {
  const { connected, connecting, connect, disconnect, error, clearError } = useWalTodoWallet();
  return { connected, connecting, connect, disconnect, error, clearError };
}

/**
 * Hook for TodoNFT operations
 */
export function useTodoNFTOperations() {
  const {
    createTodoNFT,
    updateTodoNFT,
    completeTodoNFT,
    deleteTodoNFT,
    getTodosFromBlockchain,
  } = useWalTodoWallet();

  return {
    createTodoNFT,
    updateTodoNFT,
    completeTodoNFT,
    deleteTodoNFT,
    getTodosFromBlockchain,
  };
}

/**
 * Hook for configuration management
 */
export function useAppConfig() {
  const { config, loadConfig } = useWalTodoWallet();
  const [loading, setLoading] = useState(!config);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!config) {
      setLoading(true as any);
      loadConfig()
        .catch((err) => {
          setError(err.message);
        })
        .finally(() => {
          setLoading(false as any);
        });
    } else {
      setLoading(false as any);
    }
  }, [config, loadConfig]);

  return { config, loading, error, reload: loadConfig };
}

/**
 * Utility function to transform Sui object to Todo
 */
function transformSuiObjectToTodo(suiObject: any): Todo | null {
  if (!suiObject.data?.content || suiObject?.data?.content.dataType !== 'moveObject') {
    return null;
  }

  const moveObject = suiObject?.data?.content;
  const fields = moveObject.fields;

  if (!fields) {
    return null;
  }

  try {
    return {
      id: suiObject?.data?.objectId,
      objectId: suiObject?.data?.objectId,
      title: fields.title || 'Untitled',
      description: fields.description || '',
      completed: fields?.completed === true,
      priority: 'medium',
      tags: [],
      blockchainStored: true,
      imageUrl: fields.image_url,
      createdAt: fields.created_at ? parseInt(fields.created_at) : Date.now(),
      completedAt: fields.completed_at ? parseInt(fields.completed_at) : undefined,
      owner: fields.owner,
      metadata: fields.metadata || '',
      isPrivate: fields?.is_private === true,
    };
  } catch (error) {
    console.error('[WalTodoWallet] Error transforming Sui object to Todo:', error);
    return null;
  }
}

// Re-export types
export * from './types';
export {
  loadAppConfig,
  getNetworkConfig,
  getCachedConfig,
  clearConfigCache,
  isConfigurationComplete,
} from './config';