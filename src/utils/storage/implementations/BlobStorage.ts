/**
 * @fileoverview Blob Storage - Implementation for general blob storage on Walrus
 *
 * This class provides a concrete implementation of IStorage for general blob storage
 * on the Walrus platform. It extends AbstractStorage and implements all required methods
 * for storing, retrieving, and managing binary blob data on the blockchain.
 */

import { AbstractStorage } from '../core/AbstractStorage';
import { 
  StorageInfo, 
  StorageUsage, 
  StorageOptimizationResult, 
  StorageConfig,
  StorageOperationOptions,
  ContentMetadata
} from '../core/StorageTypes';
import { StorageClient } from '../core/StorageClient';
import { StorageTransaction } from '../core/StorageTransaction';
import { StorageOperationHandler } from '../utils/StorageOperationHandler';
import { StorageError, NetworkError, BlockchainError } from '../../../types/errors';
import { ValidationError } from '../../../types/errors/ValidationError';
import { TransactionSigner } from '../../../types/signer';
import { StorageReuseAnalyzer } from '../utils/StorageReuseAnalyzer';

/**
 * Default configuration for blob storage
 */
const DEFAULT_BLOB_STORAGE_CONFIG: StorageConfig = {
  minWalBalance: BigInt(100),
  storageBuffer: BigInt(10240),
  defaultEpochDuration: 52,
  minEpochBuffer: 10,
  enableOptimization: true,
  useMockMode: false,
  maxRetries: 3,
  retryBaseDelay: 1000,
  maxContentSize: 10 * 1024 * 1024, // 10MB
  networkUrl: 'https://fullnode.testnet.sui.io:443',
  networkEnvironment: 'testnet'
};

/**
 * Implementation of IStorage for general blob storage on Walrus.
 */
export class BlobStorage extends AbstractStorage {
  /** Client for interacting with the blockchain */
  private client: StorageClient;
  
  /** Transaction manager for blockchain operations */
  private transaction: StorageTransaction | null = null;
  
  /** Storage reuse analyzer for optimization */
  private storageReuseAnalyzer: StorageReuseAnalyzer | null = null;
  
  /** User's wallet address */
  private address: string;
  
  /** Signer for transactions */
  private signer: TransactionSigner | null = null;
  
  /**
   * Creates a new BlobStorage instance.
   * 
   * @param address - User's wallet address
   * @param configOverrides - Optional configuration overrides
   */
  constructor(address: string, configOverrides: Partial<StorageConfig> = {}) {
    // Merge default config with overrides
    super({
      ...DEFAULT_BLOB_STORAGE_CONFIG,
      ...configOverrides
    });
    
    this.address = address;
    
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
    }
  }
  
  /**
   * Initializes the storage connection.
   * 
   * @returns Promise that resolves when the connection is established
   * @throws {NetworkError} if initialization fails
   */
  public async connect(): Promise<void> {
    if (this.connectionState === 'connected') {
      return;
    }
    
    this.connectionState = 'connecting';
    
    try {
      // Create a fresh abort controller
      this.abortController = this.createFreshAbortController();
      
      // Initialize client
      await this.client.init();
      
      // Initialize transaction manager if signer is available
      if (this.signer) {
        this.transaction = new StorageTransaction(
          this.client.getSuiClient(),
          this.signer
        );
      }
      
      // Initialize storage reuse analyzer
      this.storageReuseAnalyzer = new StorageReuseAnalyzer(
        this.client.getSuiClient(),
        this.client.getWalrusClient(),
        this.address
      );
      
      // Update connection state and timestamp
      this.connectionState = 'connected';
      this.lastHealthCheck = Date.now();
    } catch (error) {
      this.connectionState = 'failed';
      
      if (error instanceof NetworkError) {
        throw error;
      }
      
      throw new NetworkError(
        `Failed to connect to storage: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'connect',
          recoverable: true,
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }
  
  /**
   * Checks the health of the connection.
   * 
   * @returns Promise resolving to boolean indicating if connection is healthy
   */
  protected async checkConnectionHealth(): Promise<boolean> {
    try {
      // Perform a lightweight operation to check health
      const suiClient = this.client.getSuiClient();
      const systemState = await suiClient.getLatestSuiSystemState();
      
      // If we got a valid response, connection is healthy
      const isHealthy = !!systemState?.epoch;
      
      // Update health check timestamp on success
      if (isHealthy) {
        this.lastHealthCheck = Date.now();
      }
      
      return isHealthy;
    } catch (error) {
      console.warn('Health check failed:', error);
      return false;
    }
  }
  
  /**
   * Stores content in the storage system.
   * 
   * @param content - The binary content to store
   * @param metadata - Additional metadata to associate with the content
   * @returns Promise resolving to the unique identifier for the stored content
   * @throws {ValidationError} if validation fails
   * @throws {StorageError} if storage operation fails
   */
  public async store(
    content: Uint8Array,
    metadata: Record<string, string>
  ): Promise<string> {
    try {
      // Validate connection
      this.validateConnection('store blob');
      
      // Validate signer
      this.validateSigner('store blob');
      
      // Validate content size
      if (content.length > this.config.maxContentSize) {
        throw new ValidationError(`Content size exceeds maximum allowed (${this.config.maxContentSize} bytes)`, {
          operation: 'validate content',
          field: 'content.length',
          value: content.length.toString()
        });
      }
      
      // Ensure metadata has required fields
      const fullMetadata = this.ensureRequiredMetadata(content, metadata);
      
      // Ensure sufficient storage is allocated
      await this.ensureStorageAllocated(content.length);
      
      // Upload content
      const result = await StorageOperationHandler.execute(
        async () => {
          const walrusClient = this.client.getWalrusClient();
          
          return walrusClient.writeBlob({
            blob: content,
            deletable: false,
            epochs: this.config.defaultEpochDuration,
            signer: this.signer!,
            attributes: fullMetadata
          });
        },
        {
          operation: 'upload blob',
          maxRetries: this.config.maxRetries,
          baseDelay: this.config.retryBaseDelay,
          signal: this.abortController.signal
        }
      );
      
      if (!result.success || !result.data) {
        throw new StorageError(`Failed to upload content: ${result.error?.message}`, {
          operation: 'upload blob',
          recoverable: false,
          cause: result.error
        });
      }
      
      // Extract blob ID from the result
      const blobId = this.extractBlobId(result.data);
      
      if (!blobId) {
        throw new ValidationError('Failed to extract valid blob ID from response', {
          operation: 'extract blob ID'
        });
      }
      
      // Verify the upload if configured to do so
      if (fullMetadata.checksum) {
        const isVerified = await this.verify(blobId, fullMetadata.checksum);
        if (!isVerified) {
          console.warn(`Uploaded content verification failed for blob ${blobId}`);
        }
      }
      
      return blobId;
    } catch (error) {
      // Categorize and rethrow with appropriate type
      if (error instanceof ValidationError || 
          error instanceof StorageError || 
          error instanceof NetworkError ||
          error instanceof BlockchainError) {
        throw error;
      }
      
      throw new StorageError(
        `Failed to store content: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'store content',
          recoverable: false,
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }
  
  /**
   * Retrieves content from the storage system.
   * 
   * @param id - The unique identifier for the content
   * @returns Promise resolving to object containing the content and its metadata
   * @throws {ValidationError} if validation fails
   * @throws {StorageError} if retrieval operation fails
   */
  public async retrieve(
    id: string
  ): Promise<{ content: Uint8Array; metadata: Record<string, string> }> {
    try {
      // Validate connection
      this.validateConnection('retrieve blob');
      
      // Validate blob ID
      if (!id?.trim()) {
        throw new ValidationError('Blob ID is required', {
          operation: 'retrieve blob',
          field: 'id'
        });
      }
      
      // Check cache first
      const cached = this.getCachedContent(id);
      if (cached) {
        console.log('Retrieved content from cache');
        return cached;
      }
      
      // Create a fresh abort controller for this operation
      const retrievalAbortController = new AbortController();
      
      try {
        // Retrieve content
        const contentResult = await StorageOperationHandler.execute(
          () => this.client.retrieveBlob(id, {
            maxRetries: this.config.maxRetries,
            timeout: 15000,
            signal: retrievalAbortController.signal
          }),
          {
            operation: 'retrieve blob content',
            signal: retrievalAbortController.signal
          }
        );
        
        if (!contentResult.success) {
          throw new StorageError(`Failed to retrieve blob content: ${contentResult.error?.message}`, {
            operation: 'retrieve blob',
            blobId: id,
            recoverable: true,
            cause: contentResult.error
          });
        }
        
        // Retrieve metadata
        const metadataResult = await StorageOperationHandler.execute(
          async () => {
            const walrusClient = this.client.getWalrusClient();
            return walrusClient.getBlobMetadata({ blobId: id });
          },
          {
            operation: 'retrieve blob metadata',
            maxRetries: this.config.maxRetries,
            signal: retrievalAbortController.signal
          }
        );
        
        if (!metadataResult.success) {
          throw new StorageError(`Failed to retrieve blob metadata: ${metadataResult.error?.message}`, {
            operation: 'retrieve metadata',
            blobId: id,
            recoverable: true,
            cause: metadataResult.error
          });
        }
        
        // Extract attributes from metadata
        const attributes = this.extractMetadataAttributes(metadataResult.data) || {};
        
        // Cache the result
        this.cacheContent(id, contentResult.data, attributes);
        
        return {
          content: contentResult.data,
          metadata: attributes
        };
      } catch (error) {
        // Cancel the retrieval if something goes wrong
        retrievalAbortController.abort();
        throw error;
      }
    } catch (error) {
      // Categorize and rethrow with appropriate type
      if (error instanceof ValidationError || 
          error instanceof StorageError || 
          error instanceof NetworkError) {
        throw error;
      }
      
      throw new StorageError(
        `Failed to retrieve content: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'retrieve content',
          blobId: id,
          recoverable: true,
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }
  
  /**
   * Updates existing content in the storage system.
   * Since Walrus blobs are immutable, this creates a new blob.
   * 
   * @param id - The unique identifier for the content to update
   * @param content - The new content
   * @param metadata - Updated metadata
   * @returns Promise resolving to the new identifier for the updated content
   * @throws {ValidationError} if validation fails
   * @throws {StorageError} if update operation fails
   */
  public async update(
    id: string,
    content: Uint8Array,
    metadata: Record<string, string>
  ): Promise<string> {
    try {
      // For Walrus, updates create new blobs since they're immutable
      console.log(`Updating blob ${id}. Note: Walrus blobs are immutable, so a new blob will be created.`);
      
      // Add reference to original blob in metadata
      const updatedMetadata = {
        ...metadata,
        originalBlobId: id,
        updateTimestamp: new Date().toISOString()
      };
      
      // Store as new blob
      return this.store(content, updatedMetadata);
    } catch (error) {
      // Categorize and rethrow with appropriate type
      if (error instanceof ValidationError || 
          error instanceof StorageError || 
          error instanceof NetworkError ||
          error instanceof BlockchainError) {
        throw error;
      }
      
      throw new StorageError(
        `Failed to update content: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'update content',
          blobId: id,
          recoverable: false,
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }
  
  /**
   * Ensures sufficient storage space is allocated.
   * 
   * @param sizeBytes - Required storage size in bytes
   * @returns Promise resolving to information about the allocated storage
   * @throws {ValidationError} if validation fails
   * @throws {StorageError} if allocation fails
   * @throws {BlockchainError} if blockchain operation fails
   */
  public async ensureStorageAllocated(sizeBytes: number): Promise<StorageInfo> {
    try {
      // Validate connection and signer
      this.validateConnection('allocate storage');
      this.validateSigner('allocate storage');
      
      // Check storage optimization is enabled
      if (this.config.enableOptimization && this.storageReuseAnalyzer) {
        // Try to optimize by reusing existing storage
        const analysis = await this.optimizeStorage();
        
        if (analysis.success && analysis.recommendedStorage) {
          // Found viable storage to reuse
          return this.convertToStorageInfo(analysis.recommendedStorage);
        }
      }
      
      // Get current epoch for validation
      const epochResult = await StorageOperationHandler.execute(
        () => this.client.getSuiClient().getLatestSuiSystemState(),
        { operation: 'get epoch' }
      );
      
      if (!epochResult.success) {
        throw new NetworkError('Failed to get current epoch for storage validation', {
          operation: 'get epoch',
          recoverable: true,
          cause: epochResult.error
        });
      }
      
      const currentEpoch = Number(epochResult.data?.epoch || 0);
      
      // Check WAL balance
      const walBalance = await this.client.getWalBalance();
      
      if (walBalance < this.config.minWalBalance) {
        throw new BlockchainError(`Insufficient WAL tokens. Minimum ${this.config.minWalBalance} WAL required, but only ${walBalance} WAL available.`, {
          operation: 'check balance',
          recoverable: false
        });
      }
      
      // Calculate storage cost
      const costResult = await StorageOperationHandler.execute(
        async () => {
          const walrusClient = this.client.getWalrusClient();
          return walrusClient.storageCost(
            Number(BigInt(sizeBytes) + this.config.storageBuffer),
            this.config.defaultEpochDuration
          );
        },
        { operation: 'calculate storage cost' }
      );
      
      if (!costResult.success) {
        throw new StorageError('Failed to calculate storage cost', {
          operation: 'calculate cost',
          recoverable: true,
          cause: costResult.error
        });
      }
      
      // Calculate required balance with 10% buffer
      const requiredBalance = (BigInt(costResult.data.totalCost) * BigInt(110)) / BigInt(100);
      
      if (walBalance < requiredBalance) {
        throw new BlockchainError(`Insufficient WAL tokens for storage allocation. Required: ${requiredBalance}, Available: ${walBalance}`, {
          operation: 'check balance for allocation',
          recoverable: false
        });
      }
      
      // Create storage transaction
      if (!this.transaction) {
        throw new ValidationError('Transaction manager not initialized', {
          operation: 'create storage transaction'
        });
      }
      
      // Create and execute storage allocation transaction
      const tx = await this.transaction.createStorageAllocationTransaction(
        Number(BigInt(sizeBytes) + this.config.storageBuffer),
        this.config.defaultEpochDuration
      );
      
      const txResult = await this.transaction.executeTransaction(
        tx,
        'create-storage',
        {
          maxRetries: this.config.maxRetries,
          baseDelay: this.config.retryBaseDelay,
          signal: this.abortController.signal
        }
      );
      
      if (!txResult.success) {
        throw new BlockchainError(`Failed to create storage: ${txResult.error}`, {
          operation: 'storage allocation transaction',
          recoverable: false
        });
      }
      
      // Get created storage object ID
      if (!txResult.createdObjects || txResult.createdObjects.length === 0) {
        throw new StorageError('No storage object was created', {
          operation: 'storage allocation',
          recoverable: false
        });
      }
      
      const storageId = txResult.createdObjects[0];
      
      // Verify the created storage
      const objectResult = await StorageOperationHandler.execute(
        () => this.client.getSuiClient().getObject({
          id: storageId,
          options: {
            showContent: true
          }
        }),
        { operation: 'get storage object' }
      );
      
      if (!objectResult.success || !objectResult.data?.data?.content) {
        throw new StorageError('Failed to verify created storage', {
          operation: 'verify storage',
          recoverable: false,
          cause: objectResult.error
        });
      }
      
      // Extract storage details
      const content = objectResult.data.data.content as any;
      const fields = content?.fields;
      
      if (!fields) {
        throw new StorageError('Invalid storage object format', {
          operation: 'verify storage',
          recoverable: false
        });
      }
      
      return {
        id: storageId,
        totalSize: Number(fields.storage_size || 0),
        usedSize: Number(fields.used_size || 0),
        endEpoch: Number(fields.end_epoch || 0),
        startEpoch: currentEpoch,
        remainingBytes: Number(fields.storage_size || 0) - Number(fields.used_size || 0),
        isActive: Number(fields.end_epoch || 0) > currentEpoch
      };
    } catch (error) {
      // Categorize and rethrow with appropriate type
      if (error instanceof ValidationError || 
          error instanceof StorageError || 
          error instanceof NetworkError ||
          error instanceof BlockchainError) {
        throw error;
      }
      
      throw new StorageError(
        `Failed to allocate storage: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'allocate storage',
          recoverable: false,
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }
  
  /**
   * Gets current storage usage statistics.
   * 
   * @returns Promise resolving to storage usage information
   * @throws {ValidationError} if validation fails
   * @throws {StorageError} if retrieval fails
   */
  public async getStorageUsage(): Promise<StorageUsage> {
    try {
      // Validate connection
      this.validateConnection('get storage usage');
      
      // Get current epoch for validation
      const epochResult = await StorageOperationHandler.execute(
        () => this.client.getSuiClient().getLatestSuiSystemState(),
        { operation: 'get epoch' }
      );
      
      if (!epochResult.success) {
        throw new NetworkError('Failed to get current epoch for storage validation', {
          operation: 'get epoch',
          recoverable: true,
          cause: epochResult.error
        });
      }
      
      const currentEpoch = Number(epochResult.data?.epoch || 0);
      
      // Get owned storage objects
      const objectsResult = await StorageOperationHandler.execute(
        () => this.client.getSuiClient().getOwnedObjects({
          owner: this.address,
          filter: { StructType: '0x2::storage::Storage' },
          options: { showContent: true }
        }),
        { operation: 'get storage objects' }
      );
      
      if (!objectsResult.success) {
        throw new StorageError('Failed to get storage objects', {
          operation: 'get objects',
          recoverable: true,
          cause: objectsResult.error
        });
      }
      
      // Process storage objects
      const storageObjects: StorageInfo[] = [];
      let totalAllocated = 0;
      let totalUsed = 0;
      let activeCount = 0;
      let inactiveCount = 0;
      
      for (const item of objectsResult.data.data) {
        const content = item.data?.content as any;
        if (!content || content.dataType !== 'moveObject' || !content.fields) {
          continue;
        }
        
        const fields = content.fields;
        const totalSize = Number(fields.storage_size || 0);
        const usedSize = Number(fields.used_size || 0);
        const endEpoch = Number(fields.end_epoch || 0);
        const isActive = endEpoch > currentEpoch;
        
        totalAllocated += totalSize;
        totalUsed += usedSize;
        
        if (isActive) {
          activeCount++;
        } else {
          inactiveCount++;
        }
        
        storageObjects.push({
          id: item.data.objectId,
          totalSize,
          usedSize,
          endEpoch,
          startEpoch: Number(fields.start_epoch || 0),
          remainingBytes: totalSize - usedSize,
          isActive
        });
      }
      
      // Calculate usage percentage
      const usagePercentage = totalAllocated > 0 ? (totalUsed / totalAllocated) * 100 : 0;
      
      return {
        totalAllocated,
        totalUsed,
        totalAvailable: totalAllocated - totalUsed,
        activeStorageCount: activeCount,
        inactiveStorageCount: inactiveCount,
        usagePercentage,
        storageObjects
      };
    } catch (error) {
      // Categorize and rethrow with appropriate type
      if (error instanceof ValidationError || 
          error instanceof StorageError || 
          error instanceof NetworkError) {
        throw error;
      }
      
      throw new StorageError(
        `Failed to get storage usage: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'get storage usage',
          recoverable: true,
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }
  
  /**
   * Optimizes storage usage by analyzing and potentially reusing storage.
   * 
   * @returns Promise resolving to the optimization results
   * @throws {ValidationError} if validation fails
   * @throws {StorageError} if optimization fails
   */
  public async optimizeStorage(): Promise<StorageOptimizationResult> {
    try {
      // Validate connection
      this.validateConnection('optimize storage');
      
      // Check if optimizer is available
      if (!this.storageReuseAnalyzer) {
        return {
          success: false,
          recommendedStorage: null,
          recommendation: 'allocate-new',
          potentialSavings: BigInt(0),
          savingsPercentage: 0,
          recommendationDetails: 'Storage optimization not available'
        };
      }
      
      // Analyze with a small required size to get general inventory
      const analysis = await this.storageReuseAnalyzer.analyzeStorageEfficiency(1024);
      
      return {
        success: analysis.analysisResult.hasViableStorage,
        recommendedStorage: analysis.analysisResult.bestMatch ? this.convertToStorageInfo(analysis.analysisResult.bestMatch) : null,
        recommendation: analysis.analysisResult.recommendation,
        potentialSavings: analysis.costComparison.reuseExistingSavings,
        savingsPercentage: analysis.costComparison.reuseExistingPercentSaved,
        recommendationDetails: analysis.detailedRecommendation
      };
    } catch (error) {
      // Categorize and log but don't throw - optimization is optional
      console.warn('Storage optimization failed:', error);
      
      return {
        success: false,
        recommendedStorage: null,
        recommendation: 'allocate-new',
        potentialSavings: BigInt(0),
        savingsPercentage: 0,
        recommendationDetails: `Optimization failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
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
  }
  
  /**
   * Ensures metadata has all required fields.
   * 
   * @param content - The content being stored
   * @param metadata - The provided metadata
   * @returns Complete metadata with all required fields
   */
  private ensureRequiredMetadata(
    content: Uint8Array, 
    metadata: Record<string, string>
  ): Record<string, string> {
    // Calculate checksum if not provided
    const checksum = metadata.checksum || this.calculateChecksum(content);
    
    // Required fields with defaults
    const requiredFields = {
      contentType: 'application/octet-stream',
      contentCategory: 'blob',
      checksumAlgorithm: 'sha256',
      checksum,
      size: content.length.toString(),
      schemaVersion: '1',
      encoding: 'binary',
      createdAt: new Date().toISOString()
    };
    
    // Merge with provided metadata, prioritizing provided values
    return {
      ...requiredFields,
      ...metadata
    };
  }
  
  /**
   * Extracts blob ID from various response formats.
   * 
   * @param response - The response from writeBlob
   * @returns The extracted blob ID or null if not found
   */
  private extractBlobId(response: any): string | null {
    if (!response) {
      return null;
    }
    
    // Try different possible formats
    if (typeof response === 'string') {
      return response;
    }
    
    if (response.blobId) {
      return response.blobId;
    }
    
    if (response.blobObject) {
      const blobObject = response.blobObject;
      
      if (typeof blobObject === 'string') {
        return blobObject;
      }
      
      if (blobObject && typeof blobObject === 'object') {
        if (blobObject.blob_id) {
          return blobObject.blob_id;
        }
        
        if (blobObject.id) {
          if (typeof blobObject.id === 'string') {
            return blobObject.id;
          }
          
          if (typeof blobObject.id === 'object' && blobObject.id !== null) {
            return blobObject.id.id || null;
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Extracts metadata attributes from response.
   * 
   * @param metadata - The metadata response from getBlobMetadata
   * @returns The extracted attributes or empty object if not found
   */
  private extractMetadataAttributes(metadata: any): Record<string, string> {
    if (!metadata) {
      return {};
    }
    
    // Try different possible formats
    if (metadata.attributes) {
      return metadata.attributes;
    }
    
    if (metadata.V1 && metadata.V1.attributes) {
      return metadata.V1.attributes;
    }
    
    if (metadata.metadata && metadata.metadata.V1 && metadata.metadata.V1.attributes) {
      return metadata.metadata.V1.attributes;
    }
    
    return {};
  }
  
  /**
   * Converts a storage object to a StorageInfo interface.
   * 
   * @param storage - The storage object
   * @returns The converted StorageInfo
   */
  private convertToStorageInfo(storage: any): StorageInfo {
    return {
      id: storage.id,
      totalSize: storage.totalSize,
      usedSize: storage.usedSize,
      endEpoch: storage.endEpoch,
      startEpoch: storage.startEpoch,
      remainingBytes: storage.remaining || storage.remainingBytes || (storage.totalSize - storage.usedSize),
      isActive: storage.active || storage.isActive || (storage.endEpoch > Date.now() / 1000)
    };
  }
}