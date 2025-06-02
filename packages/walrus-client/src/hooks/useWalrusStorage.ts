/**
 * React Hook for Walrus Protocol Storage Operations
 * Consolidated from frontend implementation with enhanced functionality
 */

// This file requires React as a peer dependency
import type * as ReactType from 'react';

let React: typeof ReactType | undefined;
try {
  React = require('react') as typeof ReactType;
} catch {
  // React not available - hooks will throw runtime error if used
}

import { WalrusTodoStorage } from '../client/WalrusTodoStorage';
import type { 
  WalrusTodo,
  WalrusTodoCreateResult,
  WalrusTodoUploadOptions,
  WalrusNetwork,
  UniversalSigner,
  StorageCostEstimate
} from '../types';
import { WalrusClientError } from '../errors';

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
export interface UseWalrusStorageReturn extends WalrusStorageState {
  // Todo operations
  createTodo: (
    todo: Omit<WalrusTodo, 'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'>,
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
    todos: Array<Omit<WalrusTodo, 'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'>>,
    options?: WalrusTodoUploadOptions
  ) => Promise<WalrusTodoCreateResult[]>;

  // Storage info operations
  getTodoStorageInfo: (walrusBlobId: string) => Promise<{
    exists: boolean;
    blobInfo?: any;
    storageCost?: StorageCostEstimate;
  } | null>;

  estimateStorageCosts: (
    todos: Array<Omit<WalrusTodo, 'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'>>,
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
export interface UseWalrusStorageOptions {
  network?: WalrusNetwork;
  autoRefreshBalance?: boolean;
  autoRefreshUsage?: boolean;
  refreshInterval?: number;
  signer?: UniversalSigner;
  signAndExecuteTransaction?: (txb: any) => Promise<any>;
}

/**
 * React hook for Walrus Protocol storage operations
 */
export function useWalrusStorage(
  options: UseWalrusStorageOptions = {}
): UseWalrusStorageReturn {
  if (!React) {
    throw new Error('useWalrusStorage requires React as a peer dependency');
  }

  const {
    network = 'testnet',
    autoRefreshBalance = true,
    autoRefreshUsage = true,
    refreshInterval = 30000, // 30 seconds
    signer,
    signAndExecuteTransaction,
  } = options;

  // State management
  const [state, setState] = React!.useState<WalrusStorageState>({
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

  // Walrus storage instance
  const walrusStorageRef = React!.useRef<WalrusTodoStorage | null>(null);

  // Initialize storage
  React!.useEffect(() => {
    walrusStorageRef.current = new WalrusTodoStorage(network);
  }, [network]);

  // Get current storage instance
  const getStorage = React!.useCallback((): WalrusTodoStorage => {
    if (!walrusStorageRef.current) {
      walrusStorageRef.current = new WalrusTodoStorage(network);
    }
    return walrusStorageRef.current;
  }, [network]);

  // Helper function to handle errors
  const handleError = React!.useCallback(
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

      setState((prev: WalrusStorageState) => ({ ...prev, error: walrusError, loading: false }));
      return walrusError;
    },
    []
  );

  // Helper function to update progress
  const updateProgress = React!.useCallback((message: string, progress: number) => {
    setState((prev: WalrusStorageState) => ({
      ...prev,
      progressMessage: message,
      progress: Math.max(0, Math.min(100, progress)),
    }));
  }, []);

  // Create todo operation
  const createTodo = React!.useCallback(
    async (
      todo: Omit<WalrusTodo, 'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'>,
      options: WalrusTodoUploadOptions = {}
    ): Promise<WalrusTodoCreateResult | null> => {
      setState((prev: WalrusStorageState) => ({
        ...prev,
        uploading: true,
        loading: true,
        error: null,
        progress: 0,
        progressMessage: 'Starting upload...',
      }));

      try {
        const storage = getStorage();
        
        const result = await storage.createTodo(
          todo,
          signer,
          signAndExecuteTransaction,
          {
            ...options,
            onProgress: updateProgress,
          }
        );

        setState((prev: WalrusStorageState) => ({
          ...prev,
          uploading: false,
          loading: false,
          progress: 100,
          progressMessage: 'Upload complete',
        }));

        return result;
      } catch (error) {
        setState((prev: WalrusStorageState) => ({ ...prev, uploading: false }));
        handleError(error, 'Create Todo');
        return null;
      }
    },
    [signer, signAndExecuteTransaction, getStorage, handleError, updateProgress]
  );

  // Retrieve todo operation
  const retrieveTodo = React!.useCallback(
    async (walrusBlobId: string): Promise<WalrusTodo | null> => {
      setState((prev: WalrusStorageState) => ({
        ...prev,
        downloading: true,
        loading: true,
        error: null,
        progressMessage: 'Downloading todo...',
      }));

      try {
        const storage = getStorage();
        const result = await storage.retrieveWalrusTodo(walrusBlobId);

        setState((prev: WalrusStorageState) => ({
          ...prev,
          downloading: false,
          loading: false,
          progressMessage: 'Download complete',
        }));

        return result;
      } catch (error) {
        setState((prev: WalrusStorageState) => ({ ...prev, downloading: false }));
        handleError(error, 'Retrieve Todo');
        return null;
      }
    },
    [getStorage, handleError]
  );

  // Update todo operation
  const updateTodo = React!.useCallback(
    async (
      todo: WalrusTodo,
      options: Partial<WalrusTodoUploadOptions> = {}
    ): Promise<boolean> => {
      setState((prev: WalrusStorageState) => ({
        ...prev,
        uploading: true,
        loading: true,
        error: null,
        progressMessage: 'Updating todo...',
      }));

      try {
        const storage = getStorage();
        await storage.updateWalrusTodo(todo, signer, options);

        setState((prev: WalrusStorageState) => ({
          ...prev,
          uploading: false,
          loading: false,
          progressMessage: 'Update complete',
        }));

        return true;
      } catch (error) {
        setState((prev: WalrusStorageState) => ({ ...prev, uploading: false }));
        handleError(error, 'Update Todo');
        return false;
      }
    },
    [signer, getStorage, handleError]
  );

  // Delete todo operation
  const deleteTodo = React!.useCallback(
    async (walrusBlobId: string): Promise<boolean> => {
      setState((prev: WalrusStorageState) => ({
        ...prev,
        deleting: true,
        loading: true,
        error: null,
        progressMessage: 'Deleting todo...',
      }));

      try {
        const storage = getStorage();
        await storage.delete(walrusBlobId, signer);

        setState((prev: WalrusStorageState) => ({
          ...prev,
          deleting: false,
          loading: false,
          progressMessage: 'Delete complete',
        }));

        return true;
      } catch (error) {
        setState((prev: WalrusStorageState) => ({ ...prev, deleting: false }));
        handleError(error, 'Delete Todo');
        return false;
      }
    },
    [signer, getStorage, handleError]
  );

  // Create multiple todos
  const createMultipleTodos = React!.useCallback(
    async (
      todos: Array<Omit<WalrusTodo, 'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'>>,
      options: WalrusTodoUploadOptions = {}
    ): Promise<WalrusTodoCreateResult[]> => {
      setState((prev: WalrusStorageState) => ({
        ...prev,
        uploading: true,
        loading: true,
        error: null,
        progress: 0,
        progressMessage: 'Starting batch upload...',
      }));

      try {
        const storage = getStorage();

        const results = await storage.createMultipleTodos(
          todos,
          signer,
          signAndExecuteTransaction,
          {
            ...options,
            onProgress: updateProgress,
          }
        );

        setState((prev: WalrusStorageState) => ({
          ...prev,
          uploading: false,
          loading: false,
          progress: 100,
          progressMessage: 'Batch upload complete',
        }));

        return results;
      } catch (error) {
        setState((prev: WalrusStorageState) => ({ ...prev, uploading: false }));
        handleError(error, 'Create Multiple Todos');
        return [];
      }
    },
    [signer, signAndExecuteTransaction, getStorage, handleError, updateProgress]
  );

  // Get todo storage info
  const getTodoStorageInfo = React!.useCallback(
    async (walrusBlobId: string) => {
      setState((prev: WalrusStorageState) => ({ ...prev, loading: true, error: null }));

      try {
        const storage = getStorage();
        const result = await storage.getTodoStorageInfo(walrusBlobId);

        setState((prev: WalrusStorageState) => ({ ...prev, loading: false }));
        return result;
      } catch (error) {
        handleError(error, 'Get Storage Info');
        return null;
      }
    },
    [getStorage, handleError]
  );

  // Estimate storage costs
  const estimateStorageCosts = React!.useCallback(
    async (
      todos: Array<Omit<WalrusTodo, 'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'>>,
      epochs: number = 5
    ) => {
      setState((prev: WalrusStorageState) => ({ ...prev, loading: true, error: null }));

      try {
        const storage = getStorage();
        let totalCost = BigInt(0);
        let totalSize = 0;
        const perTodoCost: Array<{ totalCost: bigint; size: number }> = [];

        for (const todo of todos) {
          const estimate = await storage.estimateTodoStorageCost(todo, epochs);
          totalCost += estimate.totalCost;
          totalSize += estimate.sizeBytes;
          perTodoCost.push({
            totalCost: estimate.totalCost,
            size: estimate.sizeBytes,
          });
        }

        setState((prev: WalrusStorageState) => ({ ...prev, loading: false }));
        return { totalCost, totalSize, perTodoCost };
      } catch (error) {
        handleError(error, 'Estimate Storage Costs');
        return null;
      }
    },
    [getStorage, handleError]
  );

  // Refresh WAL balance
  const refreshWalBalance = React!.useCallback(async () => {
    try {
      const storage = getStorage();
      const balance = await storage.getWalBalance();
      setState((prev: WalrusStorageState) => ({ ...prev, walBalance: balance }));
    } catch (error) {
      console.warn('Failed to refresh WAL balance:', error);
    }
  }, [getStorage]);

  // Refresh storage usage
  const refreshStorageUsage = React!.useCallback(async () => {
    try {
      const storage = getStorage();
      const usage = await storage.getStorageUsage();
      setState((prev: WalrusStorageState) => ({ ...prev, storageUsage: usage }));
    } catch (error) {
      console.warn('Failed to refresh storage usage:', error);
    }
  }, [getStorage]);

  // Clear error state
  const clearError = React!.useCallback(() => {
    setState((prev: WalrusStorageState) => ({ ...prev, error: null }));
  }, []);

  // Reset all state
  const reset = React!.useCallback(() => {
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
  React!.useEffect(() => {
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
    
    return undefined;
  }, [
    autoRefreshBalance,
    autoRefreshUsage,
    refreshInterval,
    refreshWalBalance,
    refreshStorageUsage,
  ]);

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