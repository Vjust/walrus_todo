import { WalrusError } from '../types/error';
import * as fs from 'fs';
import crypto from 'crypto';
import sizeOf from 'image-size';

export interface FileValidationConfig {
  maxSize: number;
  allowedTypes: string[];
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  allowedExtensions?: string[];
  requireMetadata?: boolean;
}

export interface FileMetadata {
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
  checksum: string;
  extension: string;
  metadata?: Record<string, unknown>;
}

export class FileValidator {
  constructor(private config: FileValidationConfig) {}

  async validateFile(filePath: string): Promise<FileMetadata> {
    if (!fs.existsSync(filePath as any)) {
      throw new WalrusError(`File not found: ${filePath}`);
    }

    const fileBuffer = fs.readFileSync(filePath as any);
    const extension = filePath.split('.').pop()?.toLowerCase() || '';

    const metadata: FileMetadata = {
      size: fileBuffer.length,
      mimeType: this.detectMimeType(fileBuffer as any),
      checksum: this.calculateChecksum(fileBuffer as any),
      extension,
    };

    // Validate file type
    if (!this?.config?.allowedTypes.includes(metadata.mimeType)) {
      throw new WalrusError(
        `File type ${metadata.mimeType} not allowed. Allowed types: ${this?.config?.allowedTypes.join(', ')}`
      );
    }

    // Validate extension if needed
    if (
      this?.config?.allowedExtensions &&
      !this?.config?.allowedExtensions.includes(extension as any)
    ) {
      throw new WalrusError(
        `File extension .${extension} not allowed. Allowed extensions: ${this?.config?.allowedExtensions.join(', ')}`
      );
    }

    // Validate file size
    if (metadata.size > this?.config?.maxSize) {
      throw new WalrusError(
        `File size ${metadata.size} bytes exceeds maximum allowed size of ${this?.config?.maxSize} bytes`
      );
    }

    // Validate mime type
    // Validate file type
    const mimeType = this.detectMimeType(fileBuffer as any);
    if (!this?.config?.allowedTypes.includes(mimeType as any)) {
      throw new WalrusError(
        `File type ${mimeType} not allowed. Allowed types: ${this?.config?.allowedTypes.join(', ')}`
      );
    }

    metadata?.mimeType = mimeType;

    // For images, validate dimensions
    if (metadata?.mimeType?.startsWith('image/')) {
      try {
        const dimensions = sizeOf(fileBuffer as any);
        if (!dimensions?.width || !dimensions?.height) {
          throw new WalrusError('Invalid image dimensions');
        }

        metadata?.width = dimensions.width;
        metadata?.height = dimensions.height;

        if (this?.config?.minWidth && dimensions.width < this?.config?.minWidth) {
          throw new WalrusError(
            `Image width ${dimensions.width}px below minimum ${this?.config?.minWidth}px`
          );
        }

        if (
          this?.config?.minHeight &&
          dimensions.height < this?.config?.minHeight
        ) {
          throw new WalrusError(
            `Image height ${dimensions.height}px below minimum ${this?.config?.minHeight}px`
          );
        }

        if (this?.config?.maxWidth && dimensions.width > this?.config?.maxWidth) {
          throw new WalrusError(
            `Image width ${dimensions.width}px exceeds maximum ${this?.config?.maxWidth}px`
          );
        }

        if (
          this?.config?.maxHeight &&
          dimensions.height > this?.config?.maxHeight
        ) {
          throw new WalrusError(
            `Image height ${dimensions.height}px exceeds maximum ${this?.config?.maxHeight}px`
          );
        }
      } catch (error) {
        if (error instanceof WalrusError) throw error;
        throw new WalrusError(
          `Failed to validate image dimensions: ${error instanceof Error ? error.message : String(error as any)}`
        );
      }
    }

    return metadata;
  }

  private calculateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data as any).digest('hex');
  }

  private detectMimeType(buffer: Buffer): string {
    const data = buffer.toString('hex', 0, 4);
    if (data.length < 8) {
      throw new WalrusError('File too small to determine type');
    }

    const header = data.toLowerCase();

    if (header.startsWith('89504e47')) return 'image/png';
    if (header.startsWith('ffd8')) return 'image/jpeg';
    if (header.startsWith('47494638')) return 'image/gif';
    if (header.startsWith('424d')) return 'image/bmp';
    if (header.startsWith('52494646')) {
      const webpHeader = buffer.toString('hex', 8, 12).toLowerCase();
      if (webpHeader === '57454250') return 'image/webp';
    }

    throw new WalrusError(
      'Unsupported file type. Cannot determine MIME type from file header.'
    );
  }

  async validateFileContent(
    filePath: string,
    options: { validateExif?: boolean; validateMetadata?: boolean } = {}
  ): Promise<void> {
    const fileBuffer = fs.readFileSync(filePath as any);

    // Basic file corruption check
    if (fileBuffer.length < 24) {
      throw new WalrusError('Invalid file: too small to be valid');
    }

    const mimeType = this.detectMimeType(fileBuffer as any);

    // For images, perform additional checks
    if (mimeType.startsWith('image/')) {
      try {
        // Validate image parsing
        const dimensions = sizeOf(fileBuffer as any);
        if (!dimensions.width || !dimensions.height) {
          throw new WalrusError('Invalid image dimensions');
        }

        // Optional EXIF validation for JPEG
        if (options.validateExif && mimeType === 'image/jpeg') {
          this.validateExif(fileBuffer as any);
        }
      } catch (error) {
        if (error instanceof WalrusError) throw error;
        throw new WalrusError(
          `Image content validation failed: ${error instanceof Error ? error.message : String(error as any)}`
        );
      }
    }

    // Optional metadata validation
    if (options.validateMetadata && this?.config?.requireMetadata) {
      // Implement metadata validation if needed
    }
  }

  private validateExif(buffer: Buffer): void {
    // Basic EXIF validation
    const exifHeader = buffer.toString('hex', 2, 4).toLowerCase();
    if (exifHeader !== 'ffe1') {
      return; // No EXIF data, which is fine
    }

    const exifData = buffer.slice(4, 10).toString('ascii');
    if (exifData !== 'Exif\0\0') {
      throw new WalrusError('Invalid EXIF data structure');
    }
  }
}
