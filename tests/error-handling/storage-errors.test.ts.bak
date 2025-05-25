/**
 * Storage Error Handling Tests
 *
 * Tests the application's handling of various storage-related errors
 * including connection issues, validation errors, and resource limits.
 */

import {
  StorageError,
  ValidationError,
  WalrusErrorCode,
} from '../../src/types/errors';
import { ErrorSimulator, ErrorType } from '../helpers/error-simulator';

// Import the storage components to test
import { WalrusStorage } from '../../src/utils/walrus-storage';
import { StorageManager } from '../../src/utils/StorageManager';

describe('Storage Error Handling', () => {
  // Mock client for WalrusStorage
  let mockWalrusClient: any;
  let walrusStorage: WalrusStorage;
  let storageManager: StorageManager;

  beforeEach(() => {
    // Setup mock client
    mockWalrusClient = {
      writeBlob: jest.fn().mockResolvedValue('mock-blob-id'),
      readBlob: jest
        .fn()
        .mockResolvedValue(new Uint8Array(Buffer.from('mock data'))),
      getBlobInfo: jest.fn().mockResolvedValue({
        blob_id: 'mock-blob-id',
        registered_epoch: 10,
        certified_epoch: 11,
        size: '9',
      }),
      getBlobMetadata: jest.fn().mockResolvedValue({
        contentType: 'application/json',
      }),
    };

    // Create storage instances
    walrusStorage = new WalrusStorage(mockWalrusClient);

    // Mock the storage manager dependencies
    const mockValidator = {
      validateFile: jest.fn().mockResolvedValue(true),
    };

    const mockConfig = {
      storagePath: '/tmp/test-storage',
      getStoragePath: jest.fn().mockReturnValue('/tmp/test-storage'),
      getMaxStorageSize: jest.fn().mockReturnValue(1000000),
    };

    storageManager = new StorageManager(
      mockConfig as any,
      mockValidator as any
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Storage Errors', () => {
    it('should handle connection errors during write operations', async () => {
      // Mock a connection error
      mockWalrusClient.writeBlob.mockRejectedValueOnce(
        new Error('Network error: Unable to connect')
      );

      // Attempt to store data
      const testData = { id: 'test-1', title: 'Test Todo' };

      // Verify proper error handling
      await expect(walrusStorage.store(testData)).rejects.toThrow(StorageError);

      // Test specific error properties
      try {
        await walrusStorage.store(testData);
      } catch (error: any) {
        expect(error.code).toContain('STORAGE_');
        expect(error.shouldRetry).toBe(true);
      }
    });

    it('should handle timeout errors during read operations', async () => {
      // Mock a timeout error
      mockWalrusClient.readBlob.mockRejectedValueOnce(
        new Error('Request timed out after 30000ms')
      );

      // Attempt to retrieve data
      await expect(walrusStorage.retrieve('mock-blob-id')).rejects.toThrow(
        StorageError
      );
    });

    it('should handle validation errors for invalid data', async () => {
      // Create an error simulator for validation failures
      const errorSimulator = new ErrorSimulator({
        enabled: true,
        errorType: ErrorType.VALIDATION,
        errorMessage: 'Invalid todo data: missing required fields',
        additionalContext: {
          field: 'title',
          constraint: 'required',
        },
      });

      // Apply simulator to storage methods
      errorSimulator.simulateErrorOnMethod(
        walrusStorage,
        'store',
        'validateTodo'
      );

      // Attempt to store invalid data
      const invalidData = {
        /* missing required fields */
      };

      await expect(walrusStorage.store(invalidData as any)).rejects.toThrow(
        ValidationError
      );

      // Test specific error properties
      try {
        await walrusStorage.store(invalidData as any);
      } catch (error: any) {
        expect(error.publicMessage).toContain('Invalid value for title');
      }
    });
  });

  describe('Resource Limit Errors', () => {
    it('should handle insufficient storage errors', async () => {
      // Mock an insufficient storage error
      mockWalrusClient.writeBlob.mockRejectedValueOnce(
        new Error('Insufficient storage allocation')
      );

      // Create large test data
      const largeTestData = {
        id: 'large-1',
        title: 'Large Todo',
        description: 'a'.repeat(10000), // Very large description
      };

      // Attempt to store data
      try {
        await walrusStorage.store(largeTestData);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).toBeInstanceOf(StorageError);
        expect(error.code).toBe(WalrusErrorCode.WALRUS_INSUFFICIENT_TOKENS);
      }
    });

    it('should handle size limit constraints', async () => {
      // Setup storage manager with low size limit
      const checkSizeSpy = jest
        .spyOn(storageManager as any, 'checkStorageSize')
        .mockImplementation(() => {
          throw new ValidationError('Data exceeds maximum allowed size', {
            field: 'size',
            constraint: 'maxSize',
            recoverable: false,
          });
        });

      // Create large test data
      const largeObject = {
        id: 'huge-file',
        content: 'X'.repeat(2000000), // Too large
      };

      // Attempt to store
      await expect(
        storageManager.storeObject('test-path', largeObject)
      ).rejects.toThrow(ValidationError);

      // Verify error details
      try {
        await storageManager.storeObject('test-path', largeObject);
      } catch (error: any) {
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.recoverable).toBe(false);
      }
    });
  });

  describe('Data Integrity Errors', () => {
    it('should handle data corruption during retrieval', async () => {
      // Mock corrupted data response
      mockWalrusClient.readBlob.mockResolvedValueOnce(
        new Uint8Array(Buffer.from('{"corrupted": "json data'))
      );

      // Attempt to retrieve and parse
      await expect(walrusStorage.retrieve('corrupted-id')).rejects.toThrow(
        StorageError
      );

      // Verify specific error details
      try {
        await walrusStorage.retrieve('corrupted-id');
      } catch (error: any) {
        expect(error.code).toContain('PARSE');
      }
    });

    it('should detect and handle hash verification failures', async () => {
      // Create storage with verification
      const verifyingSpy = jest
        .spyOn(walrusStorage as any, 'verifyDataIntegrity')
        .mockImplementation(() => {
          throw new StorageError('Data integrity check failed: hash mismatch', {
            operation: 'verify',
            recoverable: false,
          });
        });

      // Attempt retrieval with verification
      await expect(
        walrusStorage.retrieveWithVerification('test-id')
      ).rejects.toThrow(/integrity check failed/);
    });
  });

  describe('Error Recovery', () => {
    it('should retry transient storage errors', async () => {
      // Mock temporary failures followed by success
      mockWalrusClient.writeBlob
        .mockRejectedValueOnce(new Error('Temporary service unavailable'))
        .mockRejectedValueOnce(new Error('Temporary service unavailable'))
        .mockResolvedValueOnce('success-blob-id');

      // Create retry wrapper for testing
      const retryWrapper = async () => {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          try {
            return await walrusStorage.store({
              id: 'retry-test',
              title: 'Retry Test',
            });
          } catch (error: any) {
            if (
              error instanceof StorageError &&
              error.shouldRetry &&
              attempts < maxAttempts - 1
            ) {
              attempts++;
              await new Promise(resolve => setTimeout(resolve, 10));
            } else {
              throw error;
            }
          }
        }
      };

      // Execute with retry
      const result = await retryWrapper();

      // Verify eventually succeeded
      expect(result).toBe('success-blob-id');
      expect(mockWalrusClient.writeBlob).toHaveBeenCalledTimes(3);
    });

    it('should fall back to local storage when remote fails', async () => {
      // Mock remote storage failure
      mockWalrusClient.writeBlob.mockRejectedValue(
        new Error('Remote storage unavailable')
      );

      // Mock filesystem operations
      const mockFs = {
        writeFileSync: jest.fn(),
        readFileSync: jest
          .fn()
          .mockReturnValue(
            JSON.stringify({ id: 'local-1', title: 'Local Todo' })
          ),
        existsSync: jest.fn().mockReturnValue(true),
      };

      // Inject mock fs
      jest.mock('fs', () => mockFs);

      // Mock the storage manager to use fallback
      const fallbackSpy = jest
        .spyOn(storageManager as any, 'useFallbackStorage')
        .mockImplementation(async data => {
          // Simulate local storage success
          return { success: true, location: 'local', id: data.id };
        });

      // Attempt storage with fallback
      const result = await storageManager.storeObject(
        'test-path',
        { id: 'test-1', title: 'Test Todo' },
        { useFallback: true }
      );

      // Verify fallback was used
      expect(result.location).toBe('local');
      expect(fallbackSpy).toHaveBeenCalled();
    });
  });

  describe('Error Simulation Integration', () => {
    it('should handle complex error scenarios with error simulator', async () => {
      // Create intermittent error simulator
      const errorSimulator = new ErrorSimulator({
        enabled: true,
        errorType: ErrorType.STORAGE,
        probability: 0.5,
        shouldRetry: true,
        errorMessage: 'Simulated storage error',
        recoveryProbability: 0.5, // 50% chance to recover
        recoveryDelay: 50,
        additionalContext: {
          operation: 'write',
          blobId: 'test-id',
        },
      });

      // Apply simulator to storage method
      errorSimulator.simulateErrorOnMethod(walrusStorage, 'store', 'storeData');

      // Make multiple store attempts
      const results = [];
      const testData = { id: 'test-1', title: 'Test Todo' };

      for (let i = 0; i < 10; i++) {
        try {
          const result = await walrusStorage.store(testData);
          results.push({ success: true, result });
        } catch (error: any) {
          results.push({ success: false, error: error.message });
        }
      }

      // Verify mix of successes and failures
      const successes = results.filter(r => r.success).length;
      const failures = results.filter(r => !r.success).length;

      expect(successes).toBeGreaterThan(0);
      expect(failures).toBeGreaterThan(0);
    });
  });
});
