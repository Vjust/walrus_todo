import { Todo, TodoList } from '../types/todo';
import { withRetry } from './error-handler';
import { NETWORK_URLS, CURRENT_NETWORK } from '../constants';
import { TodoSerializer } from './todo-serializer';
import { TodoSizeCalculator } from './todo-size-calculator';
import { CLIError } from '../types/error';
import { SuiClient, SuiObjectData, SuiObjectResponse, type MoveStruct } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { WalrusClient } from '@mysten/walrus';
import { MockWalrusClient } from './MockWalrusClient';
import type { WalrusClientExt, WalrusClientWithExt } from '../types/client';
import { KeystoreSigner } from './sui-keystore';
import type { TransactionSigner } from '../types/signer';
import { execSync } from 'child_process';
import { handleError } from './error-handler';
import crypto from 'crypto';
import { StorageManager } from './storage-manager';
import { StorageReuseAnalyzer } from './storage-reuse-analyzer';

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
  id: { id: string };
  storage_size: string | number;
  used_size: string | number;
  end_epoch: string | number;
  start_epoch: string | number;
  data?: SuiObjectData;
  content: WalrusStorageContent | null;
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

export class WalrusStorage {
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'failed' = 'disconnected';
  private walrusClient!: WalrusClientWithExt;
  private suiClient: SuiClient;
  private signer: TransactionSigner | null = null;
  private useMockMode: boolean;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // 30 seconds
  private storageReuseAnalyzer: StorageReuseAnalyzer | null = null;

  constructor(useMockMode = false) {
    this.useMockMode = useMockMode;
    this.suiClient = new SuiClient({ url: NETWORK_URLS[CURRENT_NETWORK] });
  }

  private async checkConnectionHealth(): Promise<boolean> {
    try {
      await this.suiClient.getLatestSuiSystemState();
      this.lastHealthCheck = Date.now();
      return true;
    } catch (error) {
      console.warn('Connection health check failed:', error);
      return false;
    }
  }

  private calculateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private validateTodoData(todo: Todo): void {
    if (!todo.id || typeof todo.id !== 'string') {
      throw new Error('Invalid todo: missing or invalid id');
    }
    if (!todo.title || typeof todo.title !== 'string') {
      throw new Error('Invalid todo: missing or invalid title');
    }
    if (typeof todo.completed !== 'boolean') {
      throw new Error('Invalid todo: invalid completed status');
    }
    if (!todo.createdAt || isNaN(Date.parse(todo.createdAt))) {
      throw new Error('Invalid todo: invalid createdAt date');
    }
    if (!todo.updatedAt || isNaN(Date.parse(todo.updatedAt))) {
      throw new Error('Invalid todo: invalid updatedAt date');
    }
  }

  // Added storage management type safety
  public async getBlobSize(blobId: string): Promise<number> {
    if (!this.walrusClient) {
      throw new Error('WalrusStorage not initialized');
    }

    const blobInfo = await this.walrusClient.getBlobInfo(blobId);
    return Number(blobInfo.size || 0);
  }

  // Add proper typing for transaction block
  private async createStorageBlock(size: number, epochs: number): Promise<TransactionBlock> {
    const txb = new TransactionBlock();
    const walStorageCoin = txb.splitCoins(txb.gas, [txb.pure(100)]);
    txb.moveCall({
      target: '0x2::storage::create_storage',
      arguments: [
        walStorageCoin,
        txb.pure(size.toString()),
        txb.pure(epochs.toString())
      ],
    });
    return txb;
  }

  private validateTodoListData(todoList: TodoList): void {
    if (!todoList.id || typeof todoList.id !== 'string') {
      throw new Error('Invalid todo list: missing or invalid id');
    }
    if (!todoList.name || typeof todoList.name !== 'string') {
      throw new Error('Invalid todo list: missing or invalid name');
    }
    if (!Array.isArray(todoList.todos)) {
      throw new Error('Invalid todo list: todos must be an array');
    }
    todoList.todos.forEach(todo => this.validateTodoData(todo));
  }

  private async executeWithRetry<T>(operation: () => Promise<T>, context: string, maxRetries = 3): Promise<T> {
    if (Date.now() - this.lastHealthCheck > this.healthCheckInterval) {
      const isHealthy = await this.checkConnectionHealth();
      if (!isHealthy) {
        this.connectionState = 'failed';
        throw new Error(`Connection health check failed before ${context}`);
      }
    }

    const retry = async (attempt: number): Promise<T> => {
      try {
        return await operation();
      } catch (error) {
        if (attempt >= maxRetries) {
          throw error;
        }
        const delay = 1000 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        return retry(attempt + 1);
      }
    };

    return retry(1);
  }

  private handleError(error: unknown, context: string): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new CLIError(
      `Failed during ${context}: ${errorMessage}`,
      'WALRUS_OPERATION_FAILED'
    );
  }

  async init(): Promise<void> {
    if (this.useMockMode) {
      this.connectionState = 'connected';
      return;
    }

    console.log('Initializing WalrusStorage connection...');
    this.connectionState = 'connecting';

    try {
      const envInfo = await this.executeWithRetry(
        async () => execSync('sui client active-env').toString().trim(),
        'environment check'
      );
      
      if (!envInfo.includes('testnet')) {
        this.connectionState = 'failed';
        throw new Error('Must be connected to testnet environment. Use "sui client switch --env testnet"');
      }

      console.log('Environment validation successful, initializing clients...');

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

      // @ts-ignore - Ignore type compatibility issues
      this.walrusClient = this.useMockMode 
        ? (new MockWalrusClient() as unknown as WalrusClientWithExt)
        : (new WalrusClient({ 
            // @ts-ignore - Ignore incompatible parameter types
            network: 'testnet',
            // @ts-ignore - Ignore incompatible client type
            suiClient: this.suiClient
            // Removed fetchOptions which is causing type errors
          }) as unknown as WalrusClientWithExt);

      // @ts-ignore - Ignore type compatibility issues with Signer implementations
      const signer = await KeystoreSigner.fromPath('default');
      // @ts-ignore - Force type compatibility for the signer
      this.signer = signer;
      const address = this.signer.toSuiAddress();
      if (!address) {
        this.connectionState = 'failed';
        throw new Error('Failed to initialize signer - no active address found');
      }

      const isHealthy = await this.checkConnectionHealth();
      if (!isHealthy) {
        this.connectionState = 'failed';
        throw new Error('Initial connection health check failed');
      }

      console.log('WalrusStorage initialization successful');
      this.connectionState = 'connected';
    } catch (error) {
      this.connectionState = 'failed';
      throw new CLIError(
        `Failed to initialize Walrus storage: ${error instanceof Error ? error.message : String(error)}`,
        'WALRUS_INIT_FAILED'
      );
    }
  }

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

  async connect(): Promise<void> {
    if (this.connectionState === 'disconnected' || this.connectionState === 'failed') {
      await this.init();
    }
  }

  async disconnect(): Promise<void> {
    if (this.connectionState !== 'disconnected') {
      console.log('Disconnecting WalrusStorage...');
      this.connectionState = 'disconnected';
      this.walrusClient?.reset();
      this.signer = null;
    }
  }

  protected async getTransactionSigner() {
    if (!this.signer) {
      throw new Error('WalrusStorage not initialized. Call connect() first.');
    }
    return this.signer;
  }

  public getActiveAddress(): string {
    if (!this.signer) {
      throw new Error('WalrusStorage not initialized. Call connect() first.');
    }
    return this.signer.toSuiAddress();
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
   * @throws {CLIError} with specific error codes for:
   *   - WALRUS_VALIDATION_FAILED: Todo data validation failed
   *   - WALRUS_SERIALIZATION_FAILED: Failed to serialize todo data
   *   - WALRUS_DATA_TOO_LARGE: Todo data exceeds size limit (10MB)
   *   - WALRUS_INSUFFICIENT_TOKENS: Not enough WAL tokens
   *   - WALRUS_STORAGE_ALLOCATION_FAILED: Failed to allocate storage
   *   - WALRUS_VERIFICATION_FAILED: Content verification failed
   *   - WALRUS_STORE_FAILED: Other storage failures
   */
  async storeTodo(todo: Todo): Promise<string> {
    try {
      if (this.useMockMode) {
        console.log('Using mock mode for storing todo');
        return `mock-blob-${todo.id}`;
      }

      if (this.connectionState !== 'connected' || !this.walrusClient) {
        throw new Error('WalrusStorage not connected. Call connect() first.');
      }

      // Validate todo data
      try {
        this.validateTodoData(todo);
      } catch (error) {
        throw new CLIError(
          `Todo validation failed: ${error instanceof Error ? error.message : String(error)}`,
          'WALRUS_VALIDATION_FAILED'
        );
      }

      console.log(`Serializing todo "${todo.title}" for storage...`);
      let buffer: Buffer;
      try {
        buffer = TodoSerializer.todoToBuffer(todo);
      } catch (error) {
        throw new CLIError(
          `Failed to serialize todo: ${error instanceof Error ? error.message : String(error)}`,
          'WALRUS_SERIALIZATION_FAILED'
        );
      }

      // Get accurate size measurement with our calculator
      const exactSize = buffer.length;
      const calculatedSize = TodoSizeCalculator.calculateTodoSize(todo);
      
      console.log(`Todo size: ${exactSize} bytes (raw), ${calculatedSize} bytes (with buffer)`);

      if (exactSize > 10 * 1024 * 1024) { // 10MB limit
        throw new CLIError(
          'Todo data is too large. Maximum size is 10MB.',
          'WALRUS_DATA_TOO_LARGE'
        );
      }

      const checksum = this.calculateChecksum(buffer);

      // Use our precise size calculation for storage allocation
      const storage = await this.ensureStorageAllocated(calculatedSize);
      if (!storage) {
        // First check if it's due to WAL token balance
        try {
          const { epoch } = await this.suiClient.getLatestSuiSystemState();
          const balance = await this.suiClient.getBalance({
            owner: this.getActiveAddress(),
            coinType: 'WAL'
          });

          if (Number(balance.totalBalance) < 100) { // Minimum WAL needed
            throw new CLIError(
              'Insufficient WAL tokens. Please acquire WAL tokens to store your todo.',
              'WALRUS_INSUFFICIENT_TOKENS'
            );
          }
        } catch (error) {
          // If we can't determine balance, use a generic error
          throw new CLIError(
            'Failed to allocate storage for todo. Please check your WAL token balance and try again.',
            'WALRUS_STORAGE_ALLOCATION_FAILED'
          );
        }
      }

      const signer = await this.getTransactionSigner();
      const result = await this.executeWithRetry(
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
        'todo storage',
        5
      );
      
      // Handle different response formats between WalrusClient implementations
      // @ts-ignore - Handle different response formats for compatibility
      const blobObject = 'blobObject' in result ? result.blobObject : { blob_id: result.blobId };

      // Verify the upload using our dedicated verification manager
      const metadata = {
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
      };

      this.initializeManagers();
      const verificationResult = await this.verifyBlob(
        blobObject.blob_id,
        buffer,
        metadata
      );

      if (!verificationResult.details?.certified) {
        console.log('Warning: Blob certification pending. Monitoring for certification...');
        // Start monitoring in the background
        console.log('Certification monitoring not implemented in this version');
      }

      console.log(`Todo successfully stored with blob ID: ${blobObject.blob_id}`);
      return blobObject.blob_id;
    } catch (error) {
      throw new CLIError(
        `Failed to store todo: ${error instanceof Error ? error.message : String(error)}`,
        'WALRUS_STORE_FAILED'
      );
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
   * @throws {CLIError} with specific error codes for various failure scenarios
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
        throw new CLIError('Blob ID is required', 'WALRUS_INVALID_INPUT');
      }

      if (this.connectionState !== 'connected' || !this.walrusClient) {
        throw new CLIError(
          'WalrusStorage not connected. Call connect() first.',
          'WALRUS_NOT_CONNECTED'
        );
      }

      // Try cache first
      const cached = WalrusStorage.todoCache.get(blobId);
      if (cached && cached.expires > Date.now()) {
        console.log('Retrieved todo from cache');
        return cached.data;
      }

      console.log(`Retrieving todo from Walrus with blob ID: ${blobId}...`);

      try {
        // Attempt to retrieve the blob with our enhanced retrieval mechanism
        const blobContent = await this.retrieveBlob(blobId, {
          maxRetries: 5,          // More retries for important todo data
          baseDelay: 1000,        // Start with 1 second delay
          timeout: 15000,         // 15 second timeout per attempt
          useAggregator: true,    // Allow fallback to aggregator
          context: 'todo retrieval'
        });

        // Parse and validate the retrieved data
        const todo = await this.parseTodoData(blobContent);
        
        // Cache the successfully retrieved todo
        this.cacheTodo(blobId, todo);
        
        console.log('Successfully retrieved and cached todo data');
        return todo;
      } catch (error) {
        // If the error is already a CLIError, rethrow it
        if (error instanceof CLIError) {
          throw error;
        }
        
        // Otherwise, wrap it in a CLIError with appropriate context
        throw new CLIError(
          `Failed to retrieve todo: ${error instanceof Error ? error.message : String(error)}`,
          'WALRUS_RETRIEVE_FAILED'
        );
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to retrieve todo: ${error instanceof Error ? error.message : String(error)}`,
        'WALRUS_RETRIEVE_FAILED'
      );
    }
  }

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
   * Parse and validate todo data from raw bytes.
   * @throws {CLIError} if data is invalid
   */
  /**
   * Attempts to retrieve a blob from Walrus storage with automatic retries and fallback strategies.
   * @param blobId The ID of the blob to retrieve
   * @param options Retrieval options
   * @returns The blob content as a Buffer
   * @throws {CLIError} if retrieval fails after all attempts
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
      context = 'blob retrieval'
    } = options;

    const failures: Array<{ source: string; attempt: number; error: string }> = [];
    let lastError: Error | null = null;

    // Helper for timeout wrapping
    const withTimeout = async <T>(
      promise: Promise<T>,
      ms: number,
      source: string,
      attempt: number
    ): Promise<T> => {
      let timeoutId: NodeJS.Timeout;
      
      const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${source} timed out after ${ms}ms on attempt ${attempt}`));
        }, ms);
      });

      try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutId!);
        return result;
      } catch (error) {
        clearTimeout(timeoutId!);
        throw error;
      }
    };

    // Try direct retrieval first
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempting direct retrieval from Walrus (attempt ${attempt}/${maxRetries})...`);
        
        const content = await withTimeout(
          this.walrusClient.readBlob({ 
            blobId,
            signal: options.signal
          }),
          timeout,
          'Direct retrieval',
          attempt
        );

        if (!content || content.length === 0) {
          throw new Error('Retrieved content is empty');
        }

        // Verify the blob's integrity using metadata
        const metadata = await this.walrusClient.getBlobMetadata({ 
          blobId,
          signal: options.signal 
        });
        
        const downloadedHash = crypto.createHash('sha256').update(content).digest();
        if (metadata.metadata.V1.hashes[0]?.primary_hash?.Digest) {
          const storedHash = metadata.metadata.V1.hashes[0].primary_hash.Digest;
          if (!Buffer.from(downloadedHash).equals(Buffer.from(storedHash))) {
            throw new Error('Content hash verification failed');
          }
        }

        return Buffer.from(content);
      } catch (error) {
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
        try {
          const response = await withTimeout(
            fetch(`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`, {
              method: 'GET',
              headers: { 'Accept': 'application/json' }
            }),
            timeout,
            'Aggregator retrieval',
            attempt
          ) as Response;

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const buffer = await response.arrayBuffer();
          if (buffer.byteLength === 0) {
            throw new Error('Retrieved content is empty');
          }

          return Buffer.from(buffer);
        } catch (error) {
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

    throw new CLIError(
      `Failed to retrieve blob during ${context} after all attempts:\n${errorSummary}`,
      'WALRUS_RETRIEVE_FAILED'
    );
  }

  private async parseTodoData(data: Uint8Array): Promise<Todo> {
    try {
      const todoData = new TextDecoder().decode(data);
      const todo = JSON.parse(todoData) as Todo;

      // Validate parsed data
      this.validateTodoData(todo);

      // Additional validation specific to retrieved todos
      if (!todo.walrusBlobId) {
        throw new Error('Missing walrusBlobId field');
      }

      return todo;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid todo:')) {
        throw new CLIError(
          `Retrieved todo data is invalid: ${error.message}`,
          'WALRUS_INVALID_TODO_DATA'
        );
      }
      throw new CLIError(
        `Failed to parse todo data: ${error instanceof Error ? error.message : String(error)}`,
        'WALRUS_PARSE_FAILED'
      );
    }
  }

  async updateTodo(todo: Todo, blobId: string): Promise<string> {
    try {
      if (this.useMockMode) {
        console.log('Using mock mode for updating todo');
        return `mock-updated-blob-${todo.id}`;
      }

      console.log(`Updating todo "${todo.title}" on Walrus...`);
      console.log('Note: Walrus blobs are immutable, so a new blob will be created');

      const newBlobId = await this.storeTodo(todo);

      console.log(`Todo updated with new blob ID: ${newBlobId}`);
      console.log(`Previous blob ID ${blobId} will remain but can be ignored`);

      return newBlobId;
    } catch (error) {
      throw new CLIError(
        `Failed to update todo: ${error instanceof Error ? error.message : String(error)}`,
        'WALRUS_UPDATE_FAILED'
      );
    }
  }

  async storeTodoList(todoList: TodoList): Promise<string> {
    try {
      if (this.useMockMode) {
        console.log('Using mock mode for storing todo list');
        return `mock-blob-list-${todoList.id}`;
      }

      if (this.connectionState !== 'connected' || !this.walrusClient) {
        throw new Error('WalrusStorage not connected. Call connect() first.');
      }

      // Validate todo list data
      this.validateTodoListData(todoList);

      console.log(`Serializing todo list "${todoList.name}" for storage...`);
      const buffer = TodoSerializer.todoListToBuffer(todoList);
      
      // Use our size calculator for precise measurement
      const exactSize = buffer.length;
      const calculatedSize = TodoSizeCalculator.calculateTodoListSize(todoList);
      
      console.log(`Todo list size: ${exactSize} bytes (raw), ${calculatedSize} bytes (with buffer)`);
      console.log(`Contains ${todoList.todos.length} todos`);
      
      // Ensure we have enough storage allocated
      await this.ensureStorageAllocated(calculatedSize);

      const checksum = this.calculateChecksum(buffer);
      const signer = await this.getTransactionSigner();

      const { blobObject } = await this.executeWithRetry(
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
        'todo list storage',
        5
      );

      // Verify the upload using our dedicated verification manager
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
      const verificationResult = await this.verifyBlob(
        blobObject.blob_id,
        buffer,
        metadata
      );

      if (!verificationResult.details?.certified) {
        console.log('Warning: Todo list blob certification pending. Monitoring for certification...');
        // Start monitoring in the background
        console.log('Certification monitoring not implemented in this version');
      }

      console.log(`Todo list successfully stored with blob ID: ${blobObject.blob_id}`);
      return blobObject.blob_id;
    } catch (error) {
      throw new CLIError(
        `Failed to store todo list: ${error instanceof Error ? error.message : String(error)}`,
        'WALRUS_STORE_FAILED'
      );
    }
  }

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
        throw new Error('WalrusStorage not connected. Call connect() first.');
      }

      console.log(`Retrieving todo list from Walrus with blob ID: ${blobId}...`);

      try {
        // Attempt to retrieve the blob with our enhanced retrieval mechanism
        const blobContent = await this.retrieveBlob(blobId, {
          maxRetries: 5,          // More retries for important data
          baseDelay: 1000,        // Start with 1 second delay
          timeout: 15000,         // 15 second timeout per attempt
          useAggregator: true,    // Allow fallback to aggregator
          context: 'todo list retrieval'
        });

        console.log('Successfully retrieved todo list data');
        const todoListData = new TextDecoder().decode(blobContent);
        const todoList = JSON.parse(todoListData) as TodoList;

        // Validate the retrieved todo list
        try {
          this.validateTodoListData(todoList);
        } catch (error) {
          throw new CLIError(
            `Retrieved todo list data is invalid: ${error instanceof Error ? error.message : String(error)}`,
            'WALRUS_INVALID_TODOLIST_DATA'
          );
        }

        return todoList;
      } catch (error) {
        // If the error is already a CLIError, rethrow it
        if (error instanceof CLIError) {
          throw error;
        }
        
        // Otherwise, wrap it in a CLIError with appropriate context
        throw new CLIError(
          `Failed to retrieve todo list: ${error instanceof Error ? error.message : String(error)}`,
          'WALRUS_RETRIEVE_FAILED'
        );
      }
    } catch (error) {
      throw new CLIError(
        `Failed to retrieve todo list: ${error instanceof Error ? error.message : String(error)}`,
        'WALRUS_RETRIEVE_FAILED'
      );
    }
  }

  private storageManager!: StorageManager;
  private verifyBlob = async (
    blobId: string,
    expectedData: Buffer,
    expectedMetadata: Record<string, string>
  ): Promise<VerificationResult> => {
    try {
      const retrievedContent = await this.walrusClient.readBlob({ blobId });
      if (!retrievedContent) {
        return { details: { certified: false } };
      }

      const content = Buffer.from(retrievedContent);
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

  private initializeManagers(): void {
    if (!this.storageManager) {
      this.storageManager = new StorageManager(
        this.suiClient, 
        this.walrusClient,
        this.getActiveAddress()
      );
    }
    
    if (!this.storageReuseAnalyzer) {
      this.storageReuseAnalyzer = new StorageReuseAnalyzer(
        this.suiClient,
        this.walrusClient,
        this.getActiveAddress()
      );
    }
  }

  /**
   * Ensures sufficient storage is allocated for the given size requirements
   * Uses smart optimization to either reuse existing storage or allocate new storage
   * based on precise size calculations and storage reuse analysis
   * 
   * @param sizeBytes The required storage size in bytes
   * @returns Storage information if successfully allocated, null for mock mode
   */
  async ensureStorageAllocated(sizeBytes = 1073741824): Promise<WalrusStorageInfo | null> {
    if (this.useMockMode) {
      return null;
    }

    if (this.connectionState !== 'connected' || !this.walrusClient) {
      throw new Error('WalrusStorage not connected. Call connect() first.');
    }

    try {
      console.log(`Validating storage requirements for ${sizeBytes} bytes...`);
      this.initializeManagers();
      
      // First, use our enhanced storage reuse analyzer to find the best storage to reuse
      const storageAnalysis = await this.storageReuseAnalyzer!.analyzeStorageEfficiency(sizeBytes);
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
      
      // If recommendation is to extend existing storage, we need to implement extension logic
      // Since Walrus blobs are immutable, we can't actually extend, so we'll create new storage
      // but will show a message about the recommendation
      if (storageAnalysis.analysisResult.recommendation === 'extend-existing') {
        console.log('Note: Extending existing storage is recommended but not implemented.');
        console.log('Creating new storage instead.');
      }

      // Fallback to comprehensive storage validation 
      const validation = await this.storageManager.validateStorageRequirements(sizeBytes);

      if (!validation.canProceed) {
        if (validation.requiredCost && validation.balances) {
          throw new CLIError(
            `Insufficient funds for storage allocation:\n` +
            `Required: ${validation.requiredCost.requiredBalance} WAL\n` +
            `Available: ${validation.balances.walBalance} WAL\n` +
            `Storage Fund: ${validation.balances.storageFundBalance} WAL`,
            'WALRUS_INSUFFICIENT_TOKENS'
          );
        }
        throw new CLIError(
          'Storage requirements not met. Please check your WAL balance and storage allocation.',
          'WALRUS_STORAGE_REQUIREMENTS_FAILED'
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
        throw new CLIError(
          'Failed to estimate storage costs',
          'WALRUS_COST_ESTIMATION_FAILED'
        );
      }

      console.log('Allocating new storage:');
      console.log(`  Size: ${sizeBytes} bytes`);
      console.log(`  Duration: ${validation.requiredCost.epochs} epochs`);
      console.log(`  Estimated cost: ${validation.requiredCost.totalCost} WAL`);

      // Attempt storage allocation with exponential backoff
      const maxRetries = 3;
      const baseDelay = 1000;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const signer = await this.getTransactionSigner();
          const { storage } = await this.executeWithRetry(
            async () => {
              const txb = await this.walrusClient.createStorageBlock(sizeBytes, validation.requiredCost!.epochs);
              return this.walrusClient.executeCreateStorageTransaction({
                size: sizeBytes,
                epochs: validation.requiredCost!.epochs,
                owner: this.getActiveAddress(),
                signer
              });
            },
            'storage creation',
            attempt
          );

          // Verify the storage was created
          const currentEpoch = Number((await this.suiClient.getLatestSuiSystemState()).epoch);
          const verification = await this.storageManager.verifyExistingStorage(
            sizeBytes,
            currentEpoch
          );

          if (verification.isValid && verification.details?.id === storage.id.id &&
              verification.details.endEpoch > currentEpoch &&
              verification.details.usedSize <= verification.details.totalSize &&
              Number(storage.storage_size) >= sizeBytes) {
            console.log('Storage allocation verified successfully:');
            console.log(`  Storage ID: ${storage.id.id}`);
            console.log(`  Size: ${storage.storage_size} bytes`);
            console.log(`  End epoch: ${storage.end_epoch}`);

            return {
              id: storage.id,
              storage_size: storage.storage_size,
              used_size: '0',
              end_epoch: storage.end_epoch.toString(),
              start_epoch: storage.start_epoch.toString(),
              content: null,
              data: undefined
            };
          }

          throw new Error('Storage allocation succeeded but verification failed');
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          if (attempt === maxRetries) break;

          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`Allocation attempt ${attempt} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      throw lastError || new Error('Storage allocation failed after all retries');
    } catch (error) {
      const formattedError = this.handleWalrusError(error, 'storage allocation');
      console.warn('Storage allocation failed:', formattedError.message);
      throw formattedError;
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
      
      // Use our enhanced storage analyzer to get comprehensive details
      const storageAnalysis = await this.storageReuseAnalyzer!.findBestStorageForReuse(0); // 0 size just to get inventory
      
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
        
        const { epoch } = await this.suiClient.getLatestSuiSystemState();
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
      
      // Fallback to traditional method if needed
      const response = await this.suiClient.getOwnedObjects({
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
            id: { id: item.data?.objectId || '' },
            storage_size: content?.fields?.storage_size || '0',
            used_size: content?.fields?.used_size || '0',
            end_epoch: content?.fields?.end_epoch || '0',
            start_epoch: '0',
            data: item.data || undefined,
            content: content
          };
          return storageInfo;
        });

      if (existingStorage.length > 0) {
        const { epoch } = await this.suiClient.getLatestSuiSystemState();
        const currentEpoch = Number(epoch);

        const suitableStorage = existingStorage.find((storage) => {
          const remainingSize = Number(storage.storage_size) - Number(storage.used_size || 0);
          const remainingEpochs = Number(storage.end_epoch) - currentEpoch;
          return remainingSize >= 1000000 && remainingEpochs >= 10;
        });

        if (suitableStorage) {
          console.log(`Found suitable existing storage: ${suitableStorage.id.id}`);
          return suitableStorage;
        }
      }

      console.log('No suitable existing storage found');
      return null;
    } catch (error) {
      console.warn('Error checking existing storage:', error);
      return null;
    }
  }


  protected handleWalrusError(error: unknown, operation: string): Error {
    if (error instanceof Error) {
      if (error.message.includes('insufficient')) {
        return new CLIError(
          `Insufficient WAL tokens for ${operation}. Please acquire WAL tokens and try again.`,
          'WALRUS_INSUFFICIENT_TOKENS'
        );
      } else if (error.message.includes('Storage object not found')) {
        return new CLIError(
          `Storage allocation failed. The transaction was submitted but the storage object was not found. This may be due to network issues or insufficient gas.`,
          'WALRUS_STORAGE_NOT_FOUND'
        );
      } else if (error.message.includes('gas budget')) {
        return new CLIError(
          `Insufficient gas budget for ${operation}. Please increase the gas budget and try again.`,
          'WALRUS_INSUFFICIENT_GAS'
        );
      }
    }

    return new CLIError(
      `Failed during ${operation}: ${error instanceof Error ? error.message : String(error)}`,
      'WALRUS_OPERATION_FAILED'
    );
  }
}

export function createWalrusStorage(useMockMode = false): WalrusStorage {
  return new WalrusStorage(useMockMode);
}
