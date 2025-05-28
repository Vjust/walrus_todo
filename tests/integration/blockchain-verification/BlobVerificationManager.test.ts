import { BlobVerificationManager } from '../../../apps/cli/src/utils/blob-verification';
import { CLIError } from '../../../apps/cli/src/types/errors/consolidated';
import crypto from 'crypto';

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SignatureWithBytes, IntentScope } from '@mysten/sui/cryptography';
// Unused imports removed during TypeScript cleanup
// import { SuiClient } from '@mysten/sui/client';
// import type { WalrusClientExt } from '../../../apps/cli/src/types/client';
import { getMockWalrusClient, type CompleteWalrusClientMock } from '../../helpers/complete-walrus-client-mock';
import { SuiClientType } from '../../../apps/cli/src/utils/adapters/sui-client-compatibility';

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

describe('BlobVerificationManager Integration', () => {
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

  describe('verifyBlob', () => {
    it('should successfully verify a blob', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for verification');

      // Set up the mock responses
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

      // Verify the results
      expect(result.success).toBe(true);
      expect(result.details.blobId).toBe(blobId);
      expect(result.details.size).toBe(testData.length);
      expect(result.details.certified).toBe(true);
      expect(result.poaComplete).toBe(true);
      expect(result.providers).toBe(2);

      // Verify the expected client calls
      expect(mockWalrusClient.readBlob).toHaveBeenCalledWith({ blobId });
      expect(mockWalrusClient.getBlobInfo).toHaveBeenCalledWith(blobId);
      expect(mockWalrusClient.getBlobMetadata).toHaveBeenCalledWith({ blobId });
      expect(mockWalrusClient.getStorageProviders).toHaveBeenCalledWith({
        blobId,
      });
      expect(mockWalrusClient.verifyPoA).toHaveBeenCalledWith({ blobId });
      expect(mockGetLatestSuiSystemState).toHaveBeenCalled();
    });

    it('should handle mismatch in blob content', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('expected test data');
      const retrievedData = Buffer.from('different test data'); // Content mismatch

      // Set up the mock responses
      mockWalrusClient.readBlob.mockResolvedValue(
        new Uint8Array(retrievedData)
      );
      mockWalrusClient.getBlobInfo.mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: String(retrievedData.length),
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: String(retrievedData.length),
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

      // Execute the verification and expect it to fail
      await expect(
        verificationManager.verifyBlob(blobId, testData, expectedAttributes)
      ).rejects.toThrow(CLIError);

      // Verify the expected client calls
      expect(mockWalrusClient.readBlob).toHaveBeenCalledWith({ blobId });
    });

    it('should handle non-certified blobs', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for verification');

      // Set up the mock responses for uncertified blob
      mockWalrusClient.readBlob.mockResolvedValue(new Uint8Array(testData));
      mockWalrusClient.getBlobInfo.mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: undefined, // Blob is not certified
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

      // Execute the verification with requireCertification set to false
      const result = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { requireCertification: false }
      );

      // Verify the results
      expect(result.success).toBe(true);
      expect(result.details.certified).toBe(false);
      expect(result.poaComplete).toBe(false);

      // Execute with requireCertification set to true (should fail)
      await expect(
        verificationManager.verifyBlob(blobId, testData, expectedAttributes, {
          requireCertification: true,
        })
      ).rejects.toThrow(CLIError);
    });

    it('should handle metadata verification failures', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for verification');

      // Set up the mock responses
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
      mockWalrusClient.getStorageProviders.mockResolvedValue([
        'provider1',
        'provider2',
      ]);
      mockWalrusClient.verifyPoA.mockResolvedValue(true);

      // Execute the verification with verifyAttributes set to true
      await expect(
        verificationManager.verifyBlob(blobId, testData, expectedAttributes, {
          verifyAttributes: true,
        })
      ).rejects.toThrow(CLIError);

      // Execute the verification with verifyAttributes set to false
      const result = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { verifyAttributes: false }
      );

      expect(result.success).toBe(true);
      expect(result.details.certified).toBe(true);
    });
  });

  describe('verifyUpload', () => {
    it('should successfully verify an upload', async () => {
      // Create test data
      const testData = Buffer.from('test upload data');
      const blobId = 'test-blob-id';

      // Set up the mock responses
      mockWalrusClient.writeBlob.mockResolvedValue({
        blobId: blobId,
        blobObject: { blob_id: blobId },
      });
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
      mockWalrusClient.getStorageProviders.mockResolvedValue([
        'provider1',
        'provider2',
      ]);
      mockWalrusClient.verifyPoA.mockResolvedValue(true);

      // Execute the verification
      const result = await verificationManager.verifyUpload(testData);

      // Verify the results
      expect(result.blobId).toBe(blobId);
      expect(result.certified).toBe(true);
      expect(result.poaComplete).toBe(true);
      expect(result.hasMinProviders).toBe(true);

      // Verify the checksums were calculated
      expect(result.checksums.sha256).toBeDefined();
      expect(result.checksums.sha512).toBeDefined();
      expect(result.checksums.blake2b).toBeDefined();

      // Calculate expected checksums
      const expectedChecksums = {
        sha256: crypto.createHash('sha256').update(testData).digest('hex'),
        sha512: crypto.createHash('sha512').update(testData).digest('hex'),
        blake2b: crypto.createHash('blake2b512').update(testData).digest('hex'),
      };

      expect(result.checksums.sha256).toEqual(expectedChecksums.sha256);
      expect(result.checksums.sha512).toEqual(expectedChecksums.sha512);
      expect(result.checksums.blake2b).toEqual(expectedChecksums.blake2b);

      // Verify the expected client calls
      expect(mockWalrusClient.writeBlob).toHaveBeenCalled();
      expect(mockWalrusClient.getBlobInfo).toHaveBeenCalledWith(blobId);
      expect(mockWalrusClient.getStorageProviders).toHaveBeenCalledWith({
        blobId,
      });
      expect(mockWalrusClient.verifyPoA).toHaveBeenCalledWith({ blobId });
    });

    it('should wait for certification if requested', async () => {
      // Create test data
      const testData = Buffer.from('test upload data');
      const blobId = 'test-blob-id';

      // Set up the mock responses
      mockWalrusClient.writeBlob.mockResolvedValue({
        blobId: blobId,
        blobObject: { blob_id: blobId },
      });

      // First call returns uncertified, second call returns certified
      mockWalrusClient.getBlobInfo
        .mockResolvedValueOnce({
          blob_id: blobId,
          registered_epoch: 40,
          certified_epoch: undefined, // Not certified yet
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
        })
        .mockResolvedValueOnce({
          blob_id: blobId,
          registered_epoch: 40,
          certified_epoch: 41, // Now certified
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

      mockWalrusClient.getStorageProviders.mockResolvedValue([
        'provider1',
        'provider2',
      ]);
      mockWalrusClient.verifyPoA.mockResolvedValue(true);

      // Mock setTimeout to make the test run faster
      jest.useFakeTimers();

      // Start the verification process
      const verifyPromise = verificationManager.verifyUpload(testData, {
        waitForCertification: true,
        waitTimeout: 5000,
      });

      // Advance the timer to simulate waiting for certification
      jest.advanceTimersByTime(1000);
      jest.useRealTimers();

      // Wait for the verification to complete
      const result = await verifyPromise;

      // Verify the results
      expect(result.certified).toBe(true);
      expect(mockWalrusClient.getBlobInfo).toHaveBeenCalledTimes(2);
    });

    it('should handle timeout when waiting for certification', async () => {
      // Create test data
      const testData = Buffer.from('test upload data');
      const blobId = 'test-blob-id';

      // Set up the mock responses
      mockWalrusClient.writeBlob.mockResolvedValue({
        blobId: blobId,
        blobObject: { blob_id: blobId },
      });

      // Always return uncertified blob
      mockWalrusClient.getBlobInfo.mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: undefined, // Never certified
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

      mockWalrusClient.getStorageProviders.mockResolvedValue(['provider1']);
      mockWalrusClient.verifyPoA.mockResolvedValue(false);

      // Mock setTimeout to make the test run faster
      jest.useFakeTimers();

      // Start the verification process
      const verifyPromise = verificationManager.verifyUpload(testData, {
        waitForCertification: true,
        waitTimeout: 5000,
      });

      // Advance the timer past the timeout
      jest.advanceTimersByTime(5500);
      jest.useRealTimers();

      // Expect the verification to fail with a timeout error
      await expect(verifyPromise).rejects.toThrow(
        'Timeout waiting for certification'
      );
    });
  });

  describe('monitorBlobAvailability', () => {
    it('should successfully monitor a blob', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for monitoring');
      const checksums = {
        sha256: crypto.createHash('sha256').update(testData).digest('hex'),
        sha512: crypto.createHash('sha512').update(testData).digest('hex'),
        blake2b: crypto.createHash('blake2b512').update(testData).digest('hex'),
      };

      // Set up the mock responses
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

      // Execute the monitoring
      await verificationManager.monitorBlobAvailability(blobId, checksums, {
        interval: 100,
        maxAttempts: 1,
        timeout: 1000,
      });

      // Verify the expected client calls
      expect(mockWalrusClient.readBlob).toHaveBeenCalledWith({ blobId });
      expect(mockWalrusClient.getBlobInfo).toHaveBeenCalledWith(blobId);
      expect(mockGetLatestSuiSystemState).toHaveBeenCalled();
    });

    it('should retry monitoring when content verification fails', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for monitoring');
      const incorrectData = Buffer.from('incorrect test data');
      const checksums = {
        sha256: crypto.createHash('sha256').update(testData).digest('hex'),
        sha512: crypto.createHash('sha512').update(testData).digest('hex'),
        blake2b: crypto.createHash('blake2b512').update(testData).digest('hex'),
      };

      // First call returns incorrect data, second call returns correct data
      mockWalrusClient.readBlob
        .mockResolvedValueOnce(new Uint8Array(incorrectData))
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

      // Mock setTimeout to make the test run faster
      jest.useFakeTimers();

      // Start the monitoring process
      const monitorPromise = verificationManager.monitorBlobAvailability(
        blobId,
        checksums,
        {
          interval: 100,
          maxAttempts: 2,
          timeout: 1000,
        }
      );

      // Advance the timer to simulate waiting between retries
      jest.advanceTimersByTime(100);
      jest.useRealTimers();

      // Wait for the monitoring to complete
      await monitorPromise;

      // Verify the number of calls
      expect(mockWalrusClient.readBlob).toHaveBeenCalledTimes(2);
    });

    it('should fail monitoring after exhausting max attempts', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for monitoring');
      const incorrectData = Buffer.from('incorrect test data');
      const checksums = {
        sha256: crypto.createHash('sha256').update(testData).digest('hex'),
        sha512: crypto.createHash('sha512').update(testData).digest('hex'),
        blake2b: crypto.createHash('blake2b512').update(testData).digest('hex'),
      };

      // Always return incorrect data
      mockWalrusClient.readBlob.mockResolvedValue(
        new Uint8Array(incorrectData)
      );

      mockWalrusClient.getBlobInfo.mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: String(incorrectData.length),
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: String(incorrectData.length),
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

      // Mock setTimeout to make the test run faster
      jest.useFakeTimers();

      // Start the monitoring process
      const monitorPromise = verificationManager.monitorBlobAvailability(
        blobId,
        checksums,
        {
          interval: 100,
          maxAttempts: 2,
          timeout: 1000,
        }
      );

      // Advance the timer to simulate waiting between retries
      jest.advanceTimersByTime(100);
      jest.useRealTimers();

      // Expect the monitoring to fail after max attempts
      await expect(monitorPromise).rejects.toThrow(
        'Blob availability monitoring failed'
      );
    });
  });
});
