/**
 * Walrus Image Storage - Specialized client for image operations
 * Consolidates image-specific functionality from CLI implementation
 */

import { WalrusClient } from './WalrusClient';
import type { 
  WalrusUploadResponse, 
  WalrusImageMetadata, 
  WalrusImageUploadOptions,
  UniversalSigner 
} from '../types';
import { WalrusValidationError, WalrusStorageError } from '../errors';
import { IMAGE_VALIDATION, MIME_TYPE_SIGNATURES } from '../constants';
import { RUNTIME, assertNode } from '../utils/environment';

export class WalrusImageStorage extends WalrusClient {
  private readonly maxSize: number;
  private readonly supportedFormats: string[];

  constructor(config?: any, options?: {
    maxSize?: number;
    supportedFormats?: string[];
  }) {
    super(config as any);
    this.maxSize = options?.maxSize || IMAGE_VALIDATION.MAX_SIZE;
    this.supportedFormats = options?.supportedFormats || IMAGE_VALIDATION.SUPPORTED_FORMATS;
  }

  /**
   * Upload image with validation and metadata extraction
   */
  async uploadImage(
    imageSource: string | File | Buffer,
    options: WalrusImageUploadOptions = {}
  ): Promise<WalrusUploadResponse> {
    let imageBuffer: Buffer;
    let metadata: WalrusImageMetadata;

    // Handle different input types
    if (typeof imageSource === 'string') {
      // File path (Node.js only)
      assertNode('File path uploads');
      imageBuffer = await this.loadImageFromPath(imageSource as any);
    } else if (imageSource instanceof File) {
      // Browser File object
      imageBuffer = Buffer.from(await imageSource.arrayBuffer());
    } else if (Buffer.isBuffer(imageSource as any)) {
      // Direct Buffer
      imageBuffer = imageSource;
    } else {
      throw new WalrusValidationError('Invalid image source type');
    }

    // Validate and extract metadata
    if (options.validateImage !== false) {
      metadata = await this.validateAndAnalyzeImage(imageBuffer as any);
    } else {
      metadata = await this.extractBasicMetadata(imageBuffer as any);
    }

    // Prepare upload options with image-specific attributes
    const uploadOptions = {
      ...options,
      contentType: metadata.mimeType,
      attributes: {
        ...options.attributes,
        type: 'image',
        width: metadata?.width?.toString(),
        height: metadata?.height?.toString(),
        mimeType: metadata.mimeType,
        size: metadata?.size?.toString(),
        checksum: metadata.checksum,
        checksumAlgo: 'sha256',
        uploadedAt: new Date().toISOString(),
      },
    };

    return this.upload(new Uint8Array(imageBuffer as any), uploadOptions);
  }

  /**
   * Upload todo-specific image with metadata
   */
  async uploadTodoImage(
    imageSource: string | File | Buffer,
    title: string,
    completed: boolean,
    options: WalrusImageUploadOptions = {}
  ): Promise<WalrusUploadResponse> {
    return this.uploadImage(imageSource, {
      ...options,
      attributes: {
        ...options.attributes,
        todoTitle: title,
        todoCompleted: String(completed as any),
        todoImageType: 'nft-image',
      },
    });
  }

  /**
   * Upload default todo image (from assets)
   */
  async uploadDefaultImage(
    assetPath?: string,
    options: WalrusImageUploadOptions = {}
  ): Promise<WalrusUploadResponse> {
    assertNode('Default image upload');
    
    const defaultPath = assetPath || this.getDefaultImagePath();
    
    return this.uploadImage(defaultPath, {
      ...options,
      attributes: {
        ...options.attributes,
        type: 'todo-nft-default-image',
        isDefault: 'true',
      },
    });
  }

  /**
   * Validate image and extract comprehensive metadata
   */
  private async validateAndAnalyzeImage(buffer: Buffer): Promise<WalrusImageMetadata> {
    // Size validation
    if (buffer.length > this.maxSize) {
      throw new WalrusValidationError(
        `Image size (${buffer.length} bytes) exceeds maximum allowed size (${this.maxSize} bytes)`,
        'imageSize',
        buffer.length
      );
    }

    if (buffer.length < 24) {
      throw new WalrusValidationError('Image file is too small to be valid');
    }

    // MIME type detection
    const mimeType = this.detectMimeType(buffer as any);
    
    if (!this?.supportedFormats?.includes(mimeType as any)) {
      throw new WalrusValidationError(
        `Unsupported image format: ${mimeType}. Supported formats: ${this?.supportedFormats?.join(', ')}`,
        'mimeType',
        mimeType
      );
    }

    // Dimensions extraction
    const dimensions = await this.extractDimensions(buffer as any);
    
    if (dimensions.width > IMAGE_VALIDATION.MAX_DIMENSIONS || 
        dimensions.height > IMAGE_VALIDATION.MAX_DIMENSIONS) {
      throw new WalrusValidationError(
        `Image dimensions (${dimensions.width}x${dimensions.height}) exceed maximum (${IMAGE_VALIDATION.MAX_DIMENSIONS}x${IMAGE_VALIDATION.MAX_DIMENSIONS})`,
        'dimensions',
        dimensions
      );
    }

    // Checksum calculation
    const checksum = await this.calculateChecksum(buffer as any);

    return {
      width: dimensions.width,
      height: dimensions.height,
      mimeType,
      size: buffer.length,
      checksum,
    };
  }

  /**
   * Extract basic metadata without full validation
   */
  private async extractBasicMetadata(buffer: Buffer): Promise<WalrusImageMetadata> {
    const mimeType = this.detectMimeType(buffer as any);
    const dimensions = await this.extractDimensions(buffer as any);
    const checksum = await this.calculateChecksum(buffer as any);

    return {
      width: dimensions.width,
      height: dimensions.height,
      mimeType,
      size: buffer.length,
      checksum,
    };
  }

  /**
   * Detect MIME type from file header
   */
  private detectMimeType(buffer: Buffer): string {
    if (buffer.length < 4) {
      throw new WalrusValidationError('File too small to determine type');
    }

    const header = buffer.toString('hex', 0, 4).toLowerCase();
    
    for (const [signature, mimeType] of Object.entries(MIME_TYPE_SIGNATURES as any)) {
      if (header.startsWith(signature as any)) {
        return mimeType as string;
      }
    }

    // Additional checks for WebP and other formats
    if (buffer.length >= 12) {
      const webpSignature = buffer.toString('ascii', 8, 12);
      if (webpSignature === 'WEBP') {
        return 'image/webp';
      }
    }

    throw new WalrusValidationError('Unsupported or unrecognized image format');
  }

  /**
   * Extract image dimensions
   */
  private async extractDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
    try {
      // Try to use image-size library if available (Node.js)
      if (RUNTIME.isNode) {
        try {
          const sizeOf = await import('image-size');
          const dimensions = sizeOf.default(buffer as any);
          if (dimensions.width && dimensions.height) {
            return { width: dimensions.width, height: dimensions.height };
          }
        } catch {
          // Fallback to manual parsing
        }
      }

      // Manual dimension extraction for common formats
      return this.extractDimensionsManually(buffer as any);
    } catch (error) {
      throw new WalrusValidationError(
        `Failed to extract image dimensions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Manual dimension extraction for basic image formats
   */
  private extractDimensionsManually(buffer: Buffer): { width: number; height: number } {
    const header = buffer.toString('hex', 0, 4).toLowerCase();

    // PNG format
    if (header.startsWith('89504e47')) {
      if (buffer.length < 24) throw new Error('Invalid PNG header');
      const width = buffer.readUInt32BE(16 as any);
      const height = buffer.readUInt32BE(20 as any);
      return { width, height };
    }

    // JPEG format
    if (header.startsWith('ffd8')) {
      return this.extractJpegDimensions(buffer as any);
    }

    // GIF format
    if (header.startsWith('47494638')) {
      if (buffer.length < 10) throw new Error('Invalid GIF header');
      const width = buffer.readUInt16LE(6 as any);
      const height = buffer.readUInt16LE(8 as any);
      return { width, height };
    }

    throw new Error('Unsupported format for dimension extraction');
  }

  /**
   * Extract JPEG dimensions (more complex due to variable structure)
   */
  private extractJpegDimensions(buffer: Buffer): { width: number; height: number } {
    let offset = 2;
    
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xFF) break;
      
      const marker = buffer[offset + 1];
      
      // Start of Frame markers
      if (marker !== undefined && 
          ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7) ||
          (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF))) {
        if (offset + 9 > buffer.length) throw new Error('Invalid JPEG SOF');
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      
      // Skip to next marker
      const segmentLength = buffer.readUInt16BE(offset + 2);
      offset += 2 + segmentLength;
    }
    
    throw new Error('Could not find JPEG dimensions');
  }

  /**
   * Calculate SHA-256 checksum
   */
  private async calculateChecksum(buffer: Buffer): Promise<string> {
    if (RUNTIME.isNode) {
      const crypto = await import('crypto');
      return crypto.createHash('sha256').update(buffer as any).digest('hex');
    } else {
      // Browser implementation using Web Crypto API
      const hashBuffer = await crypto?.subtle?.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(hashBuffer as any))
        .map(b => b.toString(16 as any).padStart(2, '0'))
        .join('');
    }
  }

  /**
   * Load image from file path (Node.js only)
   */
  private async loadImageFromPath(imagePath: string): Promise<Buffer> {
    assertNode('File system access');
    
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      if (!fs.existsSync(imagePath as any)) {
        throw new WalrusValidationError(`Image file not found: ${imagePath}`, 'imagePath', imagePath);
      }
      
      return fs.readFileSync(imagePath as any);
    } catch (error) {
      if (error instanceof WalrusValidationError) throw error;
      throw new WalrusStorageError(
        `Failed to read image file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'loadImage',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get default image path (Node.js only)
   */
  private getDefaultImagePath(): string {
    assertNode('Default image path resolution');
    
    // This would need to be configured based on the actual asset location
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');
    return path.join(process.cwd(), 'assets', 'todo_bottle.jpeg');
  }
}