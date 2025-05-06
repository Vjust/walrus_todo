/**
 * Defines where a todo is stored
 */
export type StorageLocation = 'local' | 'blockchain' | 'both';

/**
 * Represents a todo item with blockchain storage capabilities
 */
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
  /** Tags associated with the todo */
  tags: string[];
  /** Creation timestamp (ISO string) */
  createdAt: string;
  /** Last update timestamp (ISO string) */
  updatedAt: string;
  /** Completion timestamp (ISO string) */
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
}

/**
 * Represents a collection of todo items with blockchain integration
 */
export interface TodoList {
  /** Unique identifier for the todo list */
  id: string;
  /** Name of the todo list */
  name: string;
  /** Owner's identifier */
  owner: string;
  /** Array of todo items in the list */
  todos: Todo[];
  /** Version number for the list */
  version: number;
  /** List of users who can access this list */
  collaborators?: string[];
  /** Creation timestamp (ISO string) */
  createdAt: string;
  /** Last update timestamp (ISO string) */
  updatedAt: string;
  /** Walrus blob ID for decentralized storage of the list */
  walrusBlobId?: string;
  /** Sui object ID for this list */
  suiObjectId?: string;
}
