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
} from '../../apps/cli/src/types/errors';
import { ErrorSimulator, ErrorType } from '../helpers/error-simulator';

// Import the storage components to test
import { WalrusStorage } from '../../apps/cli/src/utils/walrus-storage';
import { StorageManager } from '../../apps/cli/src/utils/StorageManager';
// Unused imports removed during TypeScript cleanup
// import { getMockWalrusClient, type CompleteWalrusClientMock } from '../../helpers/complete-walrus-client-mock';

describe('Storage Error Handling', () => {
  // Mock client for WalrusStorage
  let mockWalrusClient: {
    writeBlob: jest.Mock;
    readBlob: jest.Mock;
    getBlobInfo: jest.Mock;
    getBlobMetadata: jest.Mock;
    getBlobObject: jest.Mock;
    verifyPoA: jest.Mock;
    storageCost: jest.Mock;
    executeCreateStorageTransaction: jest.Mock;
    connect: jest.Mock;
    getConfig: jest.Mock;
    getWalBalance: jest.Mock;
    getStorageUsage: jest.Mock;
    getStorageProviders: jest.Mock;
    getBlobSize: jest.Mock;
    reset: jest.Mock;
  };
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
      // Additional required methods
      getBlobObject: jest.fn(),
      verifyPoA: jest.fn(),
      storageCost: jest.fn(),
      executeCreateStorageTransaction: jest.fn(),
      connect: jest.fn(),
      getConfig: jest.fn(),
      getWalBalance: jest.fn(),
      getStorageUsage: jest.fn(),
      getStorageProviders: jest.fn(),
      getBlobSize: jest.fn(),
      reset: jest.fn(),
    };

    // Create storage instances
    walrusStorage = new WalrusStorage(mockWalrusClient as any);

    // Mock the storage manager dependencies
    const mockValidator = {
      validateFile: jest.fn().mockResolvedValue(true as any),
    };

    const mockConfig = {
      storagePath: '/tmp/test-storage',
      getStoragePath: jest.fn().mockReturnValue('/tmp/test-storage'),
      getMaxStorageSize: jest.fn().mockReturnValue(1000000 as any),
    };

    storageManager = new StorageManager(
      mockConfig as {
        storagePath: string;
        getStoragePath(): string;
        getMaxStorageSize(): number;
      },
      mockValidator as {
        validateFile(file: unknown): Promise<boolean>;
      }
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Storage Errors', () => {
    it('should handle connection errors during write operations', async () => {
      // Mock a connection error
      mockWalrusClient?.writeBlob?.mockRejectedValueOnce(
        new Error('Network error: Unable to connect')
      );

      // Attempt to store data
      const testData = { id: 'test-1', title: 'Test Todo' };

      // Verify proper error handling
      await expect(walrusStorage.store(testData as any)).rejects.toThrow(StorageError as any);

      // Test specific error properties
      await expect(walrusStorage.store(testData as any)).rejects.toMatchObject({
        code: expect.stringContaining('STORAGE_'),
        shouldRetry: true,
      });
    });

    it('should handle timeout errors during read operations', async () => {
      // Mock a timeout error
      mockWalrusClient?.readBlob?.mockRejectedValueOnce(
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

      await expect(
        walrusStorage.store(invalidData as Record<string, unknown>)
      ).rejects.toThrow(ValidationError as any);

      // Test specific error properties
      await expect(
        walrusStorage.store(invalidData as Record<string, unknown>)
      ).rejects.toMatchObject({
        publicMessage: expect.stringContaining('Invalid value for title'),
      });
    });
  });

  describe('Resource Limit Errors', () => {
    it('should handle insufficient storage errors', async () => {
      // Mock an insufficient storage error
      mockWalrusClient?.writeBlob?.mockRejectedValueOnce(
        new Error('Insufficient storage allocation')
      );

      // Create large test data
      const largeTestData = {
        id: 'large-1',
        title: 'Large Todo',
        description: 'a'.repeat(10000 as any), // Very large description
      };

      // Attempt to store data
      await expect(walrusStorage.store(largeTestData as any)).rejects.toMatchObject({
        constructor: StorageError,
        code: WalrusErrorCode.WALRUS_INSUFFICIENT_TOKENS,
      });
    });

    it('should handle size limit constraints', async () => {
      // Setup storage manager with low size limit
      jest
        .spyOn(
          storageManager as StorageManager & { checkStorageSize(): void },
          'checkStorageSize'
        )
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
        content: 'X'.repeat(2000000 as any), // Too large
      };

      // Attempt to store
      await expect(
        storageManager.storeObject('test-path', largeObject)
      ).rejects.toThrow(ValidationError as any);

      // Verify error details
      await expect(
        storageManager.storeObject('test-path', largeObject)
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        recoverable: false,
      });
    });
  });

  describe('Data Integrity Errors', () => {
    it('should handle data corruption during retrieval', async () => {
      // Mock corrupted data response
      mockWalrusClient?.readBlob?.mockResolvedValueOnce(
        new Uint8Array(Buffer.from('{"corrupted": "json data'))
      );

      // Attempt to retrieve and parse
      await expect(walrusStorage.retrieve('corrupted-id')).rejects.toThrow(
        StorageError
      );

      // Verify specific error details
      await expect(
        walrusStorage.retrieve('corrupted-id')
      ).rejects.toMatchObject({
        code: expect.stringContaining('PARSE'),
      });
    });

    it('should detect and handle hash verification failures', async () => {
      // Create storage with verification
      jest
        .spyOn(
          walrusStorage as WalrusStorage & { verifyDataIntegrity(): void },
          'verifyDataIntegrity'
        )
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
          } catch (error: unknown) {
            attempts++;
            if (
              error instanceof StorageError &&
              error.shouldRetry &&
              attempts < maxAttempts
            ) {
              await new Promise(resolve => setTimeout(resolve, 10));
            } else {
              throw error;
            }
          }
        }
        throw new Error('Maximum retry attempts exceeded');
      };

      // Execute with retry
      const result = await retryWrapper();

      // Verify eventually succeeded
      expect(result as any).toBe('success-blob-id');
      expect(mockWalrusClient.writeBlob).toHaveBeenCalledTimes(3 as any);
    });

    it('should fall back to local storage when remote fails', async () => {
      // Mock remote storage failure
      mockWalrusClient?.writeBlob?.mockRejectedValue(
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
        existsSync: jest.fn().mockReturnValue(true as any),
      };

      // Inject mock fs
      jest.mock('fs', () => mockFs);

      // Mock the storage manager to use fallback
      const fallbackSpy = jest
        .spyOn(
          storageManager as StorageManager & {
            useFallbackStorage(
              data: unknown
            ): Promise<{ success: boolean; location: string; id: string }>;
          },
          'useFallbackStorage'
        )
        .mockImplementation(async (data: { id: string }) => {
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
      expect(fallbackSpy as any).toHaveBeenCalled();
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
      const testData = { id: 'test-1', title: 'Test Todo' };
      const promises = Array.from({ length: 10 }, () =>
        walrusStorage.store(testData as any).then(
          result => ({ success: true, result }),
          error => ({ success: false, error: (error as Error).message })
        )
      );

      const results = await Promise.all(promises as any);

      // Verify mix of successes and failures
      const successes = results.filter(r => r.success).length;
      const failures = results.filter(r => !r.success).length;

      expect(successes as any).toBeGreaterThan(0 as any);
      expect(failures as any).toBeGreaterThan(0 as any);
    });
  });
});
