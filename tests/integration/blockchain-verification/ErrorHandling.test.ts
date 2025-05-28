import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SignatureWithBytes, IntentScope } from '@mysten/sui/cryptography';
// Unused imports removed during TypeScript cleanup
// import { SuiClient } from '@mysten/sui/client';
// import type { WalrusClientExt } from '../../../src/types/client';
import { CLIError } from '../../../apps/cli/src/types/errors/consolidated';
import { getMockWalrusClient, type CompleteWalrusClientMock } from '../../helpers/complete-walrus-client-mock';
import { SuiClientType } from '../../../apps/cli/src/utils/adapters/sui-client-compatibility';

import { BlobVerificationManager } from '../../../apps/cli/src/utils/blob-verification';
import { setTimeout as sleep } from 'timers/promises';

// Mock RetryManager class that's used by BlobVerificationManager
jest.mock('../../../apps/cli/src/utils/retry-manager', () => {
  return {
    RetryManager: jest.fn().mockImplementation((nodes, _options) => ({
      execute: jest
        .fn()
        .mockImplementation(async (callback, _operationName) => {
          return await callback(nodes[0]);
        }),
    })),
  };
});

// Mock the SuiClient
const mockGetLatestSuiSystemState = jest
  .fn()
  .mockResolvedValue({ epoch: '42' });
const mockSuiClient = {
  getLatestSuiSystemState: mockGetLatestSuiSystemState,
} as unknown as jest.Mocked<SuiClientType>;

// Create a mock transaction signer
const mockSigner = {
  connect: () => Promise.resolve(),
  getPublicKey: () => ({ toBytes: () => new Uint8Array(32) }),
  sign: async (_data: Uint8Array): Promise<Uint8Array> => new Uint8Array(64),
  signPersonalMessage: async (
    _data: Uint8Array
  ): Promise<SignatureWithBytes> => ({
    bytes: Buffer.from(new Uint8Array(32)).toString('base64'),
    signature: Buffer.from(new Uint8Array(64)).toString('base64'),
  }),
  signWithIntent: async (
    _data: Uint8Array,
    _intent: IntentScope
  ): Promise<SignatureWithBytes> => ({
    bytes: Buffer.from(new Uint8Array(32)).toString('base64'),
    signature: Buffer.from(new Uint8Array(64)).toString('base64'),
  }),
  signTransactionBlock: async (
    _transaction: unknown
  ): Promise<SignatureWithBytes> => ({
    bytes: 'mock-transaction-bytes',
    signature: Buffer.from(new Uint8Array(64)).toString('base64'),
  }),
  signData: async (_data: Uint8Array): Promise<Uint8Array> =>
    new Uint8Array(64),
  signTransaction: async (_transaction: unknown): Promise<SignatureWithBytes> => ({
    bytes: 'mock-transaction-bytes',
    signature: Buffer.from(new Uint8Array(64)).toString('base64'),
  }),
  toSuiAddress: () => 'mock-address',
  getKeyScheme: () => 'ED25519' as const,
} as unknown as Ed25519Keypair;

// Test helper
const createErrorWithCode = (message: string, code?: string) => {
  const error = new Error(message);
  if (code) {
    (error as any).code = code;
  }
  return error;
};

describe('Blockchain Verification Error Handling', () => {
  let verificationManager: BlobVerificationManager;
  let mockWalrusClient: CompleteWalrusClientMock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Use the complete mock implementation
    mockWalrusClient = getMockWalrusClient();
    
    // Override specific methods for this test
    mockWalrusClient.getConfig.mockResolvedValue({
      network: 'testnet',
      version: '1.0.0',
      maxSize: 1000000,
    });
    mockWalrusClient.getWalBalance.mockResolvedValue('2000');
    mockWalrusClient.getStorageUsage.mockResolvedValue({ used: '500', total: '2000' });
    mockWalrusClient.getBlobSize.mockResolvedValue(1024);
    mockWalrusClient.storageCost.mockResolvedValue({
      storageCost: BigInt(1000),
      writeCost: BigInt(500),
      totalCost: BigInt(1500),
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

      // First call fails with a network error, second call succeeds
      mockWalrusClient.readBlob
        .mockRejectedValueOnce(
          createErrorWithCode('Network error', 'ECONNRESET')
        )
        .mockResolvedValueOnce(new Uint8Array(testData));

      mockWalrusClient.getBlobInfo.mockResolvedValue({
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
                primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
                secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' },
              },
            ],
            $kind: 'V1',
          },
          $kind: 'V1',
        },
      });

      mockWalrusClient.getBlobMetadata.mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          hashes: [
            {
              primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
              secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' },
            },
          ],
          $kind: 'V1',
        },
        $kind: 'V1',
      });

      mockWalrusClient.getStorageProviders.mockResolvedValue([
        'provider1',
        'provider2',
      ]);
      mockWalrusClient.verifyPoA.mockResolvedValue(true);

      // Execute the verification
      const result = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes
      );

      // Verify successful result after retry
      expect(result.success).toBe(true);

      // Verify the readBlob was called twice (once for failure, once for success)
      expect(mockWalrusClient.readBlob).toHaveBeenCalledTimes(2);
    });

    it('should handle RPC endpoint failures', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for verification');

      // Setup success for readBlob
      mockWalrusClient.readBlob.mockResolvedValue(new Uint8Array(testData));

      // First call to getBlobInfo fails with RPC error, second call succeeds
      mockWalrusClient.getBlobInfo
        .mockRejectedValueOnce(new Error('RPC endpoint error'))
        .mockResolvedValueOnce({
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
                  primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
                  secondary_hash: {
                    Sha256: new Uint8Array(32),
                    $kind: 'Sha256',
                  },
                },
              ],
              $kind: 'V1',
            },
            $kind: 'V1',
          },
        });

      mockWalrusClient.getBlobMetadata.mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          hashes: [
            {
              primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
              secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' },
            },
          ],
          $kind: 'V1',
        },
        $kind: 'V1',
      });

      mockWalrusClient.getStorageProviders.mockResolvedValue([
        'provider1',
        'provider2',
      ]);
      mockWalrusClient.verifyPoA.mockResolvedValue(true);

      // Execute the verification
      const result = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes
      );

      // Verify the result
      expect(result.success).toBe(true);

      // Verify getBlobInfo was called twice
      expect(mockWalrusClient.getBlobInfo).toHaveBeenCalledTimes(2);
    });

    it('should fail after maximum retry attempts', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for verification');

      // All calls to readBlob fail with network errors
      mockWalrusClient.readBlob.mockRejectedValue(
        createErrorWithCode('Persistent network error', 'ECONNREFUSED')
      );

      // Execute the verification with few retries to speed up test
      await expect(
        verificationManager.verifyBlob(blobId, testData, expectedAttributes, {
          maxRetries: 2,
          baseDelay: 10,
        })
      ).rejects.toThrow(CLIError);

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
      
      expect(caughtError).toBeInstanceOf(CLIError);
      expect(caughtError!.message).toContain('verification failed after');
      expect(caughtError!.code).toBe('WALRUS_VERIFICATION_FAILED');
    });
  });

  describe('Timeouts and Rate Limiting', () => {
    it('should handle timeouts during verification', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for verification');

      // First call times out, second call succeeds
      mockWalrusClient.readBlob
        .mockImplementationOnce(async () => {
          await sleep(500); // Simulate a slow response
          throw new Error('Timeout');
        })
        .mockResolvedValueOnce(new Uint8Array(testData));

      mockWalrusClient.getBlobInfo.mockResolvedValue({
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
                primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
                secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' },
              },
            ],
            $kind: 'V1',
          },
          $kind: 'V1',
        },
      });

      mockWalrusClient.getBlobMetadata.mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          hashes: [
            {
              primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
              secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' },
            },
          ],
          $kind: 'V1',
        },
        $kind: 'V1',
      });

      mockWalrusClient.getStorageProviders.mockResolvedValue([
        'provider1',
        'provider2',
      ]);
      mockWalrusClient.verifyPoA.mockResolvedValue(true);

      // Execute the verification with a short timeout
      const result = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { timeout: 100 } // Short timeout to trigger failure quickly
      );

      // Verify the result
      expect(result.success).toBe(true);

      // Verify readBlob was called twice
      expect(mockWalrusClient.readBlob).toHaveBeenCalledTimes(2);
    });

    it('should handle rate limiting errors', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for verification');

      // First call gets rate limited, second call succeeds
      mockWalrusClient.getBlobInfo
        .mockRejectedValueOnce({
          message: 'Too many requests',
          status: 429,
        })
        .mockResolvedValueOnce({
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
                  primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
                  secondary_hash: {
                    Sha256: new Uint8Array(32),
                    $kind: 'Sha256',
                  },
                },
              ],
              $kind: 'V1',
            },
            $kind: 'V1',
          },
        });

      mockWalrusClient.readBlob.mockResolvedValue(new Uint8Array(testData));

      mockWalrusClient.getBlobMetadata.mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          hashes: [
            {
              primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
              secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' },
            },
          ],
          $kind: 'V1',
        },
        $kind: 'V1',
      });

      mockWalrusClient.getStorageProviders.mockResolvedValue([
        'provider1',
        'provider2',
      ]);
      mockWalrusClient.verifyPoA.mockResolvedValue(true);

      // Execute the verification
      const result = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { baseDelay: 10 } // Very short delay to speed up test
      );

      // Verify the result
      expect(result.success).toBe(true);

      // Verify getBlobInfo was called twice
      expect(mockWalrusClient.getBlobInfo).toHaveBeenCalledTimes(2);
    });
  });

  describe('Metadata and Schema Validation', () => {
    it('should handle empty or malformed metadata', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for verification');

      // Setup success for readBlob and getBlobInfo
      mockWalrusClient.readBlob.mockResolvedValue(new Uint8Array(testData));
      mockWalrusClient.getBlobInfo.mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: String(testData.length),
        // Missing metadata field
      });

      // Return null for metadata
      mockWalrusClient.getBlobMetadata.mockResolvedValue(null);

      mockWalrusClient.getStorageProviders.mockResolvedValue([
        'provider1',
        'provider2',
      ]);
      mockWalrusClient.verifyPoA.mockResolvedValue(true);

      // Execute the verification
      const result = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { verifyAttributes: true } // Force metadata validation
      );

      // Verification should fail due to metadata mismatch
      expect(result.success).toBe(false);
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
      mockWalrusClient.readBlob.mockResolvedValue(new Uint8Array(testData));
      mockWalrusClient.getBlobInfo.mockResolvedValue({
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
                primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
                secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' },
              },
            ],
            $kind: 'V1',
          },
          $kind: 'V1',
        },
      });

      // Return metadata with only some matching fields
      mockWalrusClient.getBlobMetadata.mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          owner: 'different-user', // This doesn't match
          // Missing 'tags' field
          $kind: 'V1',
        },
        $kind: 'V1',
      });

      mockWalrusClient.getStorageProviders.mockResolvedValue([
        'provider1',
        'provider2',
      ]);
      mockWalrusClient.verifyPoA.mockResolvedValue(true);

      // Execute the verification with verifyAttributes enabled
      await expect(
        verificationManager.verifyBlob(blobId, testData, expectedAttributes, {
          verifyAttributes: true,
        })
      ).rejects.toThrow(CLIError);

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
      
      expect(caughtError).toBeInstanceOf(CLIError);
      expect(caughtError!.message).toContain('Metadata verification failed');
      expect(caughtError!.message).toContain('owner:');
      expect(caughtError!.message).toContain('expected "user123", got "different-user"');
    });
  });

  describe('Blockchain-Specific Errors', () => {
    it('should handle missing certification', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for verification');

      // Setup success for readBlob
      mockWalrusClient.readBlob.mockResolvedValue(new Uint8Array(testData));

      // But blob is not certified
      mockWalrusClient.getBlobInfo.mockResolvedValue({
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
                primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
                secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' },
              },
            ],
            $kind: 'V1',
          },
          $kind: 'V1',
        },
      });

      mockWalrusClient.getBlobMetadata.mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          hashes: [
            {
              primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
              secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' },
            },
          ],
          $kind: 'V1',
        },
        $kind: 'V1',
      });

      mockWalrusClient.getStorageProviders.mockResolvedValue(['provider1']);
      mockWalrusClient.verifyPoA.mockResolvedValue(false);

      // Execute the verification with requireCertification enabled
      await expect(
        verificationManager.verifyBlob(blobId, testData, expectedAttributes, {
          requireCertification: true,
        })
      ).rejects.toThrow(CLIError);

      // But it should succeed if requireCertification is disabled
      const result = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { requireCertification: false }
      );

      expect(result.success).toBe(true);
      expect(result.details.certified).toBe(false);
    });

    it('should handle errors in proof of availability verification', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for verification');

      // Setup success for readBlob and getBlobInfo
      mockWalrusClient.readBlob.mockResolvedValue(new Uint8Array(testData));
      mockWalrusClient.getBlobInfo.mockResolvedValue({
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
                primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
                secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' },
              },
            ],
            $kind: 'V1',
          },
          $kind: 'V1',
        },
      });

      mockWalrusClient.getBlobMetadata.mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          hashes: [
            {
              primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
              secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' },
            },
          ],
          $kind: 'V1',
        },
        $kind: 'V1',
      });

      // verifyPoA throws an exception
      mockWalrusClient.verifyPoA.mockRejectedValue(
        new Error('PoA verification failed')
      );

      // getStorageProviders returns empty array (no providers)
      mockWalrusClient.getStorageProviders.mockResolvedValue([]);

      // Execute the verification
      const result = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes
      );

      // It should still succeed (because requireCertification defaults to false)
      // but poaComplete should be false and providers should be 0
      expect(result.success).toBe(true);
      expect(result.details.certified).toBe(true);
      expect(result.poaComplete).toBe(false);
      expect(result.providers).toBe(0);
    });
  });
});
