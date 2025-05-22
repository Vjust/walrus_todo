/**
 * WalrusClientAdapter
 *
 * This adapter reconciles differences between WalrusClient interface versions
 * from @mysten/walrus library and custom interfaces defined in the project.
 *
 * It provides a consistent interface that can be used by both mock implementations
 * and actual code without worrying about interface compatibility issues.
 *
 * The adapter follows the Adapter Pattern to normalize interactions with the Walrus storage
 * blockchain service, handling various version incompatibilities and interface differences.
 *
 * Key features:
 * - Version detection and compatibility handling
 * - Response normalization for consistent data structures
 * - Type conversion for blockchain-specific data types
 * - Graceful fallbacks for missing or changed functionality
 * - Transaction and signer abstraction for blockchain operations
 *
 * @module WalrusClientAdapter
 * @since 1.0.0
 * @example
 * ```typescript
 * // Create an adapter from any WalrusClient implementation
 * const walrusClient = getWalrusClient(); // Get from SDK
 * const adapter = createWalrusClientAdapter(walrusClient);
 *
 * // Use the adapter with a consistent interface regardless of underlying client version
 * const blobInfo = await adapter.getBlobInfo('blob-id-123');
 * console.log(blobInfo.blob_id); // Consistent property access
 * ```
 */

/**
 * Import types from the Walrus SDK to ensure type compatibility.
 * The SDK provides the base client interfaces and option types for blockchain operations.
 */
import {
  type WalrusClient as OriginalWalrusClient, // Original SDK client interface
  type WriteBlobOptions,         // Options for writing data blobs to storage
  type StorageWithSizeOptions,   // Options for allocating storage with specific size
  type RegisterBlobOptions,      // Options for registering existing blobs
  type DeleteBlobOptions,        // Options for deleting blobs from storage
  type CertifyBlobOptions,       // Options for certifying blob authenticity
  type WriteBlobAttributesOptions, // Options for updating blob metadata
  type GetStorageConfirmationOptions, // Options for confirming storage allocation
  type ReadBlobOptions           // Options for reading blob data
} from '@mysten/walrus';

/**
 * Import custom client interfaces defined in the project.
 * These extend the original SDK interfaces with additional functionality.
 */
import { type WalrusClient, type WalrusClientExt } from '../client';

/**
 * Import transaction types for blockchain operations.
 * These are used for creating and executing storage transactions.
 */
import { TransactionType } from '../transaction';

/**
 * Import cryptography and signing interfaces from Sui SDK.
 * These are essential for authenticating blockchain operations.
 */
import { Signer } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

/**
 * Import adapter interfaces for transactions and signers.
 * These provide abstraction over different versions of the SDK interfaces.
 */
// TransactionBlockAdapter imported but not used
import { SignerAdapter } from './SignerAdapter';

/**
 * Client version enum for better version handling
 *
 * This enum provides type-safe version identification for different Walrus client implementations.
 * It helps the adapter determine which methods and properties are available in the provided client.
 *
 * @enum {string}
 * @property {string} ORIGINAL - Original WalrusClient from the @mysten/walrus SDK
 * @property {string} CUSTOM - Custom WalrusClient interface defined in this project
 * @property {string} EXTENDED - Extended WalrusClient interface with additional functionality
 */
export enum WalrusClientVersion {
  ORIGINAL = 'original', // Base WalrusClient from SDK
  CUSTOM = 'custom',     // Project's WalrusClient interface
  EXTENDED = 'extended'  // Project's WalrusClientExt interface
}

/**
 * Error class for WalrusClientAdapter operations
 *
 * Custom error class that provides specific error handling for adapter-related issues.
 * This helps distinguish adapter errors from other types of errors in the application
 * and provides more detailed error messages for debugging.
 *
 * @extends Error
 * @class
 * @example
 * ```typescript
 * try {
 *   // Adapter operation
 * } catch (_error) {
 *   if (error instanceof WalrusClientAdapterError) {
 *     // Handle adapter-specific error
 *   } else {
 *     // Handle other errors
 *   }
 * }
 * ```
 */
export class WalrusClientAdapterError extends Error {
  /**
   * Creates a new WalrusClientAdapterError instance
   *
   * @param {string} message - The error message
   */
  constructor(message: string) {
    super(`WalrusClientAdapter Error: ${message}`);
    this.name = 'WalrusClientAdapterError';
  }
}

/**
 * Normalized blob object type that works with different library versions
 *
 * This interface defines a standardized structure for blob objects returned from various
 * versions of the Walrus client. It ensures consistent property access across different
 * library versions by normalizing property names and types.
 *
 * @interface
 * @property {string} blob_id - Unique identifier for the blob
 * @property {Object} [id] - Optional ID object with Sui format (used in newer versions)
 * @property {string} id.id - ID string in the id object
 * @property {number} [registered_epoch] - The epoch when the blob was registered
 * @property {Object} [storage_cost] - Cost information for storing the blob
 * @property {string} storage_cost.value - String representation of the storage cost
 * @property {Record<string, any>} [metadata] - User-defined blob metadata
 * @property {boolean} [deletable] - Whether the blob can be deleted
 * @property {number|string} [size] - Size of the blob in bytes (could be number or string)
 */
export interface NormalizedBlobObject {
  blob_id: string;
  id?: { id: string };
  registered_epoch?: number;
  storage_cost?: {
    value: string;
  };
  metadata?: Record<string, any>;
  deletable?: boolean;
  size?: number | string;
}

/**
 * Normalized write blob response that works with different library return types
 *
 * This interface provides a consistent structure for responses from writeBlob operations
 * across different Walrus client implementations. It normalizes the response format
 * to ensure consistent access to blob identifiers and associated objects.
 *
 * @interface
 * @property {string} blobId - Unique identifier for the written blob
 * @property {NormalizedBlobObject} blobObject - Normalized blob object with standard properties
 * @property {string} [digest] - Optional transaction digest when writeBlob was part of a transaction
 */
export interface NormalizedWriteBlobResponse {
  blobId: string;
  blobObject: NormalizedBlobObject;
  digest?: string;
}

/**
 * Common options for all adapter methods that handle transactions and signers
 *
 * This interface defines options that can be passed to any adapter method
 * that interacts with blockchain transactions. It provides a unified way to
 * specify transaction blocks and signers for blockchain operations.
 *
 * @interface
 * @property {TransactionType} [transaction] - Optional transaction block to include the operation in
 * @property {Signer|Ed25519Keypair|SignerAdapter} [signer] - Signer to authorize the transaction
 */
export interface AdapterOptions {
  transaction?: TransactionType;
  signer?: Signer | Ed25519Keypair | SignerAdapter;
}

/**
 * Unified WalrusClient interface that combines functionality from multiple interfaces
 *
 * This interface merges capabilities from all supported Walrus client versions, providing
 * a comprehensive interface for blockchain storage operations. It normalizes method
 * signatures and return types to ensure consistent behavior regardless of the underlying
 * client implementation.
 *
 * @interface
 */
export interface UnifiedWalrusClient {
  /**
   * Gets detailed information about a blob by its ID
   *
   * Retrieves metadata and storage details for a blob stored on the Walrus blockchain.
   *
   * @param {string} blobId - Unique identifier for the blob
   * @returns {Promise<NormalizedBlobObject>} Promise resolving to normalized blob information
   * @throws {WalrusClientAdapterError} If the blob cannot be found or there's a network error
   */
  getBlobInfo(blobId: string): Promise<NormalizedBlobObject>;

  /**
   * Reads a blob's content from blockchain storage
   *
   * Retrieves the binary data of a previously stored blob from the Walrus blockchain.
   *
   * @param {ReadBlobOptions} options - Options for reading the blob, including blob ID
   * @returns {Promise<Uint8Array>} Promise resolving to the binary content of the blob
   * @throws {WalrusClientAdapterError} If the blob cannot be found or there's a network error
   */
  readBlob(options: ReadBlobOptions): Promise<Uint8Array>;

  /**
   * Writes a blob to Walrus blockchain storage
   *
   * Stores binary data on the Walrus blockchain with optional metadata and configuration.
   * This operation requires a signer to pay for storage costs.
   *
   * @param {WriteBlobOptions|Object} options - Options for writing the blob
   * @param {Uint8Array} options.blob - Binary data to store
   * @param {Signer|Ed25519Keypair|SignerAdapter} options.signer - Signer to authorize the storage payment
   * @param {boolean} [options.deletable] - Whether the blob can be deleted later
   * @param {number} [options.epochs] - Number of epochs to store the blob
   * @param {Record<string, string>} [options.attributes] - Custom metadata for the blob
   * @param {TransactionType} [options.transaction] - Optional transaction to include this operation in
   * @returns {Promise<{blobId: string, blobObject: NormalizedBlobObject}>} Promise resolving to blob identifier and metadata
   * @throws {WalrusClientAdapterError} If the blob cannot be stored or there's a network error
   */
  writeBlob(options: WriteBlobOptions | {
    blob: Uint8Array;
    signer: Signer | Ed25519Keypair | SignerAdapter;
    deletable?: boolean;
    epochs?: number;
    attributes?: Record<string, string>;
    transaction?: TransactionType;
  }): Promise<{
    blobId: string; // Not optional
    blobObject: NormalizedBlobObject;
  }>;

  /**
   * Gets the Walrus client configuration
   *
   * Retrieves information about the connected Walrus network and client version.
   *
   * @returns {Promise<{network: string, version: string, maxSize: number}>} Promise resolving to client configuration
   * @throws {WalrusClientAdapterError} If there's a network error
   */
  getConfig(): Promise<{ network: string; version: string; maxSize: number }>;

  /**
   * Gets the WAL token balance for the connected account
   *
   * WAL tokens are used to pay for storage operations on the Walrus blockchain.
   *
   * @returns {Promise<string>} Promise resolving to the WAL balance as a string
   * @throws {WalrusClientAdapterError} If there's a network error
   */
  getWalBalance(): Promise<string>;

  /**
   * Gets storage usage information for the connected account
   *
   * Retrieves information about how much storage is being used and the total
   * storage allocation for the account.
   *
   * @returns {Promise<{used: string, total: string}>} Promise resolving to storage usage information
   * @throws {WalrusClientAdapterError} If there's a network error
   */
  getStorageUsage(): Promise<{ used: string; total: string }>;

  /**
   * Gets blob metadata for a specified blob
   *
   * Retrieves only the metadata portion of a blob without fetching its full content.
   *
   * @param {ReadBlobOptions} options - Options for reading the blob metadata
   * @returns {Promise<any>} Promise resolving to the blob metadata
   * @throws {WalrusClientAdapterError} If the blob cannot be found or there's a network error
   */
  getBlobMetadata(options: ReadBlobOptions): Promise<any>;

  /**
   * Verifies proof of availability for a blob
   *
   * Checks if a blob is available on the network and can be retrieved.
   *
   * @param {{blobId: string}} params - Parameters containing the blob ID to verify
   * @returns {Promise<boolean>} Promise resolving to true if the blob is available
   * @throws {WalrusClientAdapterError} If there's a network error
   */
  verifyPoA(params: { blobId: string }): Promise<boolean>;

  /**
   * Gets the full blob object for a specified blob ID
   *
   * Similar to getBlobInfo but may return additional blockchain-specific data.
   *
   * @param {{blobId: string}} params - Parameters containing the blob ID
   * @returns {Promise<NormalizedBlobObject>} Promise resolving to normalized blob information
   * @throws {WalrusClientAdapterError} If the blob cannot be found or there's a network error
   */
  getBlobObject(params: { blobId: string }): Promise<NormalizedBlobObject>;

  /**
   * Calculates storage cost for a given size and duration
   *
   * Estimates the cost of storing data of a specified size for a specified number of epochs.
   * Results include separate costs for storage and write operations, plus the total.
   *
   * @param {number} size - Size of the data in bytes
   * @param {number} epochs - Number of epochs to store the data
   * @returns {Promise<{storageCost: bigint, writeCost: bigint, totalCost: bigint}>} Promise resolving to cost information
   * @throws {WalrusClientAdapterError} If there's a network error
   */
  storageCost(size: number, epochs: number): Promise<{
    storageCost: bigint;
    writeCost: bigint;
    totalCost: bigint
  }>;

  /**
   * Gets blob size (extended functionality)
   *
   * Retrieves only the size of a blob without downloading its entire content.
   * This is an extension method that may not be available in all client versions.
   *
   * @param {string} blobId - Unique identifier for the blob
   * @returns {Promise<number>} Promise resolving to the blob size in bytes
   * @throws {WalrusClientAdapterError} If the blob cannot be found or there's a network error
   */
  getBlobSize?(blobId: string): Promise<number>;

  /**
   * Gets storage providers hosting a specific blob (extended functionality)
   *
   * Retrieves a list of storage provider identifiers that are currently hosting the blob.
   * This is an extension method that may not be available in all client versions.
   *
   * @param {{blobId: string}} params - Parameters containing the blob ID
   * @returns {Promise<string[]>} Promise resolving to an array of provider identifiers
   * @throws {WalrusClientAdapterError} If the blob cannot be found or there's a network error
   */
  getStorageProviders?(params: { blobId: string }): Promise<string[]>;

  /**
   * Resets the client connection (extended functionality)
   *
   * Clears any cached data and re-establishes the connection to the Walrus network.
   * This is an extension method that may not be available in all client versions.
   *
   * @returns {void}
   */
  reset?(): void;

  /**
   * Executes a transaction to certify a blob's authenticity
   *
   * Creates and executes a transaction that attests to the authenticity of a blob.
   * This is typically used in verification workflows.
   *
   * @param {CertifyBlobOptions & AdapterOptions} options - Options for the certification transaction
   * @returns {Promise<{digest: string}>} Promise resolving to the transaction digest
   * @throws {WalrusClientAdapterError} If the transaction fails or there's a network error
   */
  executeCertifyBlobTransaction?(
    options: CertifyBlobOptions & AdapterOptions
  ): Promise<{ digest: string }>;

  /**
   * Executes a transaction to update blob attributes
   *
   * Creates and executes a transaction that modifies metadata attributes for a blob.
   *
   * @param {WriteBlobAttributesOptions & AdapterOptions} options - Options for the attributes update
   * @returns {Promise<{digest: string}>} Promise resolving to the transaction digest
   * @throws {WalrusClientAdapterError} If the transaction fails or there's a network error
   */
  executeWriteBlobAttributesTransaction?(
    options: WriteBlobAttributesOptions & AdapterOptions
  ): Promise<{ digest: string }>;

  /**
   * Executes a transaction to register an existing blob
   *
   * Creates and executes a transaction that registers a blob that already exists in the network.
   * This is used when a blob was created outside of the current account but needs to be registered.
   *
   * @param {RegisterBlobOptions & AdapterOptions} options - Options for the registration
   * @returns {Promise<{blob: NormalizedBlobObject, digest: string}>} Promise resolving to the blob object and transaction digest
   * @throws {WalrusClientAdapterError} If the transaction fails or there's a network error
   */
  executeRegisterBlobTransaction?(
    options: RegisterBlobOptions & AdapterOptions
  ): Promise<{
    blob: NormalizedBlobObject;
    digest: string;
  }>;

  /**
   * Executes a transaction to create storage allocation
   *
   * Creates and executes a transaction that allocates storage for future blob storage.
   * Pre-allocating storage can be more cost-effective than allocating it for each blob.
   *
   * @param {StorageWithSizeOptions & AdapterOptions} options - Options for storage creation
   * @returns {Promise<{digest: string, storage: Object}>} Promise resolving to transaction digest and storage details
   * @throws {WalrusClientAdapterError} If the transaction fails or there's a network error
   */
  executeCreateStorageTransaction?(
    options: StorageWithSizeOptions & {
      transaction?: TransactionType;
      signer: Signer | Ed25519Keypair | SignerAdapter
    }
  ): Promise<{
    digest: string;
    storage: {
      id: { id: string };
      start_epoch: number;
      end_epoch: number;
      storage_size: string;
    }
  }>;

  /**
   * Creates a transaction function to delete a blob
   *
   * Returns a function that, when called with a transaction, adds the delete operation to that transaction.
   * This allows for composing multiple operations in a single transaction.
   *
   * @param {DeleteBlobOptions} options - Options for the blob deletion
   * @returns {Function} Function that accepts a transaction and returns a promise resolving to the transaction digest
   * @throws {WalrusClientAdapterError} If the operation cannot be added to the transaction
   */
  deleteBlob?(options: DeleteBlobOptions): (tx: TransactionType) => Promise<{ digest: string }>;

  /**
   * Gets storage confirmation from a specific node
   *
   * Verifies that a specific node is properly storing a blob by requesting a proof.
   * This is used for auditing storage provider compliance.
   *
   * @param {GetStorageConfirmationOptions} options - Options for the confirmation request
   * @returns {Promise<Object>} Promise resolving to verification details
   * @throws {WalrusClientAdapterError} If the confirmation fails or there's a network error
   */
  getStorageConfirmationFromNode?(
    options: GetStorageConfirmationOptions
  ): Promise<{ primary_verification: boolean; secondary_verification?: boolean; provider: string; signature?: string }>;

  /**
   * Creates a transaction block for storage allocation
   *
   * Creates a transaction block for allocating storage without executing it.
   * This allows for combining the storage creation with other operations in a single transaction.
   *
   * @param {number} size - Size of storage to allocate in bytes
   * @param {number} epochs - Number of epochs to allocate storage for
   * @returns {Promise<TransactionType>} Promise resolving to a transaction block
   * @throws {WalrusClientAdapterError} If the transaction block cannot be created
   */
  createStorageBlock?(size: number, epochs: number): Promise<TransactionType>;

  /**
   * Creates a transaction function to allocate storage
   *
   * Returns a function that, when called with a transaction, adds the storage allocation operation to that transaction.
   * This allows for composing multiple operations in a single transaction.
   *
   * @param {StorageWithSizeOptions} options - Options for storage creation
   * @returns {Function} Function that accepts a transaction and returns a promise resolving to storage details
   * @throws {WalrusClientAdapterError} If the operation cannot be added to the transaction
   */
  createStorage?(
    options: StorageWithSizeOptions
  ): (tx: TransactionType) => Promise<{
    digest: string;
    storage: {
      id: { id: string };
      start_epoch: number;
      end_epoch: number;
      storage_size: string;
    }
  }>;

  /**
   * Experimental methods for advanced or unstable features
   *
   * These methods are subject to change and may not be available in all client versions.
   * They are typically used for testing new functionality before it becomes stable.
   *
   * @property {Function} getBlobData - Retrieves specialized blob data in an implementation-specific format
   */
  experimental?: {
    getBlobData: () => Promise<any>;
  };

  /**
   * Gets the client version
   *
   * Returns the detected version of the underlying Walrus client implementation.
   * This helps determine which features are available.
   *
   * @returns {WalrusClientVersion} The detected client version enum value
   */
  getClientVersion(): WalrusClientVersion;

  /**
   * Gets the underlying WalrusClient implementation
   *
   * Provides access to the original client instance being adapted.
   * This is useful when direct access to the underlying client is required.
   *
   * @returns {OriginalWalrusClient|WalrusClient|WalrusClientExt} The underlying client implementation
   */
  getUnderlyingClient(): OriginalWalrusClient | WalrusClient | WalrusClientExt;
}

/**
 * WalrusClientAdapter interface (extends the unified interface)
 *
 * This interface adds adapter-specific lifecycle methods to the unified client interface.
 * The adapter provides version detection, method normalization, and response standardization
 * to ensure consistent behavior across different Walrus client implementations.
 *
 * @interface
 * @extends UnifiedWalrusClient
 * @example
 * ```typescript
 * // Create an adapter for a WalrusClient
 * const adapter: WalrusClientAdapter = createWalrusClientAdapter(walrusClient);
 *
 * // Use adapter with consistent interface regardless of client version
 * const config = await adapter.getConfig();
 * const blobData = await adapter.readBlob({ blobId: "myBlobId" });
 *
 * // Clean up when done
 * await adapter.close();
 * ```
 */
export interface WalrusClientAdapter extends UnifiedWalrusClient {
  /**
   * Abort all pending operations
   *
   * Cancels any in-progress operations and rejects their promises.
   * This is used for cleanup during disconnection or cancellation.
   *
   * @returns {Promise<void>} Promise that resolves when all operations are aborted
   */
  abort?(): Promise<void>;

  /**
   * Close all connections and release resources
   *
   * Properly terminates all connections to the Walrus network and releases any
   * acquired resources. This should be called when the client is no longer needed.
   *
   * @returns {Promise<void>} Promise that resolves when cleanup is complete
   */
  close?(): Promise<void>;
}

/**
 * Type guard to check if an object implements the original WalrusClient interface
 *
 * This function performs a runtime check to determine if the provided object
 * implements all the necessary methods of the OriginalWalrusClient interface.
 *
 * @param {any} client - The object to check for interface compatibility
 * @returns {boolean} True if the object implements OriginalWalrusClient
 * @example
 * ```typescript
 * if (isOriginalWalrusClient(unknownObject)) {
 *   // TypeScript now knows unknownObject is an OriginalWalrusClient
 *   const config = await unknownObject.getConfig();
 * }
 * ```
 */
export function isOriginalWalrusClient(client: any): client is OriginalWalrusClient {
  return client &&
         typeof client === 'object' &&
         typeof client.getBlobInfo === 'function' &&
         typeof client.readBlob === 'function' &&
         typeof client.writeBlob === 'function' &&
         typeof client.getConfig === 'function' &&
         typeof client.getWalBalance === 'function' &&
         typeof client.getStorageUsage === 'function';
}

/**
 * Type guard to check if an object implements the WalrusClient interface
 *
 * This function verifies if the provided object implements the custom WalrusClient
 * interface defined in the project, which extends the original SDK interface with
 * additional methods.
 *
 * @param {any} client - The object to check for interface compatibility
 * @returns {boolean} True if the object implements WalrusClient
 * @example
 * ```typescript
 * if (isWalrusClient(unknownObject)) {
 *   // TypeScript now knows unknownObject is a WalrusClient
 *   const verification = await unknownObject.verifyPoA({ blobId: "myBlobId" });
 * }
 * ```
 */
export function isWalrusClient(client: any): client is WalrusClient {
  return isOriginalWalrusClient(client) &&
         typeof client.getBlobObject === 'function' &&
         typeof client.verifyPoA === 'function';
}

/**
 * Type guard to check if an object implements the WalrusClientExt interface
 *
 * This function verifies if the provided object implements the extended WalrusClientExt
 * interface, which adds advanced functionality beyond the basic WalrusClient interface.
 *
 * @param {any} client - The object to check for interface compatibility
 * @returns {boolean} True if the object implements WalrusClientExt
 * @example
 * ```typescript
 * if (isWalrusClientExt(unknownObject)) {
 *   // TypeScript now knows unknownObject is a WalrusClientExt
 *   const blobSize = await unknownObject.getBlobSize("myBlobId");
 * }
 * ```
 */
export function isWalrusClientExt(client: any): client is WalrusClientExt {
  return isWalrusClient(client) &&
         typeof client.getBlobSize === 'function';
}

/**
 * Abstract base adapter implementation that provides common functionality
 *
 * This abstract class implements the core functionality of the WalrusClientAdapter interface.
 * It handles version detection, type conversion, and response normalization, providing
 * a solid foundation for version-specific adapter implementations to build upon.
 *
 * @abstract
 * @implements {WalrusClientAdapter}
 */
export abstract class BaseWalrusClientAdapter implements WalrusClientAdapter {
  /**
   * The underlying Walrus client being adapted
   */
  protected walrusClient: any;

  /**
   * The detected version of the Walrus client
   */
  protected clientVersion: WalrusClientVersion;

  /**
   * Creates a new BaseWalrusClientAdapter instance
   *
   * Initializes the adapter with a Walrus client instance and automatically
   * detects its version to determine available functionality.
   *
   * @param {any} walrusClient - The Walrus client instance to adapt
   * @throws {WalrusClientAdapterError} If the client is null or undefined
   */
  constructor(walrusClient: any) {
    if (!walrusClient) {
      throw new WalrusClientAdapterError('Cannot initialize WalrusClientAdapter with null or undefined client');
    }
    this.walrusClient = walrusClient;
    this.clientVersion = this.detectClientVersion(walrusClient);
  }

  /**
   * Gets the underlying WalrusClient implementation
   *
   * Provides access to the original client instance being adapted.
   *
   * @returns {any} The underlying client implementation
   */
  public getUnderlyingClient(): any {
    return this.walrusClient;
  }

  /**
   * Gets the current client version
   *
   * Returns the detected version of the underlying Walrus client.
   *
   * @returns {WalrusClientVersion} The detected client version
   */
  public getClientVersion(): WalrusClientVersion {
    return this.clientVersion;
  }

  /**
   * Detects the client version based on available methods
   *
   * Uses type guards and feature detection to determine which version
   * of the Walrus client interface is implemented by the provided client.
   *
   * @param {any} client - The client to detect the version of
   * @returns {WalrusClientVersion} The detected client version
   * @throws {WalrusClientAdapterError} If the client is null or undefined
   */
  protected detectClientVersion(client: any): WalrusClientVersion {
    if (!client) {
      throw new WalrusClientAdapterError('Cannot detect version of null or undefined client');
    }

    // Check for V3 (extended) methods
    if (isWalrusClientExt(client)) {
      return WalrusClientVersion.EXTENDED;
    }

    // Check for V2 (custom) methods
    if (isWalrusClient(client)) {
      return WalrusClientVersion.CUSTOM;
    }

    // Default to V1 (original)
    if (isOriginalWalrusClient(client)) {
      return WalrusClientVersion.ORIGINAL;
    }

    // If types don't match exactly, use method detection as a fallback
    if (('getBlobSize' in client && typeof client.getBlobSize === 'function') ||
        ('experimental' in client && client.experimental)) {
      return WalrusClientVersion.EXTENDED;
    }

    if (('getBlobObject' in client && typeof client.getBlobObject === 'function') &&
        ('verifyPoA' in client && typeof client.verifyPoA === 'function')) {
      return WalrusClientVersion.CUSTOM;
    }

    // Default to original as the base version
    return WalrusClientVersion.ORIGINAL;
  }

  /**
   * Ensures the client is initialized before using it
   *
   * Checks that the client is properly initialized and throws an error if not.
   * This method should be called before any client operations.
   *
   * @throws {WalrusClientAdapterError} If the client is not initialized
   */
  protected ensureClientInitialized(): void {
    if (!this.walrusClient) {
      throw new WalrusClientAdapterError('WalrusClient not initialized');
    }
  }

  /**
   * Helper to safely convert various types to bigint
   *
   * Handles conversion of different numeric representations (number, string, object)
   * to the bigint type used in blockchain calculations.
   *
   * @param {any} value - The value to convert to bigint
   * @returns {bigint} The converted bigint value
   * @throws {WalrusClientAdapterError} If the value cannot be converted to bigint
   */
  protected toBigInt(value: any): bigint {
    if (typeof value === 'bigint') {
      return value;
    }

    if (typeof value === 'number') {
      return BigInt(value);
    }

    if (typeof value === 'string') {
      try {
        return BigInt(value);
      } catch (e) {
        throw new WalrusClientAdapterError(`Cannot convert string to bigint: ${value}`);
      }
    }

    // Proper type guard to check if value is an object and has toString method
    if (value !== null &&
        typeof value === 'object' &&
        'toString' in value &&
        typeof value.toString === 'function') {
      try {
        return BigInt(value.toString());
      } catch (e) {
        throw new WalrusClientAdapterError(`Cannot convert value to bigint: ${value}`);
      }
    }

    throw new WalrusClientAdapterError(`Unsupported value type for bigint conversion: ${typeof value}`);
  }

  /**
   * Extracts the underlying transaction from a transaction adapter
   *
   * Handles both raw transaction blocks and transaction adapter objects,
   * extracting the underlying transaction block for use with the Walrus client.
   *
   * @param {TransactionType} tx - The transaction or transaction adapter
   * @returns {any} The extracted underlying transaction block
   */
  protected extractTransaction(tx: TransactionType): any {
    if (!tx) return undefined;

    if (typeof tx === 'object' && tx !== null) {
      // Check for adapter interfaces
      if ('getUnderlyingBlock' in tx && typeof tx.getUnderlyingBlock === 'function') {
        return tx.getUnderlyingBlock();
      }

      if ('getTransactionBlock' in tx && typeof tx.getTransactionBlock === 'function') {
        return tx.getTransactionBlock();
      }

      // Check if it's already a TransactionBlock
      if (tx.constructor && tx.constructor.name === 'TransactionBlock') {
        return tx;
      }
    }

    // Return as-is if no adapter methods found
    return tx;
  }

  /**
   * Extracts the underlying signer from a signer adapter
   *
   * Handles both raw signers and signer adapter objects,
   * extracting the underlying signer for use with the Walrus client.
   *
   * @param {Signer|Ed25519Keypair|SignerAdapter} signer - The signer or signer adapter
   * @returns {any} The extracted underlying signer
   */
  protected extractSigner(signer: Signer | Ed25519Keypair | SignerAdapter): any {
    if (!signer) return undefined;

    if (typeof signer === 'object' && signer !== null) {
      // Check for adapter interfaces
      if ('getUnderlyingSigner' in signer && typeof signer.getUnderlyingSigner === 'function') {
        return signer.getUnderlyingSigner();
      }

      if ('getSigner' in signer && typeof signer.getSigner === 'function') {
        return signer.getSigner();
      }
    }

    // Return as-is if no adapter methods found
    return signer;
  }

  /**
   * Extracts adapters from options object
   *
   * Processes an options object to extract and convert any adapters (transaction or signer)
   * to their underlying implementations. This ensures compatibility with the Walrus client.
   *
   * @template T - The type of the options object
   * @param {T} options - The options object potentially containing adapters
   * @returns {T} The processed options with adapters extracted
   */
  protected extractAdapters<T extends Record<string, any>>(options: T): T {
    const result = { ...options } as T & {
      transaction?: TransactionType;
      signer?: Signer | Ed25519Keypair | SignerAdapter;
    };

    // Use explicit type checking instead of property access to avoid type errors
    if (result && typeof result === 'object' && 'transaction' in result && result.transaction) {
      // Extract the transaction object from the adapter
      result.transaction = this.extractTransaction(result.transaction as TransactionType);
    }

    if (result && typeof result === 'object' && 'signer' in result && result.signer) {
      // Extract the signer object from the adapter
      result.signer = this.extractSigner(result.signer as Signer | Ed25519Keypair | SignerAdapter);
    }

    return result;
  }

  /**
   * Normalizes a blob object to ensure consistent structure
   *
   * Processes blob objects from different Walrus client versions to
   * ensure they conform to the NormalizedBlobObject interface, providing
   * consistent property access regardless of the original format.
   *
   * @param {any} blob - The blob object to normalize
   * @returns {NormalizedBlobObject} The normalized blob object
   */
  protected normalizeBlobObject(blob: any): NormalizedBlobObject {
    if (!blob) {
      return {
        blob_id: '',
        deletable: false
      };
    }

    // Handle different object structures
    const normalizedBlob: NormalizedBlobObject = {
      blob_id: '',
      id: undefined,
      registered_epoch: 0,
      storage_cost: { value: '0' },
      metadata: {},
      deletable: false,
      size: 0
    };

    // Extract blob_id with proper type checking
    if (typeof blob.blob_id === 'string') {
      normalizedBlob.blob_id = blob.blob_id;
    } else if (blob.id && typeof blob.id === 'object' && typeof blob.id.id === 'string') {
      normalizedBlob.blob_id = blob.id.id;
    }

    // Extract id
    if (blob.id && typeof blob.id === 'object') {
      normalizedBlob.id = blob.id;
    } else if (typeof blob.blob_id === 'string') {
      normalizedBlob.id = { id: blob.blob_id };
    }

    // Extract other properties with proper type checking
    if (typeof blob.registered_epoch === 'number') {
      normalizedBlob.registered_epoch = blob.registered_epoch;
    } else if (typeof blob.registered_epoch === 'string') {
      normalizedBlob.registered_epoch = parseInt(blob.registered_epoch, 10);
    }

    if (blob.storage_cost && typeof blob.storage_cost === 'object') {
      normalizedBlob.storage_cost = blob.storage_cost;
    }

    if (blob.metadata && typeof blob.metadata === 'object') {
      normalizedBlob.metadata = blob.metadata;
    }

    normalizedBlob.deletable = Boolean(blob.deletable);

    // Extract size
    if (typeof blob.size === 'number') {
      normalizedBlob.size = blob.size;
    } else if (typeof blob.size === 'string') {
      normalizedBlob.size = parseInt(blob.size, 10);
    }

    return normalizedBlob;
  }

  /**
   * Normalizes a write blob response to ensure consistent structure
   *
   * Processes write blob responses from different Walrus client versions to
   * ensure they conform to the NormalizedWriteBlobResponse interface, providing
   * consistent property access regardless of the original format.
   *
   * @param {any} response - The write blob response to normalize
   * @returns {NormalizedWriteBlobResponse} The normalized write blob response
   * @throws {WalrusClientAdapterError} If the response is empty or missing required data
   */
  protected normalizeWriteBlobResponse(response: any): NormalizedWriteBlobResponse {
    if (!response) {
      throw new WalrusClientAdapterError('Empty response from writeBlob operation');
    }

    // Extract blobId from various possible locations with proper type checking
    let blobId = '';

    if (typeof response === 'string') {
      blobId = response;
    } else if (typeof response.blobId === 'string') {
      blobId = response.blobId;
    } else if (response.blobObject && typeof response.blobObject.blob_id === 'string') {
      blobId = response.blobObject.blob_id;
    } else if (typeof response.blob_id === 'string') {
      blobId = response.blob_id;
    } else if (response.blobObject && response.blobObject.id &&
              typeof response.blobObject.id === 'object' &&
              typeof response.blobObject.id.id === 'string') {
      blobId = response.blobObject.id.id;
    }

    if (!blobId) {
      throw new WalrusClientAdapterError('Could not extract blobId from writeBlob response');
    }

    // Prepare the normalized blob object
    let blobObject: NormalizedBlobObject;

    if (response.blobObject) {
      blobObject = this.normalizeBlobObject(response.blobObject);
    } else {
      blobObject = { blob_id: blobId, deletable: false };
    }

    return {
      blobId,
      blobObject,
      digest: typeof response.digest === 'string' ? response.digest : ''
    };
  }

  /**
   * Abstract methods that need to be implemented by version-specific adapters
   * These methods form the core API that all adapters must implement regardless of client version
   */

  /**
   * Gets information about a blob
   *
   * @param {string} blobId - Unique identifier for the blob
   * @returns {Promise<NormalizedBlobObject>} Promise resolving to normalized blob information
   * @abstract
   */
  abstract getBlobInfo(blobId: string): Promise<NormalizedBlobObject>;

  /**
   * Reads a blob's content
   *
   * @param {ReadBlobOptions} options - Options for reading the blob
   * @returns {Promise<Uint8Array>} Promise resolving to the blob content
   * @abstract
   */
  abstract readBlob(options: ReadBlobOptions): Promise<Uint8Array>;

  /**
   * Writes a blob to Walrus storage
   *
   * @param {any} options - Options for writing the blob
   * @returns {Promise<{blobId: string, blobObject: NormalizedBlobObject}>} Promise resolving to blob info
   * @abstract
   */
  abstract writeBlob(options: any): Promise<{ blobId: string; blobObject: NormalizedBlobObject }>;

  /**
   * Gets the client configuration
   *
   * @returns {Promise<{network: string, version: string, maxSize: number}>} Promise resolving to configuration
   * @abstract
   */
  abstract getConfig(): Promise<{ network: string; version: string; maxSize: number }>;

  /**
   * Gets the WAL token balance
   *
   * @returns {Promise<string>} Promise resolving to the balance
   * @abstract
   */
  abstract getWalBalance(): Promise<string>;

  /**
   * Gets storage usage information
   *
   * @returns {Promise<{used: string, total: string}>} Promise resolving to usage information
   * @abstract
   */
  abstract getStorageUsage(): Promise<{ used: string; total: string }>;

  /**
   * Gets blob metadata
   *
   * @param {ReadBlobOptions} options - Options for reading the blob metadata
   * @returns {Promise<any>} Promise resolving to the metadata
   * @abstract
   */
  abstract getBlobMetadata(options: ReadBlobOptions): Promise<any>;

  /**
   * Verifies proof of availability
   *
   * @param {{blobId: string}} params - Parameters containing the blob ID
   * @returns {Promise<boolean>} Promise resolving to verification result
   * @abstract
   */
  abstract verifyPoA(params: { blobId: string }): Promise<boolean>;

  /**
   * Gets the blob object
   *
   * @param {{blobId: string}} params - Parameters containing the blob ID
   * @returns {Promise<NormalizedBlobObject>} Promise resolving to the blob object
   * @abstract
   */
  abstract getBlobObject(params: { blobId: string }): Promise<NormalizedBlobObject>;

  /**
   * Gets storage cost for given size and epochs
   *
   * @param {number} size - Size of data in bytes
   * @param {number} epochs - Number of epochs to store
   * @returns {Promise<{storageCost: bigint, writeCost: bigint, totalCost: bigint}>} Promise resolving to cost information
   * @abstract
   */
  abstract storageCost(size: number, epochs: number): Promise<{ storageCost: bigint; writeCost: bigint; totalCost: bigint }>;
}

/**
 * Factory function to create a WalrusClientAdapter instance
 *
 * This function creates the appropriate adapter implementation based on the
 * detected version of the provided client. The actual implementation is in
 * walrus-client-adapter.ts, which should be imported by client code.
 *
 * @param {OriginalWalrusClient|WalrusClient|WalrusClientExt|any} client - The client to adapt
 * @returns {WalrusClientAdapter} The adapter instance for the provided client
 * @throws {Error} If called directly (should be imported from implementation file)
 * @example
 * ```typescript
 * // In client code:
 * import { createWalrusClientAdapter } from '../utils/adapters';
 * import { WalrusClient } from '@mysten/walrus';
 *
 * const client = new WalrusClient();
 * const adapter = createWalrusClientAdapter(client);
 *
 * // Use the adapter interface
 * const blobInfo = await adapter.getBlobInfo('blob-id-123');
 * ```
 */
export function createWalrusClientAdapter(
  _client: OriginalWalrusClient | WalrusClient | WalrusClientExt | any
): WalrusClientAdapter {
  // This is just a placeholder - the actual implementation will be in walrus-client-adapter.ts
  throw new Error('Implementation moved to walrus-client-adapter.ts');
}