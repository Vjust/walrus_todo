import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createMockWalrusClient } from '../../../src/utils/MockWalrusClient';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SignatureWithBytes, IntentScope } from '@mysten/sui/cryptography';
import { CLIError } from '../../../src/types/error';
import { BlobVerificationManager } from '../../../src/utils/blob-verification';
import { setTimeout as sleep } from 'timers/promises';

// Mock RetryManager class that's used by BlobVerificationManager
jest.mock('../../../src/utils/retry-manager', () => {
  return {
    RetryManager: jest.fn().mockImplementation((nodes, options) => ({
      execute: jest.fn().mockImplementation(async (callback, operationName) => {
        try {
          return await callback(nodes[0]);
        } catch (error) {
          // If mock is configured to throw, propagate the error
          throw error;
        }
      })
    }))
  };
});

// Mock the SuiClient
const mockGetLatestSuiSystemState = jest.fn().mockResolvedValue({ epoch: '42' });
const mockSuiClient = {
  getLatestSuiSystemState: mockGetLatestSuiSystemState,
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
  let mockWalrusClient: ReturnType<typeof createMockWalrusClient>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockWalrusClient = createMockWalrusClient();
    
    // Set up spy methods on the mock client
    jest.spyOn(mockWalrusClient, 'readBlob');
    jest.spyOn(mockWalrusClient, 'getBlobInfo');
    jest.spyOn(mockWalrusClient, 'getBlobMetadata');
    jest.spyOn(mockWalrusClient, 'writeBlob');
    jest.spyOn(mockWalrusClient, 'verifyPoA');
    jest.spyOn(mockWalrusClient, 'getStorageProviders');
    
    verificationManager = new BlobVerificationManager(
      mockSuiClient, 
      mockWalrusClient.getUnderlyingClient(), 
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
      const expectedAttributes = { contentType: 'text/plain' };
      
      // First call fails with a network error, second call succeeds
      (mockWalrusClient.readBlob as jest.Mock)
        .mockRejectedValueOnce(createErrorWithCode('Network error', 'ECONNRESET'))
        .mockResolvedValueOnce(new Uint8Array(testData));
        
      (mockWalrusClient.getBlobInfo as jest.Mock).mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: String(testData.length),
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: String(testData.length),
            hashes: [{
              primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
              secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
            }],
            $kind: 'V1'
          },
          $kind: 'V1'
        }
      });
      
      (mockWalrusClient.getBlobMetadata as jest.Mock).mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          contentType: 'text/plain',
          hashes: [{
            primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
            secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
          }],
          $kind: 'V1'
        },
        $kind: 'V1'
      });
      
      (mockWalrusClient.getStorageProviders as jest.Mock).mockResolvedValue(['provider1', 'provider2']);
      (mockWalrusClient.verifyPoA as jest.Mock).mockResolvedValue(true);
      
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
      const expectedAttributes = { contentType: 'text/plain' };
      
      // Setup success for readBlob
      (mockWalrusClient.readBlob as jest.Mock).mockResolvedValue(new Uint8Array(testData));
      
      // First call to getBlobInfo fails with RPC error, second call succeeds
      (mockWalrusClient.getBlobInfo as jest.Mock)
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
              hashes: [{
                primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
                secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
              }],
              $kind: 'V1'
            },
            $kind: 'V1'
          }
        });
        
      (mockWalrusClient.getBlobMetadata as jest.Mock).mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          contentType: 'text/plain',
          hashes: [{
            primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
            secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
          }],
          $kind: 'V1'
        },
        $kind: 'V1'
      });
      
      (mockWalrusClient.getStorageProviders as jest.Mock).mockResolvedValue(['provider1', 'provider2']);
      (mockWalrusClient.verifyPoA as jest.Mock).mockResolvedValue(true);
      
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
      const expectedAttributes = { contentType: 'text/plain' };
      
      // All calls to readBlob fail with network errors
      (mockWalrusClient.readBlob as jest.Mock).mockRejectedValue(
        createErrorWithCode('Persistent network error', 'ECONNREFUSED')
      );
      
      // Execute the verification with few retries to speed up test
      await expect(verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { maxRetries: 2, baseDelay: 10 }
      )).rejects.toThrow(CLIError);
      
      // Check the error message contains useful information
      try {
        await verificationManager.verifyBlob(
          blobId,
          testData,
          expectedAttributes,
          { maxRetries: 2, baseDelay: 10 }
        );
      } catch (error) {
        expect((error as CLIError).message).toContain('verification failed after');
        expect((error as CLIError).code).toBe('WALRUS_VERIFICATION_FAILED');
      }
    });
  });
  
  describe('Timeouts and Rate Limiting', () => {
    it('should handle timeouts during verification', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for verification');
      const expectedAttributes = { contentType: 'text/plain' };
      
      // First call times out, second call succeeds
      (mockWalrusClient.readBlob as jest.Mock)
        .mockImplementationOnce(async () => {
          await sleep(500); // Simulate a slow response
          throw new Error('Timeout');
        })
        .mockResolvedValueOnce(new Uint8Array(testData));
      
      (mockWalrusClient.getBlobInfo as jest.Mock).mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: String(testData.length),
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: String(testData.length),
            hashes: [{
              primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
              secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
            }],
            $kind: 'V1'
          },
          $kind: 'V1'
        }
      });
      
      (mockWalrusClient.getBlobMetadata as jest.Mock).mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          contentType: 'text/plain',
          hashes: [{
            primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
            secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
          }],
          $kind: 'V1'
        },
        $kind: 'V1'
      });
      
      (mockWalrusClient.getStorageProviders as jest.Mock).mockResolvedValue(['provider1', 'provider2']);
      (mockWalrusClient.verifyPoA as jest.Mock).mockResolvedValue(true);
      
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
      const expectedAttributes = { contentType: 'text/plain' };
      
      // First call gets rate limited, second call succeeds
      (mockWalrusClient.getBlobInfo as jest.Mock)
        .mockRejectedValueOnce({ 
          message: 'Too many requests', 
          status: 429 
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
              hashes: [{
                primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
                secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
              }],
              $kind: 'V1'
            },
            $kind: 'V1'
          }
        });
       
      (mockWalrusClient.readBlob as jest.Mock).mockResolvedValue(new Uint8Array(testData));
        
      (mockWalrusClient.getBlobMetadata as jest.Mock).mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          contentType: 'text/plain',
          hashes: [{
            primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
            secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
          }],
          $kind: 'V1'
        },
        $kind: 'V1'
      });
      
      (mockWalrusClient.getStorageProviders as jest.Mock).mockResolvedValue(['provider1', 'provider2']);
      (mockWalrusClient.verifyPoA as jest.Mock).mockResolvedValue(true);
      
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
      const expectedAttributes = { contentType: 'text/plain' };
      
      // Setup success for readBlob and getBlobInfo
      (mockWalrusClient.readBlob as jest.Mock).mockResolvedValue(new Uint8Array(testData));
      (mockWalrusClient.getBlobInfo as jest.Mock).mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: String(testData.length)
        // Missing metadata field
      });
      
      // Return null for metadata
      (mockWalrusClient.getBlobMetadata as jest.Mock).mockResolvedValue(null);
      
      (mockWalrusClient.getStorageProviders as jest.Mock).mockResolvedValue(['provider1', 'provider2']);
      (mockWalrusClient.verifyPoA as jest.Mock).mockResolvedValue(true);
      
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
        contentType: 'text/plain',
        owner: 'user123',
        tags: 'important,verification'
      };
      
      // Setup success for readBlob and getBlobInfo
      (mockWalrusClient.readBlob as jest.Mock).mockResolvedValue(new Uint8Array(testData));
      (mockWalrusClient.getBlobInfo as jest.Mock).mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: String(testData.length),
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: String(testData.length),
            hashes: [{
              primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
              secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
            }],
            $kind: 'V1'
          },
          $kind: 'V1'
        }
      });
      
      // Return metadata with only some matching fields
      (mockWalrusClient.getBlobMetadata as jest.Mock).mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          contentType: 'text/plain', // This matches
          owner: 'different-user', // This doesn't match
          // Missing 'tags' field
          $kind: 'V1'
        },
        $kind: 'V1'
      });
      
      (mockWalrusClient.getStorageProviders as jest.Mock).mockResolvedValue(['provider1', 'provider2']);
      (mockWalrusClient.verifyPoA as jest.Mock).mockResolvedValue(true);
      
      // Execute the verification with verifyAttributes enabled
      await expect(verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { verifyAttributes: true }
      )).rejects.toThrow(CLIError);
      
      // Check the specific error contains details about mismatches
      try {
        await verificationManager.verifyBlob(
          blobId,
          testData,
          expectedAttributes,
          { verifyAttributes: true }
        );
      } catch (error) {
        expect((error as CLIError).message).toContain('Metadata verification failed');
        expect((error as CLIError).message).toContain('owner:');
        expect((error as CLIError).message).toContain('expected "user123", got "different-user"');
      }
    });
  });
  
  describe('Blockchain-Specific Errors', () => {
    it('should handle missing certification', async () => {
      // Create test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data for verification');
      const expectedAttributes = { contentType: 'text/plain' };
      
      // Setup success for readBlob
      (mockWalrusClient.readBlob as jest.Mock).mockResolvedValue(new Uint8Array(testData));
      
      // But blob is not certified
      (mockWalrusClient.getBlobInfo as jest.Mock).mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: undefined, // Not certified
        size: String(testData.length),
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: String(testData.length),
            hashes: [{
              primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
              secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
            }],
            $kind: 'V1'
          },
          $kind: 'V1'
        }
      });
        
      (mockWalrusClient.getBlobMetadata as jest.Mock).mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          contentType: 'text/plain',
          hashes: [{
            primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
            secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
          }],
          $kind: 'V1'
        },
        $kind: 'V1'
      });
      
      (mockWalrusClient.getStorageProviders as jest.Mock).mockResolvedValue(['provider1']);
      (mockWalrusClient.verifyPoA as jest.Mock).mockResolvedValue(false);
      
      // Execute the verification with requireCertification enabled
      await expect(verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { requireCertification: true }
      )).rejects.toThrow(CLIError);
      
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
      const expectedAttributes = { contentType: 'text/plain' };
      
      // Setup success for readBlob and getBlobInfo
      (mockWalrusClient.readBlob as jest.Mock).mockResolvedValue(new Uint8Array(testData));
      (mockWalrusClient.getBlobInfo as jest.Mock).mockResolvedValue({
        blob_id: blobId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: String(testData.length),
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: String(testData.length),
            hashes: [{
              primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
              secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
            }],
            $kind: 'V1'
          },
          $kind: 'V1'
        }
      });
      
      (mockWalrusClient.getBlobMetadata as jest.Mock).mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(testData.length),
          contentType: 'text/plain',
          hashes: [{
            primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
            secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
          }],
          $kind: 'V1'
        },
        $kind: 'V1'
      });
      
      // verifyPoA throws an exception
      (mockWalrusClient.verifyPoA as jest.Mock).mockRejectedValue(
        new Error('PoA verification failed')
      );
      
      // getStorageProviders returns empty array (no providers)
      (mockWalrusClient.getStorageProviders as jest.Mock).mockResolvedValue([]);
      
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