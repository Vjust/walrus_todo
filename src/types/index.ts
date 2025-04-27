/**
 * Type definitions for the application
 */

// Network types
export type NetworkType = 'devnet' | 'testnet' | 'mainnet' | 'localnet';
export type Network = 'testnet' | 'mainnet';

// Configuration types
export interface Config {
  network: NetworkType;
  walletAddress?: string;
  privateKey?: string;
}

// Todo types
export interface Todo {
  id: string;
  task: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  walrusBlobId?: string;
  isEncrypted?: boolean;
  isTest?: boolean;
  private?: boolean;
}

export interface TodoList {
  id: string;
  name: string;
  owner: string;
  todos: Todo[];
  version: number;
  collaborators?: string[];
  lastSynced?: string;
}

// Walrus types
export interface WalrusBlob {
  blobId: string;
  content: Uint8Array;
  metadata?: Record<string, any>;
}

// Smart contract types
export interface TodoListObject {
  id: string;
  name: string;
  owner: string;
  version: number;
  blobIds: string[];
  collaborators: string[];
}

// Error types
export class WalrusError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'WalrusError';
  }
}

export class SuiError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'SuiError';
  }
}

// Utility types
export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay?: number;
}