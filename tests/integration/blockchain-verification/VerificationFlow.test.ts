import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createMockWalrusClient } from '../../../src/utils/MockWalrusClient';
import { SuiClient } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { SignatureWithBytes, IntentScope } from '@mysten/sui.js/cryptography';
import { BlobVerificationManager } from '../../../src/utils/blob-verification';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { CLIError } from '../../../src/types/error';

// Mock Verification Flow Controller
class VerificationFlowController {
  private suiClient: Pick<SuiClient, 'getLatestSuiSystemState' | 'getObject' | 'signAndExecuteTransactionBlock'>;
  private walrusClient: ReturnType<typeof createMockWalrusClient>;
  private signer: Ed25519Keypair;
  private verificationManager: BlobVerificationManager;
  
  constructor(
    suiClient: Pick<SuiClient, 'getLatestSuiSystemState' | 'getObject' | 'signAndExecuteTransactionBlock'>,
    walrusClient: ReturnType<typeof createMockWalrusClient>,
    signer: Ed25519Keypair
  ) {
    this.suiClient = suiClient;
    this.walrusClient = walrusClient;
    this.signer = signer;
    this.verificationManager = new BlobVerificationManager(
      suiClient,
      walrusClient.getUnderlyingClient(),
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
      storageEpochs = 52
    } = options;
    
    try {
      // Step 1: Upload to blockchain storage
      console.log('Uploading data to blockchain storage...');
      const uploadOptions = { 
        waitForCertification, 
        waitTimeout: 10000,
        minProviders: 1
      };
      
      const uploadResult = await this.verificationManager.verifyUpload(data, uploadOptions);
      const blobId = uploadResult.blobId;
      
      console.log(`Data uploaded. Blob ID: ${blobId}`);
      console.log(`Certification status: ${uploadResult.certified ? 'Certified' : 'Not Certified'}`);
      
      // Step 2: Add metadata if provided
      if (Object.keys(metadata).length > 0) {
        console.log('Adding metadata...');
        
        const tx = new TransactionBlock();
        await this.walrusClient.executeWriteBlobAttributesTransaction({
          blobId,
          attributes: metadata,
          signer: this.signer,
          transaction: tx
        });
        
        console.log('Metadata added.');
      }
      
      // Step 3: Verify after upload if requested
      let verificationResult;
      if (verifyAfterUpload) {
        console.log('Verifying uploaded data...');
        
        verificationResult = await this.verificationManager.verifyBlob(
          blobId,
          data,
          metadata,
          { requireCertification: false }
        );
        
        console.log(`Verification result: ${verificationResult.success ? 'Success' : 'Failed'}`);
      }
      
      // Step 4: Monitor availability if requested
      let monitoringResult;
      if (monitorAvailability) {
        console.log('Monitoring data availability...');
        
        try {
          await this.verificationManager.monitorBlobAvailability(
            blobId,
            uploadResult.checksums,
            { interval: 1000, maxAttempts: 3, timeout: 5000 }
          );
          
          monitoringResult = {
            successful: true,
            attempts: 1
          };
          
          console.log('Monitoring completed successfully.');
        } catch (error) {
          monitoringResult = {
            successful: false,
            attempts: 3
          };
          
          console.error('Monitoring failed:', error);
        }
      }
      
      // Return combined results
      return {
        blobId,
        uploadResult,
        verificationResult,
        monitoringResult,
        registrationTransaction: 'mock-transaction-digest'
      };
    } catch (error) {
      throw new CLIError(
        `Verification flow failed: ${error instanceof Error ? error.message : String(error)}`,
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
      console.log(`Verifying blob ${blobId}...`);
      const blobInfo = await this.walrusClient.getBlobInfo(blobId);
      
      if (!blobInfo) {
        throw new CLIError('Blob not found', 'BLOB_NOT_FOUND');
      }
      
      const certified = !!blobInfo.certified_epoch;
      
      // Step 2: Check content if expected data is provided
      let contentMatch;
      if (expectedData) {
        console.log('Verifying content...');
        
        const retrievedData = await this.walrusClient.readBlob({ blobId });
        contentMatch = Buffer.compare(expectedData, Buffer.from(retrievedData)) === 0;
      }
      
      // Step 3: Check metadata if expected
      let metadataMatch;
      if (Object.keys(expectedMetadata).length > 0) {
        console.log('Verifying metadata...');
        
        const metadata = await this.walrusClient.getBlobMetadata({ blobId });
        metadataMatch = Object.entries(expectedMetadata).every(([key, value]) => {
          return metadata?.V1 && metadata.V1[key] === value;
        });
      }
      
      // Compute overall verification result
      const verified = certified && 
        (contentMatch === undefined || contentMatch) && 
        (metadataMatch === undefined || metadataMatch);
      
      return {
        verified,
        details: {
          certified,
          contentMatch,
          metadataMatch,
          epoch: blobInfo.certified_epoch,
          size: parseInt(blobInfo.size)
        }
      };
    } catch (error) {
      throw new CLIError(
        `Verification of existing data failed: ${error instanceof Error ? error.message : String(error)}`,
        'VERIFICATION_ERROR'
      );
    }
  }
}

// Mock the SuiClient
const mockGetLatestSuiSystemState = jest.fn().mockResolvedValue({ epoch: '42' });
const mockGetObject = jest.fn();
const mockSignAndExecuteTransactionBlock = jest.fn().mockResolvedValue({ digest: 'mock-transaction-digest' });

const mockSuiClient = {
  getLatestSuiSystemState: mockGetLatestSuiSystemState,
  getObject: mockGetObject,
  signAndExecuteTransactionBlock: mockSignAndExecuteTransactionBlock
} as unknown as jest.Mocked<SuiClient>;

// Create a mock transaction signer
const mockSigner = {
  connect: () => Promise.resolve(),
  getPublicKey: () => ({ toBytes: () => new Uint8Array(32) }),
  sign: async (data: Uint8Array): Promise<Uint8Array> => new Uint8Array(64),
  signPersonalMessage: async (data: Uint8Array): Promise<SignatureWithBytes> => ({
    bytes: Buffer.from(data).toString('base64'),
    signature: Buffer.from(new Uint8Array(64)).toString('base64')
  }),
  signWithIntent: async (data: Uint8Array, intent: IntentScope): Promise<SignatureWithBytes> => ({
    bytes: Buffer.from(data).toString('base64'),
    signature: Buffer.from(new Uint8Array(64)).toString('base64')
  }),
  signTransactionBlock: async (transaction: any): Promise<SignatureWithBytes> => ({
    bytes: 'mock-transaction-bytes',
    signature: Buffer.from(new Uint8Array(64)).toString('base64')
  }),
  signData: async (data: Uint8Array): Promise<Uint8Array> => new Uint8Array(64),
  signTransaction: async (transaction: any): Promise<SignatureWithBytes> => ({
    bytes: 'mock-transaction-bytes',
    signature: Buffer.from(new Uint8Array(64)).toString('base64')
  }),
  toSuiAddress: () => 'mock-address',
  getKeyScheme: () => 'ED25519' as const
} as unknown as Ed25519Keypair;

describe('Verification Flow End-to-End', () => {
  let flowController: VerificationFlowController;
  let mockWalrusClient: ReturnType<typeof createMockWalrusClient>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockWalrusClient = createMockWalrusClient();
    
    // Set up spy methods on the mock client
    jest.spyOn(mockWalrusClient, 'readBlob');
    jest.spyOn(mockWalrusClient, 'getBlobInfo');
    jest.spyOn(mockWalrusClient, 'getBlobMetadata');
    jest.spyOn(mockWalrusClient, 'writeBlob');
    jest.spyOn(mockWalrusClient, 'executeWriteBlobAttributesTransaction');
    jest.spyOn(mockWalrusClient, 'verifyPoA');
    jest.spyOn(mockWalrusClient, 'getStorageProviders');
    
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
        owner: 'Test User'
      };
      
      // Mock Walrus client responses
      (mockWalrusClient.writeBlob as jest.Mock).mockResolvedValue({
        blobId: 'test-flow-blob-id',
        blobObject: { blob_id: 'test-flow-blob-id' }
      });
      
      (mockWalrusClient.getBlobInfo as jest.Mock).mockResolvedValue({
        blob_id: 'test-flow-blob-id',
        registered_epoch: 40,
        certified_epoch: 41,
        size: String(testData.length),
        metadata: { V1: { 
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          hashes: [{
            primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
            secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
          }],
          $kind: 'V1'
        }, $kind: 'V1' }
      });
      
      (mockWalrusClient.getBlobMetadata as jest.Mock).mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          contentType: 'text/plain',
          description: 'Test data for verification',
          owner: 'Test User',
          $kind: 'V1'
        },
        $kind: 'V1'
      });
      
      (mockWalrusClient.readBlob as jest.Mock).mockResolvedValue(new Uint8Array(testData));
      (mockWalrusClient.getStorageProviders as jest.Mock).mockResolvedValue(['provider1', 'provider2']);
      (mockWalrusClient.verifyPoA as jest.Mock).mockResolvedValue(true);
      
      // Execute the verification flow
      const result = await flowController.executeVerificationFlow(testData, metadata, {
        verifyAfterUpload: true,
        monitorAvailability: true
      });
      
      // Verify the results
      expect(result.blobId).toBe('test-flow-blob-id');
      expect(result.uploadResult.certified).toBe(true);
      expect(result.uploadResult.poaComplete).toBe(true);
      expect(result.uploadResult.hasMinProviders).toBe(true);
      expect(result.verificationResult?.success).toBe(true);
      expect(result.monitoringResult?.successful).toBe(true);
      
      // Verify client calls
      expect(mockWalrusClient.writeBlob).toHaveBeenCalled();
      expect(mockWalrusClient.executeWriteBlobAttributesTransaction).toHaveBeenCalled();
      expect(mockWalrusClient.readBlob).toHaveBeenCalled();
      expect(mockWalrusClient.getBlobInfo).toHaveBeenCalled();
      expect(mockWalrusClient.getBlobMetadata).toHaveBeenCalled();
    });
    
    it('should handle verification failure in the flow', async () => {
      // Test data
      const testData = Buffer.from('test data for verification flow');
      const metadata = {
        contentType: 'text/plain',
        description: 'Test data for verification'
      };
      
      // Mock Walrus client responses for upload success
      (mockWalrusClient.writeBlob as jest.Mock).mockResolvedValue({
        blobId: 'test-flow-blob-id',
        blobObject: { blob_id: 'test-flow-blob-id' }
      });
      
      // Mock certification status (not certified)
      (mockWalrusClient.getBlobInfo as jest.Mock).mockResolvedValue({
        blob_id: 'test-flow-blob-id',
        registered_epoch: 40,
        certified_epoch: undefined, // Not certified
        size: String(testData.length),
        metadata: { V1: { 
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          hashes: [{
            primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
            secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
          }],
          $kind: 'V1'
        }, $kind: 'V1' }
      });
      
      // Mock that data is modified during retrieval
      const modifiedData = Buffer.from('modified test data for verification flow');
      (mockWalrusClient.readBlob as jest.Mock).mockResolvedValue(new Uint8Array(modifiedData));
      (mockWalrusClient.getStorageProviders as jest.Mock).mockResolvedValue(['provider1']);
      (mockWalrusClient.verifyPoA as jest.Mock).mockResolvedValue(false);
      
      // Execute the verification flow, expecting data verification to fail
      const result = await flowController.executeVerificationFlow(testData, metadata, {
        verifyAfterUpload: true,
        requireCertification: false // Don't require certification to see content mismatch
      });
      
      // We should still get results, but verification should fail
      expect(result.blobId).toBe('test-flow-blob-id');
      expect(result.uploadResult.certified).toBe(false);
      expect(result.uploadResult.poaComplete).toBe(false);
      
      // Data verification should fail because content is modified
      expect(result.verificationResult?.success).toBe(false);
    });
    
    it('should handle errors during the verification flow', async () => {
      // Test data
      const testData = Buffer.from('test data for verification flow');
      
      // Mock Walrus client error
      (mockWalrusClient.writeBlob as jest.Mock).mockRejectedValue(
        new Error('Storage allocation failed')
      );
      
      // Execute the verification flow and expect it to fail
      await expect(flowController.executeVerificationFlow(testData)).rejects.toThrow(CLIError);
    });
  });
  
  describe('verifyExistingData', () => {
    it('should verify existing data successfully', async () => {
      // Test data
      const blobId = 'existing-blob-id';
      const testData = Buffer.from('existing test data');
      const metadata = {
        contentType: 'text/plain',
        description: 'Existing test data'
      };
      
      // Mock Walrus client responses
      (mockWalrusClient.getBlobInfo as jest.Mock).mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: String(testData.length),
        metadata: { V1: { 
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          hashes: [{
            primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
            secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
          }],
          $kind: 'V1'
        }, $kind: 'V1' }
      });
      
      (mockWalrusClient.getBlobMetadata as jest.Mock).mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          contentType: 'text/plain',
          description: 'Existing test data',
          $kind: 'V1'
        },
        $kind: 'V1'
      });
      
      (mockWalrusClient.readBlob as jest.Mock).mockResolvedValue(new Uint8Array(testData));
      
      // Execute the verification
      const result = await flowController.verifyExistingData(blobId, testData, metadata);
      
      // Verify the results
      expect(result.verified).toBe(true);
      expect(result.details.certified).toBe(true);
      expect(result.details.contentMatch).toBe(true);
      expect(result.details.metadataMatch).toBe(true);
      expect(result.details.epoch).toBe(41);
      
      // Verify client calls
      expect(mockWalrusClient.getBlobInfo).toHaveBeenCalledWith(blobId);
      expect(mockWalrusClient.getBlobMetadata).toHaveBeenCalledWith({ blobId });
      expect(mockWalrusClient.readBlob).toHaveBeenCalledWith({ blobId });
    });
    
    it('should detect content mismatch', async () => {
      // Test data
      const blobId = 'existing-blob-id';
      const expectedData = Buffer.from('expected test data');
      const actualData = Buffer.from('actual test data'); // Different content
      
      // Mock Walrus client responses
      (mockWalrusClient.getBlobInfo as jest.Mock).mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: String(actualData.length),
        metadata: { V1: { 
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(actualData.length),
          hashes: [{
            primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
            secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
          }],
          $kind: 'V1'
        }, $kind: 'V1' }
      });
      
      (mockWalrusClient.readBlob as jest.Mock).mockResolvedValue(new Uint8Array(actualData));
      
      // Execute the verification
      const result = await flowController.verifyExistingData(blobId, expectedData);
      
      // Verify the results
      expect(result.verified).toBe(false);
      expect(result.details.certified).toBe(true); // Certified but content doesn't match
      expect(result.details.contentMatch).toBe(false);
    });
    
    it('should detect metadata mismatch', async () => {
      // Test data
      const blobId = 'existing-blob-id';
      const metadata = {
        contentType: 'text/plain',
        description: 'Expected description'
      };
      
      // Mock Walrus client responses
      (mockWalrusClient.getBlobInfo as jest.Mock).mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: '1000',
        metadata: { V1: { 
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: '1000',
          hashes: [{
            primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
            secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
          }],
          $kind: 'V1'
        }, $kind: 'V1' }
      });
      
      (mockWalrusClient.getBlobMetadata as jest.Mock).mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: '1000',
          contentType: 'text/plain',
          description: 'Different description', // Different metadata
          $kind: 'V1'
        },
        $kind: 'V1'
      });
      
      // Execute the verification
      const result = await flowController.verifyExistingData(blobId, undefined, metadata);
      
      // Verify the results
      expect(result.verified).toBe(false);
      expect(result.details.certified).toBe(true); // Certified but metadata doesn't match
      expect(result.details.metadataMatch).toBe(false);
    });
    
    it('should handle non-existent blob', async () => {
      const nonExistentBlobId = 'non-existent-blob';
      
      // Mock blob not found
      (mockWalrusClient.getBlobInfo as jest.Mock).mockRejectedValue(
        new Error('Blob not found')
      );
      
      // Execute the verification and expect it to fail
      await expect(flowController.verifyExistingData(nonExistentBlobId)).rejects.toThrow(CLIError);
    });
    
    it('should detect uncertified blob', async () => {
      // Test data
      const blobId = 'uncertified-blob-id';
      
      // Mock Walrus client responses for uncertified blob
      (mockWalrusClient.getBlobInfo as jest.Mock).mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: undefined, // Not certified
        size: '1000',
        metadata: { V1: { 
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: '1000',
          hashes: [{
            primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
            secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
          }],
          $kind: 'V1'
        }, $kind: 'V1' }
      });
      
      // Execute the verification
      const result = await flowController.verifyExistingData(blobId);
      
      // Verify the results
      expect(result.verified).toBe(false);
      expect(result.details.certified).toBe(false);
    });
  });
});