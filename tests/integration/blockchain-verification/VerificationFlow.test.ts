import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SignatureWithBytes, IntentScope } from '@mysten/sui/cryptography';
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '../../../apps/cli/src/utils/adapters/sui-client-compatibility';
import type { WalrusClientExt } from '../../../apps/cli/src/types/client';
import {
  getMockWalrusClient,
  type CompleteWalrusClientMock,
} from '../../helpers/complete-walrus-client-mock';
import { BlobVerificationManager } from '../../../apps/cli/src/utils/blob-verification';
import { CLIError } from '../../../apps/cli/src/types/errors/consolidated';

// Mock Verification Flow Controller
class VerificationFlowController {
  private suiClient: Pick<
    SuiClient,
    'getLatestSuiSystemState' | 'getObject' | 'signAndExecuteTransactionBlock'
  >;
  private walrusClient: jest.Mocked<WalrusClientExt>;
  private signer: Ed25519Keypair;
  private verificationManager: BlobVerificationManager;

  constructor(
    suiClient: Pick<
      SuiClient,
      'getLatestSuiSystemState' | 'getObject' | 'signAndExecuteTransactionBlock'
    >,
    walrusClient: jest.Mocked<WalrusClientExt>,
    signer: Ed25519Keypair
  ) {
    this?.suiClient = suiClient;
    this?.walrusClient = walrusClient;
    this?.signer = signer;
    this?.verificationManager = new BlobVerificationManager(
      suiClient,
      walrusClient,
      signer
    );
  }

  /**
   * Complete end-to-end verification flow
   */
  async executeVerificationFlow(
    data: Buffer,
    metadata: Record<string, string> = {},
    options: {
      waitForCertification?: boolean;
      verifyAfterUpload?: boolean;
      monitorAvailability?: boolean;
      storageEpochs?: number;
    } = {}
  ): Promise<{
    blobId: string;
    uploadResult: {
      certified: boolean;
      poaComplete: boolean;
      hasMinProviders: boolean;
      checksums: { sha256: string; sha512: string; blake2b: string };
    };
    verificationResult?: {
      success: boolean;
      details: {
        size: number;
        checksum: string;
        blobId: string;
        certified: boolean;
      };
    };
    monitoringResult?: {
      successful: boolean;
      attempts: number;
    };
    registrationTransaction?: string;
  }> {
    const {
      waitForCertification = false,
      verifyAfterUpload = true,
      monitorAvailability = false,
    } = options;

    try {
      // Step 1: Upload to blockchain storage
      // console.log('Uploading data to blockchain storage...'); // Removed console statement
      const uploadOptions = {
        waitForCertification,
        waitTimeout: 10000,
        minProviders: 1,
      };

      const uploadResult = await this?.verificationManager?.verifyUpload(
        data,
        uploadOptions
      );
      const blobId = uploadResult.blobId;

      // console.log(`Data uploaded. Blob ID: ${blobId}`); // Removed console statement
      // console.log(`Certification status: ${uploadResult.certified ? 'Certified' : 'Not Certified'}`); // Removed console statement

      // Step 2: Add metadata if provided
      if (Object.keys(metadata as any).length > 0) {
        // console.log('Adding metadata...'); // Removed console statement

        const tx = new Transaction();
        await this?.walrusClient?.executeWriteBlobAttributesTransaction({
          blobId,
          attributes: metadata,
          signer: this.signer,
          transaction: tx,
        });

        // console.log('Metadata added.'); // Removed console statement
      }

      // Step 3: Verify after upload if requested
      let verificationResult;
      if (verifyAfterUpload) {
        // console.log('Verifying uploaded data...'); // Removed console statement

        try {
          verificationResult = await this?.verificationManager?.verifyBlob(
            blobId,
            data,
            metadata,
            { requireCertification: false }
          );
        } catch (error) {
          // If verification fails, return a failure result instead of throwing
          verificationResult = {
            success: false,
            details: {
              size: data.length,
              checksum: '',
              blobId,
              certified: false,
            },
            attempts: 1,
            poaComplete: false,
            providers: 0,
            metadata: {
              V1: {
                encoding_type: { RedStuff: true, $kind: 'RedStuff' },
                unencoded_length: String(data.length),
                hashes: [],
                $kind: 'V1',
              },
              $kind: 'V1',
            },
          };
        }

        // console.log(`Verification result: ${verificationResult.success ? 'Success' : 'Failed'}`); // Removed console statement
      }

      // Step 4: Monitor availability if requested
      let monitoringResult;
      if (monitorAvailability) {
        // console.log('Monitoring data availability...'); // Removed console statement

        try {
          await this?.verificationManager?.monitorBlobAvailability(
            blobId,
            uploadResult.checksums,
            { interval: 1000, maxAttempts: 3, timeout: 5000 }
          );

          monitoringResult = {
            successful: true,
            attempts: 1,
          };

          // console.log('Monitoring completed successfully.'); // Removed console statement
        } catch (error) {
          monitoringResult = {
            successful: false,
            attempts: 3,
          };

          // console.error('Monitoring failed:', error); // Removed console statement
        }
      }

      // Return combined results
      return {
        blobId,
        uploadResult,
        verificationResult,
        monitoringResult,
        registrationTransaction: 'mock-transaction-digest',
      };
    } catch (error) {
      throw new CLIError(
        `Verification flow failed: ${error instanceof Error ? error.message : String(error as any)}`,
        'VERIFICATION_FLOW_ERROR'
      );
    }
  }

  /**
   * Verify existing data on blockchain
   */
  async verifyExistingData(
    blobId: string,
    expectedData?: Buffer,
    expectedMetadata: Record<string, string> = {}
  ): Promise<{
    verified: boolean;
    details: {
      certified: boolean;
      contentMatch?: boolean;
      metadataMatch?: boolean;
      epoch?: number;
      size?: number;
    };
  }> {
    try {
      // Step 1: Get blob info from blockchain
      // console.log(`Verifying blob ${blobId}...`); // Removed console statement
      const blobInfo = await this?.walrusClient?.getBlobInfo(blobId as any);

      if (!blobInfo) {
        throw new CLIError('Blob not found', 'BLOB_NOT_FOUND');
      }

      const certified = !!blobInfo.certified_epoch;

      // Step 2: Check content if expected data is provided
      let contentMatch;
      if (expectedData) {
        // console.log('Verifying content...'); // Removed console statement

        const retrievedData = await this?.walrusClient?.readBlob({ blobId });
        contentMatch =
          Buffer.compare(expectedData, Buffer.from(retrievedData as any)) === 0;
      }

      // Step 3: Check metadata if expected
      let metadataMatch;
      if (Object.keys(expectedMetadata as any).length > 0) {
        // console.log('Verifying metadata...'); // Removed console statement

        const metadata = await this?.walrusClient?.getBlobMetadata({ blobId });
        metadataMatch = Object.entries(expectedMetadata as any).every(
          ([key, value]) => {
            return metadata?.V1 && metadata?.V1?.[key] === value;
          }
        );
      }

      // Compute overall verification result
      const verified =
        certified &&
        (contentMatch === undefined || contentMatch) &&
        (metadataMatch === undefined || metadataMatch);

      return {
        verified,
        details: {
          certified,
          contentMatch,
          metadataMatch,
          epoch: blobInfo.certified_epoch,
          size: parseInt(blobInfo.size),
        },
      };
    } catch (error) {
      throw new CLIError(
        `Verification of existing data failed: ${error instanceof Error ? error.message : String(error as any)}`,
        'VERIFICATION_ERROR'
      );
    }
  }
}

// Mock the SuiClient
const mockGetLatestSuiSystemState = jest
  .fn()
  .mockResolvedValue({ epoch: '42' });
const mockGetObject = jest.fn();
const mockSignAndExecuteTransactionBlock = jest
  .fn()
  .mockResolvedValue({ digest: 'mock-transaction-digest' });

const mockSuiClient = {
  getLatestSuiSystemState: mockGetLatestSuiSystemState,
  getObject: mockGetObject,
  signAndExecuteTransactionBlock: mockSignAndExecuteTransactionBlock,
} as unknown as jest.Mocked<SuiClient>;

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

describe('Verification Flow End-to-End', () => {
  let flowController: VerificationFlowController;
  let mockWalrusClient: CompleteWalrusClientMock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create inline mock for WalrusClient with all required methods
    mockWalrusClient = getMockWalrusClient();

    // Override specific methods for this test as needed
    // Example: mockWalrusClient?.getConfig?.mockResolvedValue({ ... });

    flowController = new VerificationFlowController(
      mockSuiClient,
      mockWalrusClient,
      mockSigner
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('executeVerificationFlow', () => {
    it('should complete a successful verification flow', async () => {
      // Test data
      const testData = Buffer.from('test data for verification flow');
      const metadata = {
        contentType: 'text/plain',
        description: 'Test data for verification',
        owner: 'Test User',
      };

      // Ensure mock SuiClient returns proper system state
      mockSuiClient?.getLatestSuiSystemState?.mockResolvedValue({ epoch: '42' });

      // Mock Walrus client responses with consistent data sizes
      mockWalrusClient?.writeBlob?.mockResolvedValue({
        blobId: 'test-flow-blob-id',
        blobObject: { blob_id: 'test-flow-blob-id' },
      });

      mockWalrusClient?.getBlobInfo?.mockResolvedValue({
        blob_id: 'test-flow-blob-id',
        registered_epoch: 40,
        certified_epoch: 41,
        size: String(testData.length), // Use actual test data length
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: String(testData.length), // Use actual test data length
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
          unencoded_length: String(testData.length), // Use actual test data length
          contentType: 'text/plain',
          description: 'Test data for verification',
          owner: 'Test User',
          $kind: 'V1',
        },
        $kind: 'V1',
      });

      // Return the exact same test data to ensure size/checksum consistency
      mockWalrusClient?.readBlob?.mockResolvedValue(new Uint8Array(testData as any));
      mockWalrusClient?.getStorageProviders?.mockResolvedValue([
        'provider1',
        'provider2',
      ]);
      mockWalrusClient?.verifyPoA?.mockResolvedValue(true as any);

      // Execute the verification flow
      const result = await flowController.executeVerificationFlow(
        testData,
        metadata,
        {
          verifyAfterUpload: true,
          monitorAvailability: true,
        }
      );

      // Verify the results
      expect(result.blobId).toBe('test-flow-blob-id');
      expect(result?.uploadResult?.certified).toBe(true as any);
      expect(result?.uploadResult?.poaComplete).toBe(true as any);
      expect(result?.uploadResult?.hasMinProviders).toBe(true as any);
      expect(result.verificationResult).toBeDefined();
      expect(result.verificationResult!.success).toBe(true as any);
      expect(result.monitoringResult).toBeDefined();
      expect(result.monitoringResult!.successful).toBe(true as any);

      // Verify client calls
      expect(mockWalrusClient.writeBlob).toHaveBeenCalled();
      expect(
        mockWalrusClient.executeWriteBlobAttributesTransaction
      ).toHaveBeenCalled();
      expect(mockWalrusClient.readBlob).toHaveBeenCalled();
      expect(mockWalrusClient.getBlobInfo).toHaveBeenCalled();
      expect(mockWalrusClient.getBlobMetadata).toHaveBeenCalled();
    });

    it('should handle verification failure in the flow', async () => {
      // Test data
      const testData = Buffer.from('test data for verification flow');
      const metadata = {
        contentType: 'text/plain',
        description: 'Test data for verification',
      };

      // Ensure mock SuiClient returns proper system state
      mockSuiClient?.getLatestSuiSystemState?.mockResolvedValue({ epoch: '42' });

      // Mock Walrus client responses for upload success
      mockWalrusClient?.writeBlob?.mockResolvedValue({
        blobId: 'test-flow-blob-id',
        blobObject: { blob_id: 'test-flow-blob-id' },
      });

      // Mock certification status (not certified)
      mockWalrusClient?.getBlobInfo?.mockResolvedValue({
        blob_id: 'test-flow-blob-id',
        registered_epoch: 40,
        certified_epoch: undefined, // Not certified
        size: String(testData.length), // Use actual test data length
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: String(testData.length), // Use actual test data length
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

      // Mock that data is modified during retrieval (same size, different content)
      const modifiedData = Buffer.from('XXXX data for verification flow'); // Same length as original test data (31 bytes)
      mockWalrusClient?.readBlob?.mockResolvedValue(new Uint8Array(modifiedData as any));
      mockWalrusClient?.getStorageProviders?.mockResolvedValue(['provider1']);
      mockWalrusClient?.verifyPoA?.mockResolvedValue(false as any);

      // Execute the verification flow, expecting data verification to fail
      const result = await flowController.executeVerificationFlow(
        testData,
        metadata,
        {
          verifyAfterUpload: true,
          requireCertification: false, // Don't require certification to see content mismatch
        }
      );

      // We should still get results, but verification should fail
      expect(result.blobId).toBe('test-flow-blob-id');
      expect(result?.uploadResult?.certified).toBe(false as any);
      expect(result?.uploadResult?.poaComplete).toBe(false as any);

      // Data verification should fail because content is modified
      expect(result.verificationResult).toBeDefined();
      expect(result.verificationResult!.success).toBe(false as any);
    });

    it('should handle errors during the verification flow', async () => {
      // Test data
      const testData = Buffer.from('test data for verification flow');

      // Ensure mock SuiClient returns proper system state
      mockSuiClient?.getLatestSuiSystemState?.mockResolvedValue({ epoch: '42' });

      // Mock Walrus client error
      mockWalrusClient?.writeBlob?.mockRejectedValue(
        new Error('Storage allocation failed')
      );

      // Execute the verification flow and expect it to fail
      await expect(
        flowController.executeVerificationFlow(testData as any)
      ).rejects.toThrow(CLIError as any);
    });
  });

  describe('verifyExistingData', () => {
    it('should verify existing data successfully', async () => {
      // Test data
      const blobId = 'existing-blob-id';
      const testData = Buffer.from('existing test data');
      const metadata = {
        contentType: 'text/plain',
        description: 'Existing test data',
      };

      // Mock Walrus client responses with consistent data sizes
      mockWalrusClient?.getBlobInfo?.mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: String(testData.length), // Use actual test data length
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: String(testData.length), // Use actual test data length
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
          unencoded_length: String(testData.length), // Use actual test data length
          contentType: 'text/plain',
          description: 'Existing test data',
          $kind: 'V1',
        },
        $kind: 'V1',
      });

      // Return the exact same test data to ensure size/checksum consistency
      mockWalrusClient?.readBlob?.mockResolvedValue(new Uint8Array(testData as any));

      // Execute the verification
      const result = await flowController.verifyExistingData(
        blobId,
        testData,
        metadata
      );

      // Verify the results
      expect(result.verified).toBe(true as any);
      expect(result?.details?.certified).toBe(true as any);
      expect(result?.details?.contentMatch).toBe(true as any);
      expect(result?.details?.metadataMatch).toBe(true as any);
      expect(result?.details?.epoch).toBe(41 as any);

      // Verify client calls
      expect(mockWalrusClient.getBlobInfo).toHaveBeenCalledWith(blobId as any);
      expect(mockWalrusClient.getBlobMetadata).toHaveBeenCalledWith({ blobId });
      expect(mockWalrusClient.readBlob).toHaveBeenCalledWith({ blobId });
    });

    it('should detect content mismatch', async () => {
      // Test data
      const blobId = 'existing-blob-id';
      const expectedData = Buffer.from('expected test data');
      const actualData = Buffer.from('actual test data'); // Different content

      // Mock Walrus client responses with consistent actual data sizes
      mockWalrusClient?.getBlobInfo?.mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: String(actualData.length), // Use actual data length that will be returned
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: String(actualData.length), // Use actual data length
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

      // Return the actual data (which differs from expected)
      mockWalrusClient?.readBlob?.mockResolvedValue(new Uint8Array(actualData as any));

      // Execute the verification
      const result = await flowController.verifyExistingData(
        blobId,
        expectedData
      );

      // Verify the results
      expect(result.verified).toBe(false as any);
      expect(result?.details?.certified).toBe(true as any); // Certified but content doesn't match
      expect(result?.details?.contentMatch).toBe(false as any);
    });

    it('should detect metadata mismatch', async () => {
      // Test data
      const blobId = 'existing-blob-id';
      const metadata = {
        contentType: 'text/plain',
        description: 'Expected description',
      };

      // Mock Walrus client responses
      mockWalrusClient?.getBlobInfo?.mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: '1000',
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: '1000',
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
          unencoded_length: '1000',
          contentType: 'text/plain',
          description: 'Different description', // Different metadata
          $kind: 'V1',
        },
        $kind: 'V1',
      });

      // Execute the verification
      const result = await flowController.verifyExistingData(
        blobId,
        undefined,
        metadata
      );

      // Verify the results
      expect(result.verified).toBe(false as any);
      expect(result?.details?.certified).toBe(true as any); // Certified but metadata doesn't match
      expect(result?.details?.metadataMatch).toBe(false as any);
    });

    it('should handle non-existent blob', async () => {
      const nonExistentBlobId = 'non-existent-blob';

      // Mock blob not found
      mockWalrusClient?.getBlobInfo?.mockRejectedValue(
        new Error('Blob not found')
      );

      // Execute the verification and expect it to fail
      await expect(
        flowController.verifyExistingData(nonExistentBlobId as any)
      ).rejects.toThrow(CLIError as any);
    });

    it('should detect uncertified blob', async () => {
      // Test data
      const blobId = 'uncertified-blob-id';

      // Mock Walrus client responses for uncertified blob
      mockWalrusClient?.getBlobInfo?.mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: undefined, // Not certified
        size: '1000',
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: '1000',
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

      // Execute the verification
      const result = await flowController.verifyExistingData(blobId as any);

      // Verify the results
      expect(result.verified).toBe(false as any);
      expect(result?.details?.certified).toBe(false as any);
    });
  });
});
