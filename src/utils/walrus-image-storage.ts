import { SuiClient, type Signer, TransactionBlock } from '@mysten/sui';
import { WalrusClient } from '@mysten/walrus';
import * as fs from 'fs';
import * as path from 'path';
import { getAssetPath } from './path-utils';
import { handleError } from './error-handler';
import { execSync } from 'child_process';
import { KeystoreSigner } from './sui-keystore';
import crypto from 'crypto';
import { CLIError, WalrusError } from '../types/error';
import sizeOf from 'image-size';
import { withRetry } from './error-handler';

interface ImageMetadata {
  width: number;
  height: number;
  mimeType: string;
  size: number;
  checksum: string;
}

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

export class WalrusImageStorage {
  private walrusClient!: WalrusClient;
  private isInitialized: boolean = false;
  private signer: KeystoreSigner | null = null;
  private useMockMode: boolean;
  private readonly retryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000
  };

  constructor(private suiClient: SuiClient, useMockMode: boolean = false) {
    this.useMockMode = useMockMode;
  }

  async connect(): Promise<void> {
    try {
      if (this.useMockMode) {
        console.log('Using mock mode for Walrus image storage');
        this.isInitialized = true;
        return;
      }

      // Get active environment info from Sui CLI
      const envInfo = execSync('sui client active-env').toString().trim();
      if (!envInfo.includes('testnet')) {
        throw new CLIError('Must be connected to testnet environment. Use "sui client switch --env testnet"', 'INVALID_ENVIRONMENT');
      }

      // Initialize Walrus client with network config
      this.walrusClient = new WalrusClient({
        network: 'testnet',
        suiClient: this.suiClient,
        storageNodeClientOptions: {
          timeout: 30000,
          onError: (error) => handleError('Walrus storage node error:', error)
        }
      });

      // Create a signer that uses the active CLI keystore
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

  async disconnect(): Promise<void> {
    if (this.useMockMode) {
      console.log('Mock mode: No cleanup needed');
      return;
    }

    // Clear instance variables
    this.walrusClient = {} as WalrusClient;
    this.signer = null;
    this.isInitialized = false;
  }

  protected async getTransactionSigner(): Promise<Signer> {
    if (!this.signer) {
      throw new Error('WalrusImageStorage not initialized. Call connect() first.');
    }
    return this.signer as unknown as Signer;
  }

  public getActiveAddress(): string {
    if (!this.signer) {
      throw new Error('WalrusImageStorage not initialized. Call connect() first.');
    }
    return this.signer.toSuiAddress();
  }

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
      const signer = await this.getTransactionSigner();
      const { blobObject } = await this.walrusClient.writeBlob({
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

      // Return the Walrus URL format
      return `https://testnet.wal.app/blob/${blobObject.blob_id}`;
    } catch (error) {
      handleError('Failed to upload default image to Walrus', error);
      throw error;
    }
  }

  private calculateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

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
      let lastError = null;

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

          // Verify upload with timeout
          let verified = false;
          const verifyTimeout = setTimeout(() => {
            if (!verified) {
              throw new CLIError('Upload verification timed out', 'WALRUS_VERIFICATION_TIMEOUT');
            }
          }, 10000);

          try {
            // Try up to 3 times to verify the upload
            for (let verifyAttempt = 1; verifyAttempt <= 3; verifyAttempt++) {
              const uploadedContent = await this.walrusClient.readBlob({
                blobId: result.blobObject.blob_id
              });

              if (!uploadedContent) {
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
              clearTimeout(verifyTimeout);
              return `https://testnet.wal.app/blob/${result.blobObject.blob_id}`;
            }
          } catch (error) {
            lastError = error;
            if (attempt === maxRetries) throw error;
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

  public async uploadImage(imagePath: string): Promise<string> {
    return this.uploadImageInternal({
      imagePath,
      type: 'todo-nft-image'
    });
  }

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
        completed
      }
    });
  }
}

export function createWalrusImageStorage(suiClient: SuiClient, useMockMode: boolean = false): WalrusImageStorage {
  return new WalrusImageStorage(suiClient, useMockMode);
}