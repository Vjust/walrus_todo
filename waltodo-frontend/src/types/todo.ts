/**
 * Todo types for frontend
 * Re-exported from @waltodo/shared-types for consistency
 */

// Import all types from shared package
import {
  Todo as SharedTodo,
  CreateTodoInput,
  UpdateTodoInput,
  TodoFilters,
  TodoSortOptions,
  TodoNFTMetadata,
  StorageLocation as SharedStorageLocation
} from '@waltodo/shared-types';

// Re-export shared types
export type { 
  CreateTodoInput,
  UpdateTodoInput,
  TodoFilters,
  TodoSortOptions,
  TodoNFTMetadata
};

// Map shared StorageLocation enum to string literal type for backward compatibility
export type StorageLocation = 'local' | 'blockchain' | 'both';

// Import ExtendedTodoMetadata from sui-client
import type { ExtendedTodoMetadata } from '@/lib/sui-client';

// Extend the shared Todo interface to add frontend-specific fields
export interface Todo extends Omit<SharedTodo, 'storageLocation' | 'description'> {
  /** Title of the todo item */
  title: string;
  /** Detailed description of the todo item */
  description?: string;
  /** Whether the todo is completed */
  completed: boolean;
  /** Priority level of the todo */
  priority: 'high' | 'medium' | 'low';
  /** Due date of the todo in YYYY-MM-DD format */
  dueDate?: string;
  /** Tags associated with the todo for categorization and filtering */
  tags: string[];
  /** Creation timestamp (ISO string) */
  createdAt: string;
  /** Last update timestamp (ISO string) */
  updatedAt: string;
  /** Completion timestamp (ISO string), only set when completed is true */
  completedAt?: string;
  /** Whether the todo is private (stored only locally) */
  private: boolean;
  /** Where the todo is stored (local, blockchain, or both) */
  storageLocation?: StorageLocation;
  /** Walrus blob ID for decentralized storage */
  walrusBlobId?: string;
  /** Sui NFT object ID referencing this todo */
  nftObjectId?: string;
  /** Sui object ID when stored on chain (alias for nftObjectId) */
  objectId?: string;
  /** Whether the todo is stored on blockchain */
  blockchainStored?: boolean;
  /** URL to the todo image stored on Walrus */
  imageUrl?: string;
  /** Thumbnail URLs for different sizes */
  thumbnails?: Record<string, string>;
  /** Category of the todo item */
  category?: string;
  /** Name of the list the todo belongs to */
  listName?: string;
  /** Sync timestamp for API server integration */
  syncedAt?: string;
  /** Raw metadata from blockchain */
  metadata?: string;
  /** Whether the todo is private on chain */
  isPrivate?: boolean;
  /** Owner address from blockchain */
  owner?: string;
  /** Extended metadata parsed from NFT */
  extendedMetadata?: ExtendedTodoMetadata;
}

export interface TodoList {
  /** Unique identifier for the todo list */
  id: string;
  /** Name of the todo list */
  name: string;
  /** Owner's identifier (typically blockchain address) */
  owner: string;
  /** Array of todo items in the list */
  todos: Todo[];
  /** Version number for the list, increments with changes */
  version: number;
  /** List of users who can access this list (blockchain addresses) */
  collaborators?: string[];
  /** Creation timestamp (ISO string) */
  createdAt: string;
  /** Last update timestamp (ISO string) */
  updatedAt: string;
  /** Walrus blob ID for decentralized storage of the list */
  walrusBlobId?: string;
  /** Sui object ID for this list on the Sui blockchain */
  suiObjectId?: string;
}

// Helper function to convert between storage location formats
export function mapStorageLocation(location?: string): StorageLocation | undefined {
  if (!location) return undefined;
  
  switch (location) {
    case 'local':
    case SharedStorageLocation.LOCAL:
      return 'local';
    case 'walrus':
    case SharedStorageLocation.WALRUS:
    case 'blockchain':
    case SharedStorageLocation.BLOCKCHAIN:
      return 'blockchain';
    case 'both':
      return 'both';
    default:
      return undefined;
  }
}

// Helper function to adapt shared Todo to frontend Todo
export function adaptSharedTodo(sharedTodo: SharedTodo): Todo {
  const storageLocation = mapStorageLocation(sharedTodo.storageLocation);
  const nftObjectId = sharedTodo.nftId;
  
  return {
    ...sharedTodo,
    description: sharedTodo.description || '',
    priority: sharedTodo.priority || 'medium',
    tags: sharedTodo.tags || [],
    createdAt: typeof sharedTodo.createdAt === 'string' 
      ? sharedTodo.createdAt 
      : new Date(sharedTodo.createdAt).toISOString(),
    updatedAt: typeof sharedTodo.updatedAt === 'string' 
      ? sharedTodo.updatedAt 
      : sharedTodo.updatedAt 
        ? new Date(sharedTodo.updatedAt).toISOString()
        : new Date().toISOString(),
    dueDate: sharedTodo.dueDate 
      ? (typeof sharedTodo.dueDate === 'string' 
        ? sharedTodo.dueDate 
        : new Date(sharedTodo.dueDate).toISOString())
      : undefined,
    private: false,
    storageLocation,
    walrusBlobId: sharedTodo.blobId,
    nftObjectId,
    objectId: nftObjectId, // Alias for compatibility
    blockchainStored: storageLocation === 'blockchain' || storageLocation === 'both',
    imageUrl: sharedTodo.nftMetadata?.image,
  };
}