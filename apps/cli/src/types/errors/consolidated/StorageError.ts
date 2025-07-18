/**
 * @file Storage error class for storage-related failures
 * Handles errors related to local and remote storage operations,
 * including file system, database, and blockchain storage.
 */

import { BaseError, BaseErrorOptions } from './BaseError';

/**
 * Options for StorageError construction
 */
export interface StorageErrorOptions extends BaseErrorOptions {
  /** Storage operation being performed */
  operation?: string;

  /** ID of the storage item (blob, file, etc.) */
  itemId?: string;

  /** Legacy: ID of the blob (use itemId instead) */
  blobId?: string;

  /** Type of storage (local, blockchain, walrus) */
  storageType?: 'local' | 'blockchain' | 'walrus' | string;

  /** Path to the file or resource if applicable */
  path?: string;
}

/**
 * Error thrown for storage-related failures
 */
export class StorageError extends BaseError {
  /** Storage operation being performed */
  public readonly operation?: string;

  /** ID of the storage item */
  public readonly itemId?: string;

  /** Legacy: ID of the blob (for backward compatibility) */
  public readonly blobId?: string;

  /** Type of storage */
  public readonly storageType?: string;

  /** Path to the file or resource */
  public readonly path?: string;

  /**
   * Create a new StorageError
   * @param message Error message
   * @param options Options for the error
   */
  constructor(message: string, options: Partial<StorageErrorOptions> = {}) {
    const {
      operation = 'unknown',
      itemId,
      blobId, // Support legacy blobId parameter
      storageType = 'unknown',
      path,
      recoverable = true, // Storage errors are often recoverable
      ...restOptions
    } = options;

    // Use blobId as itemId if itemId is not provided (backward compatibility)
    const finalItemId = itemId || blobId;

    // Build context with storage details
    const context = {
      ...(options.context || ({} as Record<string, unknown>)),
      ...(operation ? { operation } : {}),
      ...(storageType ? { storageType } : {}),
      // Avoid including actual paths/IDs in context for security
      // They're stored as properties of the error object instead
    };

    // Generate code based on operation
    const code = `STORAGE_${operation.toUpperCase()}_ERROR`;

    // Generate public message
    const publicMessage = `A storage operation failed`;

    // Call BaseError constructor
    super({
      message,
      code,
      context,
      recoverable,
      shouldRetry: recoverable,
      publicMessage,
      ...restOptions,
    });

    // Store operation
    this.operation = operation;

    // Store sensitive properties privately with non-enumerable descriptors
    Object.defineProperties(this, {
      itemId: {
        value: finalItemId,
        enumerable: false,
        writable: false,
        configurable: false,
      },
      blobId: {
        value: finalItemId, // For backward compatibility
        enumerable: false,
        writable: false,
        configurable: false,
      },
      storageType: {
        value: storageType,
        enumerable: false,
        writable: false,
        configurable: false,
      },
      path: {
        value: path,
        enumerable: false,
        writable: false,
        configurable: false,
      },
    });
  }

  /**
   * Create a StorageError for file not found
   * @param path File path
   * @param options Additional options
   * @returns New StorageError instance
   */
  static fileNotFound(
    path: string,
    options: Omit<
      StorageErrorOptions,
      'path' | 'operation' | 'storageType' | 'message'
    > = {}
  ): StorageError {
    return new StorageError(`File not found: ${path}`, {
      ...options,
      path,
      operation: 'read',
      storageType: 'local',
      recoverable: false,
    });
  }

  /**
   * Create a StorageError for permission denied
   * @param path File path
   * @param options Additional options
   * @returns New StorageError instance
   */
  static permissionDenied(
    path: string,
    options: Omit<StorageErrorOptions, 'path' | 'operation' | 'message'> = {}
  ): StorageError {
    return new StorageError(`Permission denied: ${path}`, {
      ...options,
      path,
      operation: 'access',
      recoverable: false,
    });
  }

  /**
   * Create a StorageError for blob not found
   * @param blobId Blob ID
   * @param options Additional options
   * @returns New StorageError instance
   */
  static blobNotFound(
    blobId: string,
    options: Omit<
      StorageErrorOptions,
      'itemId' | 'operation' | 'storageType' | 'message'
    > = {}
  ): StorageError {
    return new StorageError(`Blob not found: ${blobId}`, {
      ...options,
      itemId: blobId,
      operation: 'read',
      storageType: 'walrus',
      recoverable: false,
    });
  }
}
