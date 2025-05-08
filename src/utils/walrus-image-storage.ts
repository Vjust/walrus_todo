import { SuiClient } from '@mysten/sui.js/client';
import { type Signer } from '@mysten/sui.js/cryptography';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { WalrusClient, type ReadBlobOptions } from '@mysten/walrus';
import type { WalrusClientWithExt, WalrusClientExt } from '../types/client';
import * as fs from 'fs';
import * as path from 'path';
import { getAssetPath } from './path-utils';
import { handleError } from './error-handler';
import { execSync } from 'child_process';
import { KeystoreSigner } from './sui-keystore';
import * as crypto from 'crypto';
import { CLIError } from '../types/error';
import sizeOf from 'image-size';
import { MockWalrusClient } from './MockWalrusClient';
import { NETWORK_URLS, CURRENT_NETWORK } from '../constants';

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
    completed?: boolean;
    [key: string]: any;
  };
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif'];

/**
 * A class for handling image storage on Walrus with the Sui blockchain
 */
export class WalrusImageStorage {
  private walrusClient!: WalrusClientWithExt;
  private isInitialized: boolean = false;
  private signer: KeystoreSigner | null = null;
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
        this.walrusClient = new MockWalrusClient() as unknown as WalrusClientWithExt;
        this.isInitialized = true;
        return;
      }

      // Get active environment info from Sui CLI
      const envInfo = execSync('sui client active-env').toString().trim();
      if (!envInfo.includes('testnet')) {
        throw new CLIError('Must be connected to testnet environment. Use "sui client switch --env testnet"', 'INVALID_ENVIRONMENT');
      }

      // Initialize Walrus client with network config
      const walrusConfig = {
        network: 'testnet' as const,
        suiClient: this.suiClient,
        storageNodeClientOptions: {
          timeout: 30000,
          onError: (error: Error) => handleError('Walrus storage node error:', error)
        }
      };
      
      // Create and initialize clients
      // Use suiRpcUrl instead of suiClient for compatibility
      const compatibleConfig = {
        network: 'testnet' as const,
        suiRpcUrl: NETWORK_URLS[CURRENT_NETWORK],
        storageNodeClientOptions: {
          timeout: 30000,
          onError: (error: Error) => handleError('Walrus storage node error:', error)
        }
      };
      this.walrusClient = new WalrusClient(compatibleConfig) as unknown as WalrusClientWithExt;
      this.signer = new KeystoreSigner(this.suiClient);
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

    // Reset client state
    if (this.walrusClient && 'reset' in this.walrusClient) {
      this.walrusClient.reset();
    }
    this.walrusClient = {} as WalrusClientWithExt;
    this.signer = null;
    this.isInitialized = false;
  }

  /**
   * Gets the transaction signer for this session
   * @throws If not initialized
   */
  protected async getTransactionSigner(): Promise<Signer> {
    if (!this.signer) {
      throw new Error('WalrusImageStorage not initialized. Call connect() first.');
    }
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

    try {
      if (this.useMockMode) {
        console.log('Using mock mode for default image upload');
        return 'https://testnet.wal.app/blob/mock-default-image-blob-id';
      }

      const imagePath = getAssetPath('todo_bottle.jpeg');
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Default image not found at ${imagePath}`);
      }

      // Read image file as buffer
      const imageBuffer = fs.readFileSync(imagePath);

      // Upload to Walrus using CLI keystore signer
      // @ts-ignore - Intentionally handling KeystoreSigner compatibility with Signer interface
      const signer = await this.getTransactionSigner();
      const result = await this.walrusClient.writeBlob({
        blob: new Uint8Array(imageBuffer),
        deletable: false,
        epochs: 52, // Store for ~6 months
        signer,
        attributes: {
          contentType: 'image/jpeg',
          filename: 'todo_bottle.jpeg',
          type: 'todo-nft-default-image'
        }
      });
      
      // Handle different response formats between WalrusClient implementations
      // @ts-ignore - Handle different response formats for compatibility
      const blobId = 'blobId' in result ? result.blobId : result.blobObject.blob_id;

      // Return the Walrus URL format
      return `https://testnet.wal.app/blob/${blobId}`;
    } catch (error) {
      handleError('Failed to upload default image to Walrus', error);
      throw error;
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

      const imageBuffer = fs.readFileSync(options.imagePath);
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

      const signer = await this.getTransactionSigner();

      // Upload with retries and verification
      const maxRetries = this.retryConfig.maxRetries;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Upload attempt ${attempt}/${maxRetries}...`);

          const result = await this.walrusClient.writeBlob({
            blob: new Uint8Array(imageBuffer),
            deletable: false,
            epochs: 52,
            signer,
            attributes
          });
          
          // Handle different response formats between WalrusClient implementations
          const blobId = 'blobId' in result ? result.blobId : result.blobObject.blob_id;

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
              // @ts-ignore - Promise.race type compatibility and different client interfaces
              const uploadedContent = await Promise.race([
                // @ts-ignore - Different client method signatures
                this.walrusClient.readBlob(readOptions),
                verifyTimeoutPromise
              ]);

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
    // @ts-ignore - Intentionally converting boolean to string for attribute values
    return this.uploadImageInternal({
      imagePath,
      type: 'todo-nft-image',
      metadata: {
        title,
        // @ts-ignore - Walrus API expects string values but type definition expects boolean
        completed: String(completed) // Convert boolean to string explicitly
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