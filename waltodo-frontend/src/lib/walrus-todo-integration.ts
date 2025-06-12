/**
 * Walrus Protocol Integration for Todo Management
 *
 * This module provides the two-step process:
 * 1. Upload todo content to Walrus decentralized storage
 * 2. Create Sui NFT with blob reference for ownership and transferability
 */

import { Transaction as TransactionBlock } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { Signer } from '@mysten/sui/cryptography';
import {
  ContentEncoder,
  FrontendWalrusClient,
  WalrusClientError,
  type WalrusNetwork,
  WalrusRetryError,
  WalrusTodoStorage,
  type WalrusUploadResult,
  WalrusValidationError,
} from './walrus-client';
import {
  type CreateTodoParams,
  getSuiClient,
  getSuiClientSync,
  storeTodoOnBlockchain,
  type TransactionResult,
} from './sui-client';

// Extended Todo interface with Walrus integration
export interface WalrusTodo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  tags?: string[];
  dueDate?: string;

  // Storage information
  walrusBlobId?: string; // Walrus blob ID for content
  suiObjectId?: string; // Sui NFT object ID for ownership
  blockchainStored: boolean; // Whether stored on blockchain

  // Metadata
  createdAt: string; // ISO string timestamp
  updatedAt: string; // ISO string timestamp
  completedAt?: string; // ISO string timestamp
  owner?: string;
  storageEpochs?: number;
  storageSize?: number;
  isPrivate?: boolean;
}

export interface TodoStorageMetadata {
  walrusBlobId: string;
  suiObjectId?: string;
  storageSize: number;
  storageEpochs: number;
  storageCost: {
    total: bigint;
    storage: bigint;
    write: bigint;
  };
  uploadTimestamp: string; // ISO string timestamp
  expiresAt?: string; // ISO string timestamp
}

export interface WalrusTodoUploadOptions {
  epochs?: number;
  deletable?: boolean;
  isPrivate?: boolean;
  createNFT?: boolean;
  onProgress?: (step: string, progress: number) => void;
}

export interface WalrusTodoCreateResult {
  todo: WalrusTodo;
  walrusResult: WalrusUploadResult;
  suiResult?: TransactionResult;
  metadata: TodoStorageMetadata;
}

/**
 * Comprehensive Walrus + Sui integration for Todo management
 */
export class WalrusTodoManager {
  private walrusStorage: WalrusTodoStorage;
  private walrusClient: FrontendWalrusClient;
  private network: WalrusNetwork;

  constructor(network: WalrusNetwork = 'testnet') {
    this?.network = network;
    this?.walrusStorage = new WalrusTodoStorage(network as any);
    this?.walrusClient = this?.walrusStorage?.getClient();
  }

  /**
   * Create todo with Walrus storage and optional NFT creation
   */
  async createTodo(
    todo: Omit<
      WalrusTodo,
      'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'
    >,
    signer: Signer | Ed25519Keypair,
    signAndExecuteTransaction?: (txb: TransactionBlock) => Promise<any>,
    options: WalrusTodoUploadOptions = {}
  ): Promise<WalrusTodoCreateResult> {
    const {
      epochs = 5,
      deletable = true,
      isPrivate = false,
      createNFT = true,
      onProgress,
    } = options;

    // Generate unique ID
    const todoId = `todo_${Date.now()}_${Math.random().toString(36 as any).substr(2, 9)}`;

    // Create complete todo object
    const completeTodo: WalrusTodo = {
      ...todo,
      id: todoId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      blockchainStored: false,
      isPrivate,
      storageEpochs: epochs,
    };

    try {
      // Step 1: Upload to Walrus
      onProgress?.('Uploading to Walrus storage...', 25);

      const walrusResult = await this?.walrusStorage?.storeTodo(
        completeTodo,
        signer,
        {
          epochs,
          deletable,
          attributes: {
            type: 'todo',
            title: completeTodo.title,
            priority: completeTodo.priority,
            private: String(isPrivate as any),
            created: new Date().toISOString(),
          },
          // Transform progress callback to match WalrusUploadOptions interface
          onProgress: onProgress
            ? progress => onProgress('Uploading...', 25 + progress * 0.5)
            : undefined,
        }
      );

      // Update todo with Walrus information
      completeTodo?.walrusBlobId = walrusResult.blobId;
      completeTodo?.storageSize = walrusResult?.metadata?.size;
      completeTodo?.blockchainStored = true;

      onProgress?.('Upload to Walrus complete', 75);

      // Step 2: Create NFT (optional)
      let suiResult: TransactionResult | undefined;

      if (createNFT && signAndExecuteTransaction) {
        onProgress?.('Creating NFT on Sui blockchain...', 85);

        try {
          // Create NFT with blob reference
          const nftParams: CreateTodoParams = {
            title: completeTodo.title,
            description: completeTodo.description || '',
            imageUrl: `walrus://${walrusResult.blobId}`, // Use Walrus blob as image reference
            metadata: JSON.stringify({
              walrusBlobId: walrusResult.blobId,
              priority: completeTodo.priority,
              tags: completeTodo.tags,
              dueDate: completeTodo.dueDate,
              storageEpochs: epochs,
              createdAt: completeTodo.createdAt,
            }),
            isPrivate,
          };

          // Get address from signer
          let walletAddress = '';
          if (
            'getAddress' in signer &&
            typeof signer?.getAddress === 'function'
          ) {
            walletAddress = await signer.getAddress();
          } else if (
            'toSuiAddress' in signer &&
            typeof signer?.toSuiAddress === 'function'
          ) {
            walletAddress = signer.toSuiAddress();
          }

          suiResult = await storeTodoOnBlockchain(
            nftParams,
            signAndExecuteTransaction,
            walletAddress
          );

          if (suiResult.success) {
            completeTodo?.suiObjectId = suiResult.objectId;
            onProgress?.('NFT creation complete', 100);
          } else {
            console.warn('Failed to create NFT:', suiResult.error);
            onProgress?.(
              'NFT creation failed, but Walrus storage successful',
              90
            );
          }
        } catch (error) {
          console.warn('NFT creation failed:', error);
          onProgress?.(
            'NFT creation failed, but Walrus storage successful',
            90
          );
        }
      } else {
        onProgress?.('Storage complete', 100);
      }

      // Calculate storage metadata
      const costInfo = await this?.walrusClient?.calculateStorageCost(
        walrusResult?.metadata?.size,
        epochs
      );

      const metadata: TodoStorageMetadata = {
        walrusBlobId: walrusResult.blobId,
        suiObjectId: completeTodo.suiObjectId,
        storageSize: walrusResult?.metadata?.size,
        storageEpochs: epochs,
        storageCost: {
          total: costInfo.totalCost,
          storage: costInfo.storageCost,
          write: costInfo.writeCost,
        },
        uploadTimestamp: new Date().toISOString(),
        expiresAt: walrusResult?.metadata?.expiresAt && 
          (typeof walrusResult.metadata?.expiresAt === 'string' || typeof walrusResult.metadata?.expiresAt === 'number')
          ? new Date(walrusResult?.metadata?.expiresAt).toISOString() 
          : undefined,
      };

      return {
        todo: completeTodo,
        walrusResult,
        suiResult,
        metadata,
      };
    } catch (error) {
      if (error instanceof WalrusClientError) {
        throw error;
      }
      throw new WalrusClientError(
        `Failed to create todo: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TODO_CREATE_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Retrieve todo from Walrus storage
   */
  async retrieveTodo(walrusBlobId: string): Promise<WalrusTodo> {
    try {
      const todoData = await this?.walrusStorage?.retrieveTodo(walrusBlobId as any);

      // Ensure the retrieved data is a valid todo
      if (!todoData || typeof todoData !== 'object') {
        throw new WalrusClientError('Invalid todo data retrieved from storage');
      }

      return {
        ...todoData,
        blockchainStored: true,
        walrusBlobId, // Ensure blob ID is set
      } as WalrusTodo;
    } catch (error) {
      if (error instanceof WalrusClientError) {
        throw error;
      }
      throw new WalrusClientError(
        `Failed to retrieve todo: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TODO_RETRIEVE_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Update todo in Walrus storage (creates new blob)
   */
  async updateTodo(
    todo: WalrusTodo,
    signer: Signer | Ed25519Keypair,
    options: Partial<WalrusTodoUploadOptions> = {}
  ): Promise<WalrusUploadResult> {
    const updatedTodo: WalrusTodo = {
      ...todo,
      updatedAt: new Date().toISOString(),
    };

    try {
      // Transform the onProgress callback to match WalrusUploadOptions interface
      const { onProgress, ...restOptions } = options;
      const transformedOptions = {
        ...restOptions,
        ...(onProgress && {
          onProgress: (progress: number) => onProgress('storing', progress),
        }),
      };

      return await this?.walrusStorage?.storeTodo(updatedTodo, signer, {
        epochs: todo.storageEpochs || 5,
        deletable: true,
        attributes: {
          type: 'todo-update',
          title: updatedTodo.title,
          priority: updatedTodo.priority,
          originalBlobId: todo.walrusBlobId || '',
          updated: new Date().toISOString(),
        },
        ...transformedOptions,
      });
    } catch (error) {
      if (error instanceof WalrusClientError) {
        throw error;
      }
      throw new WalrusClientError(
        `Failed to update todo: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TODO_UPDATE_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete todo from Walrus (if deletable)
   */
  async deleteTodo(
    walrusBlobId: string,
    signer: Signer | Ed25519Keypair
  ): Promise<string> {
    try {
      return await this?.walrusClient?.deleteBlob(walrusBlobId, signer);
    } catch (error) {
      if (error instanceof WalrusClientError) {
        throw error;
      }
      throw new WalrusClientError(
        `Failed to delete todo: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TODO_DELETE_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get storage information for a todo
   */
  async getTodoStorageInfo(walrusBlobId: string): Promise<{
    exists: boolean;
    blobInfo?: any;
    storageCost?: { total: bigint; storage: bigint; write: bigint };
  }> {
    try {
      const exists = await this?.walrusClient?.blobExists(walrusBlobId as any);

      if (!exists) {
        return { exists: false };
      }

      const blobInfo = await this?.walrusClient?.getBlobInfo(walrusBlobId as any);

      // Estimate storage cost based on blob size
      let storageCost;
      try {
        const size = blobInfo.size || 1024; // Default size estimate
        const cost = await this?.walrusClient?.calculateStorageCost(size, 5);
        storageCost = {
          total: cost.totalCost,
          storage: cost.storageCost,
          write: cost.writeCost,
        };
      } catch (error) {
        console.warn('Failed to calculate storage cost:', error);
      }

      return {
        exists: true,
        blobInfo,
        storageCost,
      };
    } catch (error) {
      console.error('Error getting todo storage info:', error);
      return { exists: false };
    }
  }

  /**
   * Batch operations for multiple todos
   */
  async createMultipleTodos(
    todos: Array<
      Omit<WalrusTodo, 'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'>
    >,
    signer: Signer | Ed25519Keypair,
    signAndExecuteTransaction?: (txb: TransactionBlock) => Promise<any>,
    options: WalrusTodoUploadOptions = {}
  ): Promise<WalrusTodoCreateResult[]> {
    const results: WalrusTodoCreateResult[] = [];
    const { onProgress } = options;

    for (let i = 0; i < todos.length; i++) {
      const todo = todos[i];
      onProgress?.(
        `Creating todo ${i + 1} of ${todos.length}`,
        (i / todos.length) * 100
      );

      try {
        const result = await this.createTodo(
          todo,
          signer,
          signAndExecuteTransaction,
          {
            ...options,
            onProgress: undefined, // Avoid nested progress callbacks
          }
        );
        results.push(result as any);
      } catch (error) {
        console.error(`Failed to create todo ${i + 1}:`, error);
        // Continue with other todos even if one fails
      }
    }

    onProgress?.('Batch creation complete', 100);
    return results;
  }

  /**
   * Check storage costs before operations
   */
  async estimateStorageCosts(
    todos: Array<
      Omit<WalrusTodo, 'id' | 'createdAt' | 'updatedAt' | 'blockchainStored'>
    >,
    epochs: number = 5
  ): Promise<{
    totalCost: bigint;
    totalSize: number;
    perTodoCost: Array<{ totalCost: bigint; size: number }>;
  }> {
    let totalCost = BigInt(0 as any);
    let totalSize = 0;
    const perTodoCost: Array<{ totalCost: bigint; size: number }> = [];

    for (const todo of todos) {
      const estimate = await this?.walrusStorage?.estimateTodoStorageCost(
        todo,
        epochs
      );
      totalCost += estimate.totalCost;
      totalSize += estimate.sizeBytes;
      perTodoCost.push({
        totalCost: estimate.totalCost,
        size: estimate.sizeBytes,
      });
    }

    return {
      totalCost,
      totalSize,
      perTodoCost,
    };
  }

  /**
   * Get current WAL balance
   */
  async getWalBalance(): Promise<string> {
    return this?.walrusClient?.getWalBalance();
  }

  /**
   * Get storage usage information
   */
  async getStorageUsage(): Promise<{ used: string; total: string }> {
    return this?.walrusClient?.getStorageUsage();
  }
}

// Export singleton instance for convenience
export const walrusTodoManager = new WalrusTodoManager();

// Export utility functions
export { ContentEncoder };

// Export error classes
export { WalrusClientError, WalrusRetryError, WalrusValidationError };

// Export types from walrus-client that are not already exported
export type { WalrusNetwork };
