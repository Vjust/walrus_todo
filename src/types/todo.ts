/**
 * Todo Data Model Types
 *
 * This file defines the core data structures for the todo application.
 * It includes definitions for todo items, todo lists, and their related metadata.
 * The data model supports both local storage and blockchain integration through
 * Walrus decentralized storage and Sui blockchain.
 *
 * @module TodoTypes
 */

/**
 * Defines where a todo is stored in the system
 *
 * @typedef {('local'|'blockchain'|'both')} StorageLocation
 * @property {'local'} local - Stored only in local filesystem
 * @property {'blockchain'} blockchain - Stored only on blockchain (Walrus/Sui)
 * @property {'both'} both - Stored in both local filesystem and blockchain
 */
export type StorageLocation = 'local' | 'blockchain' | 'both';

/**
 * Represents a todo item with blockchain storage capabilities
 *
 * Todo items are the core entity in the application. They can be stored locally,
 * on the blockchain, or both, depending on the user's configuration and privacy needs.
 * Todos support rich metadata including priority, due dates, tags, and can be
 * represented as NFTs on the Sui blockchain.
 *
 * @interface Todo
 * @property {string} id - Unique identifier for the todo
 * @property {string} title - Title of the todo item
 * @property {string} [description] - Detailed description of the todo item
 * @property {boolean} completed - Whether the todo is completed
 * @property {'high'|'medium'|'low'} priority - Priority level of the todo
 * @property {string} [dueDate] - Due date of the todo in YYYY-MM-DD format
 * @property {string[]} tags - Tags associated with the todo for categorization and filtering
 * @property {string} createdAt - Creation timestamp (ISO string)
 * @property {string} updatedAt - Last update timestamp (ISO string)
 * @property {string} [completedAt] - Completion timestamp (ISO string), only set when completed is true
 * @property {boolean} private - Whether the todo is private (stored only locally)
 * @property {StorageLocation} [storageLocation] - Where the todo is stored (local, blockchain, or both)
 * @property {string} [walrusBlobId] - Walrus blob ID for decentralized storage
 * @property {string} [nftObjectId] - Sui NFT object ID referencing this todo
 * @property {string} [imageUrl] - URL to the todo image stored on Walrus
 * @property {string} [category] - Category of the todo item
 * @property {string} [listName] - Name of the list the todo belongs to
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

// Additional types for API inputs and operations
export interface CreateTodoInput {
  title: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  dueDate?: string;
  tags?: string[];
  category?: string;
  listName?: string;
}

export interface UpdateTodoInput {
  title?: string;
  description?: string;
  completed?: boolean;
  priority?: 'high' | 'medium' | 'low';
  dueDate?: string;
  tags?: string[];
  category?: string;
}

export type Priority = 'high' | 'medium' | 'low';
export type TodoStatus = 'pending' | 'completed' | 'archived';

export interface TodoMetadata {
  totalCount: number;
  completedCount: number;
  pendingCount: number;
  highPriorityCount: number;
  overdueCount: number;
}

export interface TodoFilter {
  completed?: boolean;
  priority?: Priority;
  tags?: string[];
  category?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export type SortBy = 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'title';
export type SortOrder = 'asc' | 'desc';

export interface OfflineData {
  todos: Todo[];
  syncedAt?: string;
  version: number;
}

export interface SyncData {
  todos: Todo[];
  deletedIds: string[];
  lastSyncedAt: string;
  version: number;
}

/**
 * Represents a collection of todo items with blockchain integration
 *
 * TodoList serves as a container for organizing multiple related todos.
 * Lists can be shared with collaborators and stored on the blockchain.
 * Each list maintains its own version for tracking changes and synchronization.
 *
 * @interface TodoList
 * @property {string} id - Unique identifier for the todo list
 * @property {string} name - Name of the todo list
 * @property {string} owner - Owner's identifier (typically blockchain address)
 * @property {Todo[]} todos - Array of todo items in the list
 * @property {number} version - Version number for the list, increments with changes
 * @property {string[]} [collaborators] - List of users who can access this list (blockchain addresses)
 * @property {string} createdAt - Creation timestamp (ISO string)
 * @property {string} updatedAt - Last update timestamp (ISO string)
 * @property {string} [walrusBlobId] - Walrus blob ID for decentralized storage of the list
 * @property {string} [suiObjectId] - Sui object ID for this list on the Sui blockchain
 */
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

/**
 * Parameters for creating a new todo item
 */
export interface CreateTodoParams {
  /** Title of the todo item */
  title: string;
  /** Detailed description of the todo item */
  description?: string;
  /** Priority level of the todo */
  priority: 'high' | 'medium' | 'low';
  /** Due date of the todo in YYYY-MM-DD format */
  dueDate?: string;
  /** Tags associated with the todo for categorization and filtering */
  tags?: string[];
  /** Whether the todo is private (stored only locally) */
  private?: boolean;
  /** Where the todo is stored (local, blockchain, or both) */
  storageLocation?: StorageLocation;
  /** URL to the todo image stored on Walrus */
  imageUrl?: string;
}

/**
 * Parameters for updating an existing todo item
 */
export interface UpdateTodoParams {
  /** Todo ID to update */
  id: string;
  /** Title of the todo item */
  title?: string;
  /** Detailed description of the todo item */
  description?: string;
  /** Whether the todo is completed */
  completed?: boolean;
  /** Priority level of the todo */
  priority?: 'high' | 'medium' | 'low';
  /** Due date of the todo in YYYY-MM-DD format */
  dueDate?: string;
  /** Tags associated with the todo for categorization and filtering */
  tags?: string[];
  /** Whether the todo is private (stored only locally) */
  private?: boolean;
  /** Where the todo is stored (local, blockchain, or both) */
  storageLocation?: StorageLocation;
}

/**
 * Result of a blockchain transaction
 */
export interface TransactionResult {
  /** Transaction hash/digest */
  digest: string;
  /** Whether the transaction was successful */
  success: boolean;
  /** Error message if the transaction failed */
  error?: string;
  /** Gas cost of the transaction */
  gasCost?: number;
  /** Additional metadata about the transaction */
  metadata?: Record<string, string | number | boolean | null>;
}

/**
 * Supported network types
 */
export type NetworkType = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

/**
 * Context information for error reporting
 */
export interface ErrorContext {
  /** The operation being performed when the error occurred */
  operation: string;
  /** Network being used */
  network?: NetworkType;
  /** Todo ID if relevant */
  todoId?: string;
  /** List name if relevant */
  listName?: string;
  /** Additional context data */
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

// Helper functions for todo operations
export function createTodo(input: CreateTodoInput): Todo {
  const now = new Date().toISOString();
  return {
    id: `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: input.title,
    description: input.description,
    completed: false,
    priority: input.priority || 'medium',
    dueDate: input.dueDate,
    tags: input.tags || [],
    createdAt: now,
    updatedAt: now,
    private: false,
    category: input.category,
    listName: input.listName
  };
}

export function createTodoList(name: string, owner: string): TodoList {
  const now = new Date().toISOString();
  return {
    id: `list-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    owner,
    todos: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
    shared: false,
    collaborators: [],
    metadata: {},
    description: ''
  };
}

export function validateTodo(todo: unknown): todo is Todo {
  if (!todo || typeof todo !== 'object') return false;
  const t = todo as Record<string, unknown>;
  return (
    typeof t.id === 'string' &&
    typeof t.title === 'string' &&
    typeof t.completed === 'boolean' &&
    ['high', 'medium', 'low'].includes(t.priority as string) &&
    Array.isArray(t.tags) &&
    typeof t.createdAt === 'string' &&
    typeof t.updatedAt === 'string' &&
    typeof t.private === 'boolean'
  );
}

export function validateTodoList(list: unknown): list is TodoList {
  if (!list || typeof list !== 'object') return false;
  const l = list as Record<string, unknown>;
  return (
    typeof l.id === 'string' &&
    typeof l.name === 'string' &&
    typeof l.owner === 'string' &&
    Array.isArray(l.todos) &&
    typeof l.version === 'number' &&
    typeof l.createdAt === 'string' &&
    typeof l.updatedAt === 'string'
  );
}

export function serializeTodo(todo: Todo): string {
  return JSON.stringify(todo);
}

export function deserializeTodo(data: string): Todo {
  const parsed = JSON.parse(data);
  if (!validateTodo(parsed)) {
    throw new Error('Invalid todo data');
  }
  return parsed;
}
