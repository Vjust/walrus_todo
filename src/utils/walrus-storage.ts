/**
 * @fileoverview Walrus Storage Interface - Manages Todo and TodoList data on Walrus decentralized storage platform
 *
 * This module provides a robust interface to interact with Walrus, a decentralized storage platform built on the
 * Sui blockchain. It handles storage allocation, data verification, transaction management, and error handling
 * for Todo and TodoList entities. Key features include:
 *
 * - Secure storage and retrieval of Todo data with checksum verification
 * - Optimized storage allocation with reuse analysis to minimize costs
 * - Automatic retry for network operations with proper error categorization
 * - In-memory caching for frequently accessed items
 * - Transaction management for blockchain operations
 *
 * The implementation handles various blockchain-specific edge cases such as transaction building,
 * signature verification, and client compatibility between different versions of the Sui SDK.
 *
 * @module walrus-storage
 * @requires @mysten/sui.js/client
 * @requires @mysten/walrus
 * @requires crypto
 */

import { Todo, TodoList } from '../types/todo';
import { withRetry } from './error-handler';
import { NETWORK_URLS, CURRENT_NETWORK } from '../constants';
import { TodoSerializer } from './todo-serializer';
import { TodoSizeCalculator } from './todo-size-calculator';
import { CLIError } from '../types/error';
import { SuiClient, SuiObjectData, SuiObjectResponse, type MoveStruct } from '@mysten/sui.js/client';
import { WalrusClient } from '@mysten/walrus';
import { MockWalrusClient } from './MockWalrusClient';
import type { WalrusClientExt, WalrusClientWithExt } from '../types/client';
import { createWalrusClientAdapter, WalrusClientAdapter } from './adapters/walrus-client-adapter';
import { KeystoreSigner } from './sui-keystore';
import type { TransactionSigner } from '../types/signer';
import { execSync } from 'child_process';
import { handleError } from './error-handler';
import crypto from 'crypto';
import { StorageManager } from './storage-manager';
// Import the storage reuse analyzer as a type to avoid direct dependency
import type { StorageReuseAnalyzer } from './storage-reuse-analyzer';
// Import the Transaction type
import { Transaction, createTransaction, TransactionType } from '../types/transaction';
import { TransactionBlockAdapter } from '../types/adapters/TransactionBlockAdapter';
import { createTransactionBlockAdapter } from './adapters/transaction-adapter';
// Import error handling helpers
import {
  AsyncOperationHandler,
  AsyncOperationOptions,
  categorizeWalrusError,
  mapToWalrusError,
  ErrorCategory
} from './walrus-error-handler';
import {
  NetworkError,
  StorageError,
  BlockchainError,
  TransactionError
} from '../types/errors';
import { ValidationError } from '../types/errors/ValidationError';

/**
 * @interface VerificationResult
 * @description Result of a blob verification operation, indicating whether content matches expected data
 * @property {Object} [details] - Detailed verification information
 * @property {boolean} [details.certified] - Whether the blob was certified as matching expected data
 * @property {string} [details.checksum] - SHA-256 checksum of the blob if verification was successful
 */
interface VerificationResult {
  details?: {
    certified: boolean;
    checksum?: string;
  };
}

/**
 * @interface WalrusStorageContent
 * @description Represents the content of a Walrus storage object as returned by the Sui blockchain
 * @property {string} dataType - Type of the data ('moveObject' for storage objects)
 * @property {Object} fields - Fields of the storage object
 * @property {string} fields.storage_size - Total allocated storage size in bytes
 * @property {string} fields.used_size - Currently used storage in bytes
 * @property {string} fields.end_epoch - Expiration epoch number
 * @property {boolean} hasPublicTransfer - Whether the object can be transferred
 * @property {string} type - Type identifier for the Move object
 */
interface WalrusStorageContent {
  dataType: 'moveObject';
  fields: {
    [key: string]: string | number | boolean | null;
    storage_size: string;
    used_size: string;
    end_epoch: string;
  };
  hasPublicTransfer: boolean;
  type: string;
}

/**
 * @interface WalrusStorageInfo
 * @description Comprehensive information about a Walrus storage object with metadata
 * @property {{ id: string } | null} id - Unique identifier for the storage object or null if not available
 * @property {string | number | null} storage_size - Total allocated storage size in bytes
 * @property {string | number | null} used_size - Currently used storage in bytes
 * @property {string | number | null} end_epoch - Expiration epoch number
 * @property {string | number | null} start_epoch - Starting epoch number
 * @property {SuiObjectData | null} [data] - Raw Sui object data if available
 * @property {WalrusStorageContent | null} content - Structured content of the storage object
 */
interface WalrusStorageInfo {
  id: { id: string } | null;
  storage_size: string | number | null;
  used_size: string | number | null;
  end_epoch: string | number | null;
  start_epoch: string | number | null;
  data?: SuiObjectData | null;
  content: WalrusStorageContent | null;
}

/**
 * Safely converts various types to a number with a fallback value
 * @param {string | number | null | undefined} value - The value to convert to a number
 * @param {number} [fallback=0] - The fallback value to use if conversion fails
 * @returns {number} The converted number or fallback value if conversion is not possible
 * @example
 * // Returns 123
 * safeToNumber('123', 0);
 *
 * // Returns 0 (fallback value)
 * safeToNumber(null, 0);
 *
 * // Returns 10 (fallback value)
 * safeToNumber('abc', 10);
 */
function safeToNumber(value: string | number | null | undefined, fallback: number = 0): number {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  return isNaN(num) ? fallback : num;
}

/**
 * @interface OldWalrusStorageContent
 * @description Legacy format for Walrus storage content from older API versions
 * @property {string} dataType - Type of the data ('moveObject' for storage objects)
 * @property {Object} fields - Essential fields of the storage object
 * @property {string} fields.storage_size - Total allocated storage size in bytes
 * @property {string} fields.used_size - Currently used storage in bytes
 * @property {string} fields.end_epoch - Expiration epoch number
 */
interface OldWalrusStorageContent {
  dataType: 'moveObject';
  fields: {
    storage_size: string;
    used_size: string;
    end_epoch: string;
  };
}

// Import node-fetch dynamically to avoid ESM issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fetch: any;

/**
 * A utility class for managing Todo data storage on the Walrus decentralized platform
 *
 * This class handles the storage and retrieval of Todo items and Todo lists using the Walrus storage
 * system, integrated with the Sui blockchain for secure transactions. It provides methods to store,
 * retrieve, and update Todo data, ensuring data integrity through checksum validation and robust
 * error handling.
 *
 * Key features include:
 * - Secure blockchain-based persistence of todo data
 * - Automatic retry mechanisms for network operations
 * - Smart storage allocation with efficiency analysis
 * - Content verification with SHA-256 checksums
 * - In-memory caching for improved performance
 * - Comprehensive error handling with detailed error categories
 *
 * The implementation handles various Sui and Walrus API versions through adapters
 * and provides fallback mechanisms for different types of failures.
 *
 * @class WalrusStorage
 * @example
 * // Create a storage instance
 * const storage = new WalrusStorage();
 *
 * // Connect to the Walrus network
 * await storage.connect();
 *
 * // Store a todo
 * const blobId = await storage.storeTodo(myTodo);
 *
 * // Retrieve a todo later
 * const retrievedTodo = await storage.retrieveTodo(blobId);
 */

export class WalrusStorage {
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'failed' = 'disconnected';
  private walrusClient: WalrusClientAdapter | null = null;
  private suiClient: SuiClient | null = null;
  private signer: TransactionSigner | null = null;
  private useMockMode: boolean;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // 30 seconds
  private storageReuseAnalyzer: StorageReuseAnalyzer | null = null;
  // AbortController for cancelable operations
  private abortController: AbortController = new AbortController();

  /**
   * Creates a new WalrusStorage instance
   *
   * @param {boolean} [useMockMode=false] - Flag to enable mock mode for testing purposes,
   *                                        bypassing actual blockchain and storage operations
   */
  constructor(useMockMode = false) {
    this.useMockMode = useMockMode;
    try {
      this.suiClient = new SuiClient({ url: NETWORK_URLS[CURRENT_NETWORK] });
    } catch (error) {
      console.warn('Failed to initialize SuiClient:', error);
      this.suiClient = null;
    }
  }

  /**
   * Checks the health of the connection to the Sui blockchain
   *
   * Performs a lightweight query to verify network connectivity and client initialization.
   * Uses AsyncOperationHandler for proper timeout handling and error categorization.
   * Updates the lastHealthCheck timestamp on success for throttling future checks.
   *
   * @private
   * @returns {Promise<boolean>} Promise resolving to boolean indicating if connection is healthy
   */

  private async checkConnectionHealth(): Promise<boolean> {
    try {
      // Check if suiClient is initialized
      if (!this.suiClient) {
        console.warn('Connection health check failed: SuiClient is not initialized');
        return false;
      }

      const result = await AsyncOperationHandler.execute(
        () => this.suiClient?.getLatestSuiSystemState() ?? Promise.reject(new Error('SuiClient is not initialized')),
        {
          operation: 'connection health check',
          maxRetries: 1,
          timeout: 5000,
          throwErrors: false
        }
      );

      if (result.success) {
        this.lastHealthCheck = Date.now();
        return true;
      } else {
        console.warn('Connection health check failed:', result.error?.message);
        return false;
      }
    } catch (error) {
      console.warn('Connection health check failed:', error);
      return false;
    }
  }

  /**
   * Calculates a SHA-256 checksum for the provided data buffer
   *
   * Used for data integrity verification when storing and retrieving todos.
   * The checksum is stored with the blob metadata and verified upon retrieval.
   *
   * @private
   * @param {Buffer} data - The data buffer to calculate a checksum for
   * @returns {string} Hexadecimal representation of the SHA-256 hash
   */
  private calculateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Validates todo data structure and fields with detailed validation errors
   *
   * Checks that all required fields exist and have the correct types:
   * - id: must be a non-empty string
   * - title: must be a non-empty string
   * - completed: must be a boolean
   * - createdAt: must be a valid date string
   * - updatedAt: must be a valid date string
   *
   * @private
   * @param {Todo} todo - The todo object to validate
   * @throws {ValidationError} Throws a structured validation error with field and operation details
   */

  private validateTodoData(todo: Todo): void {
    if (!todo.id || typeof todo.id !== 'string') {
      throw new ValidationError('Invalid todo: missing or invalid id', {
        field: 'id',
        recoverable: false,
        operation: 'data validation'
      });
    }
    if (!todo.title || typeof todo.title !== 'string') {
      throw new ValidationError('Invalid todo: missing or invalid title', {
        field: 'title',
        recoverable: false,
        operation: 'data validation'
      });
    }
    if (typeof todo.completed !== 'boolean') {
      throw new ValidationError('Invalid todo: invalid completed status', {
        field: 'completed',
        recoverable: false,
        operation: 'data validation'
      });
    }
    if (!todo.createdAt || isNaN(Date.parse(todo.createdAt))) {
      throw new ValidationError('Invalid todo: invalid createdAt date', {
        field: 'createdAt',
        recoverable: false,
        operation: 'data validation'
      });
    }
    if (!todo.updatedAt || isNaN(Date.parse(todo.updatedAt))) {
      throw new ValidationError('Invalid todo: invalid updatedAt date', {
        field: 'updatedAt',
        recoverable: false,
        operation: 'data validation'
      });
    }
  }

  /**
   * Gets the size of a stored blob with proper error handling
   *
   * Retrieves metadata about a stored blob to determine its size.
   * Uses AsyncOperationHandler for automatic retries and error handling.
   * Returns 0 if the blob cannot be found or if retrieval fails.
   *
   * @param {string} blobId - The unique identifier of the blob to check
   * @returns {Promise<number>} The size of the blob in bytes, or 0 if retrieval fails
   * @throws {StorageError} If the WalrusStorage is not initialized
   */

  public async getBlobSize(blobId: string): Promise<number> {
    return AsyncOperationHandler.execute(
      async () => {
        if (!this.walrusClient) {
          throw new StorageError('WalrusStorage not initialized', {
            operation: 'get blob size'
          });
        }

        if (!this.walrusClient) {
          throw new StorageError('WalrusStorage not initialized', {
            operation: 'get blob size'
          });
        }

        const blobInfo = await this.walrusClient.getBlobInfo(blobId);
        return typeof blobInfo?.size === 'string' ? Number(blobInfo.size) : 0;
      },
      {
        operation: 'get blob size',
        maxRetries: 3,
        throwErrors: false,
        signal: this.abortController.signal
      }
    ).then(result => result.success ? (result.data || 0) : 0);
  }

  /**
   * Creates a storage transaction block with adapter compatibility across Sui SDK versions
   *
   * This method handles compatibility between different versions of the Sui SDK and the
   * Walrus client by first attempting to use the client's built-in implementation, then
   * falling back to a manual implementation if needed.
   *
   * @private
   * @param {number} size - Requested storage size in bytes
   * @param {number} epochs - Duration in epochs for the storage allocation
   * @returns {Promise<TransactionType>} A transaction object that can be executed to allocate storage
   * @throws {ValidationError} If transaction creation fails
   */

  private async createStorageBlock(size: number, epochs: number): Promise<TransactionType> {
    return AsyncOperationHandler.execute(
      async () => {
        // Try to use the WalrusClient's createStorageBlock implementation first
        if (this.walrusClient && 'createStorageBlock' in this.walrusClient) {
          return await this.walrusClient.createStorageBlock(size, epochs);
        }

        // If that fails or doesn't exist, create our own transaction block
        const tx = createTransaction();

        tx.moveCall({
          target: '0x2::storage::create_storage',
          arguments: [
            tx.pure(size),
            tx.pure(epochs),
            tx.object('0x6') // Use explicit gas object reference
          ]
        });

        return tx;
      },
      {
        operation: 'create storage transaction',
        maxRetries: 2,
        signal: this.abortController.signal
      }
    ).then(result => result.success ? result.data : Promise.reject(result.error));
  }

  /**
   * Validates todo list data structure and fields with detailed validation errors
   *
   * Validates the todo list itself and all contained todos:
   * - id: must be a non-empty string
   * - name: must be a non-empty string
   * - todos: must be an array
   *
   * Additionally validates each todo in the list by calling validateTodoData()
   * for each element, providing context about which todo in the list failed.
   *
   * @private
   * @param {TodoList} todoList - The todo list object to validate
   * @throws {ValidationError} Throws a structured validation error with field and operation details
   */

  private validateTodoListData(todoList: TodoList): void {
    if (!todoList.id || typeof todoList.id !== 'string') {
      throw new ValidationError('Invalid todo list: missing or invalid id', {
        field: 'id',
        recoverable: false,
        operation: 'data validation'
      });
    }
    if (!todoList.name || typeof todoList.name !== 'string') {
      throw new ValidationError('Invalid todo list: missing or invalid name', {
        field: 'name',
        recoverable: false,
        operation: 'data validation'
      });
    }
    if (!Array.isArray(todoList.todos)) {
      throw new ValidationError('Invalid todo list: todos must be an array', {
        field: 'todos',
        recoverable: false,
        operation: 'data validation'
      });
    }
    
    // Validate each todo in the list
    try {
      todoList.todos.forEach(todo => this.validateTodoData(todo));
    } catch (error) {
      // Wrap the error with list context
      if (error instanceof ValidationError) {
        throw new ValidationError(`Invalid todo in list: ${error.message}`, {
          field: error.field,
          recoverable: false,
          operation: 'list validation',
          cause: error
        });
      }
      throw error;
    }
  }

  /**
   * Initializes the WalrusStorage connection to the Walrus network
   *
   * This method performs the following initialization steps:
   * 1. Creates a fresh abort controller for cancellation support
   * 2. Verifies environment is set to testnet (required for Walrus)
   * 3. Loads the node-fetch library dynamically if needed
   * 4. Initializes the Walrus client with proper network settings
   * 5. Initializes the signer from the Sui keystore
   * 6. Verifies connection health with a final check
   *
   * All errors are categorized and mapped to specific error types for easier handling.
   *
   * @returns {Promise<void>} Promise that resolves when initialization is complete
   * @throws {ValidationError} If environment validation fails
   * @throws {BlockchainError} If signer initialization fails
   * @throws {NetworkError} If connection validation fails
   */

  async init(): Promise<void> {
    if (this.useMockMode) {
      this.connectionState = 'connected';
      return;
    }

    console.log('Initializing WalrusStorage connection...');
    this.connectionState = 'connecting';

    // Create a fresh abort controller for this initialization
    this.abortController = new AbortController();

    try {
      // Check environment
      const envInfo = await AsyncOperationHandler.execute(
        async () => execSync('sui client active-env').toString().trim(),
        {
          operation: 'environment check',
          maxRetries: 2,
          signal: this.abortController.signal
        }
      );
      
      if (!envInfo.data?.includes('testnet')) {
        this.connectionState = 'failed';
        throw new ValidationError(
          'Must be connected to testnet environment. Use "sui client switch --env testnet"', 
          { operation: 'environment validation' }
        );
      }

      console.log('Environment validation successful, initializing clients...');

      // Import fetch if needed
      if (!fetch) {
        try {
          const nodeFetch = await import('node-fetch');
          fetch = nodeFetch.default;
          console.log('Successfully imported node-fetch');
        } catch (fetchError) {
          console.warn('Failed to import node-fetch, falling back to global fetch');
          fetch = globalThis.fetch;
        }
      }

      // Initialize client with proper error handling
      if (this.useMockMode) {
        const mockClient = new MockWalrusClient() as unknown as WalrusClient;
        this.walrusClient = createWalrusClientAdapter(mockClient);
      } else {
        await AsyncOperationHandler.execute(
          async () => {
            const walrusClient = new WalrusClient({ 
              network: 'testnet',
              fullnode: NETWORK_URLS[CURRENT_NETWORK],
              fetchOptions: { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              }
            });
            this.walrusClient = createWalrusClientAdapter(walrusClient);
          },
          {
            operation: 'client initialization',
            maxRetries: 3,
            baseDelay: 1000,
            signal: this.abortController.signal
          }
        );
      }

      // Initialize signer
      try {
        // @ts-ignore - Ignore type compatibility issues with Signer implementations
        const signer = await KeystoreSigner.fromPath('default');
        // @ts-ignore - Force type compatibility for the signer
        this.signer = signer;
        const address = this.signer.toSuiAddress();
        if (!address) {
          this.connectionState = 'failed';
          throw new ValidationError('Failed to initialize signer - no active address found', {
            operation: 'signer initialization'
          });
        }
      } catch (error) {
        this.connectionState = 'failed';
        throw new BlockchainError(
          `Failed to initialize signer: ${error instanceof Error ? error.message : String(error)}`,
          { operation: 'signer initialization' }
        );
      }

      // Perform final health check
      const isHealthy = await this.checkConnectionHealth();
      if (!isHealthy) {
        this.connectionState = 'failed';
        throw new NetworkError('Initial connection health check failed', {
          operation: 'connection validation',
          recoverable: true
        });
      }

      console.log('WalrusStorage initialization successful');
      this.connectionState = 'connected';
    } catch (error) {
      this.connectionState = 'failed';
      
      // Categorize and map the error
      const category = categorizeWalrusError(error);
      const mappedError = mapToWalrusError(error, category, 'initialization');
      
      // Rethrow the properly mapped error
      throw mappedError;
    }
  }

  /**
   * Checks if the storage is connected with an optional health check
   *
   * If the connection is marked as connected but the last health check is older
   * than the healthCheckInterval, performs a new health check. This approach
   * balances responsiveness with minimizing network requests.
   *
   * @returns {Promise<boolean>} Promise resolving to boolean indicating connection status
   */

  async isConnected(): Promise<boolean> {
    if (this.connectionState === 'connected' && 
        Date.now() - this.lastHealthCheck > this.healthCheckInterval) {
      const isHealthy = await this.checkConnectionHealth();
      if (!isHealthy) {
        this.connectionState = 'failed';
        return false;
      }
    }
    return this.connectionState === 'connected';
  }

  /**
   * Connects to the storage service if not already connected
   *
   * Public method to establish connection to the Walrus storage service.
   * If already connected, this is a no-op. Otherwise, calls init() to
   * perform full initialization sequence.
   *
   * @returns {Promise<void>} Promise that resolves when connection is established
   * @throws Various errors from init() if connection fails
   */

  async connect(): Promise<void> {
    if (this.connectionState === 'disconnected' || this.connectionState === 'failed') {
      await this.init();
    }
  }

  /**
   * Disconnects from the storage service
   *
   * Performs a clean shutdown of the Walrus storage connection:
   * 1. Cancels any pending operations via the abort controller
   * 2. Resets the Walrus client if present
   * 3. Nullifies the signer to prevent further transactions
   * 4. Updates connection state to disconnected
   *
   * @returns {Promise<void>} Promise that resolves when disconnection is complete
   */

  async disconnect(): Promise<void> {
    if (this.connectionState !== 'disconnected') {
      console.log('Disconnecting WalrusStorage...');
      
      // Cancel any pending operations
      this.abortController.abort('Disconnecting');
      
      // Reset connections
      this.connectionState = 'disconnected';
      this.walrusClient?.reset();
      this.signer = null;
    }
  }

  /**
   * Gets the transaction signer with proper error handling
   *
   * Retrieves the previously initialized signer for transaction operations.
   * The signer is required for all write operations to the blockchain.
   *
   * @protected
   * @returns {Promise<TransactionSigner>} The initialized transaction signer
   * @throws {ValidationError} If signer is not initialized (connection required first)
   */

  protected async getTransactionSigner(): Promise<TransactionSigner> {
    if (!this.signer) {
      throw new ValidationError('WalrusStorage not initialized. Call connect() first.', {
        operation: 'get transaction signer'
      });
    }
    return this.signer;
  }

  /**
   * Gets the active wallet address for the connected signer
   *
   * Retrieves the blockchain address associated with the current signer.
   * This address is used for various operations including storage allocation,
   * transaction signing, and ownership verification.
   *
   * @public
   * @returns {string} The active wallet address in Sui format
   * @throws {ValidationError} If storage is not initialized or address cannot be retrieved
   */

  public getActiveAddress(): string {
    if (!this.signer) {
      throw new ValidationError('WalrusStorage not initialized. Call connect() first.', {
        operation: 'get active address'
      });
    }

    // Add null check with fallback for signer address
    const address = this.signer.toSuiAddress();
    if (!address) {
      throw new ValidationError('Failed to get active address from signer', {
        operation: 'get active address'
      });
    }

    return address;
  }

  /**
   * Stores a todo item in Walrus blob storage
   *
   * This method performs a complete storage operation with validation, integrity protection,
   * and verification:
   *
   * 1. Validates todo data format and fields
   * 2. Serializes the todo using TodoSerializer and generates a SHA-256 checksum
   * 3. Ensures sufficient storage space is allocated using storage optimization
   * 4. Uploads the todo data with comprehensive metadata as a Walrus blob
   * 5. Verifies the uploaded content integrity with retries
   * 6. In case of failure, provides detailed error information with recovery options
   *
   * The method includes special handling for WAL token balance verification and
   * storage allocation optimization to minimize costs.
   *
   * @param {Todo} todo - The todo item to store
   * @returns {Promise<string>} A Promise resolving to the Walrus blob ID for future retrieval
   * @throws {ValidationError} If todo validation fails or storage is not connected
   * @throws {StorageError} If blob storage operations fail
   * @throws {TransactionError} If blockchain transaction fails (e.g., insufficient WAL tokens)
   * @throws {NetworkError} If network communication fails
   * @throws {BlockchainError} If blockchain interaction fails
   */

  async storeTodo(todo: Todo): Promise<string> {
    try {
      if (this.useMockMode) {
        console.log('Using mock mode for storing todo');
        return `mock-blob-${todo.id}`;
      }

      if (this.connectionState !== 'connected' || !this.walrusClient) {
        throw new ValidationError('WalrusStorage not connected. Call connect() first.', {
          operation: 'store todo'
        });
      }

      // Validate todo data
      try {
        this.validateTodoData(todo);
      } catch (error) {
        // Re-throw validation errors with proper context
        if (error instanceof ValidationError) {
          throw error;
        }
        throw new ValidationError(
          `Todo validation failed: ${error instanceof Error ? error.message : String(error)}`,
          { operation: 'todo validation' }
        );
      }

      console.log(`Serializing todo "${todo.title}" for storage...`);
      
      // Serialize todo with proper error handling
      let buffer: Buffer;
      try {
        buffer = TodoSerializer.todoToBuffer(todo);
      } catch (error) {
        throw new ValidationError(
          `Failed to serialize todo: ${error instanceof Error ? error.message : String(error)}`,
          { operation: 'todo serialization' }
        );
      }

      // Get accurate size measurement with our calculator
      const exactSize = buffer.length;
      const calculatedSize = TodoSizeCalculator.calculateTodoSize(todo);
      
      console.log(`Todo size: ${exactSize} bytes (raw), ${calculatedSize} bytes (with buffer)`);

      if (exactSize > 10 * 1024 * 1024) { // 10MB limit
        throw new ValidationError('Todo data is too large. Maximum size is 10MB.', {
          operation: 'size validation',
          field: 'size',
          value: exactSize
        });
      }

      const checksum = this.calculateChecksum(buffer);

      // Use our precise size calculation for storage allocation
      const storage = await this.ensureStorageAllocated(calculatedSize);
      if (!storage) {
        // First check if it's due to WAL token balance
        try {
          // Verify if it's a balance issue with proper error handling
          const systemStateResult = await AsyncOperationHandler.execute(
            () => this.suiClient?.getLatestSuiSystemState() ?? Promise.reject(new Error('SuiClient is not initialized')),
            {
              operation: 'get system state',
              maxRetries: 2,
              signal: this.abortController.signal
            }
          );
          
          if (!systemStateResult.success) {
            throw new NetworkError('Failed to get system state', {
              operation: 'system state check',
              recoverable: true,
              cause: systemStateResult.error
            });
          }

          const systemState = systemStateResult.data;
          const epoch = systemState?.epoch ?? '0';

          // Get balance with proper error handling
          try {
            const activeAddress = this.getActiveAddress();
            const balanceResult = await AsyncOperationHandler.execute(
              () => this.suiClient?.getBalance({
                owner: activeAddress,
                coinType: 'WAL'
              }) ?? Promise.reject(new Error('SuiClient is not initialized')),
              {
                operation: 'check WAL balance',
                maxRetries: 2,
                signal: this.abortController.signal
              }
            );

            if (!balanceResult.success) {
              throw new BlockchainError('Failed to check WAL balance', {
                operation: 'balance check',
                recoverable: true,
                cause: balanceResult.error
              });
            }

            const balance = balanceResult.data;
            if (safeToNumber(balance?.totalBalance, 0) < 100) { // Minimum WAL needed
              throw new TransactionError('Insufficient WAL tokens. Please acquire WAL tokens to store your todo.', {
                operation: 'storage allocation',
                recoverable: false
              });
            }
          } catch (addressError) {
            if (addressError instanceof ValidationError) {
              throw addressError;
            }
            throw new ValidationError(
              `Failed to verify wallet address: ${addressError instanceof Error ? addressError.message : String(addressError)}`,
              { operation: 'address validation' }
            );
          }
        } catch (error) {
          if (error instanceof TransactionError || 
              error instanceof ValidationError || 
              error instanceof BlockchainError) {
            throw error;
          }
          
          throw new StorageError(
            `Failed to allocate storage for todo. Please check your WAL token balance and try again. Error: ${error instanceof Error ? error.message : String(error)}`,
            { operation: 'storage allocation' }
          );
        }
      }

      // Get signer and prepare for upload
      const signer = await this.getTransactionSigner();
      
      // Upload with proper error handling
      const uploadResult = await AsyncOperationHandler.execute(
        async () => this.walrusClient.writeBlob({
          blob: new Uint8Array(buffer),
          deletable: false,
          epochs: 52,
          signer,
          attributes: {
            contentType: 'application/json',
            filename: `todo-${todo.id}.json`,
            type: 'todo-data',
            title: todo.title,
            completed: todo.completed.toString(),
            checksum_algo: 'sha256',
            checksum,
            size: exactSize.toString(),
            version: '1',
            schemaVersion: '1',
            encoding: 'utf-8'
          }
        }),
        {
          operation: 'todo upload',
          maxRetries: 5,
          baseDelay: 1000,
          signal: this.abortController.signal
        }
      );

      if (!uploadResult.success) {
        throw new StorageError('Failed to upload todo data', {
          operation: 'blob upload',
          cause: uploadResult.error
        });
      }

      const result = uploadResult.data;
      
      // Safely extract blob information with proper type checking and fallbacks for null values
      const blobObject = result?.blobObject ?? (result?.blobId ? { blob_id: result.blobId } : null);

      // Prepare metadata for verification
      const metadata = {
        contentType: 'application/json',
        filename: `todo-${todo?.id ?? 'unknown'}.json`,
        type: 'todo-data',
        title: todo?.title ?? 'Untitled Todo',
        completed: (todo?.completed ?? false).toString(),
        checksum_algo: 'sha256',
        checksum: checksum ?? '',
        size: exactSize?.toString() ?? '0',
        version: '1',
        schemaVersion: '1',
        encoding: 'utf-8'
      };

      // Initialize storage managers if needed
      this.initializeManagers();

      // Ensure we have a valid blob ID with proper type checking
      let blobId = '';
      
      // Use type guards to safely access properties with null checks and optional chaining
      if (blobObject && typeof blobObject === 'object') {
        // Option 1: Get blob_id directly if it exists
        if ('blob_id' in blobObject && typeof blobObject.blob_id === 'string') {
          blobId = blobObject.blob_id;
        }
        // Option 2: Use nested id property with multiple null checks
        else if ('id' in blobObject && blobObject.id) {
          // Handle both string id and object with id property
          if (typeof blobObject.id === 'string') {
            blobId = blobObject.id;
          }
          else if (typeof blobObject.id === 'object' && blobObject.id !== null) {
            // Access nested id property with optional chaining
            const nestedId = blobObject.id?.id;
            if (typeof nestedId === 'string') {
              blobId = nestedId;
            }
          }
        }
        // Option 3: Extract from blobId if present
        else if ('blobId' in blobObject && typeof blobObject.blobId === 'string') {
          blobId = blobObject.blobId;
        }
      }

      // Last resort: try to directly use result.blobId if blobObject didn't yield a valid ID
      if (!blobId && result?.blobId && typeof result.blobId === 'string') {
        blobId = result.blobId;
      }
      
      if (!blobId) {
        throw new ValidationError('Failed to extract valid blob ID from response', {
          operation: 'blob ID extraction'
        });
      }
      
      // Verify the upload with proper error handling
      const verificationResult = await AsyncOperationHandler.execute(
        () => this.verifyBlob(blobId, buffer, metadata),
        {
          operation: 'verify blob',
          maxRetries: 3,
          signal: this.abortController.signal,
          throwErrors: false
        }
      );

      // Check if verification was successful
      if (verificationResult.success && verificationResult.data?.details?.certified) {
        console.log(`Todo successfully verified and stored with blob ID: ${blobId}`);
      } else {
        console.log('Warning: Blob certification pending. Monitoring for certification...');
        // Start monitoring in the background
        console.log('Certification monitoring not implemented in this version');
      }

      console.log(`Todo successfully stored with blob ID: ${blobId}`);
      return blobId;
    } catch (error) {
      // Categorize and properly throw the error
      const category = categorizeWalrusError(error);
      throw mapToWalrusError(error, category, 'store todo');
    }
  }

  // In-memory cache with entries that expire after 5 minutes
  private static todoCache: Map<string, { data: Todo; expires: number }> = new Map();
  private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Retrieves a todo item from Walrus blob storage
   *
   * This method implements a multi-stage retrieval strategy with caching:
   *
   * 1. Check in-memory cache first (avoids network requests for recently accessed todos)
   * 2. Try direct retrieval from Walrus client with multiple retries
   * 3. Fall back to public aggregator service with exponential backoff
   * 4. Parse and validate the retrieved data
   * 5. Cache successfully retrieved todos for faster future access
   *
   * The implementation includes extensive error handling with proper categorization,
   * enabling robust recovery strategies and clear error messages for users.
   *
   * @param {string} blobId - The Walrus blob ID for the todo to retrieve
   * @returns {Promise<Todo>} A Promise resolving to the retrieved Todo item
   * @throws {ValidationError} If blobId is invalid or storage is not connected
   * @throws {StorageError} If blob retrieval fails
   * @throws {NetworkError} If network communication fails
   */

  async retrieveTodo(blobId: string): Promise<Todo> {
    try {
      if (this.useMockMode) {
        console.log('Using mock mode for retrieving todo');
        return {
          id: 'mock-id',
          title: 'Mock task',
          description: 'Mock description',
          completed: false,
          priority: 'medium',
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          walrusBlobId: blobId,
          private: true
        };
      }

      if (!blobId?.trim()) {
        throw new ValidationError('Blob ID is required', {
          operation: 'retrieve todo',
          field: 'blobId'
        });
      }

      if (this.connectionState !== 'connected' || !this.walrusClient) {
        throw new ValidationError('WalrusStorage not connected. Call connect() first.', {
          operation: 'retrieve todo'
        });
      }

      // Try cache first
      const cached = WalrusStorage.todoCache.get(blobId);
      if (cached && cached.expires > Date.now()) {
        console.log('Retrieved todo from cache');
        return cached.data;
      }

      console.log(`Retrieving todo from Walrus with blob ID: ${blobId}...`);

      // Create a fresh abort controller for this operation
      const retrievalAbortController = new AbortController();
      
      try {
        // Attempt to retrieve the blob with our enhanced retrieval mechanism
        const blobContentResult = await AsyncOperationHandler.execute(
          () => this.retrieveBlob(blobId, {
            maxRetries: 5,
            baseDelay: 1000,
            timeout: 15000,
            useAggregator: true,
            context: 'todo retrieval',
            signal: retrievalAbortController.signal
          }),
          {
            operation: 'retrieve blob',
            signal: retrievalAbortController.signal
          }
        );

        if (!blobContentResult.success) {
          throw new StorageError(`Failed to retrieve blob content: ${blobContentResult.error?.message}`, {
            operation: 'blob retrieval',
            blobId,
            recoverable: true,
            cause: blobContentResult.error
          });
        }

        const blobContent = blobContentResult.data ?? new Uint8Array();

        // Parse and validate the retrieved data
        const todo = await this.parseTodoData(blobContent);
        
        // Cache the successfully retrieved todo
        this.cacheTodo(blobId, todo);
        
        console.log('Successfully retrieved and cached todo data');
        return todo;
      } catch (error) {
        // Cancel the retrieval if something goes wrong
        retrievalAbortController.abort();
        
        // Categorize the error
        const category = categorizeWalrusError(error);
        throw mapToWalrusError(error, category, 'retrieve todo');
      }
    } catch (error) {
      // Categorize and properly throw the error
      const category = categorizeWalrusError(error);
      throw mapToWalrusError(error, category, 'retrieve todo');
    }
  }

  /**
   * Caches a todo for faster retrieval and cleans expired entries
   *
   * Stores the retrieved todo in an in-memory cache with an expiration time.
   * Also performs cache maintenance by removing any entries that have already expired.
   * This improves performance for frequently accessed todos without requiring
   * network requests.
   *
   * @private
   * @param {string} blobId - The blob ID used as the cache key
   * @param {Todo} todo - The todo object to cache
   */

  private cacheTodo(blobId: string, todo: Todo): void {
    WalrusStorage.todoCache.set(blobId, {
      data: todo,
      expires: Date.now() + WalrusStorage.CACHE_TTL
    });

    // Clean expired entries
    for (const [key, value] of WalrusStorage.todoCache.entries()) {
      if (value.expires <= Date.now()) {
        WalrusStorage.todoCache.delete(key);
      }
    }
  }

  /**
   * Attempts to retrieve a blob from Walrus storage with automatic retries and fallback strategies
   *
   * This is a comprehensive low-level blob retrieval implementation that provides:
   * 1. Multiple retrieval strategies (direct and aggregator)
   * 2. Automatic retries with exponential backoff
   * 3. Timeout handling to prevent hanging operations
   * 4. Abort signal support for cancellation
   * 5. Content hash verification for integrity
   * 6. Detailed failure tracking for diagnostics
   *
   * The method first attempts direct retrieval through the Walrus client.
   * If that fails, it falls back to the public aggregator service if enabled.
   * All failures are tracked with source and attempt information for better debugging.
   *
   * @private
   * @param {string} blobId - The ID of the blob to retrieve
   * @param {Object} [options] - Retrieval options
   * @param {number} [options.maxRetries=3] - Maximum number of retries per strategy
   * @param {number} [options.baseDelay=1000] - Base delay in ms for exponential backoff
   * @param {number} [options.timeout=15000] - Timeout in ms for each retrieval attempt
   * @param {boolean} [options.useAggregator=true] - Whether to try the public aggregator as fallback
   * @param {string} [options.context='blob retrieval'] - Context description for error messages
   * @param {AbortSignal} [options.signal] - AbortSignal for cancellation support
   * @returns {Promise<Buffer>} The blob content as a Buffer
   * @throws {StorageError} With detailed failure information if all retrieval attempts fail
   * @throws {NetworkError} If network communication fails
   */

  private async retrieveBlob(
    blobId: string,
    options: {
      maxRetries?: number;
      baseDelay?: number;
      timeout?: number;
      useAggregator?: boolean;
      context?: string;
      signal?: AbortSignal;
    } = {}
  ): Promise<Buffer> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      timeout = 15000,
      useAggregator = true,
      context = 'blob retrieval',
      signal
    } = options;

    const failures: Array<{ source: string; attempt: number; error: string }> = [];
    let lastError: Error | null = null;

    // Helper for timeout wrapping
    const withTimeout = async <T>(
      promise: Promise<T>,
      ms: number,
      source: string,
      attempt: number,
      signal?: AbortSignal
    ): Promise<T> => {
      let timeoutId: NodeJS.Timeout;
      
      // Create a promise that rejects after the timeout
      const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new NetworkError(`${source} timed out after ${ms}ms on attempt ${attempt}`, {
            operation: context,
            recoverable: true
          }));
        }, ms);
      });

      // Create a promise that rejects if the signal is aborted
      const abortPromise = new Promise<T>((_, reject) => {
        if (signal) {
          if (signal.aborted) {
            reject(new Error(`Operation was canceled`));
          }
          signal.addEventListener('abort', () => {
            reject(new Error(`Operation was canceled`));
          }, { once: true });
        }
      });

      try {
        // Race the promises
        const result = await Promise.race([promise, timeoutPromise, abortPromise]);
        clearTimeout(timeoutId!);
        return result;
      } catch (error) {
        clearTimeout(timeoutId!);
        throw error;
      }
    };

    // Try direct retrieval first
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Check if operation was canceled
      if (signal?.aborted) {
        throw new Error('Blob retrieval operation was canceled');
      }

      try {
        console.log(`Attempting direct retrieval from Walrus (attempt ${attempt}/${maxRetries})...`);
        
        // Retrieve content with timeout
        const content = await withTimeout(
          this.walrusClient.readBlob({ 
            blobId,
            signal
          }),
          timeout,
          'Direct retrieval',
          attempt,
          signal
        );

        if (!content || content.length === 0) {
          throw new StorageError('Retrieved content is empty', {
            operation: context,
            blobId,
            recoverable: true
          });
        }

        // Verify the blob's integrity using metadata
        const metadata = await this.walrusClient.getBlobMetadata({
          blobId,
          signal
        });

        // Calculate content hash
        const downloadedHash = crypto.createHash('sha256').update(content).digest();

        // Use proper null checking and optional chaining for deeply nested properties
        const storedHash = metadata?.metadata?.V1?.hashes?.[0]?.primary_hash?.Digest ?? null;
        if (storedHash) {
          // Convert both to Buffer for proper comparison and handle potential null values
          const downloadedBuffer = Buffer.from(downloadedHash);
          const storedBuffer = Buffer.from(storedHash);

          if (!downloadedBuffer.equals(storedBuffer)) {
            throw new StorageError('Content hash verification failed', {
              operation: 'hash verification',
              blobId,
              recoverable: true
            });
          }
        }

        return Buffer.from(content);
      } catch (error) {
        // Check if operation was canceled during execution
        if (signal?.aborted) {
          throw new Error('Blob retrieval operation was canceled');
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        failures.push({
          source: 'direct',
          attempt,
          error: errorMessage
        });

        if (attempt === maxRetries) {
          lastError = error instanceof Error ? error : new Error(errorMessage);
          break;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Direct retrieval attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // If direct retrieval fails and aggregator is allowed, try the public aggregator
    if (useAggregator) {
      console.log('Direct retrieval failed, attempting fallback to public aggregator...');
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        // Check if operation was canceled
        if (signal?.aborted) {
          throw new Error('Blob retrieval operation was canceled');
        }

        try {
          const response = await withTimeout(
            fetch(`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`, {
              method: 'GET',
              headers: { 'Accept': 'application/json' },
              signal
            }),
            timeout,
            'Aggregator retrieval',
            attempt,
            signal
          ) as Response;

          if (!response.ok) {
            throw new NetworkError(`HTTP ${response.status}: ${response.statusText}`, {
              operation: 'aggregator retrieval',
              recoverable: true
            });
          }

          const buffer = await response?.arrayBuffer() ?? new ArrayBuffer(0);
          if (buffer.byteLength === 0) {
            throw new StorageError('Retrieved content is empty', {
              operation: 'aggregator retrieval',
              blobId,
              recoverable: true
            });
          }

          return Buffer.from(buffer);
        } catch (error) {
          // Check if operation was canceled during execution
          if (signal?.aborted) {
            throw new Error('Blob retrieval operation was canceled');
          }

          const errorMessage = error instanceof Error ? error.message : String(error);
          failures.push({
            source: 'aggregator',
            attempt,
            error: errorMessage
          });

          if (attempt === maxRetries) {
            lastError = error instanceof Error ? error : new Error(errorMessage);
            break;
          }

          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`Aggregator attempt ${attempt} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // If we get here, all attempts failed
    const errorSummary = failures
      .map(f => `${f.source} attempt ${f.attempt}: ${f.error}`)
      .join('\n');

    throw new StorageError(
      `Failed to retrieve blob during ${context} after all attempts:\n${errorSummary}`,
      {
        operation: context,
        blobId,
        recoverable: false,
        cause: lastError || undefined
      }
    );
  }

  /**
   * Parses and validates todo data from raw bytes
   *
   * Handles the conversion from raw blob data to a structured Todo object:
   * 1. Decodes the binary data as UTF-8 text
   * 2. Parses the JSON text into a Todo object
   * 3. Validates the Todo structure and fields
   * 4. Performs additional validation specific to retrieved todos
   *
   * Provides detailed error information for different failure scenarios,
   * making it easier to diagnose data corruption or format issues.
   *
   * @private
   * @param {Uint8Array} data - The raw todo data bytes
   * @returns {Promise<Todo>} Parsed and validated Todo object
   * @throws {ValidationError} If parsing fails or data is invalid
   */

  private async parseTodoData(data: Uint8Array): Promise<Todo> {
    try {
      const todoData = new TextDecoder().decode(data);
      let todo: Todo;
      try {
        todo = JSON.parse(todoData) as Todo;
      } catch (parseError) {
        throw new ValidationError(`Failed to parse todo JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`, {
          operation: 'todo parsing',
          recoverable: false
        });
      }

      // Validate parsed data
      this.validateTodoData(todo);

      // Additional validation specific to retrieved todos
      if (!todo.walrusBlobId) {
        throw new ValidationError('Missing walrusBlobId field', {
          field: 'walrusBlobId',
          operation: 'todo parsing'
        });
      }

      return todo;
    } catch (error) {
      if (error instanceof ValidationError) {
        // For validation errors, just propagate them
        throw error;
      }
      
      if (error instanceof SyntaxError) {
        // For JSON parsing errors
        throw new ValidationError(`Retrieved todo data is not valid JSON: ${error.message}`, {
          operation: 'todo parsing',
          recoverable: false,
          cause: error
        });
      }
      
      // For other errors
      throw new ValidationError(
        `Failed to parse todo data: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'todo parsing',
          recoverable: false,
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }

  /**
   * Updates a todo item by storing a new version
   *
   * Because Walrus blobs are immutable, this method creates a new blob with
   * the updated todo data. The original blob remains but can be ignored.
   *
   * This approach ensures data history is preserved on the blockchain while
   * allowing logical updates to todos.
   *
   * @param {Todo} todo - Updated todo object
   * @param {string} blobId - Original blob ID (for reference only)
   * @returns {Promise<string>} Promise resolving to new blob ID for the updated version
   * @throws {ValidationError} If todo validation fails
   * @throws {StorageError} If storage operations fail
   * @throws Various errors from storeTodo() method
   */

  async updateTodo(todo: Todo, blobId: string): Promise<string> {
    try {
      if (this.useMockMode) {
        console.log('Using mock mode for updating todo');
        return `mock-updated-blob-${todo.id}`;
      }

      console.log(`Updating todo "${todo.title}" on Walrus...`);
      console.log('Note: Walrus blobs are immutable, so a new blob will be created');

      // Store the updated todo
      const newBlobId = await this.storeTodo(todo);

      console.log(`Todo updated with new blob ID: ${newBlobId}`);
      console.log(`Previous blob ID ${blobId} will remain but can be ignored`);

      return newBlobId;
    } catch (error) {
      // Categorize and properly throw the error
      const category = categorizeWalrusError(error);
      throw mapToWalrusError(error, category, 'update todo');
    }
  }

  /**
   * Stores a todo list in Walrus blob storage
   *
   * Similar to the storeTodo method but handles an entire collection of todos as a list:
   * 1. Validates the todo list and all contained todos
   * 2. Serializes the list with proper error handling
   * 3. Calculates the exact size and ensures sufficient storage
   * 4. Uploads with list-specific metadata (including todo count)
   * 5. Verifies the uploaded content
   *
   * This method allows efficient storage of multiple related todos as a single entity,
   * improving retrieval performance and maintaining logical grouping.
   *
   * @param {TodoList} todoList - The todo list to store
   * @returns {Promise<string>} Promise resolving to the blob ID
   * @throws {ValidationError} If list validation fails
   * @throws {StorageError} If storage operations fail
   * @throws {TransactionError} If blockchain transaction fails
   * @throws Various other categorized errors
   */

  async storeTodoList(todoList: TodoList): Promise<string> {
    try {
      if (this.useMockMode) {
        console.log('Using mock mode for storing todo list');
        return `mock-blob-list-${todoList.id}`;
      }

      if (this.connectionState !== 'connected' || !this.walrusClient) {
        throw new ValidationError('WalrusStorage not connected. Call connect() first.', {
          operation: 'store todo list'
        });
      }

      // Validate todo list data with proper error handling
      try {
        this.validateTodoListData(todoList);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }
        throw new ValidationError(
          `Todo list validation failed: ${error instanceof Error ? error.message : String(error)}`,
          { operation: 'list validation' }
        );
      }

      console.log(`Serializing todo list "${todoList.name}" for storage...`);
      
      // Serialize with proper error handling
      let buffer: Buffer;
      try {
        buffer = TodoSerializer.todoListToBuffer(todoList);
      } catch (error) {
        throw new ValidationError(
          `Failed to serialize todo list: ${error instanceof Error ? error.message : String(error)}`,
          { operation: 'list serialization' }
        );
      }
      
      // Size calculations
      const exactSize = buffer.length;
      const calculatedSize = TodoSizeCalculator.calculateTodoListSize(todoList);
      
      console.log(`Todo list size: ${exactSize} bytes (raw), ${calculatedSize} bytes (with buffer)`);
      console.log(`Contains ${todoList.todos.length} todos`);
      
      // Ensure we have enough storage allocated
      await this.ensureStorageAllocated(calculatedSize);

      const checksum = this.calculateChecksum(buffer);
      const signer = await this.getTransactionSigner();

      // Upload with proper error handling
      const uploadResult = await AsyncOperationHandler.execute(
        async () => this.walrusClient.writeBlob({
          blob: new Uint8Array(buffer),
          deletable: false,
          epochs: 52,
          signer,
          attributes: {
            contentType: 'application/json',
            filename: `todolist-${todoList.id}.json`,
            type: 'todolist-data',
            name: todoList.name,
            checksum,
            size: exactSize.toString(),
            version: '1',
            todoCount: todoList.todos.length.toString()
          }
        }),
        {
          operation: 'todo list upload',
          maxRetries: 5,
          baseDelay: 1000,
          signal: this.abortController.signal
        }
      );

      if (!uploadResult.success) {
        throw new StorageError('Failed to upload todo list data', {
          operation: 'list upload',
          cause: uploadResult.error
        });
      }

      const result = uploadResult.data;
      
      // Safely extract blob information with proper type checking
      const blobObject = result?.blobObject ?? (result?.blobId ? { blob_id: result.blobId } : null);

      // Prepare metadata for verification
      const metadata = {
        contentType: 'application/json',
        filename: `todolist-${todoList.id}.json`,
        type: 'todolist-data',
        name: todoList.name,
        checksum,
        size: exactSize.toString(),
        version: '1',
        todoCount: todoList.todos.length.toString()
      };

      this.initializeManagers();
      
      // Extract blob ID with error handling
      let blobId = '';
      if (blobObject && typeof blobObject === 'object') {
        // Option 1: Get blob_id directly if it exists
        if ('blob_id' in blobObject && typeof blobObject.blob_id === 'string') {
          blobId = blobObject.blob_id;
        }
        // Option 2: Use nested id property with multiple null checks
        else if ('id' in blobObject && blobObject.id) {
          // Handle both string id and object with id property
          if (typeof blobObject.id === 'string') {
            blobId = blobObject.id;
          }
          else if (typeof blobObject.id === 'object' && blobObject.id !== null) {
            // Access nested id property with optional chaining
            const nestedId = blobObject.id?.id;
            if (typeof nestedId === 'string') {
              blobId = nestedId;
            }
          }
        }
        // Option 3: Extract from blobId if present
        else if ('blobId' in blobObject && typeof blobObject.blobId === 'string') {
          blobId = blobObject.blobId;
        }
      }

      // Last resort: try to directly use result.blobId if blobObject didn't yield a valid ID
      if (!blobId && result?.blobId && typeof result.blobId === 'string') {
        blobId = result.blobId;
      }
      
      if (!blobId) {
        throw new ValidationError('Failed to extract valid blob ID from response', {
          operation: 'list ID extraction'
        });
      }
      
      // Verify with proper error handling
      const verificationResult = await AsyncOperationHandler.execute(
        () => this.verifyBlob(blobId, buffer, metadata),
        {
          operation: 'verify list blob',
          maxRetries: 3,
          signal: this.abortController.signal,
          throwErrors: false
        }
      );

      // Check if verification was successful
      if (verificationResult.success && verificationResult.data?.details?.certified) {
        console.log(`Todo list successfully verified and stored with blob ID: ${blobId}`);
      } else {
        console.log('Warning: Todo list blob certification pending. Monitoring for certification...');
        // Start monitoring in the background
        console.log('Certification monitoring not implemented in this version');
      }

      console.log(`Todo list successfully stored with blob ID: ${blobId}`);
      return blobId;
    } catch (error) {
      // Categorize and properly throw the error
      const category = categorizeWalrusError(error);
      throw mapToWalrusError(error, category, 'store todo list');
    }
  }

  /**
   * Retrieves a todo list from Walrus blob storage
   *
   * Retrieves and reconstructs a TodoList from blob storage:
   * 1. Uses the enhanced retrieveBlob method with retries and fallbacks
   * 2. Parses and validates the entire list structure
   * 3. Validates each todo in the list
   *
   * Unlike individual todos, lists aren't currently cached since they may be
   * larger and less frequently accessed. The abortController allows cancellation
   * of the operation if needed.
   *
   * @param {string} blobId - The blob ID for the todo list to retrieve
   * @returns {Promise<TodoList>} Promise resolving to the TodoList
   * @throws {ValidationError} If blobId is invalid or list parsing fails
   * @throws {StorageError} If blob retrieval fails
   * @throws {NetworkError} If network communication fails
   */

  async retrieveTodoList(blobId: string): Promise<TodoList> {
    try {
      if (this.useMockMode) {
        console.log('Using mock mode for retrieving todo list');
        return {
          id: 'mock-list-id',
          name: 'Mock List',
          owner: 'mock-owner',
          todos: [],
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          walrusBlobId: blobId
        };
      }

      if (this.connectionState !== 'connected' || !this.walrusClient) {
        throw new ValidationError('WalrusStorage not connected. Call connect() first.', {
          operation: 'retrieve todo list'
        });
      }

      console.log(`Retrieving todo list from Walrus with blob ID: ${blobId}...`);

      // Create a fresh abort controller for this operation
      const retrievalAbortController = new AbortController();
      
      try {
        // Attempt to retrieve the blob with our enhanced retrieval mechanism
        const blobContentResult = await AsyncOperationHandler.execute(
          () => this.retrieveBlob(blobId, {
            maxRetries: 5,
            baseDelay: 1000,
            timeout: 15000,
            useAggregator: true,
            context: 'todo list retrieval',
            signal: retrievalAbortController.signal
          }),
          {
            operation: 'retrieve list blob',
            signal: retrievalAbortController.signal
          }
        );

        if (!blobContentResult.success) {
          throw new StorageError(`Failed to retrieve list blob content: ${blobContentResult.error?.message}`, {
            operation: 'list blob retrieval',
            blobId,
            recoverable: true,
            cause: blobContentResult.error
          });
        }

        const blobContent = blobContentResult.data ?? new Uint8Array();
        console.log('Successfully retrieved todo list data');

        // Parse the list with proper error handling
        try {
          const todoListData = new TextDecoder().decode(blobContent);
          let todoList: TodoList;
          try {
            todoList = JSON.parse(todoListData) as TodoList;
          } catch (parseError) {
            throw new ValidationError(`Failed to parse todo list JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`, {
              operation: 'list parsing',
              recoverable: false
            });
          }

          // Validate the retrieved todo list
          this.validateTodoListData(todoList);

          return todoList;
        } catch (error) {
          if (error instanceof ValidationError) {
            // Propagate validation errors
            throw error;
          }
          
          if (error instanceof SyntaxError) {
            // For JSON parsing errors
            throw new ValidationError('Retrieved todo list data is not valid JSON', {
              operation: 'list parsing',
              recoverable: false,
              cause: error
            });
          }
          
          // For other errors
          throw new ValidationError(
            `Failed to parse todo list data: ${error instanceof Error ? error.message : String(error)}`,
            {
              operation: 'list parsing',
              recoverable: false,
              cause: error instanceof Error ? error : undefined
            }
          );
        }
      } catch (error) {
        // Cancel the retrieval if something goes wrong
        retrievalAbortController.abort();
        
        // Categorize and throw mapped error
        const category = categorizeWalrusError(error);
        throw mapToWalrusError(error, category, 'retrieve todo list');
      }
    } catch (error) {
      // Categorize and properly throw the error
      const category = categorizeWalrusError(error);
      throw mapToWalrusError(error, category, 'retrieve todo list');
    }
  }

  /**
   * Storage verification utility for content integrity checking
   *
   * Verifies that blob content matches expected data by:
   * 1. Retrieving the content directly from storage
   * 2. Comparing content length with expected data
   * 3. Calculating and comparing SHA-256 checksums
   *
   * This verification step is critical for ensuring data integrity in the
   * decentralized storage system, as it confirms successful storage operations.
   *
   * @private
   * @type {Function} Verification function that accepts blobId, expected data, and metadata
   */

  private storageManager: StorageManager | null = null;
  private verifyBlob = async (
    blobId: string,
    expectedData: Buffer,
    expectedMetadata: Record<string, string>
  ): Promise<VerificationResult> => {
    try {
      if (!this.walrusClient) {
        throw new StorageError('WalrusStorage not initialized', {
          operation: 'verify blob'
        });
      }

      const retrievedContent = await this.walrusClient.readBlob({ blobId });
      if (!retrievedContent) {
        return { details: { certified: false } };
      }

      const content = Buffer.from(retrievedContent ?? new Uint8Array());
      const checksum = this.calculateChecksum(content);
      const isValid = expectedData.length === content.length &&
                     this.calculateChecksum(expectedData) === checksum;

      return {
        details: {
          certified: isValid,
          checksum: isValid ? checksum : undefined
        }
      };
    } catch (error) {
      console.warn('Blob verification failed:', error);
      return { details: { certified: false } };
    }
  };

  /**
   * Initializes storage managers when needed
   *
   * Lazily initializes the StorageManager and StorageReuseAnalyzer classes
   * to avoid unnecessary instantiation if they aren't used.
   *
   * This method handles compatibility challenges between different versions
   * of the Walrus client by using type assertions where necessary. It also
   * provides informative errors if initialization fails.
   *
   * @private
   * @throws {ValidationError} If client initialization is incomplete or initialization fails
   */

  private initializeManagers(): void {
    if (!this.storageManager) {
      // Pass the WalrusClientAdapter's underlying client to match the StorageManager's expected type
      if (!this.walrusClient || !this.suiClient) {
        throw new ValidationError('Cannot initialize storage managers: client not initialized', {
          operation: 'initialize managers'
        });
      }

      const walrusClient = this.walrusClient.getUnderlyingClient();
      try {
        // Cast the walrusClient to match the expected interface for StorageManager
        // This fixes the compatibility issue between WalrusClient types
        this.storageManager = new StorageManager(
          this.suiClient,
          walrusClient as any, // Using 'any' to bypass strict type checking
          this.getActiveAddress()
        );
      } catch (error) {
        console.warn('Failed to initialize StorageManager:', error);
        throw new ValidationError('Failed to initialize StorageManager', {
          operation: 'initialize managers',
          cause: error instanceof Error ? error : undefined
        });
      }
    }
    
    if (!this.storageReuseAnalyzer) {
      // Use dynamic import to avoid direct dependency
      const { StorageReuseAnalyzer } = require('./storage-reuse-analyzer');

      if (!this.walrusClient || !this.suiClient) {
        throw new ValidationError('Cannot initialize storage analyzer: client not initialized', {
          operation: 'initialize analyzer'
        });
      }

      // Pass the underlying client to match the analyzer's expected type
      const walrusClient = this.walrusClient.getUnderlyingClient();
      try {
        // Cast the walrusClient to match the expected interface for StorageReuseAnalyzer
        this.storageReuseAnalyzer = new StorageReuseAnalyzer(
          this.suiClient,
          walrusClient as any, // Using 'any' to bypass strict type checking
          this.getActiveAddress()
        );
      } catch (error) {
        console.warn('Failed to initialize StorageReuseAnalyzer:', error);
        throw new ValidationError('Failed to initialize StorageReuseAnalyzer', {
          operation: 'initialize analyzer',
          cause: error instanceof Error ? error : undefined
        });
      }
    }
  }

  /**
   * Ensures sufficient storage is allocated for the given size requirements
   *
   * This is a comprehensive storage allocation implementation that optimizes for cost efficiency:
   * 1. Uses StorageReuseAnalyzer to find optimal existing storage when possible
   * 2. Analyzes current storage inventory for reuse opportunities
   * 3. Validates storage requirements including WAL token balance
   * 4. Creates new storage only when necessary
   * 5. Verifies storage creation success with blockchain confirmation
   *
   * The method prioritizes reusing existing storage to save WAL tokens and provides
   * detailed analytics about storage efficiency for transparency.
   *
   * @param {number} [sizeBytes=1073741824] - The required storage size in bytes (default: 1GB)
   * @returns {Promise<WalrusStorageInfo | null>} Storage information if successfully allocated, null for mock mode
   * @throws {ValidationError} If validation fails
   * @throws {StorageError} If storage operations fail
   * @throws {TransactionError} If blockchain transaction fails (e.g., insufficient WAL)
   * @throws {NetworkError} If network communication fails
   */

  async ensureStorageAllocated(sizeBytes = 1073741824): Promise<WalrusStorageInfo | null> {
    try {
      if (this.useMockMode) {
        return null;
      }

      if (this.connectionState !== 'connected' || !this.walrusClient) {
        throw new ValidationError('WalrusStorage not connected. Call connect() first.', {
          operation: 'storage allocation'
        });
      }

      console.log(`Validating storage requirements for ${sizeBytes} bytes...`);
      this.initializeManagers();
      
      // Use storage analyzer for optimal allocation
      const storageAnalysisResult = await AsyncOperationHandler.execute(
        () => this.storageReuseAnalyzer!.analyzeStorageEfficiency(sizeBytes),
        {
          operation: 'analyze storage',
          maxRetries: 2,
          signal: this.abortController.signal
        }
      );

      if (!storageAnalysisResult.success) {
        throw new StorageError('Failed to analyze storage efficiency', {
          operation: 'storage analysis',
          cause: storageAnalysisResult.error
        });
      }

      const storageAnalysis = storageAnalysisResult.data;
      console.log('Storage analysis completed:');
      console.log(`  Total storage: ${storageAnalysis.analysisResult.totalStorage} bytes`);
      console.log(`  Used storage: ${storageAnalysis.analysisResult.usedStorage} bytes`);
      console.log(`  Available: ${storageAnalysis.analysisResult.availableStorage} bytes`);
      console.log(`  Active storage objects: ${storageAnalysis.analysisResult.activeStorageCount}`);
      console.log(`  Recommendation: ${storageAnalysis.detailedRecommendation}`);
      
      // If we have viable storage to reuse, use it
      if (storageAnalysis.analysisResult.hasViableStorage && storageAnalysis.analysisResult.bestMatch) {
        const bestMatch = storageAnalysis.analysisResult.bestMatch;
        console.log('Reusing existing storage:');
        console.log(`  Storage ID: ${bestMatch.id}`);
        console.log(`  Total size: ${bestMatch.totalSize} bytes`);
        console.log(`  Used size: ${bestMatch.usedSize} bytes`);
        console.log(`  Remaining: ${bestMatch.remaining} bytes`);
        console.log(`  Remaining after operation: ${bestMatch.remaining - sizeBytes} bytes`);
        console.log(`  WAL tokens saved: ${storageAnalysis.costComparison.reuseExistingSavings}`);
        console.log(`  Percentage saved: ${storageAnalysis.costComparison.reuseExistingPercentSaved}%`);
        
        return {
          id: { id: bestMatch.id },
          storage_size: bestMatch.totalSize.toString(),
          used_size: bestMatch.usedSize.toString(),
          end_epoch: bestMatch.endEpoch.toString(),
          start_epoch: bestMatch.startEpoch.toString(),
          content: null,
          data: undefined
        };
      }
      
      // If recommendation is to extend existing storage but not implemented, log info
      if (storageAnalysis.analysisResult.recommendation === 'extend-existing') {
        console.log('Note: Extending existing storage is recommended but not implemented.');
        console.log('Creating new storage instead.');
      }

      // Fallback to comprehensive storage validation
      const validationResult = await AsyncOperationHandler.execute(
        () => this.storageManager.validateStorageRequirements(sizeBytes),
        {
          operation: 'validate storage requirements',
          maxRetries: 2,
          signal: this.abortController.signal
        }
      );

      if (!validationResult.success) {
        throw new StorageError('Failed to validate storage requirements', {
          operation: 'requirements validation',
          cause: validationResult.error
        });
      }

      const validation = validationResult.data;

      if (!validation.canProceed) {
        if (validation.requiredCost && validation.balances) {
          throw new TransactionError(
            `Insufficient funds for storage allocation:\n` +
            `Required: ${validation.requiredCost.requiredBalance} WAL\n` +
            `Available: ${validation.balances.walBalance} WAL\n` +
            `Storage Fund: ${validation.balances.storageFundBalance} WAL`,
            {
              operation: 'storage allocation',
              recoverable: false
            }
          );
        }
        throw new ValidationError(
          'Storage requirements not met. Please check your WAL balance and storage allocation.',
          { operation: 'storage validation' }
        );
      }

      // If we can use existing storage, return it
      if (validation.existingStorage?.isValid && validation.existingStorage.details) {
        const details = validation.existingStorage.details;
        console.log('Using existing storage from validation check:');
        console.log(`  Storage ID: ${details.id}`);
        console.log(`  Remaining size: ${validation.existingStorage.remainingSize} bytes`);
        console.log(`  Remaining epochs: ${validation.existingStorage.remainingEpochs}`);

        return {
          id: { id: details.id },
          storage_size: details.totalSize.toString(),
          used_size: details.usedSize.toString(),
          end_epoch: details.endEpoch.toString(),
          start_epoch: '0', // We don't track this
          content: null,
          data: undefined
        };
      }

      // Proceed with new storage allocation if we get here
      if (!validation.requiredCost) {
        throw new ValidationError(
          'Failed to estimate storage costs',
          { operation: 'cost estimation' }
        );
      }

      console.log('Allocating new storage:');
      console.log(`  Size: ${sizeBytes} bytes`);
      console.log(`  Duration: ${validation.requiredCost.epochs} epochs`);
      console.log(`  Estimated cost: ${validation.requiredCost.totalCost} WAL`);

      // Create a fresh abort controller for allocation
      const allocationAbortController = new AbortController();
      
      try {
        // Attempt storage allocation with comprehensive error handling
        const signer = await this.getTransactionSigner();

        // Verify required values before proceeding
        if (!this.walrusClient) {
          throw new ValidationError('WalrusClient is not initialized', {
            operation: 'storage allocation'
          });
        }

        if (!validation.requiredCost || !validation.requiredCost.epochs) {
          throw new ValidationError('Missing required cost information for storage allocation', {
            operation: 'storage allocation'
          });
        }

        // Create and execute transaction with proper error handling
        const storageCreationResult = await AsyncOperationHandler.execute(
          async () => {
            // Create transaction with proper error handling
            const txbResult = await this.createStorageBlock(
              sizeBytes,
              validation.requiredCost?.epochs || 52 // Default to 52 epochs if missing
            );

            // Verify transaction was created successfully
            if (!txbResult) {
              throw new ValidationError('Failed to create storage transaction block', {
                operation: 'transaction creation'
              });
            }

            return this.walrusClient!.executeCreateStorageTransaction({
              size: sizeBytes,
              epochs: validation.requiredCost?.epochs || 52, // Provide default
              transaction: txbResult, // Use the properly unwrapped result
              signer: signer // Use the properly typed signer
            });
          },
          {
            operation: 'create storage',
            maxRetries: 3,
            baseDelay: 2000,
            signal: allocationAbortController.signal
          }
        );

        if (!storageCreationResult.success) {
          throw new TransactionError('Failed to create storage', {
            operation: 'storage transaction',
            recoverable: false,
            cause: storageCreationResult.error
          });
        }

        const storage = storageCreationResult.data?.storage ?? null;

        // Verify the storage was created
        if (!this.suiClient) {
          throw new ValidationError('SuiClient is not initialized', {
            operation: 'storage verification'
          });
        }

        // Get current epoch for verification
        const systemStateResult = await AsyncOperationHandler.execute(
          () => this.suiClient?.getLatestSuiSystemState() ?? Promise.reject(new Error('SuiClient is not initialized')),
          {
            operation: 'get epoch',
            maxRetries: 2,
            signal: allocationAbortController.signal
          }
        );

        if (!systemStateResult.success) {
          throw new NetworkError('Failed to get system state for verification', {
            operation: 'system state check',
            recoverable: true,
            cause: systemStateResult.error
          });
        }

        const systemState = systemStateResult.data;
        // Use optional chaining and provide a default value
        const currentEpoch = safeToNumber(systemState?.epoch, 0);

        if (!this.storageManager) {
          throw new ValidationError('StorageManager is not initialized', {
            operation: 'storage verification'
          });
        }

        // Verify storage with proper error handling
        const verificationResult = await AsyncOperationHandler.execute(
          () => this.storageManager.verifyExistingStorage(
            sizeBytes,
            currentEpoch
          ),
          {
            operation: 'verify storage',
            maxRetries: 2,
            signal: allocationAbortController.signal
          }
        );

        if (!verificationResult.success) {
          throw new StorageError('Storage verification failed', {
            operation: 'verification',
            recoverable: false,
            cause: verificationResult.error
          });
        }

        const verification = verificationResult.data;

        // Add comprehensive null checks for storage object and its properties
        if (!storage || !storage.id || !storage.id.id) {
          throw new ValidationError('Invalid storage object returned from creation', {
            operation: 'storage validation'
          });
        }

        // Add comprehensive null checks with optional chaining for verification
        if (verification?.isValid &&
            verification?.details?.id === storage?.id?.id &&
            (verification?.details?.endEpoch ?? 0) > currentEpoch &&
            (verification?.details?.usedSize ?? 0) <= (verification?.details?.totalSize ?? 0) &&
            safeToNumber(storage?.storage_size, 0) >= sizeBytes) {

          console.log('Storage allocation verified successfully:');
          console.log(`  Storage ID: ${storage?.id?.id}`);
          console.log(`  Size: ${storage?.storage_size ?? 'unknown'} bytes`);
          console.log(`  End epoch: ${storage?.end_epoch ?? 'unknown'}`);

          return {
            id: storage?.id ?? null,
            storage_size: storage?.storage_size ?? '0',
            used_size: '0',
            end_epoch: String(storage?.end_epoch ?? 0),
            start_epoch: String(storage?.start_epoch ?? 0),
            content: null,
            data: undefined
          };
        }

        throw new StorageError('Storage allocation succeeded but verification failed', {
          operation: 'storage verification',
          recoverable: false
        });
      } catch (error) {
        // Cancel any pending operations
        allocationAbortController.abort();
        
        // Categorize and rethrow the error
        const category = categorizeWalrusError(error);
        throw mapToWalrusError(error, category, 'storage allocation');
      }
    } catch (error) {
      // Categorize and map the error
      const category = categorizeWalrusError(error);
      const mappedError = mapToWalrusError(error, category, 'storage allocation');
      
      console.warn('Storage allocation failed:', mappedError.message);
      throw mappedError;
    }
  }

  /**
   * Enhanced method to check existing storage and provide detailed analytics
   *
   * This method provides comprehensive information about the user's current storage allocation:
   * 1. Uses StorageReuseAnalyzer to gather inventory statistics
   * 2. Provides metrics on total allocation, usage, and efficiency
   * 3. Identifies and analyzes the best storage for reuse
   * 4. Calculates remaining epochs before expiration
   * 5. Falls back to traditional object queries if analyzer fails
   *
   * The method is designed to be non-critical, returning null instead of throwing
   * errors since it's primarily used for informational purposes.
   *
   * @returns {Promise<WalrusStorageInfo | null>} Detailed storage information or null if not available
   */

  async checkExistingStorage(): Promise<WalrusStorageInfo | null> {
    try {
      if (this.useMockMode) {
        return null;
      }

      const address = this.getActiveAddress();
      console.log(`Checking existing storage for address ${address}...`);
      this.initializeManagers();
      
      // Use enhanced storage analyzer with proper error handling
      const analyzerResult = await AsyncOperationHandler.execute(
        () => this.storageReuseAnalyzer!.findBestStorageForReuse(0), // 0 size just to get inventory
        {
          operation: 'find best storage',
          maxRetries: 2,
          signal: this.abortController.signal
        }
      );

      if (!analyzerResult.success) {
        console.warn('Storage analysis failed:', analyzerResult.error?.message);
        return null;
      }

      const storageAnalysis = analyzerResult.data;
      
      console.log('Storage inventory:');
      console.log(`  Total storage allocation: ${storageAnalysis.totalStorage} bytes`);
      console.log(`  Total used storage: ${storageAnalysis.usedStorage} bytes`);
      console.log(`  Total available storage: ${storageAnalysis.availableStorage} bytes`);
      console.log(`  Active storage objects: ${storageAnalysis.activeStorageCount}`);
      console.log(`  Inactive/expired storage objects: ${storageAnalysis.inactiveStorageCount}`);
      
      if (storageAnalysis.activeStorageCount === 0) {
        console.log('No active storage objects found');
        return null;
      }
      
      // Find the best storage object to return
      if (storageAnalysis.bestMatch) {
        const bestMatch = storageAnalysis.bestMatch;
        console.log('Best existing storage for reuse:');
        console.log(`  Storage ID: ${bestMatch.id}`);
        console.log(`  Total size: ${bestMatch.totalSize} bytes`);
        console.log(`  Used size: ${bestMatch.usedSize} bytes`);
        console.log(`  Remaining: ${bestMatch.remaining} bytes`);
        
        // Get current epoch with proper error handling
        const epochResult = await AsyncOperationHandler.execute(
          () => this.suiClient?.getLatestSuiSystemState() ?? Promise.reject(new Error('SuiClient is not initialized')),
          {
            operation: 'get epoch',
            maxRetries: 2,
            signal: this.abortController.signal
          }
        );

        if (!epochResult.success) {
          console.warn('Failed to get current epoch:', epochResult.error?.message);
          return null;
        }

        const epoch = epochResult.data?.epoch ?? '0';
        const currentEpoch = Number(epoch);
        console.log(`  Remaining epochs: ${bestMatch.endEpoch - currentEpoch}`);
        
        return {
          id: { id: bestMatch.id },
          storage_size: bestMatch.totalSize.toString(),
          used_size: bestMatch.usedSize.toString(),
          end_epoch: bestMatch.endEpoch.toString(),
          start_epoch: bestMatch.startEpoch.toString(),
          content: null,
          data: undefined
        };
      }
      
      // Fallback to traditional method if analyzer didn't find a best match
      try {
        const response = await this.suiClient?.getOwnedObjects({
          owner: address,
          filter: {
            StructType: `0x2::storage::Storage`
          },
          options: {
            showContent: true
          }
        });

        const existingStorage = response.data
          .filter((item: SuiObjectResponse) => item.data?.content?.dataType === 'moveObject')
          .map((item: SuiObjectResponse) => {
            const content = item.data?.content && 
              'dataType' in item.data.content && 
              'fields' in item.data.content && 
              item.data.content.dataType === 'moveObject' 
                ? item.data.content as unknown as WalrusStorageContent 
                : null;
            const storageInfo: WalrusStorageInfo = {
              id: item.data?.objectId ? { id: item.data.objectId } : null,
              storage_size: content?.fields?.storage_size ?? '0',
              used_size: content?.fields?.used_size ?? '0',
              end_epoch: content?.fields?.end_epoch ?? '0',
              start_epoch: '0',
              data: item.data ?? null,
              content: content
            };
            return storageInfo;
          });

        if (existingStorage.length > 0) {
          const epochResult = await AsyncOperationHandler.execute(
            () => this.suiClient?.getLatestSuiSystemState() ?? Promise.reject(new Error('SuiClient is not initialized')),
            {
              operation: 'get epoch',
              maxRetries: 2,
              signal: this.abortController.signal
            }
          );

          if (!epochResult.success) {
            console.warn('Failed to get current epoch:', epochResult.error?.message);
            return existingStorage[0]; // Return first storage without epoch check
          }

          const epoch = epochResult.data?.epoch ?? '0';
          const currentEpoch = Number(epoch);

          const suitableStorage = existingStorage.find((storage) => {
            const remainingSize = safeToNumber(storage.storage_size) - safeToNumber(storage.used_size);
            const remainingEpochs = safeToNumber(storage.end_epoch) - currentEpoch;
            return remainingSize >= 1000000 && remainingEpochs >= 10;
          });

          if (suitableStorage) {
            console.log(`Found suitable existing storage: ${suitableStorage.id?.id ?? 'unknown'}`);
            return suitableStorage;
          }
        }

        console.log('No suitable existing storage found');
        return null;
      } catch (error) {
        // For fallback method, just log and return null instead of propagating error
        console.warn('Error checking existing storage:', error);
        return null;
      }
    } catch (error) {
      // For the main method, log and return null instead of propagating error
      console.warn('Error checking existing storage:', error);
      return null;
    }
  }
}

/**
 * Factory function to create a new WalrusStorage instance
 *
 * @param {boolean} [useMockMode=false] - Flag to enable mock mode for testing purposes
 * @returns {WalrusStorage} A new WalrusStorage instance
 * @example
 * // Create a real storage instance
 * const storage = createWalrusStorage();
 *
 * // Create a mock storage instance for testing
 * const mockStorage = createWalrusStorage(true);
 */
export function createWalrusStorage(useMockMode = false): WalrusStorage {
  return new WalrusStorage(useMockMode);
}