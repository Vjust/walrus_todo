/**
 * @fileoverview NFT Storage - Implementation for NFT creation and management
 *
 * This class provides functionality for creating and managing NFTs on the Sui blockchain,
 * integrated with blob storage for the NFT content. It extends AbstractStorage
 * to provide a consistent interface while adding NFT-specific capabilities.
 */

import { AbstractStorage } from '../core/AbstractStorage';
import { 
  StorageInfo, 
  StorageUsage, 
  StorageOptimizationResult, 
  StorageConfig
} from '../core/StorageTypes';
import { StorageClient } from '../core/StorageClient';
import { StorageTransaction } from '../core/StorageTransaction';
import { StorageOperationHandler } from '../utils/StorageOperationHandler';
import { StorageError, BlockchainError, TransactionError } from '@errors';
import { ValidationError } from '@errors/ValidationError';
import { TransactionSigner } from '@types/signer';
import { Todo } from '@types/todo';
import { BlobStorage } from './BlobStorage';
import { TransactionBlock } from '@mysten/sui/transactions';

/**
 * Configuration for NFT storage
 */
export interface NFTStorageConfig extends StorageConfig {
  /** Package ID for the NFT module */
  packageId: string;
  /** Collection ID for NFTs */
  collectionId?: string;
}

/**
 * Default configuration for NFT storage
 */
const DEFAULT_NFT_STORAGE_CONFIG: Partial<NFTStorageConfig> = {
  packageId: '',
  collectionId: ''
};

/**
 * Basic NFT metadata
 */
export interface NFTMetadata {
  /** Title of the NFT */
  title: string;
  /** Description of the NFT */
  description: string;
  /** URL to the NFT content (e.g., image) */
  url?: string;
  /** Link to external metadata */
  externalUrl?: string;
  /** ID of the blob containing the NFT content */
  blobId?: string;
  /** Properties of the NFT */
  properties?: Record<string, string>;
}

/**
 * NFT information returned after creation or retrieval
 */
export interface NFTInfo {
  /** Object ID of the NFT */
  objectId: string;
  /** Title of the NFT */
  title: string;
  /** Description of the NFT */
  description: string;
  /** Whether the NFT is completed (for Todo NFTs) */
  completed: boolean;
  /** ID of the blob containing the NFT content */
  walrusBlobId: string;
  /** Raw blockchain object data */
  rawData?: any;
}

/**
 * Implementation for NFT creation and management on Sui blockchain.
 */
export class NFTStorage extends AbstractStorage {
  /** Client for interacting with the blockchain */
  private client: StorageClient;
  
  /** Transaction manager for blockchain operations */
  private transaction: StorageTransaction | null = null;
  
  /** Blob storage for content */
  private blobStorage: BlobStorage | null = null;
  
  /** User's wallet address */
  private address: string;
  
  /** Signer for transactions */
  private signer: TransactionSigner | null = null;
  
  /** Package ID for the NFT module */
  private packageId: string;
  
  /** Collection ID for NFTs */
  private collectionId: string | null = null;
  
  /** Maximum number of retries for blockchain operations */
  private readonly retryAttempts = 3;
  
  /** Base delay between retries in milliseconds */
  private readonly retryDelay = 1000;
  
  /**
   * Creates a new NFTStorage instance.
   * 
   * @param address - User's wallet address
   * @param packageId - Package ID for the NFT module
   * @param configOverrides - Optional configuration overrides
   */
  constructor(
    address: string,
    packageId: string,
    configOverrides: Partial<NFTStorageConfig> = {}
  ) {
    // Merge defaults with overrides
    super({
      ...DEFAULT_NFT_STORAGE_CONFIG,
      ...configOverrides,
      packageId
    } as NFTStorageConfig);
    
    this.address = address;
    this.packageId = packageId;
    this.collectionId = configOverrides.collectionId || null;
    
    // Initialize client
    this.client = new StorageClient({
      suiUrl: this.config.networkUrl,
      network: this.config.networkEnvironment,
      useMockMode: this.config.useMockMode,
      address: address,
      validateEnvironment: true
    });
  }
  
  /**
   * Sets the transaction signer.
   * 
   * @param signer - The signer for transactions
   */
  public setSigner(signer: TransactionSigner): void {
    this.signer = signer;
    
    // Initialize transaction manager if client is ready
    if (this.connectionState === 'connected' && this.signer) {
      this.transaction = new StorageTransaction(
        this.client.getSuiClient(),
        this.signer
      );
      
      // Initialize blob storage if needed
      if (!this.blobStorage) {
        this.blobStorage = new BlobStorage(this.address);
        this.blobStorage.setSigner(this.signer);
      }
    }
  }
  
  /**
   * Sets the collection ID for NFTs.
   * 
   * @param collectionId - The collection ID
   */
  public setCollectionId(collectionId: string): void {
    this.collectionId = collectionId;
  }
  
  /**
   * Initializes the storage connection.
   * 
   * @returns Promise that resolves when the connection is established
   * @throws {BlockchainError} if initialization fails
   */
  public async connect(): Promise<void> {
    if (this.connectionState === 'connected') {
      return;
    }
    
    this.connectionState = 'connecting';
    
    try {
      // Create a fresh abort controller
      this.abortController = new AbortController();
      
      // Initialize client
      await this.client.init();
      
      // Initialize transaction manager if signer is available
      if (this.signer) {
        this.transaction = new StorageTransaction(
          this.client.getSuiClient(),
          this.signer
        );
        
        // Initialize blob storage
        this.blobStorage = new BlobStorage(this.address);
        this.blobStorage.setSigner(this.signer);
        await this.blobStorage.connect();
      }
      
      // Verify package ID exists
      if (!this.packageId) {
        throw new ValidationError('Package ID is required for NFT operations', {
          operation: 'connect NFT storage',
          field: 'packageId'
        });
      }
      
      // Update connection state and timestamp
      this.connectionState = 'connected';
      this.lastHealthCheck = Date.now();
    } catch (error) {
      this.connectionState = 'failed';
      
      if (error instanceof ValidationError || error instanceof BlockchainError) {
        throw error;
      }
      
      throw new BlockchainError(
        `Failed to connect to NFT storage: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'connect NFT storage',
          recoverable: true,
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }
  
  /**
   * Disconnects from the storage.
   * 
   * @returns Promise that resolves when disconnection is complete
   */
  public async disconnect(): Promise<void> {
    if (this.connectionState !== 'disconnected') {
      // Disconnect blob storage if connected
      if (this.blobStorage) {
        await this.blobStorage.disconnect();
      }
      
      // Run parent disconnect
      await super.disconnect();
    }
  }
  
  /**
   * Checks the health of the connection.
   * 
   * @returns Promise resolving to boolean indicating if connection is healthy
   */
  protected async checkConnectionHealth(): Promise<boolean> {
    try {
      // Check blockchain health
      const suiClient = this.client.getSuiClient();
      const systemState = await suiClient.getLatestSuiSystemState();
      
      // Check blob storage health if available
      let blobHealthy = true;
      if (this.blobStorage) {
        blobHealthy = await this.blobStorage.isConnected();
      }
      
      // Both must be healthy for overall health
      const isHealthy = !!systemState?.epoch && blobHealthy;
      
      // Update health check timestamp on success
      if (isHealthy) {
        this.lastHealthCheck = Date.now();
      }
      
      return isHealthy;
    } catch (error) {
      console.warn('NFT storage health check failed:', error);
      return false;
    }
  }
  
  /**
   * Creates an NFT for a Todo item.
   * 
   * @param todo - The Todo to create an NFT for
   * @param blobId - The blob ID containing the Todo data
   * @returns Promise resolving to the created NFT information
   * @throws {ValidationError} if validation fails
   * @throws {BlockchainError} if blockchain operation fails
   */
  public async createTodoNFT(todo: Todo, blobId: string): Promise<NFTInfo> {
    try {
      // Validate connection and signer
      this.validateConnection('create todo NFT');
      this.validateSigner('create todo NFT');
      
      // Validate inputs
      if (!todo.title) {
        throw new ValidationError('Todo title is required', {
          operation: 'create todo NFT',
          field: 'title'
        });
      }
      
      if (!blobId) {
        throw new ValidationError('A valid Walrus blob ID must be provided', {
          operation: 'create todo NFT',
          field: 'blobId'
        });
      }
      
      // Validate collection ID
      if (!this.collectionId) {
        throw new ValidationError('Collection ID is required for NFT creation', {
          operation: 'create todo NFT',
          field: 'collectionId'
        });
      }
      
      // Create transaction
      const tx = await this.createTodoNFTTransaction(
        todo.title,
        todo.description || '',
        blobId,
        todo.completed || false
      );
      
      // Execute transaction
      const txResult = await this.transaction.executeTransaction(
        tx,
        'create-todo-nft',
        {
          maxRetries: this.config.maxRetries,
          baseDelay: this.config.retryBaseDelay,
          signal: this.abortController.signal
        }
      );
      
      if (!txResult.success) {
        throw new TransactionError(`Failed to create NFT: ${txResult.error}`, {
          operation: 'create todo NFT',
          recoverable: false
        });
      }
      
      // Get created NFT object ID
      if (!txResult.createdObjects || txResult.createdObjects.length === 0) {
        throw new BlockchainError('No NFT was created', {
          operation: 'create todo NFT',
          recoverable: false
        });
      }
      
      const nftId = txResult.createdObjects[0];
      
      // Retrieve the created NFT to get its details
      const nftInfo = await this.getTodoNFT(nftId);
      
      return nftInfo;
    } catch (error) {
      if (error instanceof ValidationError ||
          error instanceof BlockchainError ||
          error instanceof TransactionError) {
        throw error;
      }
      
      throw new BlockchainError(
        `Failed to create Todo NFT: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'create todo NFT',
          recoverable: false,
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }
  
  /**
   * Creates a transaction for Todo NFT creation.
   * 
   * @param title - Title of the NFT
   * @param description - Description of the NFT
   * @param blobId - The blob ID containing the content
   * @param completed - Whether the Todo is completed
   * @returns Promise resolving to the transaction
   * @throws {BlockchainError} if transaction creation fails
   */
  private async createTodoNFTTransaction(
    title: string,
    description: string,
    blobId: string,
    completed: boolean
  ): Promise<any> {
    // Validate transaction manager
    if (!this.transaction) {
      throw new ValidationError('Transaction manager not initialized', {
        operation: 'create NFT transaction'
      });
    }
    
    try {
      const tx = {}; // Create transaction block
      
      // Must use 'as any' since we're dealing with a generic transaction wrapper
      (tx as any).moveCall({
        target: `${this.packageId}::todo_nft::create_todo_nft`,
        arguments: [
          (tx as any).pure(title),
          (tx as any).pure(description),
          (tx as any).pure(blobId),
          (tx as any).pure(completed),
          (tx as any).object(this.collectionId),
        ],
      });
      
      return tx;
    } catch (error) {
      throw new BlockchainError(
        `Failed to create NFT transaction: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'create NFT transaction',
          recoverable: false,
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }
  
  /**
   * Gets information about a Todo NFT.
   * 
   * @param nftId - The NFT object ID
   * @returns Promise resolving to the NFT information
   * @throws {ValidationError} if validation fails
   * @throws {BlockchainError} if retrieval fails
   */
  public async getTodoNFT(nftId: string): Promise<NFTInfo> {
    try {
      // Validate connection
      this.validateConnection('get todo NFT');
      
      // Validate NFT ID
      if (!nftId?.trim()) {
        throw new ValidationError('NFT object ID is required', {
          operation: 'get todo NFT',
          field: 'nftId'
        });
      }
      
      // Normalize object ID (in case it's a transaction digest)
      const objectId = await this.normalizeObjectId(nftId);
      
      // Retrieve the NFT
      const result = await StorageOperationHandler.execute(
        async () => {
          const response = await this.client.getSuiClient().getObject({
            id: objectId,
            options: {
              showDisplay: true,
              showContent: true,
              showType: true
            }
          });
          
          if (!response.data) {
            throw new BlockchainError(`Todo NFT not found: ${objectId}`, {
              operation: 'get NFT object',
              recoverable: false
            });
          }
          
          return response;
        },
        {
          operation: 'get todo NFT',
          maxRetries: this.config.maxRetries
        }
      );
      
      if (!result.success || !result.data?.data) {
        throw new BlockchainError(`Failed to retrieve NFT: ${result.error?.message}`, {
          operation: 'get todo NFT',
          recoverable: true,
          cause: result.error
        });
      }
      
      // Extract NFT details from the response
      const content = (result.data.data.content as any);
      if (!content || !content.fields) {
        throw new BlockchainError('Invalid NFT data format', {
          operation: 'get todo NFT',
          recoverable: false
        });
      }
      
      // Extract fields from the NFT
      const fields = content.fields;
      
      return {
        objectId,
        title: fields.title || '',
        description: fields.description || '',
        completed: fields.completed || false,
        walrusBlobId: fields.walrus_blob_id || '',
        rawData: result.data
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof BlockchainError) {
        throw error;
      }
      
      throw new BlockchainError(
        `Failed to get Todo NFT: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'get todo NFT',
          recoverable: true,
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }
  
  /**
   * Updates the completion status of a Todo NFT.
   * 
   * @param nftId - The NFT object ID
   * @param completed - The new completion status
   * @returns Promise resolving to the transaction digest
   * @throws {ValidationError} if validation fails
   * @throws {BlockchainError} if update fails
   */
  public async updateTodoNFTCompletionStatus(
    nftId: string,
    completed: boolean
  ): Promise<string> {
    try {
      // Validate connection and signer
      this.validateConnection('update todo NFT');
      this.validateSigner('update todo NFT');
      
      // Validate NFT ID
      if (!nftId?.trim()) {
        throw new ValidationError('NFT object ID is required', {
          operation: 'update todo NFT',
          field: 'nftId'
        });
      }
      
      // Create update transaction
      const tx = new TransactionBlock();
      
      // Use proper transaction methods
      tx.moveCall({
        target: `${this.packageId}::todo_nft::update_completion_status`,
        arguments: [
          tx.object(nftId),
          tx.pure(completed)
        ]
      });
      
      // Execute transaction
      const txResult = await this.transaction.executeTransaction(
        tx,
        'update-todo-nft',
        {
          maxRetries: this.config.maxRetries,
          baseDelay: this.config.retryBaseDelay,
          signal: this.abortController.signal
        }
      );
      
      if (!txResult.success) {
        throw new TransactionError(`Failed to update NFT: ${txResult.error}`, {
          operation: 'update todo NFT',
          recoverable: false
        });
      }
      
      return txResult.digest;
    } catch (error) {
      if (error instanceof ValidationError ||
          error instanceof BlockchainError ||
          error instanceof TransactionError) {
        throw error;
      }
      
      throw new BlockchainError(
        `Failed to update Todo NFT: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'update todo NFT',
          recoverable: false,
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }
  
  /**
   * Stores content in the storage system.
   * This implementation uses the blob storage to store the content.
   * 
   * @param content - The binary content to store
   * @param metadata - Additional metadata to associate with the content
   * @returns Promise resolving to the unique identifier for the stored content
   * @throws {StorageError} if blob storage is not available
   */
  public async store(
    content: Uint8Array,
    metadata: Record<string, string>
  ): Promise<string> {
    // Validate blob storage is available
    if (!this.blobStorage) {
      throw new StorageError('Blob storage not initialized', {
        operation: 'store content',
        recoverable: false
      });
    }
    
    // Delegate to blob storage
    return this.blobStorage.store(content, metadata);
  }
  
  /**
   * Retrieves content from the storage system.
   * This implementation uses the blob storage to retrieve the content.
   * 
   * @param id - The unique identifier for the content
   * @returns Promise resolving to object containing the content and its metadata
   * @throws {StorageError} if blob storage is not available
   */
  public async retrieve(
    id: string
  ): Promise<{ content: Uint8Array; metadata: Record<string, string> }> {
    // Validate blob storage is available
    if (!this.blobStorage) {
      throw new StorageError('Blob storage not initialized', {
        operation: 'retrieve content',
        recoverable: false
      });
    }
    
    // Delegate to blob storage
    return this.blobStorage.retrieve(id);
  }
  
  /**
   * Updates existing content in the storage system.
   * This implementation uses the blob storage to update the content.
   * 
   * @param id - The unique identifier for the content to update
   * @param content - The new content
   * @param metadata - Updated metadata
   * @returns Promise resolving to the new identifier for the updated content
   * @throws {StorageError} if blob storage is not available
   */
  public async update(
    id: string,
    content: Uint8Array,
    metadata: Record<string, string>
  ): Promise<string> {
    // Validate blob storage is available
    if (!this.blobStorage) {
      throw new StorageError('Blob storage not initialized', {
        operation: 'update content',
        recoverable: false
      });
    }
    
    // Delegate to blob storage
    return this.blobStorage.update(id, content, metadata);
  }
  
  /**
   * Ensures sufficient storage space is allocated.
   * This implementation delegates to the blob storage.
   * 
   * @param sizeBytes - Required storage size in bytes
   * @returns Promise resolving to information about the allocated storage
   * @throws {StorageError} if blob storage is not available
   */
  public async ensureStorageAllocated(sizeBytes: number): Promise<StorageInfo> {
    // Validate blob storage is available
    if (!this.blobStorage) {
      throw new StorageError('Blob storage not initialized', {
        operation: 'allocate storage',
        recoverable: false
      });
    }
    
    // Delegate to blob storage
    return this.blobStorage.ensureStorageAllocated(sizeBytes);
  }
  
  /**
   * Gets current storage usage statistics.
   * This implementation delegates to the blob storage.
   * 
   * @returns Promise resolving to storage usage information
   * @throws {StorageError} if blob storage is not available
   */
  public async getStorageUsage(): Promise<StorageUsage> {
    // Validate blob storage is available
    if (!this.blobStorage) {
      throw new StorageError('Blob storage not initialized', {
        operation: 'get storage usage',
        recoverable: false
      });
    }
    
    // Delegate to blob storage
    return this.blobStorage.getStorageUsage();
  }
  
  /**
   * Validates that a signer is available for transactions.
   * 
   * @param operation - The operation being performed
   * @throws {ValidationError} if no signer is available
   */
  private validateSigner(operation: string): void {
    if (!this.signer) {
      throw new ValidationError('No signer available. Call setSigner() first.', {
        operation,
        recoverable: false
      });
    }
    
    if (!this.transaction) {
      throw new ValidationError('Transaction manager not initialized', {
        operation,
        recoverable: false
      });
    }
  }
  
  /**
   * Normalizes an object ID or transaction digest.
   * If the ID is a transaction digest, finds the created object ID.
   * 
   * @param idOrDigest - The ID or digest to normalize
   * @returns Promise resolving to the normalized object ID
   */
  private async normalizeObjectId(idOrDigest: string): Promise<string> {
    // If it's not a transaction digest (44 chars), return as is
    if (idOrDigest.length !== 66) {
      return idOrDigest;
    }
    
    try {
      // It might be a transaction digest, try to get created objects
      const txResult = await StorageOperationHandler.execute(
        () => this.client.getSuiClient().getTransactionBlock({
          digest: idOrDigest,
          options: {
            showEffects: true
          }
        }),
        { operation: 'get transaction' }
      );
      
      if (!txResult.success || !txResult.data?.effects?.created?.length) {
        // Not a transaction with created objects, return original
        return idOrDigest;
      }
      
      // Find NFT object in created objects
      const nftObject = txResult.data.effects.created.find(obj => {
        const reference = (obj as any)?.reference;
        return reference && reference.objectId;
      });
      
      if (!nftObject) {
        // No created objects, return original
        return idOrDigest;
      }
      
      // Extract object ID from reference
      const objectId = (nftObject as any)?.reference?.objectId;
      if (!objectId) {
        return idOrDigest;
      }
      
      console.log(`Normalized transaction digest ${idOrDigest} to object ID ${objectId}`);
      return objectId;
    } catch (error) {
      // If anything goes wrong, return the original
      console.warn('Failed to normalize object ID:', error);
      return idOrDigest;
    }
  }
}