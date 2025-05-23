/**
 * Todo types for frontend
 */

export type StorageLocation = 'local' | 'blockchain' | 'both';

export interface Todo {
  /** Unique identifier for the todo */
  id: string;
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
  /** URL to the todo image stored on Walrus */
  imageUrl?: string;
  /** Category of the todo item */
  category?: string;
  /** Name of the list the todo belongs to */
  listName?: string;
  /** Sync timestamp for API server integration */
  syncedAt?: string;
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