import { FileValidator, FileValidationConfig } from '../../src/utils/FileValidator';

import * as fs from 'fs';
import sizeOf from 'image-size';

jest.mock('fs');
jest.mock('image-size', () => {
  return jest.fn().mockImplementation(() => ({ width: 800, height: 600 }));
});

class MockHash {
  update(_data: Buffer) { return this; }
  digest() { return 'test-checksum'; }
}

jest.mock('crypto', () => ({
  createHash: () => new MockHash()
}));

describe('FileValidator', () => {
  let validator: FileValidator;
  let mockBuffer: Buffer;
  const defaultConfig: FileValidationConfig = {
    maxSize: 1024 * 1024 * 10, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif'],
    minWidth: 100,
    minHeight: 100,
    maxWidth: 4000,
    maxHeight: 4000,
    allowedExtensions: ['jpg', 'jpeg', 'png', 'gif']
  };

  beforeEach(() => {
    jest.resetAllMocks();
    validator = new FileValidator(defaultConfig);

    mockBuffer = Buffer.from([
      0xFF, 0xD8, // JPEG SOI
      0xFF, 0xE1, // EXIF marker
      0x45, 0x78, 0x69, 0x66, // "Exif"
      0x00, 0x00  // Null terminator
    ]);

    (fs.readFileSync as jest.Mock).mockReturnValue(mockBuffer);
    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });

  describe('validateFile', () => {
    it('should validate a correct image file', async () => {
      Object.defineProperty(mockBuffer, 'length', { value: 1024 });
      (sizeOf as jest.Mock).mockReturnValueOnce({ width: 800, height: 600 });

      const result = await validator.validateFile('/test/image.jpg');

      expect(result).toEqual(expect.objectContaining({
        mimeType: 'image/jpeg',
        width: 800,
        height: 600,
        extension: 'jpg'
      }));
    });

    it('should reject file that is too large', async () => {
      Object.defineProperty(mockBuffer, 'length', { value: defaultConfig.maxSize + 1 });

      await expect(validator.validateFile('/test/large.jpg'))
        .rejects.toThrow(/exceeds maximum allowed size/);
    });

    it('should reject unsupported file type', async () => {
      // Create a mock buffer with an invalid mime type
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]); // Invalid header
      Object.defineProperty(invalidBuffer, 'length', { value: 100 });
      (fs.readFileSync as jest.Mock).mockReturnValue(invalidBuffer);
      jest.spyOn(validator as any, 'detectMimeType').mockReturnValueOnce('application/octet-stream');

      await expect(validator.validateFile('/test/file.txt'))
        .rejects.toThrow(/not allowed. Allowed types:/);
    });

    it('should reject file with invalid extension', async () => {

      await expect(validator.validateFile('/test/file.bmp'))
        .rejects.toThrow(/extension .bmp not allowed/);
    });

    it('should validate image dimensions', async () => {
      Object.defineProperty(mockBuffer, 'length', { value: 1024 });
      
      (sizeOf as jest.Mock).mockReturnValueOnce({ width: 50, height: 200 });
      await expect(validator.validateFile('/test/small.jpg'))
        .rejects.toThrow(/width 50px below minimum/);

      (sizeOf as jest.Mock).mockReturnValueOnce({ width: 200, height: 50 });
      await expect(validator.validateFile('/test/small.jpg'))
        .rejects.toThrow(/height 50px below minimum/);

      (sizeOf as jest.Mock).mockReturnValueOnce({ width: 5000, height: 200 });
      await expect(validator.validateFile('/test/large.jpg'))
        .rejects.toThrow(/width 5000px exceeds maximum/);

      (sizeOf as jest.Mock).mockReturnValueOnce({ width: 200, height: 5000 });
      await expect(validator.validateFile('/test/large.jpg'))
        .rejects.toThrow(/height 5000px exceeds maximum/);
    });
  });

  describe('validateFileContent', () => {
    it('should validate EXIF data structure', async () => {
      Object.defineProperty(mockBuffer, 'length', { value: 100 });
      (sizeOf as jest.Mock).mockReturnValueOnce({ width: 800, height: 600 });
      
      await expect(validator.validateFileContent('/test/image.jpg', { validateExif: true }))
        .resolves.not.toThrow();
    });

    it('should reject corrupt EXIF data', async () => {
      const badExifBuffer = Buffer.from([
        0xFF, 0xD8, // JPEG SOI
        0xFF, 0xE1, // EXIF marker
        0x00, 0x00, 0x00, 0x00, // Invalid EXIF data
        0x00, 0x00  // Null terminator
      ]);
      Object.defineProperty(badExifBuffer, 'length', { value: 100 });
      (fs.readFileSync as jest.Mock).mockReturnValue(badExifBuffer);
      (sizeOf as jest.Mock).mockReturnValueOnce({ width: 800, height: 600 });

      await expect(validator.validateFileContent('/test/image.jpg', { validateExif: true }))
        .rejects.toThrow(/Invalid EXIF data structure/);
    });

    it('should validate file minimum size', async () => {
      Object.defineProperty(mockBuffer, 'length', { value: 20 });

      await expect(validator.validateFileContent('/test/small.jpg'))
        .rejects.toThrow(/too small to be valid/);
    });
  });
});