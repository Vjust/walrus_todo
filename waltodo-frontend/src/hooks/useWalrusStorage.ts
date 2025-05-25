/**
 * React Hook for Walrus Protocol Storage Operations
 *
 * This hook provides a React interface to Walrus storage operations
 * with proper state management, error handling, and loading states.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  WalrusTodoManager,
  WalrusTodo,
  WalrusTodoCreateResult,
  WalrusTodoUploadOptions,
  TodoStorageMetadata,
  WalrusClientError,
  type WalrusNetwork,
} from '@/lib/walrus-todo-integration';
import { useWalletContext } from '@/contexts/WalletContext';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { Signer } from '@mysten/sui/cryptography';

// Hook state interface
interface WalrusStorageState {
  loading: boolean;
  uploading: boolean;
  downloading: boolean;
  deleting: boolean;
  progress: number;
  progressMessage: string;
  error: WalrusClientError | null;
  walBalance: string | null;
  storageUsage: { used: string; total: string } | null;
}

// Hook return interface
interface UseWalrusStorageReturn extends WalrusStorageState {
  // Todo operations
  createTodo: (
    todo: Omit<
      WalrusTodo,
      'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'
    >,
    options?: WalrusTodoUploadOptions
  ) => Promise<WalrusTodoCreateResult | null>;

  retrieveTodo: (walrusBlobId: string) => Promise<WalrusTodo | null>;

  updateTodo: (
    todo: WalrusTodo,
    options?: Partial<WalrusTodoUploadOptions>
  ) => Promise<boolean>;

  deleteTodo: (walrusBlobId: string) => Promise<boolean>;

  // Batch operations
  createMultipleTodos: (
    todos: Array<
      Omit<WalrusTodo, 'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'>
    >,
    options?: WalrusTodoUploadOptions
  ) => Promise<WalrusTodoCreateResult[]>;

  // Storage info operations
  getTodoStorageInfo: (walrusBlobId: string) => Promise<{
    exists: boolean;
    blobInfo?: any;
    storageCost?: { total: bigint; storage: bigint; write: bigint };
  } | null>;

  estimateStorageCosts: (
    todos: Array<
      Omit<WalrusTodo, 'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'>
    >,
    epochs?: number
  ) => Promise<{
    totalCost: bigint;
    totalSize: number;
    perTodoCost: Array<{ totalCost: bigint; size: number }>;
  } | null>;

  // Utility operations
  refreshWalBalance: () => Promise<void>;
  refreshStorageUsage: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

// Options for the hook
interface UseWalrusStorageOptions {
  network?: WalrusNetwork;
  autoRefreshBalance?: boolean;
  autoRefreshUsage?: boolean;
  refreshInterval?: number;
}

/**
 * React hook for Walrus Protocol storage operations
 */
export function useWalrusStorage(
  options: UseWalrusStorageOptions = {}
): UseWalrusStorageReturn {
  const {
    network = 'testnet',
    autoRefreshBalance = true,
    autoRefreshUsage = true,
    refreshInterval = 30000, // 30 seconds
  } = options;

  // Get wallet context
  const { connected, address, error: walletError } = useWalletContext();

  // State management
  const [state, setState] = useState<WalrusStorageState>({
    loading: false,
    uploading: false,
    downloading: false,
    deleting: false,
    progress: 0,
    progressMessage: '',
    error: null,
    walBalance: null,
    storageUsage: null,
  });

  // Walrus manager instance
  const walrusManagerRef = useRef<WalrusTodoManager | null>(null);

  // Initialize manager
  useEffect(() => {
    walrusManagerRef.current = new WalrusTodoManager(network);
  }, [network]);

  // Get current manager
  const getManager = useCallback((): WalrusTodoManager => {
    if (!walrusManagerRef.current) {
      walrusManagerRef.current = new WalrusTodoManager(network);
    }
    return walrusManagerRef.current;
  }, [network]);

  // Helper function to handle errors
  const handleError = useCallback(
    (error: unknown, operation: string): WalrusClientError => {
      let walrusError: WalrusClientError;

      if (error instanceof WalrusClientError) {
        walrusError = error;
      } else {
        walrusError = new WalrusClientError(
          `${operation} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'OPERATION_ERROR',
          error instanceof Error ? error : undefined
        );
      }

      setState(prev => ({ ...prev, error: walrusError, loading: false }));
      return walrusError;
    },
    []
  );

  // Helper function to update progress
  const updateProgress = useCallback((message: string, progress: number) => {
    setState(prev => ({
      ...prev,
      progressMessage: message,
      progress: Math.max(0, Math.min(100, progress)),
    }));
  }, []);

  // Create todo operation
  const createTodo = useCallback(
    async (
      todo: Omit<
        WalrusTodo,
        'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'
      >,
      options: WalrusTodoUploadOptions = {}
    ): Promise<WalrusTodoCreateResult | null> => {
      if (!connected || !address) {
        handleError(new Error('Wallet not connected'), 'Create Todo');
        return null;
      }

      setState(prev => ({
        ...prev,
        uploading: true,
        loading: true,
        error: null,
        progress: 0,
        progressMessage: 'Starting upload...',
      }));

      try {
        const manager = getManager();

        // Create a mock signer for now - in real implementation, get from wallet
        const signer = new Ed25519Keypair();

        const result = await manager.createTodo(
          todo,
          signer,
          undefined, // signAndExecuteTransaction - would come from wallet context
          {
            ...options,
            onProgress: updateProgress,
          }
        );

        setState(prev => ({
          ...prev,
          uploading: false,
          loading: false,
          progress: 100,
          progressMessage: 'Upload complete',
        }));

        return result;
      } catch (error) {
        setState(prev => ({ ...prev, uploading: false }));
        handleError(error, 'Create Todo');
        return null;
      }
    },
    [connected, address, getManager, handleError, updateProgress]
  );

  // Retrieve todo operation
  const retrieveTodo = useCallback(
    async (walrusBlobId: string): Promise<WalrusTodo | null> => {
      setState(prev => ({
        ...prev,
        downloading: true,
        loading: true,
        error: null,
        progressMessage: 'Downloading todo...',
      }));

      try {
        const manager = getManager();
        const result = await manager.retrieveTodo(walrusBlobId);

        setState(prev => ({
          ...prev,
          downloading: false,
          loading: false,
          progressMessage: 'Download complete',
        }));

        return result;
      } catch (error) {
        setState(prev => ({ ...prev, downloading: false }));
        handleError(error, 'Retrieve Todo');
        return null;
      }
    },
    [getManager, handleError]
  );

  // Update todo operation
  const updateTodo = useCallback(
    async (
      todo: WalrusTodo,
      options: Partial<WalrusTodoUploadOptions> = {}
    ): Promise<boolean> => {
      if (!connected || !address) {
        handleError(new Error('Wallet not connected'), 'Update Todo');
        return false;
      }

      setState(prev => ({
        ...prev,
        uploading: true,
        loading: true,
        error: null,
        progressMessage: 'Updating todo...',
      }));

      try {
        const manager = getManager();
        const signer = new Ed25519Keypair(); // Mock signer

        await manager.updateTodo(todo, signer, options);

        setState(prev => ({
          ...prev,
          uploading: false,
          loading: false,
          progressMessage: 'Update complete',
        }));

        return true;
      } catch (error) {
        setState(prev => ({ ...prev, uploading: false }));
        handleError(error, 'Update Todo');
        return false;
      }
    },
    [connected, address, getManager, handleError]
  );

  // Delete todo operation
  const deleteTodo = useCallback(
    async (walrusBlobId: string): Promise<boolean> => {
      if (!connected || !address) {
        handleError(new Error('Wallet not connected'), 'Delete Todo');
        return false;
      }

      setState(prev => ({
        ...prev,
        deleting: true,
        loading: true,
        error: null,
        progressMessage: 'Deleting todo...',
      }));

      try {
        const manager = getManager();
        const signer = new Ed25519Keypair(); // Mock signer

        await manager.deleteTodo(walrusBlobId, signer);

        setState(prev => ({
          ...prev,
          deleting: false,
          loading: false,
          progressMessage: 'Delete complete',
        }));

        return true;
      } catch (error) {
        setState(prev => ({ ...prev, deleting: false }));
        handleError(error, 'Delete Todo');
        return false;
      }
    },
    [connected, address, getManager, handleError]
  );

  // Create multiple todos
  const createMultipleTodos = useCallback(
    async (
      todos: Array<
        Omit<WalrusTodo, 'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'>
      >,
      options: WalrusTodoUploadOptions = {}
    ): Promise<WalrusTodoCreateResult[]> => {
      if (!connected || !address) {
        handleError(new Error('Wallet not connected'), 'Create Multiple Todos');
        return [];
      }

      setState(prev => ({
        ...prev,
        uploading: true,
        loading: true,
        error: null,
        progress: 0,
        progressMessage: 'Starting batch upload...',
      }));

      try {
        const manager = getManager();
        const signer = new Ed25519Keypair(); // Mock signer

        const results = await manager.createMultipleTodos(
          todos,
          signer,
          undefined, // signAndExecuteTransaction
          {
            ...options,
            onProgress: updateProgress,
          }
        );

        setState(prev => ({
          ...prev,
          uploading: false,
          loading: false,
          progress: 100,
          progressMessage: 'Batch upload complete',
        }));

        return results;
      } catch (error) {
        setState(prev => ({ ...prev, uploading: false }));
        handleError(error, 'Create Multiple Todos');
        return [];
      }
    },
    [connected, address, getManager, handleError, updateProgress]
  );

  // Get todo storage info
  const getTodoStorageInfo = useCallback(
    async (walrusBlobId: string) => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const manager = getManager();
        const result = await manager.getTodoStorageInfo(walrusBlobId);

        setState(prev => ({ ...prev, loading: false }));
        return result;
      } catch (error) {
        handleError(error, 'Get Storage Info');
        return null;
      }
    },
    [getManager, handleError]
  );

  // Estimate storage costs
  const estimateStorageCosts = useCallback(
    async (
      todos: Array<
        Omit<WalrusTodo, 'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'>
      >,
      epochs: number = 5
    ) => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const manager = getManager();
        const result = await manager.estimateStorageCosts(todos, epochs);

        setState(prev => ({ ...prev, loading: false }));
        return result;
      } catch (error) {
        handleError(error, 'Estimate Storage Costs');
        return null;
      }
    },
    [getManager, handleError]
  );

  // Refresh WAL balance
  const refreshWalBalance = useCallback(async () => {
    try {
      const manager = getManager();
      const balance = await manager.getWalBalance();
      setState(prev => ({ ...prev, walBalance: balance }));
    } catch (error) {
      console.warn('Failed to refresh WAL balance:', error);
    }
  }, [getManager]);

  // Refresh storage usage
  const refreshStorageUsage = useCallback(async () => {
    try {
      const manager = getManager();
      const usage = await manager.getStorageUsage();
      setState(prev => ({ ...prev, storageUsage: usage }));
    } catch (error) {
      console.warn('Failed to refresh storage usage:', error);
    }
  }, [getManager]);

  // Clear error state
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Reset all state
  const reset = useCallback(() => {
    setState({
      loading: false,
      uploading: false,
      downloading: false,
      deleting: false,
      progress: 0,
      progressMessage: '',
      error: null,
      walBalance: null,
      storageUsage: null,
    });
  }, []);

  // Auto-refresh balance and usage
  useEffect(() => {
    if (!connected) return;

    if (autoRefreshBalance) {
      refreshWalBalance();
    }
    if (autoRefreshUsage) {
      refreshStorageUsage();
    }

    if (refreshInterval > 0 && (autoRefreshBalance || autoRefreshUsage)) {
      const interval = setInterval(() => {
        if (autoRefreshBalance) refreshWalBalance();
        if (autoRefreshUsage) refreshStorageUsage();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [
    connected,
    autoRefreshBalance,
    autoRefreshUsage,
    refreshInterval,
    refreshWalBalance,
    refreshStorageUsage,
  ]);

  // Clear error when wallet error changes
  useEffect(() => {
    if (walletError) {
      setState(prev => ({ ...prev, error: null }));
    }
  }, [walletError]);

  return {
    ...state,
    createTodo,
    retrieveTodo,
    updateTodo,
    deleteTodo,
    createMultipleTodos,
    getTodoStorageInfo,
    estimateStorageCosts,
    refreshWalBalance,
    refreshStorageUsage,
    clearError,
    reset,
  };
}

// Export type for external use
export type {
  UseWalrusStorageReturn,
  WalrusStorageState,
  UseWalrusStorageOptions,
};
