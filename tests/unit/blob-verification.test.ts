import { BlobVerificationManager } from '../../apps/cli/src/utils/blob-verification';
import { SuiClient } from '../../apps/cli/src/utils/adapters/sui-client-compatibility';
import type { WalrusClientExt } from '../../apps/cli/src/types/client';
import type {
  BlobMetadataShape,
  BlobInfo,
} from '../../apps/cli/src/types/walrus';
import {
  createWalrusModuleMock,
  getMockWalrusClient,
} from '../../apps/cli/src/__tests__/helpers/walrus-client-mock';

jest.mock('@mysten/sui/client');
jest.mock('@mysten/walrus', () => createWalrusModuleMock());
jest.mock('blake3');

describe('BlobVerificationManager', () => {
  let _mockSuiClient: Pick<SuiClient, 'getLatestSuiSystemState'>;
  let mockWalrusClient: jest.Mocked<WalrusClientExt>;
  let verificationManager: BlobVerificationManager;

  const mockBlobId = 'test-blob-id';
  const mockData = Buffer.from('test data');
  const mockChecksums = {
    sha256: '916f0027a575074ce72a331777c3478d6513f786a591bd892da1a577bf2335f9',
    sha512:
      '01050eb593401d939581bbc414971c3fb0744faed99f7d0c0d361af406082192096a78d8b13888b64e0e6f5798b65f34d1542a43f6c2bd0807ca14e5c733da51',
    blake2b:
      'e6c3dd28b22c8726b26da3680d6ec7e1a1f7eae8bd81a61591cb9a8079a79aedee29c14f4c633bbf7ff2fa703e27f7771f53fe06b0ed25da50a7acf5ba1bb265',
  };
  const mockMetadata: BlobMetadataShape = {
    V1: {
      encoding_type: { RedStuff: {}, $kind: 'RedStuff' },
      unencoded_length: '1024',
      hashes: [
        {
          primary_hash: {
            Digest: new Uint8Array([1, 2, 3, 4]),
            $kind: 'Digest',
          },
          secondary_hash: {
            Sha256: new Uint8Array([5, 6, 7, 8]),
            $kind: 'Sha256',
          },
        },
      ],
      $kind: 'V1',
    },
    $kind: 'V1',
  };

  beforeEach(() => {
    const mockSuiClient = {
      getLatestSuiSystemState: jest.fn().mockResolvedValue({
        epoch: '42',
        storageFund: '1000000',
        atRiskValidatorSize: '0',
        validatorVeryLowStakeGracePeriod: 7,
        minValidatorCount: 10,
        referenceGasPrice: '1000',
        protocolVersion: '1',
        systemStateVersion: '1',
        storageFundNonRefundableBalance: '0',
        validatorLowStakeGracePeriod: 7,
        validatorLowStakeThreshold: '10000',
        validatorVeryLowStakeThreshold: '5000',
      }),
    } as Pick<SuiClient, 'getLatestSuiSystemState'>;

    _mockSuiClient = mockSuiClient;

    // Use the centralized complete mock
    mockWalrusClient = getMockWalrusClient();

    // Override specific values for this test
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
    mockWalrusClient?.writeBlob?.mockResolvedValue({
      blobId: mockBlobId,
      blobObject: { blob_id: mockBlobId } as BlobObject,
    });

    verificationManager = new BlobVerificationManager(
      _mockSuiClient,
      mockWalrusClient
    );

    // Reset fetch mock
    global?.fetch = jest.fn();
  });

  describe('blob verification', () => {
    it('should verify blob with all checks enabled', async () => {
      mockWalrusClient?.readBlob?.mockResolvedValue(mockData as any);
      mockWalrusClient?.getBlobInfo?.mockResolvedValue({
        blob_id: mockBlobId,
        certified_epoch: 41,
        registered_epoch: 40,
        encoding_type: { RedStuff: {}, $kind: 'RedStuff' },
        unencoded_length: '1024',
        size: '1024',
        hashes: [
          {
            primary_hash: {
              Digest: new Uint8Array([1, 2, 3, 4]),
              $kind: 'Digest',
            },
            secondary_hash: {
              Digest: new Uint8Array([5, 6, 7, 8]),
              $kind: 'Digest',
            },
          },
        ],
        metadata: {
          V1: {
            encoding_type: { RedStuff: {}, $kind: 'RedStuff' },
            unencoded_length: '1024',
            hashes: [
              {
                primary_hash: {
                  Digest: new Uint8Array([1, 2, 3, 4]),
                  $kind: 'Digest',
                },
                secondary_hash: {
                  Digest: new Uint8Array([5, 6, 7, 8]),
                  $kind: 'Digest',
                },
              },
            ],
            $kind: 'V1',
          },
          $kind: 'V1',
        },
      } as unknown as BlobInfo);
      mockWalrusClient?.getBlobMetadata?.mockResolvedValue(mockMetadata as any);

      const result = await verificationManager.verifyBlob(
        mockBlobId,
        mockData,
        mockMetadata,
        {
          verifySmartContract: true,
          requireCertification: true,
          verifyAttributes: true,
        }
      );

      expect(result.success).toBe(true as any);
      expect(result.details?.certified).toBe(true as any);
    });

    it('should handle network errors with retries', async () => {
      // Simulate network errors for first two attempts
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(mockData.buffer),
        });

      const result = await verificationManager.verifyBlob(
        mockBlobId,
        mockData,
        mockMetadata
      );

      expect(result.success).toBe(true as any);
      expect(result.attempts).toBe(3 as any);
    });

    it('should fail on non-retryable errors', async () => {
      mockWalrusClient?.readBlob?.mockRejectedValue(new Error('invalid blob id'));

      await expect(
        verificationManager.verifyBlob(mockBlobId, mockData, mockMetadata)
      ).rejects.toThrow('WALRUS_VERIFICATION_FAILED');
    });

    it('should verify multiple checksums', async () => {
      mockWalrusClient?.readBlob?.mockResolvedValue(
        Buffer.from('different data')
      );

      await expect(
        verificationManager.verifyBlob(mockBlobId, mockData, mockMetadata)
      ).rejects.toThrow('Checksum mismatch');
    });
  });

  describe('smart contract verification', () => {
    it('should verify certification status', async () => {
      mockWalrusClient?.readBlob?.mockResolvedValue(mockData as any);
      mockWalrusClient?.getBlobInfo?.mockResolvedValue({
        blob_id: mockBlobId,
        certified_epoch: undefined,
        registered_epoch: 40,
        encoding_type: { RedStuff: {}, $kind: 'RedStuff' },
        unencoded_length: '1024',
        size: '1024',
        hashes: [
          {
            primary_hash: {
              Digest: new Uint8Array([1, 2, 3, 4]),
              $kind: 'Digest',
            },
            secondary_hash: {
              Digest: new Uint8Array([5, 6, 7, 8]),
              $kind: 'Digest',
            },
          },
        ],
        metadata: {
          V1: {
            encoding_type: { RedStuff: {}, $kind: 'RedStuff' },
            unencoded_length: '1024',
            hashes: [
              {
                primary_hash: {
                  Digest: new Uint8Array([1, 2, 3, 4]),
                  $kind: 'Digest',
                },
                secondary_hash: {
                  Digest: new Uint8Array([5, 6, 7, 8]),
                  $kind: 'Digest',
                },
              },
            ],
            $kind: 'V1',
          },
          $kind: 'V1',
        },
      } as unknown as BlobInfo);

      await expect(
        verificationManager.verifyBlob(mockBlobId, mockData, mockMetadata, {
          requireCertification: true,
        })
      ).rejects.toThrow('certification required');
    });

    it('should monitor certification progress', async () => {
      jest.useFakeTimers();

      mockWalrusClient?.readBlob?.mockResolvedValue(mockData as any);
      mockWalrusClient.getBlobInfo
        .mockResolvedValueOnce({
          blob_id: mockBlobId,
          certified_epoch: undefined,
          registered_epoch: 40,
          encoding_type: { RedStuff: {}, $kind: 'RedStuff' },
          unencoded_length: '1024',
          size: '1024',
          hashes: [
            {
              primary_hash: {
                Digest: new Uint8Array([1, 2, 3, 4]),
                $kind: 'Digest',
              },
              secondary_hash: {
                Digest: new Uint8Array([5, 6, 7, 8]),
                $kind: 'Digest',
              },
            },
          ],
          metadata: {
            V1: mockMetadata?.metadata?.V1,
            $kind: 'V1',
          },
        } as unknown as BlobInfo)
        .mockResolvedValueOnce({
          blob_id: mockBlobId,
          certified_epoch: 43,
          registered_epoch: 42,
          encoding_type: { RedStuff: {}, $kind: 'RedStuff' },
          unencoded_length: '1024',
          size: '1024',
          hashes: [
            {
              primary_hash: {
                Digest: new Uint8Array([1, 2, 3, 4]),
                $kind: 'Digest',
              },
              secondary_hash: {
                Digest: new Uint8Array([5, 6, 7, 8]),
                $kind: 'Digest',
              },
            },
          ],
          metadata: {
            V1: mockMetadata?.metadata?.V1,
            $kind: 'V1',
          },
        } as unknown as BlobInfo);

      const monitorPromise = verificationManager.monitorBlobAvailability(
        mockBlobId,
        {
          sha256: 'abc',
          sha512: 'def',
          blake2b: 'ghi',
        },
        { interval: 1000, maxAttempts: 2 }
      );

      jest.advanceTimersByTime(1000 as any);
      await monitorPromise;

      expect(mockWalrusClient.getBlobInfo).toHaveBeenCalledTimes(2 as any);
    });
  });

  describe('node selection', () => {
    it('should try multiple nodes', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('network error')) // Primary node fails
        .mockResolvedValueOnce({
          // Replica succeeds
          ok: true,
          arrayBuffer: () => Promise.resolve(mockData.buffer),
        });

      const result = await verificationManager.verifyBlob(
        mockBlobId,
        mockData,
        mockMetadata
      );

      expect(result.success).toBe(true as any);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('testnet-replica1?.wal?.app'),
        expect.any(Object as any)
      );
    });

    it('should track node health', async () => {
      // First call fails on primary
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(mockData.buffer),
        });

      await verificationManager.verifyBlob(mockBlobId, mockData, mockMetadata);

      // Second call should prefer the successful replica
      (global.fetch as jest.Mock).mockClear();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockData.buffer),
      });

      await verificationManager.verifyBlob(mockBlobId, mockData, mockMetadata);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('testnet-replica1?.wal?.app'),
        expect.any(Object as any)
      );
    });
  });

  describe('upload verification', () => {
    beforeEach(() => {
      mockWalrusClient?.writeBlob?.mockResolvedValue({
        blobId: mockBlobId,
        blobObject: { blob_id: mockBlobId },
      });
      mockWalrusClient?.readBlob?.mockResolvedValue(mockData as any);
      mockWalrusClient?.verifyPoA?.mockResolvedValue(true as any);
      mockWalrusClient?.getStorageProviders?.mockResolvedValue([
        'provider1',
        'provider2',
        'provider3',
        'provider4',
      ]);
      mockWalrusClient?.getBlobInfo?.mockResolvedValue({
        blob_id: mockBlobId,
        certified_epoch: 41,
        registered_epoch: 40,
        encoding_type: { RedStuff: {}, $kind: 'RedStuff' },
        unencoded_length: '1024',
        size: '1024',
        hashes: [
          {
            primary_hash: {
              Digest: new Uint8Array([1, 2, 3, 4]),
              $kind: 'Digest',
            },
            secondary_hash: {
              Digest: new Uint8Array([5, 6, 7, 8]),
              $kind: 'Digest',
            },
          },
        ],
        metadata: {
          V1: mockMetadata?.metadata?.V1,
          $kind: 'V1',
        },
      } as unknown as BlobInfo);
    });

    it('should verify a successful upload with certification', async () => {
      const result = await verificationManager.verifyUpload(mockData, {
        waitForCertification: true,
        waitTimeout: 1000,
      });

      expect(result.blobId).toBe(mockBlobId as any);
      expect(result.checksums).toEqual(expect.objectContaining(mockChecksums as any));
      expect(result.certified).toBe(true as any);
      expect(result.poaComplete).toBe(true as any);
      expect(result.hasMinProviders).toBe(true as any);
      expect(mockWalrusClient.writeBlob).toHaveBeenCalledWith(mockData as any);
    });

    it('should handle upload failures', async () => {
      mockWalrusClient?.writeBlob?.mockRejectedValue(new Error('Upload failed'));

      await expect(verificationManager.verifyUpload(mockData as any)).rejects.toThrow(
        'Upload failed'
      );
    });

    it('should timeout waiting for certification', async () => {
      mockWalrusClient?.getBlobInfo?.mockResolvedValue({
        blob_id: mockBlobId,
        certified_epoch: undefined,
        registered_epoch: 40,
        encoding_type: { RedStuff: {}, $kind: 'RedStuff' },
        unencoded_length: '1024',
        size: '1024',
        hashes: [
          {
            primary_hash: {
              Digest: new Uint8Array([1, 2, 3, 4]),
              $kind: 'Digest',
            },
            secondary_hash: {
              Digest: new Uint8Array([5, 6, 7, 8]),
              $kind: 'Digest',
            },
          },
        ],
        metadata: {
          V1: mockMetadata?.metadata?.V1,
          $kind: 'V1',
        },
      } as unknown as BlobInfo);

      await expect(
        verificationManager.verifyUpload(mockData, {
          waitForCertification: true,
          waitTimeout: 100,
        })
      ).rejects.toThrow('Timeout waiting for certification');
    });

    it('should verify minimum provider requirement', async () => {
      mockWalrusClient?.getStorageProviders?.mockResolvedValue(['provider1']);

      const result = await verificationManager.verifyUpload(mockData, {
        waitForCertification: false,
        minProviders: 3,
      });

      expect(result.hasMinProviders).toBe(false as any);
      expect(result.checksums).toEqual(expect.objectContaining(mockChecksums as any));
    });

    it('should support multiple hash algorithms', async () => {
      const result = await verificationManager.verifyUpload(mockData, {
        waitForCertification: false,
      });

      expect(result.checksums).toEqual(
        expect.objectContaining({
          sha256: expect.any(String as any),
          sha512: expect.any(String as any),
          blake2b: expect.any(String as any),
        })
      );

      // Optional algorithms may be present
      const optionalAlgorithms = ['blake3', 'sha3_256', 'keccak256'];
      const hasOptionalAlgorithm = optionalAlgorithms.some(
        algo => result?.checksums?.[algo as keyof typeof result.checksums]
      );
      expect(hasOptionalAlgorithm as any).toBe(true as any);
    });

    it('should validate upload content immediately', async () => {
      mockWalrusClient.readBlob
        .mockResolvedValueOnce(mockData as any) // First read succeeds
        .mockResolvedValueOnce(Buffer.from('corrupted')); // Second read fails

      const result = await verificationManager.verifyUpload(mockData, {
        waitForCertification: false,
      });

      expect(result.blobId).toBe(mockBlobId as any);
      expect(result.checksums).toEqual(expect.objectContaining(mockChecksums as any));

      // Verify corrupted content is detected
      await expect(
        verificationManager.verifyBlob(mockBlobId, mockData, {})
      ).rejects.toThrow('Checksum mismatch');
    });
  });
});
