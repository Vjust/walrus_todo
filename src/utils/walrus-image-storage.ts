import { SuiClient } from '@mysten/sui.js/client';
import { type Signer } from '@mysten/sui.js/cryptography';

// Define compatible SignatureWithBytes interface for local usage
interface SignatureWithBytes {
  signature: string;
  bytes: string;
}
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { WalrusClient, type ReadBlobOptions } from '@mysten/walrus';
import type { WalrusClientExt, WalrusClientWithExt } from '../types/client';
import * as fs from 'fs';
import * as path from 'path';
import { getAssetPath } from './path-utils';
import { handleError } from './error-handler';
import { execSync } from 'child_process';
import { KeystoreSigner } from './sui-keystore';
import * as crypto from 'crypto';
import { CLIError } from '../types/error';
import sizeOf from 'image-size';
import { MockWalrusClient, createMockWalrusClient } from './MockWalrusClient';
import { NETWORK_URLS, CURRENT_NETWORK } from '../constants';
import { SignerAdapter } from '../types/adapters/SignerAdapter';
import { createSignerAdapter } from './adapters/signer-adapter';
import { WalrusClientAdapter, createWalrusClientAdapter } from './adapters/walrus-client-adapter';
import { TransactionBlockAdapter, createTransactionBlockAdapter } from './adapters/transaction-adapter';

/**
 * A type that extends SuiClient with optional extensions used by other parts of the code
 */
export type ClientWithExtensions<T extends Record<string, any> = Record<string, any>> = SuiClient & Partial<{
  network: string;
  cache: unknown;
  core: unknown;
  $extend: unknown;
  jsonRpc: SuiClient;
}> & T;

/**
 * Execute operation with retries using exponential backoff
 */
const withRetry = async <T>(
  fn: () => Promise<T>, 
  options?: { attempts?: number; baseDelay?: number; maxDelay?: number }
): Promise<T> => {
  const attempts = options?.attempts || 3;
  const baseDelay = options?.baseDelay || 1000;
  const maxDelay = options?.maxDelay || 10000;
  let lastError: Error | null = null;
  
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, i), maxDelay);
      // Add a small amount of jitter to prevent synchronized retries
      const jitter = Math.random() * 200;
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }
  
  throw lastError;
};

/**
 * Metadata about an image for storage and retrieval
 */
interface ImageMetadata {
  width: number;
  height: number;
  mimeType: string;
  size: number;
  checksum: string;
}

/**
 * Options for uploading an image
 */
interface ImageUploadOptions {
  imagePath: string;
  type: 'todo-nft-image' | 'todo-nft-default-image';
  metadata?: {
    title?: string;
    completed?: boolean | string; // Support both boolean and string formats
    [key: string]: any;
  };
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif'];

/**
 * A class for handling image storage on Walrus with the Sui blockchain
 */
export class WalrusImageStorage {
  private walrusClient!: WalrusClientAdapter;
  private isInitialized: boolean = false;
  private signer: SignerAdapter | null = null;
  private useMockMode: boolean;
  private readonly retryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000
  };

  /**
   * Creates a new WalrusImageStorage instance
   * 
   * @param suiClient The SuiClient instance to use for blockchain interactions
   * @param useMockMode Whether to use mock mode instead of real storage (for testing)
   */
  constructor(
    private suiClient: ClientWithExtensions,
    useMockMode: boolean = false
  ) {
    this.useMockMode = useMockMode;
  }

  /**
   * Connects to the Walrus storage service
   * In mock mode, this is a no-op
   */
  async connect(): Promise<void> {
    try {
      if (this.useMockMode) {
        console.log('Using mock mode for Walrus image storage');
        // Use the factory function to create a properly configured MockWalrusClient
        // that implements the WalrusClientAdapter interface
        this.walrusClient = createMockWalrusClient();
        this.isInitialized = true;
        return;
      }

      // Get active environment info from Sui CLI
      const envInfo = execSync('sui client active-env').toString().trim();
      if (!envInfo.includes('testnet')) {
        throw new CLIError('Must be connected to testnet environment. Use "sui client switch --env testnet"', 'INVALID_ENVIRONMENT');
      }

      // Initialize Walrus client with network config
      // Use suiRpcUrl instead of suiClient for compatibility
      const compatibleConfig = {
        network: 'testnet' as const,
        fullnode: NETWORK_URLS[CURRENT_NETWORK],
        fetchOptions: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        },
        // Add the required packageConfig property for newer versions of WalrusClient
        packageConfig: {
          packageId: '', // Will be auto-discovered by WalrusClient
          storage: '', // Will be auto-discovered by WalrusClient
          blob: '' // Will be auto-discovered by WalrusClient
        }
      };
      const walrusClient = new WalrusClient(compatibleConfig);
      this.walrusClient = createWalrusClientAdapter(walrusClient);
      
      // Initialize KeystoreSigner and adapt it to the expected interface
      const keystoreSigner = new KeystoreSigner(this.suiClient);
      
      // Note: We need to use the adapter to ensure type compatibility
      // KeystoreSigner implements a compatible but slightly different Signer interface
      // The adapter bridges these differences ensuring consistent behavior
      // Use type assertion to tell TypeScript that KeystoreSigner is compatible with Signer
      this.signer = createSignerAdapter(keystoreSigner as unknown as Signer);
      this.isInitialized = true;
    } catch (error) {
      if (error instanceof Error) {
        handleError('Failed to initialize Walrus client', error);
        throw new CLIError(`Failed to initialize Walrus client: ${error.message}`, 'WALRUS_INIT_FAILED');
      }
      throw new CLIError('Failed to initialize Walrus client: Unknown error', 'WALRUS_INIT_FAILED');
    }
  }

  /**
   * Disconnects from the Walrus storage service
   * In mock mode, this is a no-op
   */
  async disconnect(): Promise<void> {
    if (this.useMockMode) {
      console.log('Mock mode: No cleanup needed');
      return;
    }

    // Reset client state safely using optional chaining
    if (this.walrusClient?.reset) {
      try {
        this.walrusClient.reset();
      } catch (error) {
        // Log but don't throw since we're cleaning up
        console.error('Error resetting Walrus client:', error);
      }
    }

    // Release any pending promises or connections
    try {
      // Cancel any in-flight requests if supported
      if (typeof this.walrusClient?.abort === 'function') {
        await this.walrusClient.abort();
      }

      // For the Sui client, clean up any listeners or open connections
      if (this.suiClient && typeof this.suiClient.close === 'function') {
        await this.suiClient.close();
      }
    } catch (cleanupError) {
      // Just log errors during cleanup, don't throw
      console.error('Error during connection cleanup:', cleanupError);
    }
    
    // Create a minimal WalrusClientAdapter with a functional getUnderlyingClient method
    // This ensures proper typing for the minimal client
    const minimalClient = {
      getConfig: async (): Promise<{ network: string; version: string; maxSize: number }> => 
        ({ network: 'testnet', version: '1.0.0', maxSize: 0 }),
      readBlob: async (): Promise<Uint8Array> => new Uint8Array(0),
      writeBlob: async (): Promise<{ blobId: string; blobObject: { blob_id: string } }> => 
        ({ blobId: '', blobObject: { blob_id: '' } }),
      getBlobInfo: async (): Promise<any> => ({ blob_id: '' }),
      getBlobObject: async (): Promise<any> => ({ blob_id: '' }),
      getBlobMetadata: async (): Promise<any> => ({ blob_id: '' }),
      getStorageUsage: async (): Promise<{ used: string; total: string }> => 
        ({ used: '0', total: '0' }),
      getWalBalance: async (): Promise<string> => '0',
      verifyPoA: async (): Promise<boolean> => false,
      executeCreateStorageTransaction: async (): Promise<any> => 
        ({ 
          digest: '', 
          storage: { 
            id: { id: '' }, 
            start_epoch: 0, 
            end_epoch: 0, 
            storage_size: '0' 
          } 
        }),
      storageCost: async (): Promise<{ 
        storageCost: bigint; 
        writeCost: bigint; 
        totalCost: bigint 
      }> => ({ 
        storageCost: BigInt(0), 
        writeCost: BigInt(0), 
        totalCost: BigInt(0) 
      })
    };
    
    // Use type assertion to satisfy the compiler
    // This is safe because createWalrusClientAdapter will handle any missing methods
    // by providing default implementations
    this.walrusClient = createWalrusClientAdapter(minimalClient as unknown as WalrusClient);
    
    // Clean up signer reference
    this.signer = null;
    this.isInitialized = false;
  }

  /**
   * Gets the transaction signer for this session
   * @throws If not initialized
   */
  protected async getTransactionSigner(): Promise<SignerAdapter> {
    if (!this.signer) {
      throw new Error('WalrusImageStorage not initialized. Call connect() first.');
    }
    
    // All signers should already be wrapped in an adapter during connect(),
    // but we ensure it here for type safety.
    // The 'getUnderlyingSigner' property is a reliable way to identify a SignerAdapter instance
    if (this.signer && !('getUnderlyingSigner' in this.signer)) {
      // If it's not already a SignerAdapter, create one from the base Signer
      // Use type assertion to tell TypeScript that this.signer is compatible with Signer
      return createSignerAdapter(this.signer as unknown as Signer);
    }
    
    // It's already a SignerAdapter, so just return it
    return this.signer;
  }

  /**
   * Gets the active Sui address for this session
   * @throws If not initialized
   */
  public getActiveAddress(): string {
    if (!this.signer) {
      throw new Error('WalrusImageStorage not initialized. Call connect() first.');
    }
    return this.signer.toSuiAddress();
  }

  /**
   * Uploads the default todo image to Walrus storage
   * @returns URL to the uploaded image
   */
  async uploadDefaultImage(): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('WalrusImageStorage not initialized. Call connect() first.');
    }

    let fileBuffer: Buffer | null = null;

    try {
      if (this.useMockMode) {
        console.log('Using mock mode for default image upload');
        return 'https://testnet.wal.app/blob/mock-default-image-blob-id';
      }

      const imagePath = getAssetPath('todo_bottle.jpeg');
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Default image not found at ${imagePath}`);
      }

      // Read image file as buffer with proper resource handling
      fileBuffer = fs.readFileSync(imagePath);

      // Get signer adapter to ensure compatibility with the WalrusClient interface
      const signerAdapter = await this.getTransactionSigner();
      
      // Create a clean copy of the buffer for uploading
      const imageBuffer = Buffer.from(fileBuffer);

      // Use the adapter-compliant method signature for writeBlob
      const result = await this.walrusClient.writeBlob({
        blob: new Uint8Array(imageBuffer),
        deletable: false,
        epochs: 52, // Store for ~6 months
        signer: signerAdapter, // WalrusClientAdapter understands SignerAdapter
        attributes: {
          contentType: 'image/jpeg',
          filename: 'todo_bottle.jpeg',
          type: 'todo-nft-default-image'
        }
      });
      
      // Extract the blob ID with type guards for different response formats
      let blobId: string;
      
      if (result.blobId) {
        // Direct blobId in the response
        blobId = result.blobId;
      } else if (result.blobObject) {
        // Need to extract from blobObject based on its structure
        if (result.blobObject && typeof result.blobObject === 'object') {
          if ('blob_id' in result.blobObject && typeof result.blobObject.blob_id === 'string') {
            blobId = result.blobObject.blob_id;
          } else if ('id' in result.blobObject && 
                    typeof result.blobObject.id === 'object' && 
                    result.blobObject.id !== null &&
                    'id' in result.blobObject.id &&
                    typeof result.blobObject.id.id === 'string') {
            blobId = result.blobObject.id.id;
          } else {
            throw new Error('Invalid blob object structure');
          }
        } else {
          throw new Error('Invalid blob object format');
        }
      } else {
        throw new Error('No blob ID or blob object in response');
      }

      // Return the Walrus URL format
      return `https://testnet.wal.app/blob/${blobId}`;
    } catch (error) {
      handleError('Failed to upload default image to Walrus', error);
      throw error;
    } finally {
      // Explicitly null out any large buffers to help garbage collection
      fileBuffer = null;
    }
  }

  /**
   * Calculates SHA-256 checksum of a buffer
   */
  private calculateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Detects MIME type from file header bytes
   * @throws CLIError for unsupported or invalid types
   */
  private detectMimeType(buffer: Buffer): string {
    try {
      if (buffer.length < 4) {
        throw new CLIError('File too small to determine type', 'WALRUS_INVALID_IMAGE');
      }
      
      const header = buffer.toString('hex', 0, 4).toLowerCase();
      
      if (header.startsWith('89504e47')) return 'image/png';
      if (header.startsWith('ffd8')) return 'image/jpeg';
      if (header.startsWith('47494638')) return 'image/gif';
      
      throw new CLIError(
        `Unsupported image format. Only PNG, JPEG, and GIF are supported.`,
        'WALRUS_UNSUPPORTED_FORMAT'
      );
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new CLIError(
          `Failed to detect image type: ${error.message}`,
          'WALRUS_MIME_DETECTION_FAILED'
        );
      }
      throw new CLIError(
        'Failed to detect image type: Unknown error type',
        'WALRUS_MIME_DETECTION_FAILED'
      );
    }
  }

  /**
   * Validates an image for size, format, and dimensions
   * @throws CLIError for validation failures
   */
  private validateImage(buffer: Buffer, mimeType: string): void {
    try {
      // Validate size
      if (buffer.length > MAX_IMAGE_SIZE) {
        throw new CLIError(
          `Image size (${buffer.length} bytes) exceeds maximum allowed size (${MAX_IMAGE_SIZE} bytes)`,
          'WALRUS_IMAGE_TOO_LARGE'
        );
      }

      // Validate mime type
      if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
        throw new CLIError(
          `Unsupported image type: ${mimeType}. Supported types: ${SUPPORTED_MIME_TYPES.join(', ')}`,
          'WALRUS_UNSUPPORTED_FORMAT'
        );
      }

      // Basic image corruption check
      try {
        if (buffer.length < 24) {
          throw new CLIError('Invalid image file: too small to be valid', 'WALRUS_INVALID_IMAGE');
        }

        // Use image-size to validate basic format
        const dimensions = sizeOf(buffer);
        if (!dimensions.width || !dimensions.height) {
          throw new CLIError('Invalid image dimensions', 'WALRUS_INVALID_IMAGE');
        }

        // Basic dimension validation
        if (dimensions.width > 10000 || dimensions.height > 10000) {
          throw new CLIError(
            'Image dimensions too large. Maximum allowed is 10000x10000 pixels.',
            'WALRUS_INVALID_DIMENSIONS'
          );
        }
      } catch (error) {
        if (error instanceof CLIError) throw error;
        throw new CLIError(
          `Invalid image file: ${error instanceof Error ? error.message : String(error)}`,
          'WALRUS_INVALID_IMAGE'
        );
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new CLIError(
          `Image validation failed: ${error.message}`,
          'WALRUS_VALIDATION_FAILED'
        );
      }
      throw new CLIError(
        'Image validation failed: Unknown error type',
        'WALRUS_VALIDATION_FAILED'
      );
    }
  }

  /**
   * Internal method to upload an image with specific options
   */
  private async uploadImageInternal(options: ImageUploadOptions): Promise<string> {
    let fileBuffer: Buffer | null = null;
    if (!this.isInitialized) {
      throw new CLIError(
        'WalrusImageStorage not initialized. Call connect() first.',
        'WALRUS_NOT_INITIALIZED'
      );
    }

    try {
      if (this.useMockMode) {
        console.log('Using mock mode for image upload');
        return `https://testnet.wal.app/blob/mock-image-blob-id-${Date.now()}`;
      }

      // Validate input
      if (!options.imagePath?.trim()) {
        throw new CLIError('Image path is required', 'WALRUS_INVALID_INPUT');
      }

      if (!fs.existsSync(options.imagePath)) {
        throw new CLIError(
          `Image not found at ${options.imagePath}`,
          'WALRUS_FILE_NOT_FOUND'
        );
      }

      fileBuffer = fs.readFileSync(options.imagePath);
      const imageBuffer = Buffer.from(fileBuffer);
      const mimeType = this.detectMimeType(imageBuffer);
      this.validateImage(imageBuffer, mimeType);

      // Get image metadata
      const dimensions = sizeOf(imageBuffer);
      const metadata: ImageMetadata = {
        width: dimensions.width || 0,
        height: dimensions.height || 0,
        mimeType,
        size: imageBuffer.length,
        checksum: this.calculateChecksum(imageBuffer)
      };

      // Prepare upload attributes
      const baseAttributes = {
        contentType: metadata.mimeType,
        filename: path.basename(options.imagePath),
        type: options.type,
        checksum: metadata.checksum,
        checksum_algo: 'sha256',
        size: metadata.size.toString(),
        uploadedAt: new Date().toISOString(),
        width: metadata.width.toString(),
        height: metadata.height.toString(),
        encoding: 'binary'
      };

      // Add additional metadata if provided
      const attributes = options.metadata
        ? { ...baseAttributes, ...options.metadata }
        : baseAttributes;

      // Get a properly adapted signer that conforms to the expected interface
      const signerAdapter = await this.getTransactionSigner();

      // Upload with retries and verification
      const maxRetries = this.retryConfig.maxRetries;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Upload attempt ${attempt}/${maxRetries}...`);

          // Using the adapter-compliant method signature
          const result = await this.walrusClient.writeBlob({
            blob: new Uint8Array(imageBuffer),
            deletable: false,
            epochs: 52,
            signer: signerAdapter, // The adapter handles interface compatibility
            attributes
          });
          
          // Extract the blob ID with proper type checking for different response formats
          let blobId: string;
          
          if (result.blobId) {
            // Direct blobId in the response
            blobId = result.blobId;
          } else if (result.blobObject) {
            // Need to extract from blobObject based on its structure
            if (result.blobObject && typeof result.blobObject === 'object') {
              if ('blob_id' in result.blobObject && typeof result.blobObject.blob_id === 'string') {
                blobId = result.blobObject.blob_id;
              } else if ('id' in result.blobObject && 
                        typeof result.blobObject.id === 'object' && 
                        result.blobObject.id !== null &&
                        'id' in result.blobObject.id &&
                        typeof result.blobObject.id.id === 'string') {
                blobId = result.blobObject.id.id;
              } else {
                throw new Error('Invalid blob object structure');
              }
            } else {
              throw new Error('Invalid blob object format');
            }
          } else {
            throw new Error('No blob ID or blob object in response');
          }

          // Verify upload with timeout
          let verified = false;
          const verifyTimeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              if (!verified) {
                reject(new CLIError('Upload verification timed out', 'WALRUS_VERIFICATION_TIMEOUT'));
              }
            }, 10000);
          });

          try {
            // Try up to 3 times to verify the upload
            for (let verifyAttempt = 1; verifyAttempt <= 3; verifyAttempt++) {
              const readOptions: ReadBlobOptions = { blobId };
              // Using Promise.race for timeout handling
              const uploadResult = await Promise.race([
                this.walrusClient.readBlob(readOptions).then(result => ({ 
                  success: true, 
                  data: result 
                })),
                verifyTimeoutPromise.catch(err => ({ 
                  success: false, 
                  error: err 
                }))
              ]);
              
              // Check if the result indicates failure
              if (!uploadResult || !('success' in uploadResult) || !uploadResult.success) {
                const error = uploadResult && 'error' in uploadResult ? uploadResult.error : new Error('Unknown verification error');
                throw error instanceof Error ? error : new Error(String(error));
              }
              
              // Type guard to safely access data property
              if (!('data' in uploadResult)) {
                throw new Error('Upload result does not contain expected data');
              }
              
              const uploadedContent = uploadResult.data;

              if (!uploadedContent || uploadedContent.length === 0) {
                if (verifyAttempt === 3) {
                  throw new CLIError('Failed to verify uploaded content', 'WALRUS_VERIFICATION_FAILED');
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
              }

              const uploadedBuffer = Buffer.from(uploadedContent);
              const uploadedChecksum = this.calculateChecksum(uploadedBuffer);

              if (uploadedChecksum !== metadata.checksum) {
                throw new CLIError(
                  'Content integrity check failed',
                  'WALRUS_VERIFICATION_FAILED'
                );
              }

              verified = true;
              return `https://testnet.wal.app/blob/${blobId}`;
            }
            
            // If we get here, verification failed after all attempts
            throw new CLIError('Failed to verify uploaded content after multiple attempts', 'WALRUS_VERIFICATION_FAILED');
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt === maxRetries) throw lastError;
          }
        } catch (error) {
          if (error instanceof CLIError) {
            lastError = error;
          } else if (error instanceof Error) {
            lastError = new CLIError(`Upload attempt ${attempt} failed: ${error.message}`, 'WALRUS_UPLOAD_RETRY_FAILED');
          } else {
            lastError = new CLIError(`Upload attempt ${attempt} failed: Unknown error type`, 'WALRUS_UPLOAD_RETRY_FAILED');
          }
          if (attempt === maxRetries) throw lastError;
          await new Promise(resolve => setTimeout(resolve, this.retryConfig.baseDelay * attempt));
        }
      }

      throw lastError || new CLIError('Upload failed after all retries', 'WALRUS_UPLOAD_FAILED');
    } catch (error) {
      if (error instanceof CLIError) throw error;
      throw new CLIError(
        `Failed to upload image: ${error instanceof Error ? error.message : String(error)}`,
        'WALRUS_UPLOAD_FAILED'
      );
    } finally {
      // Explicitly null out any large buffers to help garbage collection
      fileBuffer = null;
    }
  }

  /**
   * Uploads an image to Walrus storage
   * @param imagePath Path to the image file
   * @returns URL to the uploaded image
   */
  public async uploadImage(imagePath: string): Promise<string> {
    return this.uploadImageInternal({
      imagePath,
      type: 'todo-nft-image'
    });
  }

  /**
   * Uploads a todo-specific image to Walrus storage with metadata
   * @param imagePath Path to the image file
   * @param title Todo title to include in metadata
   * @param completed Todo completion status to include in metadata
   * @returns URL to the uploaded image
   */
  public async uploadTodoImage(
    imagePath: string,
    title: string,
    completed: boolean
  ): Promise<string> {
    return this.uploadImageInternal({
      imagePath,
      type: 'todo-nft-image',
      metadata: {
        title,
        // Walrus API attributes are all strings, so we convert boolean to string
        completed: String(completed)
      }
    });
  }
}

/**
 * Creates a new WalrusImageStorage instance
 * @param suiClient The SuiClient instance to use
 * @param useMockMode Whether to use mock mode
 * @returns A configured WalrusImageStorage instance
 */
export function createWalrusImageStorage(
  suiClient: ClientWithExtensions,
  useMockMode: boolean = false
): WalrusImageStorage {
  return new WalrusImageStorage(suiClient, useMockMode);
}