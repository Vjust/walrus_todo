import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { TransactionRecord, WalletActions, WalletState } from './types';
import type { NetworkType } from '@/types/wallet';
import { defaultStorageConfig, persistSelectors, storageKeys } from './middleware/persist';
import { logger } from './middleware/logger';

/**
 * Initial state for wallet store
 */
const initialWalletState: WalletState = {
  // Connection state
  connection: {
    status: 'disconnected',
    address: null,
    network: 'testnet' as NetworkType,
    chainId: null,
    name: null,
  },
  
  // Session management
  session: {
    lastActivity: Date.now(),
    expired: false,
    timeoutWarning: false,
    autoDisconnectTime: 30 * 60 * 1000, // 30 minutes
  },
  
  // Transaction state
  transactions: {
    history: [],
    pending: {},
    lastTransaction: undefined,
  },
  
  // Capabilities
  capabilities: {
    signAndExecute: false,
    nftSupport: false,
    walrusSupport: false,
    networkSwitching: false,
  },
  
  // Error state
  error: null,
  
  // Modal state
  modalOpen: false,
};

/**
 * Wallet Store with comprehensive state management
 */
export const useWalletStore = create<WalletState & WalletActions>()(
  devtools(
    persist(
      subscribeWithSelector(
        logger(
          'Wallet Store',
          immer((set, get) => ({
            ...initialWalletState,

            // Connection actions
            connect: () => {
              set((state) => {
                state.connection.status = 'connecting';
                state.error = null;
              });
            },

            disconnect: () => {
              set((state) => {
                state.connection = {
                  status: 'disconnected',
                  address: null,
                  network: state.connection.network, // Keep network preference
                  chainId: null,
                  name: null,
                };
                state.session = {
                  ...initialWalletState.session,
                  lastActivity: Date.now(),
                };
                state.transactions.pending = {};
                state.capabilities = { ...initialWalletState.capabilities };
                state.error = null;
                state.modalOpen = false;
              });
            },

            setConnectionStatus: (status) => {
              set((state) => {
                state.connection.status = status;
                if (status === 'connected') {
                  state.session.lastActivity = Date.now();
                  state.session.expired = false;
                  state.session.timeoutWarning = false;
                  state.error = null;
                } else if (status === 'error') {
                  state.connection.address = null;
                  state.connection.name = null;
                  state.connection.chainId = null;
                }
              });
            },

            setAccount: (address, name) => {
              set((state) => {
                state.connection.address = address;
                state.connection.name = name || null;
                if (address) {
                  state.connection.status = 'connected';
                  state.session.lastActivity = Date.now();
                  state.session.expired = false;
                }
              });
            },

            setNetwork: (network, chainId) => {
              set((state) => {
                state.connection.network = network;
                state.connection.chainId = chainId || null;
              });
            },

            // Session actions
            updateActivity: () => {
              set((state) => {
                state.session.lastActivity = Date.now();
                state.session.expired = false;
                state.session.timeoutWarning = false;
              });
            },

            setSessionExpired: (expired) => {
              set((state) => {
                state.session.expired = expired;
                if (expired) {
                  state.connection.status = 'disconnected';
                  state.connection.address = null;
                  state.connection.name = null;
                  state.connection.chainId = null;
                }
              });
            },

            setTimeoutWarning: (warning) => {
              set((state) => {
                state.session.timeoutWarning = warning;
              });
            },

            resetSession: () => {
              set((state) => {
                state.session = {
                  ...initialWalletState.session,
                  lastActivity: Date.now(),
                };
              });
            },

            // Transaction actions
            addTransaction: (transaction) => {
              const fullTransaction: TransactionRecord = {
                ...transaction,
                timestamp: new Date().toISOString(),
              };

              set((state) => {
                // Add to history
                state.transactions.history.unshift(fullTransaction);
                
                // Keep only last 100 transactions
                if (state.transactions.history.length > 100) {
                  state.transactions.history = state.transactions.history.slice(0, 100);
                }

                // Add to pending if status is pending
                if (fullTransaction.status === 'pending') {
                  state.transactions.pending[fullTransaction.id] = fullTransaction;
                }

                // Update last transaction
                state.transactions.lastTransaction = fullTransaction;
              });
            },

            updateTransaction: (id, updates) => {
              set((state) => {
                // Update in history
                const historyIndex = state.transactions.history.findIndex(tx => tx.id === id);
                if (historyIndex !== -1) {
                  Object.assign(state.transactions.history[historyIndex], updates);
                }

                // Update in pending
                const pendingTx = state.transactions.pending[id];
                if (pendingTx) {
                  Object.assign(pendingTx, updates);
                  
                  // Remove from pending if no longer pending
                  if (updates.status && updates.status !== 'pending') {
                    delete state.transactions.pending[id];
                  }
                }

                // Update last transaction if it's the same
                if (state.transactions.lastTransaction?.id === id) {
                  Object.assign(state.transactions.lastTransaction, updates);
                }
              });
            },

            removeTransaction: (id) => {
              set((state) => {
                // Remove from history
                state.transactions.history = state.transactions.history.filter(tx => tx.id !== id);
                
                // Remove from pending
                delete state.transactions.pending[id];

                // Clear last transaction if it's the same
                if (state.transactions.lastTransaction?.id === id) {
                  state.transactions.lastTransaction = undefined;
                }
              });
            },

            clearTransactionHistory: () => {
              set((state) => {
                state.transactions.history = [];
                state.transactions.pending = {};
                state.transactions.lastTransaction = undefined;
              });
            },

            // Error actions
            setError: (error) => {
              set((state) => {
                state.error = error;
              });
            },

            clearError: () => {
              set((state) => {
                state.error = null;
              });
            },

            // Modal actions
            openModal: () => {
              set((state) => {
                state.modalOpen = true;
              });
            },

            closeModal: () => {
              set((state) => {
                state.modalOpen = false;
              });
            },

            // Capabilities
            setCapabilities: (capabilities) => {
              set((state) => {
                Object.assign(state.capabilities, capabilities);
              });
            },
          }))
        )
      ),
      {
        name: storageKeys.wallet,
        ...defaultStorageConfig,
        partialize: persistSelectors.wallet,
        version: 1,
      }
    ),
    {
      name: 'WalTodo Wallet Store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// Connection selectors
export const useWalletConnection = () => useWalletStore((state) => state.connection);
export const useWalletAddress = () => useWalletStore((state) => state.connection.address);
export const useWalletStatus = () => useWalletStore((state) => state.connection.status);
export const useWalletNetwork = () => useWalletStore((state) => state.connection.network);
export const useWalletName = () => useWalletStore((state) => state.connection.name);

// Session selectors
export const useWalletSession = () => useWalletStore((state) => state.session);
export const useSessionExpired = () => useWalletStore((state) => state.session.expired);
export const useTimeoutWarning = () => useWalletStore((state) => state.session.timeoutWarning);

// Transaction selectors
export const useTransactionHistory = () => useWalletStore((state) => state.transactions.history);
export const usePendingTransactions = () => useWalletStore((state) => state.transactions.pending);
export const useLastTransaction = () => useWalletStore((state) => state.transactions.lastTransaction);
export const usePendingTransactionCount = () => 
  useWalletStore((state) => Object.keys(state.transactions.pending).length);

// Capability selectors
export const useWalletCapabilities = () => useWalletStore((state) => state.capabilities);
export const useCanSignAndExecute = () => useWalletStore((state) => state.capabilities.signAndExecute);
export const useNFTSupport = () => useWalletStore((state) => state.capabilities.nftSupport);
export const useWalrusSupport = () => useWalletStore((state) => state.capabilities.walrusSupport);

// Error and modal selectors
export const useWalletError = () => useWalletStore((state) => state.error);
export const useWalletModal = () => useWalletStore((state) => state.modalOpen);

// Connection state helpers
export const useIsConnected = () => useWalletStore((state) => state.connection.status === 'connected');
export const useIsConnecting = () => useWalletStore((state) => state.connection.status === 'connecting');
export const useIsDisconnected = () => useWalletStore((state) => state.connection.status === 'disconnected');

// Action selectors
export const useWalletActions = () => useWalletStore((state) => ({
  connect: state.connect,
  disconnect: state.disconnect,
  setConnectionStatus: state.setConnectionStatus,
  setAccount: state.setAccount,
  setNetwork: state.setNetwork,
  updateActivity: state.updateActivity,
  setSessionExpired: state.setSessionExpired,
  setTimeoutWarning: state.setTimeoutWarning,
  resetSession: state.resetSession,
  addTransaction: state.addTransaction,
  updateTransaction: state.updateTransaction,
  removeTransaction: state.removeTransaction,
  clearTransactionHistory: state.clearTransactionHistory,
  setError: state.setError,
  clearError: state.clearError,
  openModal: state.openModal,
  closeModal: state.closeModal,
  setCapabilities: state.setCapabilities,
}));

// Computed selectors
export const useWalletSummary = () => useWalletStore((state) => ({
  isConnected: state.connection.status === 'connected',
  address: state.connection.address,
  network: state.connection.network,
  name: state.connection.name,
  pendingTransactions: Object.keys(state.transactions.pending).length,
  hasError: !!state.error,
  sessionValid: !state.session.expired,
}));

/**
 * Session timeout management hook
 */
export const useSessionTimeout = () => {
  const walletActions = useWalletActions();
  const { setTimeoutWarning, setSessionExpired } = walletActions;
  const { lastActivity, autoDisconnectTime, timeoutWarning } = useWalletSession();

  // Check if session should timeout
  const checkTimeout = () => {
    const now = Date.now();
    const timeSinceActivity = now - lastActivity;
    const warningTime = autoDisconnectTime! - 5 * 60 * 1000; // 5 minutes before timeout

    if (timeSinceActivity >= autoDisconnectTime!) {
      setSessionExpired(true);
    } else if (timeSinceActivity >= warningTime && !timeoutWarning) {
      setTimeoutWarning(true);
    }
  };

  return {
    checkTimeout,
    timeRemaining: Math.max(0, autoDisconnectTime! - (Date.now() - lastActivity)),
    warningThreshold: 5 * 60 * 1000, // 5 minutes
  };
};

/**
 * Store hydration helper
 */
export const hydrateWalletStore = () => {
  if (typeof window !== 'undefined') {
    useWalletStore.persist.rehydrate();
  }
};