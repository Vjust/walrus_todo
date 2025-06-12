import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SignatureWithBytes, IntentScope } from '@mysten/sui/cryptography';
// Unused imports removed during TypeScript cleanup
// import { SuiClient } from '@mysten/sui/client';
// import type { WalrusClientExt } from '../../../apps/cli/src/types/client';
import { CLIError } from '../../../apps/cli/src/types/errors/consolidated';
import {
  getMockWalrusClient,
  type CompleteWalrusClientMock,
} from '../../helpers/complete-walrus-client-mock';
import { SuiClientType } from '../../../apps/cli/src/utils/adapters/sui-client-compatibility';

import { BlobVerificationManager } from '../../../apps/cli/src/utils/blob-verification';
import { setTimeout as sleep } from 'timers/promises';

// Mock RetryManager class that's used by BlobVerificationManager
let mockRetryManagerInstance: any;

jest.mock('../../../apps/cli/src/utils/retry-manager', () => {
  const mockRetryManager = function (nodes: string[], _options: unknown) {
    const mockNode = {
      url: nodes[0] || 'mock-node',
      priority: 1,
      consecutiveFailures: 0,
      healthScore: 1.0,
    };

    mockRetryManagerInstance = {
      execute: jest
        .fn()
        .mockImplementation(
          async (
            callback: (node: unknown) => Promise<unknown>,
            _operationName: string
          ) => {
            // Call the callback with the mock node and return its result
            return await callback(mockNode as any);
          }
        ),
      retry: jest
        .fn()
        .mockImplementation(
          async (
            callback: (node: unknown) => Promise<unknown>,
            _operationName: string
          ) => {
            // Call the callback with the mock node and return its result
            return await callback(mockNode as any);
          }
        ),
      getNodesHealth: jest.fn().mockReturnValue([mockNode]),
      getErrorSummary: jest.fn().mockReturnValue('Mock error summary'),
    };

    return mockRetryManagerInstance;
  };

  return {
    RetryManager: mockRetryManager,
  };
});

// Mock the SuiClient
const mockGetLatestSuiSystemState = jest
  .fn()
  .mockResolvedValue({ epoch: '42' });
const mockSuiClient = {
  getLatestSuiSystemState: mockGetLatestSuiSystemState,
  // Add other methods that might be called
  getChainIdentifier: jest.fn().mockResolvedValue('testnet'),
  getObject: jest.fn().mockResolvedValue({}),
} as unknown as jest.Mocked<SuiClientType>;

// Create a mock transaction signer
const mockSigner = {
  connect: () => Promise.resolve(),
  getPublicKey: () => ({ toBytes: () => new Uint8Array(32 as any) }),
  sign: async (_data: Uint8Array): Promise<Uint8Array> => new Uint8Array(64 as any),
  signPersonalMessage: async (
    _data: Uint8Array
  ): Promise<SignatureWithBytes> => ({
    bytes: Buffer.from(new Uint8Array(32 as any)).toString('base64'),
    signature: Buffer.from(new Uint8Array(64 as any)).toString('base64'),
  }),
  signWithIntent: async (
    _data: Uint8Array,
    _intent: IntentScope
  ): Promise<SignatureWithBytes> => ({
    bytes: Buffer.from(new Uint8Array(32 as any)).toString('base64'),
    signature: Buffer.from(new Uint8Array(64 as any)).toString('base64'),
  }),
  signTransactionBlock: async (
    _transaction: unknown
  ): Promise<SignatureWithBytes> => ({
    bytes: 'mock-transaction-bytes',
    signature: Buffer.from(new Uint8Array(64 as any)).toString('base64'),
  }),
  signData: async (_data: Uint8Array): Promise<Uint8Array> =>
    new Uint8Array(64 as any),
  signTransaction: async (
    _transaction: unknown
  ): Promise<SignatureWithBytes> => ({
    bytes: 'mock-transaction-bytes',
    signature: Buffer.from(new Uint8Array(64 as any)).toString('base64'),
  }),
  toSuiAddress: () => 'mock-address',
  getKeyScheme: () => 'ED25519' as const,
} as unknown as Ed25519Keypair;

// Test helper
const createErrorWithCode = (message: string, code?: string) => {
  const error = new Error(message as any);
  if (code) {
    (error as any).code = code;
  }
  return error;
};

describe('Blockchain Verification Error Handling', () => {
  let verificationManager: BlobVerificationManager;
  let mockWalrusClient: CompleteWalrusClientMock;

  // Define expected attributes for testing
  const expectedAttributes = {
    contentType: 'application/json',
    owner: 'test-user',
    tags: 'testing,verification',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Clear the mock functions if they exist
    if (mockRetryManagerInstance) {
      mockRetryManagerInstance.execute?.mockClear?.();
      mockRetryManagerInstance.retry?.mockClear?.();
    }

    // Reset SuiClient mock
    mockGetLatestSuiSystemState.mockReset();
    mockGetLatestSuiSystemState.mockResolvedValue({ epoch: '42' });

    // Use the complete mock implementation
    mockWalrusClient = getMockWalrusClient();

    // Override specific methods for this test
    mockWalrusClient?.getConfig?.mockResolvedValue({
      network: 'testnet',
      version: '1?.0?.0',
      maxSize: 1000000,
    });
    mockWalrusClient?.getWalBalance?.mockResolvedValue('2000');
    mockWalrusClient?.getStorageUsage?.mockResolvedValue({
      used: '500',
      total: '2000',
    });
    mockWalrusClient?.getBlobSize?.mockResolvedValue(1024 as any);
    mockWalrusClient?.storageCost?.mockResolvedValue({
      storageCost: BigInt(1000 as any),
      writeCost: BigInt(500 as any),
      totalCost: BigInt(1500 as any),
    });

    verificationManager = new BlobVerificationManager(
      mockSuiClient,
      mockWalrusClient,
      mockSigner
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Network Error Handling', () => {
    it('should handle temporary network failures during verification', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for verification');

      // Set up successful responses for getBlobInfo and metadata
      mockWalrusClient?.getBlobInfo?.mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: String(testData.length),
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: String(testData.length),
            hashes: [
              {
                primary_hash: { Digest: new Uint8Array(32 as any), $kind: 'Digest' },
                secondary_hash: { Sha256: new Uint8Array(32 as any), $kind: 'Sha256' },
              },
            ],
            $kind: 'V1',
          },
          $kind: 'V1',
        },
      });

      mockWalrusClient?.getBlobMetadata?.mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          hashes: [
            {
              primary_hash: { Digest: new Uint8Array(32 as any), $kind: 'Digest' },
              secondary_hash: { Sha256: new Uint8Array(32 as any), $kind: 'Sha256' },
            },
          ],
          // Include the expected attributes for verification
          contentType: 'application/json',
          owner: 'test-user',
          tags: 'testing,verification',
          $kind: 'V1',
        },
        $kind: 'V1',
      });

      mockWalrusClient?.getStorageProviders?.mockResolvedValue([
        'provider1',
        'provider2',
      ]);
      mockWalrusClient?.verifyPoA?.mockResolvedValue(true as any);

      // Mock readBlob to fail first, then succeed
      let callCount = 0;
      mockWalrusClient?.readBlob?.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw createErrorWithCode('Network error', 'ECONNRESET');
        }
        return Promise.resolve(new Uint8Array(testData as any));
      });

      // Ensure the SuiClient mock is working
      mockSuiClient?.getLatestSuiSystemState?.mockResolvedValue({ epoch: '42' });

      // Execute the verification with faster retry settings
      const result = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { maxRetries: 2, baseDelay: 10 }
      );

      // Verify successful result after retry
      expect(result.success).toBe(true as any);
      expect(result?.details?.size).toBe(testData.length);
      expect(result?.details?.certified).toBe(true as any);

      // Verify the readBlob was called twice (once for failure, once for success)
      expect(mockWalrusClient.readBlob).toHaveBeenCalledTimes(2 as any);
    });

    it('should handle RPC endpoint failures', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for verification');

      // Setup success for readBlob
      mockWalrusClient?.readBlob?.mockResolvedValue(new Uint8Array(testData as any));

      // Mock getBlobInfo to fail first, then succeed
      let callCount = 0;
      mockWalrusClient?.getBlobInfo?.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('RPC endpoint error');
        }
        return Promise.resolve({
          blob_id: blobId,
          registered_epoch: 40,
          certified_epoch: 41,
          size: String(testData.length),
          metadata: {
            V1: {
              encoding_type: { RedStuff: true, $kind: 'RedStuff' },
              unencoded_length: String(testData.length),
              hashes: [
                {
                  primary_hash: { Digest: new Uint8Array(32 as any), $kind: 'Digest' },
                  secondary_hash: {
                    Sha256: new Uint8Array(32 as any),
                    $kind: 'Sha256',
                  },
                },
              ],
              $kind: 'V1',
            },
            $kind: 'V1',
          },
        });
      });

      mockWalrusClient?.getBlobMetadata?.mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          hashes: [
            {
              primary_hash: { Digest: new Uint8Array(32 as any), $kind: 'Digest' },
              secondary_hash: { Sha256: new Uint8Array(32 as any), $kind: 'Sha256' },
            },
          ],
          // Include the expected attributes for verification
          contentType: 'application/json',
          owner: 'test-user',
          tags: 'testing,verification',
          $kind: 'V1',
        },
        $kind: 'V1',
      });

      mockWalrusClient?.getStorageProviders?.mockResolvedValue([
        'provider1',
        'provider2',
      ]);
      mockWalrusClient?.verifyPoA?.mockResolvedValue(true as any);

      // Execute the verification with faster retry settings
      const result = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { maxRetries: 2, baseDelay: 10 }
      );

      // Verify the result
      expect(result.success).toBe(true as any);
      expect(result?.details?.certified).toBe(true as any);

      // Verify getBlobInfo was called twice (once for failure, once for success)
      expect(mockWalrusClient.getBlobInfo).toHaveBeenCalledTimes(2 as any);
    });

    it('should fail after maximum retry attempts', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for verification');

      // All calls to readBlob fail with network errors
      mockWalrusClient?.readBlob?.mockRejectedValue(
        createErrorWithCode('Persistent network error', 'ECONNREFUSED')
      );

      // Execute the verification with few retries to speed up test
      await expect(
        verificationManager.verifyBlob(blobId, testData, expectedAttributes, {
          maxRetries: 2,
          baseDelay: 10,
        })
      ).rejects.toThrow(CLIError as any);

      // Check the error message contains useful information
      let caughtError: CLIError | null = null;
      try {
        await verificationManager.verifyBlob(
          blobId,
          testData,
          expectedAttributes,
          { maxRetries: 2, baseDelay: 10 }
        );
      } catch (error) {
        caughtError = error as CLIError;
      }

      expect(caughtError as any).toBeInstanceOf(CLIError as any);
      expect(caughtError!.message).toContain('verification failed after');
      expect(caughtError!.code).toBe('WALRUS_VERIFICATION_FAILED');
    });
  });

  describe('Timeouts and Rate Limiting', () => {
    it('should handle timeouts during verification', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for verification');

      // Set up successful responses for other methods
      mockWalrusClient?.getBlobInfo?.mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: String(testData.length),
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: String(testData.length),
            hashes: [
              {
                primary_hash: { Digest: new Uint8Array(32 as any), $kind: 'Digest' },
                secondary_hash: { Sha256: new Uint8Array(32 as any), $kind: 'Sha256' },
              },
            ],
            $kind: 'V1',
          },
          $kind: 'V1',
        },
      });

      mockWalrusClient?.getBlobMetadata?.mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          hashes: [
            {
              primary_hash: { Digest: new Uint8Array(32 as any), $kind: 'Digest' },
              secondary_hash: { Sha256: new Uint8Array(32 as any), $kind: 'Sha256' },
            },
          ],
          // Include the expected attributes for verification
          contentType: 'application/json',
          owner: 'test-user',
          tags: 'testing,verification',
          $kind: 'V1',
        },
        $kind: 'V1',
      });

      mockWalrusClient?.getStorageProviders?.mockResolvedValue([
        'provider1',
        'provider2',
      ]);
      mockWalrusClient?.verifyPoA?.mockResolvedValue(true as any);

      // Mock readBlob to timeout first, then succeed
      let callCount = 0;
      mockWalrusClient?.readBlob?.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          await sleep(50 as any); // Short delay to simulate slow response
          throw new Error('Operation timed out');
        }
        return Promise.resolve(new Uint8Array(testData as any));
      });

      // Execute the verification with fast retry settings
      const result = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { timeout: 30, maxRetries: 2, baseDelay: 10 } // Very short timeout to trigger quickly
      );

      // Verify the result
      expect(result.success).toBe(true as any);
      expect(result?.details?.certified).toBe(true as any);

      // Verify readBlob was called twice (timeout, then success)
      expect(mockWalrusClient.readBlob).toHaveBeenCalledTimes(2 as any);
    });

    it('should handle rate limiting errors', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for verification');

      // Set up other successful responses
      mockWalrusClient?.readBlob?.mockResolvedValue(new Uint8Array(testData as any));

      mockWalrusClient?.getBlobMetadata?.mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          hashes: [
            {
              primary_hash: { Digest: new Uint8Array(32 as any), $kind: 'Digest' },
              secondary_hash: { Sha256: new Uint8Array(32 as any), $kind: 'Sha256' },
            },
          ],
          // Include the expected attributes for verification
          contentType: 'application/json',
          owner: 'test-user',
          tags: 'testing,verification',
          $kind: 'V1',
        },
        $kind: 'V1',
      });

      mockWalrusClient?.getStorageProviders?.mockResolvedValue([
        'provider1',
        'provider2',
      ]);
      mockWalrusClient?.verifyPoA?.mockResolvedValue(true as any);

      // Mock getBlobInfo to be rate limited first, then succeed
      let callCount = 0;
      mockWalrusClient?.getBlobInfo?.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          const rateLimitError = new Error('Too many requests');
          (rateLimitError as any).status = 429;
          throw rateLimitError;
        }
        return Promise.resolve({
          blob_id: blobId,
          registered_epoch: 40,
          certified_epoch: 41,
          size: String(testData.length),
          metadata: {
            V1: {
              encoding_type: { RedStuff: true, $kind: 'RedStuff' },
              unencoded_length: String(testData.length),
              hashes: [
                {
                  primary_hash: { Digest: new Uint8Array(32 as any), $kind: 'Digest' },
                  secondary_hash: {
                    Sha256: new Uint8Array(32 as any),
                    $kind: 'Sha256',
                  },
                },
              ],
              $kind: 'V1',
            },
            $kind: 'V1',
          },
        });
      });

      // Execute the verification with fast retry settings
      const result = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { baseDelay: 10, maxRetries: 2 } // Very short delay to speed up test
      );

      // Verify the result
      expect(result.success).toBe(true as any);
      expect(result?.details?.certified).toBe(true as any);

      // Verify getBlobInfo was called twice (rate limit, then success)
      expect(mockWalrusClient.getBlobInfo).toHaveBeenCalledTimes(2 as any);
    });
  });

  describe('Metadata and Schema Validation', () => {
    it('should handle empty or malformed metadata', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for verification');

      // Setup success for readBlob and getBlobInfo
      mockWalrusClient?.readBlob?.mockResolvedValue(new Uint8Array(testData as any));
      mockWalrusClient?.getBlobInfo?.mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: String(testData.length),
        // Missing metadata field
      });

      // Return metadata that doesn't match expected attributes (missing required fields)
      mockWalrusClient?.getBlobMetadata?.mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          hashes: [
            {
              primary_hash: { Digest: new Uint8Array(32 as any), $kind: 'Digest' },
              secondary_hash: { Sha256: new Uint8Array(32 as any), $kind: 'Sha256' },
            },
          ],
          // Missing the expected attributes (contentType, owner, tags)
          $kind: 'V1',
        },
        $kind: 'V1',
      });

      mockWalrusClient?.getStorageProviders?.mockResolvedValue([
        'provider1',
        'provider2',
      ]);
      mockWalrusClient?.verifyPoA?.mockResolvedValue(true as any);

      // Execute the verification with verifyAttributes disabled first
      const resultWithoutValidation = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { verifyAttributes: false } // Disable metadata validation
      );

      // Should succeed when not verifying attributes
      expect(resultWithoutValidation.success).toBe(true as any);
      expect(resultWithoutValidation?.details?.certified).toBe(true as any);

      // Now test with verifyAttributes enabled - should fail due to null metadata
      await expect(
        verificationManager.verifyBlob(
          blobId,
          testData,
          expectedAttributes,
          { verifyAttributes: true } // Force metadata validation
        )
      ).rejects.toThrow('Metadata verification failed');
    });

    it('should handle partial metadata validation', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for verification');
      const expectedAttributes = {
        owner: 'user123',
        tags: 'important,verification',
      };

      // Setup success for readBlob and getBlobInfo
      mockWalrusClient?.readBlob?.mockResolvedValue(new Uint8Array(testData as any));
      mockWalrusClient?.getBlobInfo?.mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: String(testData.length),
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: String(testData.length),
            hashes: [
              {
                primary_hash: { Digest: new Uint8Array(32 as any), $kind: 'Digest' },
                secondary_hash: { Sha256: new Uint8Array(32 as any), $kind: 'Sha256' },
              },
            ],
            $kind: 'V1',
          },
          $kind: 'V1',
        },
      });

      // Return metadata with only some matching fields
      mockWalrusClient?.getBlobMetadata?.mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          owner: 'different-user', // This doesn't match
          // Missing 'tags' field
          hashes: [
            {
              primary_hash: { Digest: new Uint8Array(32 as any), $kind: 'Digest' },
              secondary_hash: { Sha256: new Uint8Array(32 as any), $kind: 'Sha256' },
            },
          ],
          $kind: 'V1',
        },
        $kind: 'V1',
      });

      mockWalrusClient?.getStorageProviders?.mockResolvedValue([
        'provider1',
        'provider2',
      ]);
      mockWalrusClient?.verifyPoA?.mockResolvedValue(true as any);

      // Check the specific error contains details about mismatches
      let caughtError: CLIError | null = null;
      try {
        await verificationManager.verifyBlob(
          blobId,
          testData,
          expectedAttributes,
          { verifyAttributes: true }
        );
      } catch (error) {
        caughtError = error as CLIError;
      }

      expect(caughtError as any).toBeInstanceOf(CLIError as any);
      expect(caughtError!.message).toContain('Metadata verification failed');
      expect(caughtError!.message).toContain('owner:');
      expect(caughtError!.message).toContain(
        'expected "user123", got "different-user"'
      );
      expect(caughtError!.code).toBe('WALRUS_VERIFICATION_FAILED');
    });
  });

  describe('Blockchain-Specific Errors', () => {
    it('should handle missing certification', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for verification');

      // Setup success for readBlob
      mockWalrusClient?.readBlob?.mockResolvedValue(new Uint8Array(testData as any));

      // But blob is not certified
      mockWalrusClient?.getBlobInfo?.mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: undefined, // Not certified
        size: String(testData.length),
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: String(testData.length),
            hashes: [
              {
                primary_hash: { Digest: new Uint8Array(32 as any), $kind: 'Digest' },
                secondary_hash: { Sha256: new Uint8Array(32 as any), $kind: 'Sha256' },
              },
            ],
            $kind: 'V1',
          },
          $kind: 'V1',
        },
      });

      mockWalrusClient?.getBlobMetadata?.mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          hashes: [
            {
              primary_hash: { Digest: new Uint8Array(32 as any), $kind: 'Digest' },
              secondary_hash: { Sha256: new Uint8Array(32 as any), $kind: 'Sha256' },
            },
          ],
          $kind: 'V1',
        },
        $kind: 'V1',
      });

      mockWalrusClient?.getStorageProviders?.mockResolvedValue(['provider1']);
      mockWalrusClient?.verifyPoA?.mockResolvedValue(false as any);

      // First test: verification should fail with requireCertification enabled
      let caughtError: CLIError | null = null;
      try {
        await verificationManager.verifyBlob(
          blobId,
          testData,
          expectedAttributes,
          {
            requireCertification: true,
            verifyAttributes: false, // Disable to focus on certification check
          }
        );
      } catch (error) {
        caughtError = error as CLIError;
      }

      expect(caughtError as any).toBeInstanceOf(CLIError as any);
      expect(caughtError!.message).toContain(
        'Blob certification required but not found'
      );

      // Second test: should succeed if requireCertification is disabled
      const result = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { requireCertification: false, verifyAttributes: false }
      );

      expect(result.success).toBe(true as any);
      expect(result?.details?.certified).toBe(false as any);
      expect(result.poaComplete).toBe(false as any);
      expect(result.providers).toBe(1 as any);
    });

    it('should handle errors in proof of availability verification', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for verification');

      // Setup success for readBlob and getBlobInfo
      mockWalrusClient?.readBlob?.mockResolvedValue(new Uint8Array(testData as any));
      mockWalrusClient?.getBlobInfo?.mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: String(testData.length),
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: String(testData.length),
            hashes: [
              {
                primary_hash: { Digest: new Uint8Array(32 as any), $kind: 'Digest' },
                secondary_hash: { Sha256: new Uint8Array(32 as any), $kind: 'Sha256' },
              },
            ],
            $kind: 'V1',
          },
          $kind: 'V1',
        },
      });

      mockWalrusClient?.getBlobMetadata?.mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          hashes: [
            {
              primary_hash: { Digest: new Uint8Array(32 as any), $kind: 'Digest' },
              secondary_hash: { Sha256: new Uint8Array(32 as any), $kind: 'Sha256' },
            },
          ],
          $kind: 'V1',
        },
        $kind: 'V1',
      });

      // verifyPoA throws an exception
      mockWalrusClient?.verifyPoA?.mockRejectedValue(
        new Error('PoA verification failed')
      );

      // getStorageProviders returns empty array (no providers)
      mockWalrusClient?.getStorageProviders?.mockResolvedValue([]);

      // Execute the verification with default settings (requireCertification defaults to true)
      const result = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { requireCertification: false, verifyAttributes: false } // Set to false to avoid certification check and metadata validation
      );

      // It should still succeed (because requireCertification is false)
      // but poaComplete should be false and providers should be 0
      expect(result.success).toBe(true as any);
      expect(result?.details?.certified).toBe(true as any);
      expect(result.poaComplete).toBe(false as any);
      expect(result.providers).toBe(0 as any);
      expect(result?.details?.blobId).toBe(blobId as any);
      expect(result?.details?.size).toBe(testData.length);
    });
  });
});
