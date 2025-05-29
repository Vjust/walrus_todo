/**
 * Unified Todo NFT types for both hooks and blockchain helpers
 * This ensures consistency between useSuiTodos and lib/sui-client
 */

import { 
  CreateTodoInput as SharedCreateTodoInput,
  UpdateTodoInput as SharedUpdateTodoInput,
  Todo as SharedTodo 
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

export interface Todo extends Omit<SharedTodo, 'storageLocation' | 'walrusUrls' | 'blobId' | 'transactionId' | 'nftId' | 'nftMetadata'> {
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
  createdAt?: number | string;
  completedAt?: number;
  updatedAt?: string;
  owner?: string;
  metadata?: string;
  isPrivate?: boolean;
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

// Re-export for backward compatibility
export type { CreateTodoParams as CreateTodoNFTParams, UpdateTodoParams as UpdateTodoNFTParams };