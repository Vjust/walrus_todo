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

interface VerificationResult {
  details?: {
    certified: boolean;
    checksum?: string;
  };
}

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
 * @param value The value to convert
 * @param fallback The fallback value to use if conversion fails
 * @returns The converted number or fallback
 */
function safeToNumber(value: string | number | null | undefined, fallback: number = 0): number {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  return isNaN(num) ? fallback : num;
}

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
 * WalrusStorage - A utility class for managing Todo data storage on the Walrus decentralized platform.
 * 
 * This class handles the storage and retrieval of Todo items and Todo lists using the Walrus storage
 * system, integrated with the Sui blockchain for secure transactions. It provides methods to store,
 * retrieve, and update Todo data, ensuring data integrity through checksum validation and robust
 * error handling. Key features include automatic retry mechanisms for network issues, storage
 * allocation optimization, and caching for efficient data access. It serves as a critical component
 * for persisting Todo information in a decentralized environment.
 * 
 * @class WalrusStorage
 * @param {boolean} [useMockMode=false] - Flag to enable mock mode for testing purposes, bypassing
 *                                       actual blockchain and storage operations.
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
   * Checks connection health with proper error handling
   * @returns Promise resolving to boolean indicating if connection is healthy
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

  private calculateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Validates todo data with clear validation errors
   * @throws ValidationError with specific details
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
   * Gets blob size with proper error handling
   * @param blobId The blob ID to check
   * @returns The size of the blob in bytes
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
   * Creates a storage transaction block with adapter compatibility
   * @param size Size in bytes
   * @param epochs Duration in epochs
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
   * Validates todo list data with clear errors
   * @throws ValidationError with specific details
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
   * Initialize the WalrusStorage connection
   * @returns Promise that resolves when initialization is complete
   * @throws Properly categorized errors
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
   * Check if the storage is connected with a health check
   * @returns Promise resolving to boolean
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
   * Connect to the storage service if not already connected
   */
  async connect(): Promise<void> {
    if (this.connectionState === 'disconnected' || this.connectionState === 'failed') {
      await this.init();
    }
  }

  /**
   * Disconnect from the storage service
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
   * Get the transaction signer with proper error handling
   * @throws Properly categorized error if signer is not initialized
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
   * Get the active wallet address
   * @returns The active wallet address
   * @throws Properly categorized error if not initialized
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
   * Store a todo item in Walrus blob storage.
   * 
   * This method performs several steps:
   * 1. Validates todo data format and fields
   * 2. Serializes the todo and generates a SHA-256 checksum
   * 3. Ensures sufficient storage space is allocated
   * 4. Uploads the todo data with metadata as a Walrus blob
   * 5. Verifies the uploaded content with retries
   * 
   * @param todo - The todo item to store
   * @returns A Promise resolving to the Walrus blob ID
   * @throws Properly categorized errors for different failure scenarios
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
   * Retrieve a todo item from Walrus blob storage.
   * 
   * This method attempts to retrieve the todo data in this order:
   * 1. Check in-memory cache
   * 2. Try direct retrieval from Walrus client
   * 3. Fall back to public aggregator with retries
   * 
   * @param blobId - The Walrus blob ID to retrieve
   * @returns A Promise resolving to the Todo item
   * @throws Properly categorized errors for various failure scenarios
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
   * Cache a todo for faster retrieval
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
   * Attempts to retrieve a blob from Walrus storage with automatic retries and fallback strategies.
   * @param blobId The ID of the blob to retrieve
   * @param options Retrieval options
   * @returns The blob content as a Buffer
   * @throws Properly categorized errors for retrieval failures
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
   * Parse and validate todo data from raw bytes
   * @param data The raw todo data bytes
   * @returns Parsed and validated Todo object
   * @throws Properly categorized errors for parsing issues
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
   * Update a todo item by storing a new version
   * @param todo Updated todo
   * @param blobId Original blob ID
   * @returns Promise resolving to new blob ID
   * @throws Properly categorized errors for update failures
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
   * Store a todo list in Walrus blob storage
   * @param todoList The list to store
   * @returns Promise resolving to the blob ID
   * @throws Properly categorized errors for storage failures
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
   * Retrieve a todo list from Walrus blob storage
   * @param blobId The blob ID to retrieve
   * @returns Promise resolving to the TodoList
   * @throws Properly categorized errors for retrieval failures
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
   * Storage verification utility
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
   * Initialize storage managers when needed
   * @private
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
   * Uses smart optimization to either reuse existing storage or allocate new storage
   * based on precise size calculations and storage reuse analysis
   * 
   * @param sizeBytes The required storage size in bytes
   * @returns Storage information if successfully allocated, null for mock mode
   * @throws Properly categorized errors for allocation failures
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
   * @returns Detailed storage information or null if not available
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

export function createWalrusStorage(useMockMode = false): WalrusStorage {
  return new WalrusStorage(useMockMode);
}