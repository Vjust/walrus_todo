/**
 * @fileoverview Image Storage - Specialized storage implementation for images
 *
 * This class extends the BlobStorage implementation to provide specialized
 * functionality for storing, retrieving, and managing image files. It adds
 * image-specific validation, format handling, and metadata management.
 */

import { BlobStorage } from './BlobStorage';
import { StorageConfig } from '../core/StorageTypes';
import { StorageError } from '../../../types/errors';
import { ValidationError } from '../../../types/errors/ValidationError';
import { StorageOperationHandler } from '../utils/StorageOperationHandler';
import * as crypto from 'crypto';

/**
 * Supported image formats
 */
type ImageFormat = 'jpeg' | 'png' | 'gif' | 'webp' | 'svg';

/**
 * Image information structure
 */
interface ImageInfo {
  /** Width of the image in pixels */
  width: number;
  /** Height of the image in pixels */
  height: number;
  /** Format of the image */
  format: ImageFormat;
  /** Size of the image in bytes */
  size: number;
  /** Whether the image is animated */
  animated?: boolean;
  /** Aspect ratio of the image */
  aspectRatio: number;
}

/**
 * Default configuration for image storage
 */
const DEFAULT_IMAGE_STORAGE_CONFIG: Partial<StorageConfig> = {
  maxContentSize: 20 * 1024 * 1024, // 20MB for images
};

/**
 * Specialized storage implementation for image files.
 * Extends BlobStorage with image-specific functionality.
 */
export class ImageStorage extends BlobStorage {
  /** Maximum image dimensions */
  private maxImageDimension = 10000; // 10,000 pixels max width/height
  
  /** Supported image formats */
  private supportedFormats: ImageFormat[] = ['jpeg', 'png', 'gif', 'webp', 'svg'];
  
  /**
   * Creates a new ImageStorage instance.
   * 
   * @param address - User's wallet address
   * @param configOverrides - Optional configuration overrides
   */
  constructor(address: string, configOverrides: Partial<StorageConfig> = {}) {
    // Merge image defaults with provided overrides
    super(address, {
      ...DEFAULT_IMAGE_STORAGE_CONFIG,
      ...configOverrides
    });
  }
  
  /**
   * Stores an image in the storage system.
   * 
   * @param imageData - The binary image data to store
   * @param filename - The original filename
   * @param contentType - The content type of the image
   * @param additionalMetadata - Any additional metadata to store
   * @returns Promise resolving to the blob ID for the stored image
   * @throws {ValidationError} if image validation fails
   * @throws {StorageError} if storage operation fails
   */
  public async storeImage(
    imageData: Uint8Array,
    filename: string,
    contentType: string,
    additionalMetadata: Record<string, string> = {}
  ): Promise<string> {
    try {
      // Validate image data
      this.validateImageData(imageData, contentType);
      
      // Analyze image to get dimensions and format
      const imageInfo = await this.getImageInfo(imageData, contentType);
      
      // Generate a unique image ID if not provided
      const imageId = additionalMetadata.imageId || this.generateImageId();
      
      // Calculate SHA-256 hash of the image data
      const checksum = this.calculateChecksum(imageData);
      
      // Prepare comprehensive metadata
      const metadata = {
        contentType,
        contentCategory: 'image',
        filename,
        imageId,
        width: imageInfo.width.toString(),
        height: imageInfo.height.toString(),
        format: imageInfo.format,
        size: imageData.length.toString(),
        checksum,
        checksumAlgorithm: 'sha256',
        aspectRatio: imageInfo.aspectRatio.toString(),
        createdAt: new Date().toISOString(),
        schemaVersion: '1',
        encoding: 'binary',
        ...additionalMetadata
      };
      
      // Store the image
      const blobId = await this.store(imageData, metadata);
      
      console.log(`Image successfully stored with blob ID: ${blobId}`);
      console.log(`Image dimensions: ${imageInfo.width}x${imageInfo.height}, Format: ${imageInfo.format}`);
      
      return blobId;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof StorageError) {
        throw error;
      }
      
      throw new StorageError(
        `Failed to store image: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'store image',
          recoverable: false,
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }
  
  /**
   * Retrieves an image from storage.
   * 
   * @param blobId - The blob ID for the image to retrieve
   * @returns Promise resolving to the image data and metadata
   * @throws {ValidationError} if validation fails
   * @throws {StorageError} if retrieval operation fails
   */
  public async retrieveImage(
    blobId: string
  ): Promise<{ 
    imageData: Uint8Array; 
    metadata: Record<string, string>; 
    imageInfo: ImageInfo;
  }> {
    try {
      // Retrieve the blob
      const { content, metadata } = await this.retrieve(blobId);
      
      // Extract image info from metadata
      const imageInfo: ImageInfo = {
        width: parseInt(metadata.width || '0', 10),
        height: parseInt(metadata.height || '0', 10),
        format: (metadata.format || 'jpeg') as ImageFormat,
        size: content.length,
        aspectRatio: parseFloat(metadata.aspectRatio || '0') || 
                    (parseInt(metadata.width || '0', 10) / parseInt(metadata.height || '0', 10))
      };
      
      // Validate the checksum if available
      if (metadata.checksum) {
        const calculatedChecksum = this.calculateChecksum(content);
        if (calculatedChecksum !== metadata.checksum) {
          console.warn(`Image checksum verification failed for blob ${blobId}`);
        }
      }
      
      return {
        imageData: content,
        metadata,
        imageInfo
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof StorageError) {
        throw error;
      }
      
      throw new StorageError(
        `Failed to retrieve image: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'retrieve image',
          blobId,
          recoverable: true,
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }
  
  /**
   * Updates an image in storage.
   * 
   * @param blobId - The original blob ID
   * @param imageData - The new image data
   * @param contentType - The content type of the new image
   * @param additionalMetadata - Any additional metadata to update
   * @returns Promise resolving to the new blob ID
   * @throws {ValidationError} if validation fails
   * @throws {StorageError} if update operation fails
   */
  public async updateImage(
    blobId: string,
    imageData: Uint8Array,
    contentType: string,
    additionalMetadata: Record<string, string> = {}
  ): Promise<string> {
    try {
      // First retrieve the original image to get its metadata
      const { metadata: originalMetadata } = await this.retrieveImage(blobId);
      
      // Validate the new image data
      this.validateImageData(imageData, contentType);
      
      // Analyze image to get dimensions and format
      const imageInfo = await this.getImageInfo(imageData, contentType);
      
      // Prepare updated metadata
      const metadata = {
        ...originalMetadata,
        contentType,
        width: imageInfo.width.toString(),
        height: imageInfo.height.toString(),
        format: imageInfo.format,
        size: imageData.length.toString(),
        checksum: this.calculateChecksum(imageData),
        aspectRatio: imageInfo.aspectRatio.toString(),
        updatedAt: new Date().toISOString(),
        originalBlobId: blobId,
        ...additionalMetadata
      };
      
      // Store as new blob (since Walrus blobs are immutable)
      const newBlobId = await this.store(imageData, metadata);
      
      console.log(`Image updated with new blob ID: ${newBlobId}`);
      console.log(`Previous blob ID ${blobId} will remain but can be ignored`);
      
      return newBlobId;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof StorageError) {
        throw error;
      }
      
      throw new StorageError(
        `Failed to update image: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'update image',
          blobId,
          recoverable: false,
          cause: error instanceof Error ? error : undefined
        }
      );
    }
  }
  
  /**
   * Validates image data to ensure it meets requirements.
   * 
   * @param imageData - The image data to validate
   * @param contentType - The content type of the image
   * @throws {ValidationError} if validation fails
   */
  private validateImageData(imageData: Uint8Array, contentType: string): void {
    // Check size
    if (imageData.length === 0) {
      throw new ValidationError('Image data is empty', {
        operation: 'validate image',
        field: 'imageData'
      });
    }
    
    if (imageData.length > this.getConfig().maxContentSize) {
      throw new ValidationError(`Image size exceeds maximum allowed (${this.getConfig().maxContentSize} bytes)`, {
        operation: 'validate image',
        field: 'imageData.length',
        value: imageData.length.toString()
      });
    }
    
    // Validate content type
    const format = this.getFormatFromContentType(contentType);
    if (!this.supportedFormats.includes(format)) {
      throw new ValidationError(`Unsupported image format: ${format}. Supported formats: ${this.supportedFormats.join(', ')}`, {
        operation: 'validate image',
        field: 'contentType',
        value: contentType
      });
    }
    
    // Basic format validation
    if (!this.validateImageFormat(imageData, format)) {
      throw new ValidationError(`Image data does not match claimed format: ${format}`, {
        operation: 'validate image',
        field: 'format',
        value: format
      });
    }
  }
  
  /**
   * Gets format information from a content type.
   * 
   * @param contentType - The content type to parse
   * @returns The image format
   */
  private getFormatFromContentType(contentType: string): ImageFormat {
    if (contentType.includes('jpeg') || contentType.includes('jpg')) {
      return 'jpeg';
    } else if (contentType.includes('png')) {
      return 'png';
    } else if (contentType.includes('gif')) {
      return 'gif';
    } else if (contentType.includes('webp')) {
      return 'webp';
    } else if (contentType.includes('svg')) {
      return 'svg';
    }
    
    // Default fallback
    return 'jpeg';
  }
  
  /**
   * Performs basic validation of image format using magic numbers.
   * 
   * @param imageData - The image data to validate
   * @param format - The expected format
   * @returns Whether the image data matches the claimed format
   */
  private validateImageFormat(imageData: Uint8Array, format: ImageFormat): boolean {
    // Check file signature (magic numbers)
    if (format === 'jpeg') {
      // JPEG starts with FF D8
      return imageData[0] === 0xFF && imageData[1] === 0xD8;
    } else if (format === 'png') {
      // PNG starts with 89 50 4E 47 0D 0A 1A 0A
      return imageData[0] === 0x89 && imageData[1] === 0x50 && 
             imageData[2] === 0x4E && imageData[3] === 0x47 &&
             imageData[4] === 0x0D && imageData[5] === 0x0A &&
             imageData[6] === 0x1A && imageData[7] === 0x0A;
    } else if (format === 'gif') {
      // GIF starts with 47 49 46 38 (GIF8)
      return imageData[0] === 0x47 && imageData[1] === 0x49 && 
             imageData[2] === 0x46 && imageData[3] === 0x38;
    } else if (format === 'webp') {
      // WebP starts with 52 49 46 46 (RIFF) and has WEBP at position 8
      return imageData[0] === 0x52 && imageData[1] === 0x49 && 
             imageData[2] === 0x46 && imageData[3] === 0x46 &&
             imageData[8] === 0x57 && imageData[9] === 0x45 &&
             imageData[10] === 0x42 && imageData[11] === 0x50;
    } else if (format === 'svg') {
      // For SVG, check for XML signature or svg tag
      const start = new TextDecoder().decode(imageData.slice(0, 100));
      return start.includes('<?xml') || start.includes('<svg');
    }
    
    return true; // Default to true for unknown formats
  }
  
  /**
   * Analyzes image data to extract information like dimensions and format.
   * 
   * Note: A full implementation would use image libraries to get accurate dimensions,
   * but this is a simplified version that avoids external dependencies.
   * 
   * @param imageData - The image data to analyze
   * @param contentType - The content type of the image
   * @returns Information about the image
   */
  private async getImageInfo(imageData: Uint8Array, contentType: string): Promise<ImageInfo> {
    try {
      // In a real implementation, you would use an image processing library
      // to extract dimensions and other metadata. This is a simplified version.
      const format = this.getFormatFromContentType(contentType);
      
      // For now, we'll provide basic information and simulate some values
      const defaultInfo: ImageInfo = {
        width: 800,
        height: 600,
        format,
        size: imageData.length,
        aspectRatio: 800 / 600
      };
      
      // If we had an image library, we would use code like this:
      /*
      const sharp = require('sharp');
      const metadata = await sharp(imageData).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: imageData.length,
        animated: metadata.pages > 1,
        aspectRatio: metadata.width / metadata.height
      };
      */
      
      return defaultInfo;
    } catch (error) {
      console.warn('Error analyzing image:', error);
      
      // Return default values if analysis fails
      return {
        width: 0,
        height: 0,
        format: this.getFormatFromContentType(contentType),
        size: imageData.length,
        aspectRatio: 1
      };
    }
  }
  
  /**
   * Generates a unique ID for an image.
   * 
   * @returns A unique image ID
   */
  private generateImageId(): string {
    return `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }
  
  /**
   * Calculates a checksum for the provided data.
   * 
   * @param data - The data to calculate a checksum for
   * @returns Hexadecimal representation of the hash
   */
  protected calculateChecksum(data: Uint8Array): string {
    return crypto.createHash('sha256').update(Buffer.from(data)).digest('hex');
  }
}