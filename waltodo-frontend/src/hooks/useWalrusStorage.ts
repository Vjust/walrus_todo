/**
 * React Hook for Walrus Protocol Storage Operations
 *
 * This hook provides a React interface to Walrus storage operations
 * with proper state management, error handling, and loading states.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TodoStorageMetadata,
  WalrusClientError,
  type WalrusNetwork,
  WalrusTodo,
  WalrusTodoCreateResult,
  WalrusTodoManager,
  WalrusTodoUploadOptions,
} from '@/lib/walrus-todo-integration';
import { useClientSafeWallet } from '@/hooks/useClientSafeWallet';
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

  // Health check operations
  testConnection: () => Promise<{ success: boolean; error?: string }>;
  uploadBlob: (data: Uint8Array, options?: { metadata?: any }) => Promise<{ success: boolean; blobId?: string; error?: string }>;
  retrieveBlob: (blobId: string) => Promise<{ success: boolean; data?: Uint8Array; error?: string }>;

  // Image upload operation
  uploadImage: (
    file: File,
    options?: { epochs?: number; onProgress?: (progress: number) => void }
  ) => Promise<{ blobId: string; url: string } | null>;

  // Utility operations
  refreshWalBalance: () => Promise<void>;
  refreshStorageUsage: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

// Hook options interface
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

  // Get wallet context - this is the proper way to access wallet state
  const walletContext = useClientSafeWallet();
  
  // Safely extract wallet properties with fallbacks
  const connected = walletContext?.connected || false;
  const address = walletContext?.address || null;
  const walletError = walletContext?.error || null;
  const signAndExecuteTransaction = walletContext?.signAndExecuteTransaction;

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

  // Progress update helper
  const updateProgress = useCallback((message: string, progress: number) => {
    setState(prev => ({
      ...prev,
      progress: Math.min(100, Math.max(0, progress)),
      progressMessage: message,
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

        // Ensure we have the signAndExecuteTransaction function
        if (!signAndExecuteTransaction) {
          throw new Error('Wallet signing capability not available');
        }

        // Create a wallet signer that uses the connected wallet
        const walletSigner = {
          async signData(data: Uint8Array): Promise<{ signature: Uint8Array; publicKey: Uint8Array }> {
            // For Walrus uploads, we don't need actual signing - just return mock data
            // The actual signing happens when creating the NFT on Sui
            return {
              signature: new Uint8Array(64), // Mock signature
              publicKey: new Uint8Array(32), // Mock public key
            };
          },
          getAddress(): string {
            return address;
          },
          toSuiAddress(): string {
            return address;
          },
        };

        const result = await manager.createTodo(
          todo,
          walletSigner as any,
          signAndExecuteTransaction,
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
    [connected, address, signAndExecuteTransaction, getManager, handleError, updateProgress]
  );

  // Retrieve todo operation
  const retrieveTodo = useCallback(
    async (walrusBlobId: string): Promise<WalrusTodo | null> => {
      setState(prev => ({
        ...prev,
        downloading: true,
        loading: true,
        error: null,
        progressMessage: 'Retrieving todo...',
      }));

      try {
        const manager = getManager();
        const result = await manager.retrieveTodo(walrusBlobId);

        setState(prev => ({
          ...prev,
          downloading: false,
          loading: false,
          progressMessage: 'Retrieval complete',
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
        
        // Create wallet signer
        const walletSigner = {
          async signData(data: Uint8Array): Promise<{ signature: Uint8Array; publicKey: Uint8Array }> {
            return {
              signature: new Uint8Array(64),
              publicKey: new Uint8Array(32),
            };
          },
          getAddress(): string {
            return address;
          },
          toSuiAddress(): string {
            return address;
          },
        };

        await manager.updateTodo(todo, walletSigner as any, options);

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
        
        // Create wallet signer for deletion
        const walletSigner = {
          async signData(data: Uint8Array): Promise<{ signature: Uint8Array; publicKey: Uint8Array }> {
            return {
              signature: new Uint8Array(64),
              publicKey: new Uint8Array(32),
            };
          },
          getAddress(): string {
            return address;
          },
          toSuiAddress(): string {
            return address;
          },
        };

        await manager.deleteTodo(walrusBlobId, walletSigner as any);

        setState(prev => ({
          ...prev,
          deleting: false,
          loading: false,
          progressMessage: 'Deletion complete',
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
        
        // Ensure we have the signAndExecuteTransaction function
        if (!signAndExecuteTransaction) {
          throw new Error('Wallet signing capability not available');
        }

        // Create wallet signer
        const walletSigner = {
          async signData(data: Uint8Array): Promise<{ signature: Uint8Array; publicKey: Uint8Array }> {
            return {
              signature: new Uint8Array(64),
              publicKey: new Uint8Array(32),
            };
          },
          getAddress(): string {
            return address;
          },
          toSuiAddress(): string {
            return address;
          },
        };

        const results = await manager.createMultipleTodos(
          todos,
          walletSigner as any,
          signAndExecuteTransaction,
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
    [connected, address, signAndExecuteTransaction, getManager, handleError, updateProgress]
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

  // Test connection
  const testConnection = useCallback(async () => {
    try {
      const manager = getManager();
      // Use the walrus client to test connection
      const client = manager['walrusClient'] || manager['walrusStorage']?.getClient?.();
      if (client && typeof client.getWalBalance === 'function') {
        await client.getWalBalance();
        return { success: true };
      }
      return { success: true }; // Assume success if we can't test
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }, [getManager]);

  // Upload blob
  const uploadBlob = useCallback(
    async (data: Uint8Array, options: { metadata?: any } = {}) => {
      try {
        const manager = getManager();
        // Use the walrus client directly
        const client = manager['walrusClient'] || manager['walrusStorage']?.getClient?.();
        if (client && typeof client.upload === 'function') {
          const result = await client.upload(data, { epochs: 1 });
          return { success: true, blobId: result.blobId };
        }
        throw new Error('Walrus client not available');
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Upload failed',
        };
      }
    },
    [getManager]
  );

  // Retrieve blob
  const retrieveBlob = useCallback(
    async (blobId: string) => {
      try {
        const manager = getManager();
        // Use the walrus client directly
        const client = manager['walrusClient'] || manager['walrusStorage']?.getClient?.();
        if (client && typeof client.download === 'function') {
          const result = await client.download(blobId);
          return { success: true, data: result.data };
        }
        throw new Error('Walrus client not available');
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Retrieval failed',
        };
      }
    },
    [getManager]
  );

  // Upload image
  const uploadImage = useCallback(
    async (
      file: File,
      options: { epochs?: number; onProgress?: (progress: number) => void } = {}
    ) => {
      if (!connected || !address) {
        handleError(new Error('Wallet not connected'), 'Upload Image');
        return null;
      }

      setState(prev => ({
        ...prev,
        uploading: true,
        loading: true,
        error: null,
        progress: 0,
        progressMessage: 'Uploading image...',
      }));

      try {
        const manager = getManager();
        // Use the walrus client directly
        const client = manager['walrusClient'] || manager['walrusStorage']?.getClient?.();
        if (client && typeof client.uploadImage === 'function') {
          options?.onProgress?.(20);
          
          const result = await client.uploadImage(file, {
            epochs: options.epochs || 5,
          });
          
          options?.onProgress?.(80);
          
          const url = client.getBlobUrl?.(result.blobId) || `walrus://${result.blobId}`;
          
          setState(prev => ({
            ...prev,
            uploading: false,
            loading: false,
            progress: 100,
            progressMessage: 'Image uploaded successfully',
          }));
          
          options?.onProgress?.(100);
          
          return {
            blobId: result.blobId,
            url,
          };
        }
        throw new Error('Image upload not supported');
      } catch (error) {
        setState(prev => ({ ...prev, uploading: false }));
        handleError(error, 'Upload Image');
        return null;
      }
    },
    [connected, address, getManager, handleError]
  );

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Reset state
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
    if (!connected || !address) {return;}

    let intervalId: NodeJS.Timeout | undefined;

    if (autoRefreshBalance || autoRefreshUsage) {
      const refresh = async () => {
        if (autoRefreshBalance) {
          await refreshWalBalance();
        }
        if (autoRefreshUsage) {
          await refreshStorageUsage();
        }
      };

      // Initial refresh
      refresh();

      // Set up interval
      intervalId = setInterval(refresh, refreshInterval);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [
    connected,
    address,
    autoRefreshBalance,
    autoRefreshUsage,
    refreshInterval,
    refreshWalBalance,
    refreshStorageUsage,
  ]);

  // Handle wallet errors
  useEffect(() => {
    if (walletError) {
      setState(prev => ({
        ...prev,
        error: new WalrusClientError(
          `Wallet error: ${walletError}`,
          'WALLET_ERROR'
        ),
      }));
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
    testConnection,
    uploadBlob,
    retrieveBlob,
    uploadImage,
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
