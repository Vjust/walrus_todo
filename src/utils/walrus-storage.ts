
import { Todo, TodoList } from '../types/todo';
import { NETWORK_URLS, CURRENT_NETWORK } from '../constants';
import { TodoSerializer } from './todo-serializer';
import { CLIError } from '../types/error';
import { SuiClient } from '@mysten/sui/client';
import { WalrusClient, RetryableWalrusClientError } from '@mysten/walrus';
import { KeystoreSigner } from './sui-keystore';
import { execSync } from 'child_process';
import { handleError } from './error-handler';
// Import node-fetch dynamically to avoid ESM issues
let fetch: any;

export class WalrusStorage {
  private isInitialized: boolean = false;
  private walrusClient!: WalrusClient;
  private suiClient: SuiClient;
  private signer: KeystoreSigner | null = null;
  private useMockMode: boolean;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // Initial delay in ms

  constructor(useMockMode: boolean = false) {
    this.useMockMode = useMockMode;
    this.suiClient = new SuiClient({ url: NETWORK_URLS[CURRENT_NETWORK] });
  }

  /**
   * Check if the storage is in mock mode
   * @returns True if in mock mode, false otherwise
   */
  isInMockMode(): boolean {
    return this.useMockMode;
  }

  /**
   * Custom fetch implementation with retry logic for Walrus operations
   * @param url The URL to fetch
   * @param init Fetch options
   * @returns Promise with the fetch response
   */
  private async fetchWithRetry(url: RequestInfo, init?: RequestInit): Promise<Response> {
    let lastError: Error | null = null;

    // Ensure fetch is available
    if (!fetch) {
      try {
        const nodeFetch = await import('node-fetch');
        fetch = nodeFetch.default;
        console.log('Successfully imported node-fetch in fetchWithRetry');
      } catch (fetchError) {
        console.warn('Failed to import node-fetch in fetchWithRetry, falling back to global fetch:', fetchError);
        // Fall back to global fetch if available
        fetch = globalThis.fetch;
      }
    }

    if (!fetch) {
      throw new Error('No fetch implementation available');
    }

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Attempt the fetch
        const response = await fetch(url, init);

        // If successful, return the response
        if (response.ok) {
          return response;
        }

        // If not successful but not a server error, don't retry
        if (response.status < 500) {
          return response;
        }

        // For server errors, throw to trigger retry
        lastError = new Error(`HTTP error ${response.status}: ${response.statusText}`);
      } catch (error) {
        // Store the error for potential rethrowing
        lastError = error instanceof Error ? error : new Error(String(error));

        // If this is not the last attempt, wait before retrying
        if (attempt < this.maxRetries - 1) {
          // Exponential backoff with jitter
          const delay = this.retryDelay * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // If we've exhausted all retries, throw the last error
    throw lastError || new Error('Failed after maximum retry attempts');
  }

  async init(): Promise<void> {
    try {
      if (this.useMockMode) {
        this.isInitialized = true;
        return;
      }

      // Dynamically import node-fetch to avoid ESM issues
      if (!fetch) {
        try {
          const nodeFetch = await import('node-fetch');
          fetch = nodeFetch.default;
          console.log('Successfully imported node-fetch');
        } catch (fetchError) {
          console.warn('Failed to import node-fetch, falling back to global fetch:', fetchError);
          // Fall back to global fetch if available
          fetch = globalThis.fetch;
        }
      }

      // Get active environment info from Sui CLI
      const envInfo = execSync('sui client active-env').toString().trim();
      if (!envInfo.includes('testnet')) {
        throw new Error('Must be connected to testnet environment. Use "sui client switch --env testnet"');
      }

      // Initialize Walrus client with network config and improved error handling
      this.walrusClient = new WalrusClient({
        network: 'testnet',
        suiClient: this.suiClient,
        storageNodeClientOptions: {
          timeout: 60000, // Increase timeout to 60 seconds for better reliability
          onError: (error) => handleError('Walrus storage node error:', error),
          fetch: (url, init) => {
            // Custom fetch implementation with retry logic
            return this.fetchWithRetry(url, init);
          }
        }
      });

      // Create a signer that uses the active CLI keystore
      this.signer = new KeystoreSigner(this.suiClient);

      this.isInitialized = true;
    } catch (error) {
      throw new CLIError(
        `Failed to initialize Walrus storage: ${error instanceof Error ? error.message : String(error)}`,
        'WALRUS_INIT_FAILED'
      );
    }
  }

  async isConnected(): Promise<boolean> {
    return this.isInitialized;
  }

  async connect(): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }
  }

  async disconnect(): Promise<void> {
    this.isInitialized = false;
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

  async storeTodo(todo: Todo): Promise<string> {
    try {
      if (this.useMockMode) {
        // Mock storing to Walrus
        console.log('Using mock mode for storing todo');
        const blobId = `mock-blob-${todo.id}`;
        return blobId;
      }

      if (!this.isInitialized || !this.walrusClient) {
        throw new Error('WalrusStorage not initialized. Call connect() first.');
      }

      // Calculate the size of the todo data
      console.log(`Serializing todo "${todo.title}" for storage...`);
      const buffer = TodoSerializer.todoToBuffer(todo);
      const sizeBytes = buffer.length;

      // Explicitly ensure storage is allocated before writing blob
      console.log('Ensuring storage is allocated...');
      const storage = await this.ensureStorageAllocated(sizeBytes + 1000); // Add buffer
      if (!storage) {
        throw new Error('Failed to allocate storage for todo. Check WAL token balance.');
      }
      console.log(`Using storage with ID: ${storage.id.id}`);

      // Get the transaction signer
      const signer = await this.getTransactionSigner();

      try {
        // Use the writeBlob method with storage allocation handled by the SDK
        console.log('Writing blob to Walrus...');
        const { blobObject } = await this.walrusClient.writeBlob({
          blob: new Uint8Array(buffer),
          deletable: false,
          epochs: 52, // Store for ~6 months
          signer,
          attributes: {
            contentType: 'application/json',
            filename: `todo-${todo.id}.json`,
            type: 'todo-data',
            title: todo.title,
            completed: todo.completed.toString()
          }
        });

        console.log(`Todo successfully stored on Walrus with blob ID: ${blobObject.blob_id}`);
        console.log(`Blob object ID: ${blobObject.id.id}`);
        console.log(`Blob size: ${blobObject.size}`);
        console.log(`Blob registered in epoch: ${blobObject.registered_epoch}`);
        console.log(`Blob storage ends in epoch: ${blobObject.storage.end_epoch}`);

        return blobObject.blob_id;
      } catch (error) {
        // Retry logic remains the same
        if (error instanceof RetryableWalrusClientError) {
          console.log('Encountered a retryable error. Resetting client and retrying...');
          this.walrusClient.reset();

          // Retry with writeBlob method
          console.log('Retrying with writeBlob method...');
          const { blobObject } = await this.walrusClient.writeBlob({
            blob: new Uint8Array(buffer),
            deletable: false,
            epochs: 52,
            signer,
            attributes: {
              contentType: 'application/json',
              filename: `todo-${todo.id}.json`,
              type: 'todo-data',
              title: todo.title,
              completed: todo.completed.toString()
            }
          });

          console.log(`Todo successfully stored on Walrus after retry with blob ID: ${blobObject.blob_id}`);
          return blobObject.blob_id;
        }

        throw error;
      }
    } catch (error) {
      throw new CLIError(
        `Failed to store todo: ${error instanceof Error ? error.message : String(error)}`,
        'WALRUS_STORE_FAILED'
      );
    }
  }

  async retrieveTodo(blobId: string): Promise<Todo> {
    try {
      if (this.useMockMode) {
        // Mock retrieval
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

      if (!this.isInitialized || !this.walrusClient) {
        throw new Error('WalrusStorage not initialized. Call connect() first.');
      }

      console.log(`Retrieving todo from Walrus with blob ID: ${blobId}...`);

      // Try to retrieve from Walrus client first
      try {
        try {
          const blobContent = await this.walrusClient.readBlob({ blobId });
          if (blobContent) {
            console.log('Successfully retrieved todo data from Walrus');
            // Convert binary data to todo object
            const todoData = new TextDecoder().decode(blobContent);
            return JSON.parse(todoData) as Todo;
          }
        } catch (walrusError) {
          // Check if it's a retryable error
          if (walrusError instanceof RetryableWalrusClientError) {
            console.log('Encountered a retryable error. Resetting client and retrying...');
            this.walrusClient.reset();

            // Retry the operation
            const blobContent = await this.walrusClient.readBlob({ blobId });
            if (blobContent) {
              console.log('Successfully retrieved todo data from Walrus after retry');
              // Convert binary data to todo object
              const todoData = new TextDecoder().decode(blobContent);
              return JSON.parse(todoData) as Todo;
            }
          }

          console.warn('Failed to retrieve directly from Walrus client, trying aggregator:', walrusError);
        }

        // Fallback to public aggregator if direct retrieval fails
        console.log('Attempting to retrieve from public aggregator...');
        // Ensure fetch is available
        if (!fetch) {
          try {
            const nodeFetch = await import('node-fetch');
            fetch = nodeFetch.default;
          } catch (fetchError) {
            console.warn('Failed to import node-fetch, falling back to global fetch');
            fetch = globalThis.fetch;
          }
        }
        const response = await fetch(`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`, {
          method: 'GET'
        });

        if (!response.ok) {
          throw new Error(`Failed to retrieve blob from aggregator: ${response.statusText}`);
        }

        console.log('Successfully retrieved todo data from public aggregator');
        const todoData = new TextDecoder().decode(await response.arrayBuffer());
        return JSON.parse(todoData) as Todo;
      } catch (error) {
        console.error('All retrieval methods failed:', error);
        throw error;
      }
    } catch (error) {
      throw new CLIError(
        `Failed to retrieve todo: ${error instanceof Error ? error.message : String(error)}`,
        'WALRUS_RETRIEVE_FAILED'
      );
    }
  }

  async updateTodo(todo: Todo, blobId: string): Promise<string> {
    try {
      if (this.useMockMode) {
        // Mock update
        console.log('Using mock mode for updating todo');
        return `mock-updated-blob-${todo.id}`;
      }

      console.log(`Updating todo "${todo.title}" on Walrus...`);
      console.log('Note: Walrus blobs are immutable, so a new blob will be created');

      // For Walrus, we can't update blobs directly as they're immutable
      // So we create a new blob and return the new blob ID
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
        // Mock storage
        console.log('Using mock mode for storing todo list');
        const blobId = `mock-blob-list-${todoList.id}`;
        return blobId;
      }

      if (!this.isInitialized || !this.walrusClient) {
        throw new Error('WalrusStorage not initialized. Call connect() first.');
      }

      // Ensure storage is allocated
      await this.ensureStorageAllocated();

      console.log(`Serializing todo list "${todoList.name}" for storage...`);
      // Serialize todoList to buffer
      const buffer = TodoSerializer.todoListToBuffer(todoList);

      // Upload to Walrus using CLI keystore signer
      console.log('Uploading todo list data to Walrus...');
      const signer = await this.getTransactionSigner();

      try {
        const { blobObject } = await this.walrusClient.writeBlob({
          blob: new Uint8Array(buffer),
          deletable: false,
          epochs: 52, // Store for ~6 months
          signer,
          attributes: {
            contentType: 'application/json',
            filename: `todolist-${todoList.id}.json`,
            type: 'todolist-data',
            name: todoList.name
          }
        });

        console.log(`Todo list successfully stored on Walrus with blob ID: ${blobObject.blob_id}`);
        console.log(`Blob object ID: ${blobObject.id.id}`);
        console.log(`Blob size: ${blobObject.size}`);
        console.log(`Blob registered in epoch: ${blobObject.registered_epoch}`);
        console.log(`Blob storage ends in epoch: ${blobObject.storage.end_epoch}`);

        return blobObject.blob_id;
      } catch (error) {
        // Check if it's a retryable error
        if (error instanceof RetryableWalrusClientError) {
          console.log('Encountered a retryable error. Resetting client and retrying...');
          this.walrusClient.reset();

          // Retry the operation
          const { blobObject } = await this.walrusClient.writeBlob({
            blob: new Uint8Array(buffer),
            deletable: false,
            epochs: 52, // Store for ~6 months
            signer,
            attributes: {
              contentType: 'application/json',
              filename: `todolist-${todoList.id}.json`,
              type: 'todolist-data',
              name: todoList.name
            }
          });

          console.log(`Todo list successfully stored on Walrus after retry with blob ID: ${blobObject.blob_id}`);
          return blobObject.blob_id;
        }

        // If not a retryable error, rethrow
        throw error;
      }
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
        // Mock retrieval
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

      if (!this.isInitialized || !this.walrusClient) {
        throw new Error('WalrusStorage not initialized. Call connect() first.');
      }

      console.log(`Retrieving todo list from Walrus with blob ID: ${blobId}...`);

      // Try to retrieve from Walrus client first
      try {
        try {
          const blobContent = await this.walrusClient.readBlob({ blobId });
          if (blobContent) {
            console.log('Successfully retrieved todo list data from Walrus');
            // Convert binary data to todoList object
            const todoListData = new TextDecoder().decode(blobContent);
            return JSON.parse(todoListData) as TodoList;
          }
        } catch (walrusError) {
          // Check if it's a retryable error
          if (walrusError instanceof RetryableWalrusClientError) {
            console.log('Encountered a retryable error. Resetting client and retrying...');
            this.walrusClient.reset();

            // Retry the operation
            const blobContent = await this.walrusClient.readBlob({ blobId });
            if (blobContent) {
              console.log('Successfully retrieved todo list data from Walrus after retry');
              // Convert binary data to todoList object
              const todoListData = new TextDecoder().decode(blobContent);
              return JSON.parse(todoListData) as TodoList;
            }
          }

          console.warn('Failed to retrieve directly from Walrus client, trying aggregator:', walrusError);
        }

        // Fallback to public aggregator if direct retrieval fails
        console.log('Attempting to retrieve from public aggregator...');
        // Ensure fetch is available
        if (!fetch) {
          try {
            const nodeFetch = await import('node-fetch');
            fetch = nodeFetch.default;
          } catch (fetchError) {
            console.warn('Failed to import node-fetch, falling back to global fetch');
            fetch = globalThis.fetch;
          }
        }
        const response = await fetch(`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`, {
          method: 'GET'
        });

        if (!response.ok) {
          throw new Error(`Failed to retrieve blob from aggregator: ${response.statusText}`);
        }

        console.log('Successfully retrieved todo list data from public aggregator');
        const todoListData = new TextDecoder().decode(await response.arrayBuffer());
        return JSON.parse(todoListData) as TodoList;
      } catch (error) {
        console.error('All retrieval methods failed:', error);
        throw error;
      }
    } catch (error) {
      throw new CLIError(
        `Failed to retrieve todo list: ${error instanceof Error ? error.message : String(error)}`,
        'WALRUS_RETRIEVE_FAILED'
      );
    }
  }

  /**
   * Ensure that storage is allocated for the user in Walrus.
   * This method checks for available storage and buys it if necessary.
   * @param sizeBytes Number of bytes to ensure are allocated (default: 1GB).
   * @returns The storage object if allocation was successful, undefined otherwise
   */
  async ensureStorageAllocated(sizeBytes: number = 1073741824): Promise<any> { // 1GB = 1073741824 bytes
    if (this.useMockMode) {
      return undefined; // Skip in mock mode
    }

    if (!this.isInitialized || !this.walrusClient) {
      throw new Error('WalrusStorage not initialized. Call connect() first.');
    }

    try {
      console.log('Checking Walrus storage allocation...');

      // Get the active address
      const address = this.getActiveAddress();
      console.log(`Using address ${address} for Walrus storage operations`);

      // Calculate the cost of storage for the given size and epochs
      const epochs = 52; // Store for ~6 months
      const { storageCost, writeCost, totalCost } = await this.walrusClient.storageCost(sizeBytes, epochs);

      console.log(`Storage cost for ${sizeBytes} bytes for ${epochs} epochs:`);
      console.log(`  Storage cost: ${storageCost} WAL`);
      console.log(`  Write cost: ${writeCost} WAL`);
      console.log(`  Total cost: ${totalCost} WAL`);

      // Get the current epoch from the Sui client
      const { epoch } = await this.suiClient.getLatestSuiSystemState();
      const currentEpoch = Number(epoch);
      console.log(`Current epoch: ${currentEpoch}`);

      // Create storage for the blob
      console.log('Creating storage allocation...');

      // Get the transaction signer
      const signer = await this.getTransactionSigner();

      // Create storage transaction
      const { storage } = await this.walrusClient.executeCreateStorageTransaction({
        size: sizeBytes,
        epochs: epochs,
        owner: address,
        signer
      });

      console.log(`Storage allocated successfully:`);
      console.log(`  Storage ID: ${storage.id.id}`);
      console.log(`  Start epoch: ${storage.start_epoch}`);
      console.log(`  End epoch: ${storage.end_epoch}`);
      console.log(`  Storage size: ${storage.storage_size}`);

      return storage;
    } catch (error: any) {
      // Use our error handler to get a consistent error message
      const formattedError = this.handleWalrusError(error, 'storage allocation');

      // If we get an error about insufficient WAL tokens, provide guidance
      if (formattedError.message.includes('Insufficient WAL tokens')) {
        console.warn('Insufficient WAL tokens for storage allocation.');
        console.warn('You need WAL tokens to store data on Walrus.');
        console.warn('Please acquire WAL tokens and try again.');
      }

      // Log the error but don't throw - we'll let the caller handle it
      console.warn('Storage allocation failed:', formattedError.message);
      return undefined;
    }
  }

  async checkExistingStorage(): Promise<any> {
    try {
      if (this.useMockMode) {
        return undefined;
      }

      const address = this.getActiveAddress();
      console.log(`Checking existing storage for address ${address}...`);

      // Query storage objects for this address using Sui client
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
        .filter(item => item.data?.content?.dataType === 'moveObject')
        .map(item => {
          const content = item.data?.content as any;
          return {
            id: { id: item.data?.objectId },
            storage_size: Number(content?.fields?.storage_size || 0),
            used_size: Number(content?.fields?.used_size || 0),
            end_epoch: Number(content?.fields?.end_epoch || 0)
          };
        });

      if (existingStorage && existingStorage.length > 0) {
        // Get the current epoch
        const { epoch } = await this.suiClient.getLatestSuiSystemState();
        const currentEpoch = Number(epoch);

        // Find storage with sufficient remaining capacity and time
        const suitableStorage = existingStorage.find(storage => {
          const remainingSize = storage.storage_size - storage.used_size;
          const remainingEpochs = storage.end_epoch - currentEpoch;

          return remainingSize >= 1000000 && remainingEpochs >= 10;
        });

        if (suitableStorage) {
          console.log(`Found suitable existing storage: ${suitableStorage.id.id}`);
          return suitableStorage;
        }
      }

      console.log('No suitable existing storage found, will create new storage');
      return null;
    } catch (error) {
      console.warn('Error checking existing storage:', error);
      return null;
    }
  }

  // Helper method to handle Walrus errors consistently
  protected handleWalrusError(error: any, operation: string): Error {
    if (error instanceof Error) {
      if (error.message.includes('insufficient')) {
        return new CLIError(
          `Insufficient WAL tokens for ${operation}. Please acquire WAL tokens and try again.`,
          'WALRUS_INSUFFICIENT_TOKENS'
        );
      } else if (error.message.includes('Storage object not found')) {
        return new CLIError(
          `Storage allocation failed. The transaction was submitted but the storage object was not found in the effects. This may be due to network issues or insufficient gas.`,
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

export function createWalrusStorage(
  useMockMode: boolean = false
): WalrusStorage {
  return new WalrusStorage(useMockMode);
}
