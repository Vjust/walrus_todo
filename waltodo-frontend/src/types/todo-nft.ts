/**
 * Unified Todo NFT types for both hooks and blockchain helpers
 * This ensures consistency between useSuiTodos and lib/sui-client
 */

import { 
  CreateTodoInput as SharedCreateTodoInput,
  Todo as SharedTodo,
  UpdateTodoInput as SharedUpdateTodoInput 
} from '@waltodo/shared-types';

export interface CreateTodoParams extends SharedCreateTodoInput {
  imageUrl?: string;
  metadata?: string;
  isPrivate?: boolean;
}

export interface UpdateTodoParams extends SharedUpdateTodoInput {
  objectId: string;
  imageUrl?: string;
  metadata?: string;
}

export interface Todo extends Omit<SharedTodo, 'storageLocation' | 'walrusUrls' | 'blobId' | 'transactionId' | 'nftId' | 'nftMetadata' | 'description' | 'createdAt' | 'updatedAt'> {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  tags?: string[];
  dueDate?: string;
  blockchainStored: boolean;
  objectId?: string; // Sui object ID when stored on chain
  imageUrl?: string;
  createdAt?: string; // ISO string timestamp
  completedAt?: string; // ISO string timestamp
  updatedAt?: string; // ISO string timestamp
  owner?: string;
  metadata?: string;
  isPrivate?: boolean;
  // Additional fields for NFT compatibility
  walrusBlobId?: string; // Walrus blob ID for the main todo data
  nftObjectId?: string; // Alias for objectId
  private?: boolean; // Alias for isPrivate
  listName?: string; // Name of the list this todo belongs to
  category?: string; // Category for organization
  
  // Enhanced NFT data fields
  isNFT?: boolean; // Flag to indicate if this is an NFT
  nftData?: {
    owner: string;
    createdAt?: number; // Unix timestamp
    completedAt?: number; // Unix timestamp
    updatedAt?: number; // Unix timestamp
    transferredAt?: number; // Unix timestamp
    previousOwner?: string; // Previous owner for transfer tracking
  };
}

export interface TodoList {
  name: string;
  todos: Todo[];
}

export interface TransactionResult {
  success: boolean;
  digest?: string;
  objectId?: string;
  error?: string;
}

export type NetworkType = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

// TodoNFT interface for NFT statistics
export interface TodoNFT {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  blobId: string;
  storageSize: number;
  createdAt: number; // Unix timestamp
  completedAt?: number; // Unix timestamp
  tags: string[];
  walTokensSpent: number;
}

// NFT-specific types
export interface NFTCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
}

export interface TodoNFTMetadata {
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  dueDate?: string;
  walrusBlobId?: string;
  category?: string;
  imageData?: {
    blobId: string;
    url: string;
    mimeType: string;
    size: number;
  };
  attributes?: Record<string, any>;
}

// Re-export for backward compatibility
export type { CreateTodoParams as CreateTodoNFTParams, UpdateTodoParams as UpdateTodoNFTParams };