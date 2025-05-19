/**
 * @fileoverview Core Storage Interface - Defines the contract for all storage implementations
 *
 * This interface establishes a common API for all storage implementations in the system,
 * whether they store todos, images, or other data types. It abstracts away the underlying
 * storage medium (blockchain, local, etc.) and provides a consistent interface for basic
 * operations like connecting, storing, retrieving, and managing storage.
 */

import { StorageInfo, StorageUsage, StorageOptimizationResult, StorageConfig } from './StorageTypes';

/**
 * Core storage interface that all storage implementations must implement.
 * Defines standard operations for connecting, storing, retrieving, and managing storage.
 */
export interface IStorage {
  /**
   * Initializes the storage connection
   * @returns Promise that resolves when the connection is established
   * @throws {StorageError} if initialization fails
   */
  connect(): Promise<void>;
  
  /**
   * Terminates the storage connection, releasing any resources
   * @returns Promise that resolves when disconnection is complete
   */
  disconnect(): Promise<void>;
  
  /**
   * Checks if the storage is currently connected
   * @returns Promise resolving to boolean indicating connection status
   */
  isConnected(): Promise<boolean>;
  
  /**
   * Stores content in the storage system
   * @param content - The binary content to store
   * @param metadata - Additional metadata to associate with the content
   * @returns Promise resolving to the unique identifier for the stored content
   * @throws {StorageError} if storage operation fails
   */
  store(content: Uint8Array, metadata: Record<string, string>): Promise<string>;
  
  /**
   * Retrieves content from the storage system
   * @param id - The unique identifier for the content
   * @returns Promise resolving to object containing the content and its metadata
   * @throws {StorageError} if retrieval operation fails
   */
  retrieve(id: string): Promise<{ content: Uint8Array; metadata: Record<string, string> }>;
  
  /**
   * Updates existing content in the storage system
   * @param id - The unique identifier for the content to update
   * @param content - The new content
   * @param metadata - Updated metadata
   * @returns Promise resolving to the new identifier for the updated content
   * @throws {StorageError} if update operation fails
   */
  update(id: string, content: Uint8Array, metadata: Record<string, string>): Promise<string>;
  
  /**
   * Verifies the integrity of stored content
   * @param id - The unique identifier for the content
   * @param expectedChecksum - Optional expected checksum for verification
   * @returns Promise resolving to boolean indicating verification result
   */
  verify(id: string, expectedChecksum?: string): Promise<boolean>;
  
  /**
   * Ensures sufficient storage space is allocated for upcoming operations
   * @param sizeBytes - Required storage size in bytes
   * @returns Promise resolving to information about the allocated storage
   * @throws {StorageError} if allocation fails
   */
  ensureStorageAllocated(sizeBytes: number): Promise<StorageInfo>;
  
  /**
   * Gets current storage usage statistics
   * @returns Promise resolving to storage usage information
   */
  getStorageUsage(): Promise<StorageUsage>;
  
  /**
   * Optimizes storage usage by analyzing and potentially reusing storage
   * @returns Promise resolving to the optimization results
   */
  optimizeStorage(): Promise<StorageOptimizationResult>;
  
  /**
   * Gets the current storage configuration
   * @returns The current storage configuration
   */
  getConfig(): StorageConfig;
  
  /**
   * Updates the storage configuration
   * @param config - Partial configuration to update
   */
  setConfig(config: Partial<StorageConfig>): void;
}