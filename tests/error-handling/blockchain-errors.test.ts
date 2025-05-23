/**
 * Blockchain Error Handling Tests
 * 
 * Tests the application's handling of blockchain-related errors,
 * including transaction failures, verification errors, and consensus issues.
 */

import { BlockchainError, TransactionError } from '../../src/types/errors';
import { ErrorSimulator, ErrorType } from '../helpers/error-simulator';
import { BlobVerificationManager } from '../../src/utils/blob-verification';

// Create mock clients and services
const createMockSuiClient = () => ({
  getLatestSuiSystemState: jest.fn().mockResolvedValue({ epoch: '42' }),
  executeTransactionBlock: jest.fn().mockResolvedValue({
    digest: 'mock-tx-digest',
    effects: { status: { status: 'success' } },
    events: []
  }),
  waitForTransactionBlock: jest.fn().mockResolvedValue({
    digest: 'mock-tx-digest',
    effects: { status: { status: 'success' } },
    events: []
  })
});

const createMockWalrusClient = () => ({
  readBlob: jest.fn().mockResolvedValue(new Uint8Array(Buffer.from('test data'))),
  getBlobInfo: jest.fn().mockResolvedValue({
    blob_id: 'test-blob-id',
    registered_epoch: 40,
    certified_epoch: 41,
    size: '9',
    metadata: {
      V1: {
        encoding_type: { RedStuff: true, $kind: 'RedStuff' },
        unencoded_length: '9',
        hashes: [{
          primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
          secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
        }],
        $kind: 'V1'
      },
      $kind: 'V1'
    }
  }),
  getBlobMetadata: jest.fn().mockResolvedValue({
    V1: {
      encoding_type: { RedStuff: true, $kind: 'RedStuff' },
      unencoded_length: '9',
      contentType: 'text/plain',
      hashes: [{
        primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
        secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
      }],
      $kind: 'V1'
    },
    $kind: 'V1'
  }),
  verifyPoA: jest.fn().mockResolvedValue(true),
  getStorageProviders: jest.fn().mockResolvedValue(['provider1', 'provider2'])
});

const createMockSigner = () => ({
  signPersonalMessage: jest.fn().mockResolvedValue({
    bytes: 'mock-bytes',
    signature: 'mock-signature',
  }),
  signWithIntent: jest.fn().mockResolvedValue({
    bytes: 'mock-bytes',
    signature: 'mock-signature',
  }),
  signTransactionBlock: jest.fn().mockResolvedValue({
    bytes: 'mock-transaction-bytes',
    signature: 'mock-signature',
  }),
  getPublicKey: jest.fn().mockReturnValue({
    toBytes: jest.fn().mockReturnValue(new Uint8Array(32))
  })
});

describe('Blockchain Error Handling', () => {
  let mockSuiClient: ReturnType<typeof createMockSuiClient>;
  let mockWalrusClient: ReturnType<typeof createMockWalrusClient>;
  let mockSigner: ReturnType<typeof createMockSigner>;
  let verificationManager: BlobVerificationManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSuiClient = createMockSuiClient();
    mockWalrusClient = createMockWalrusClient();
    mockSigner = createMockSigner();
    
    verificationManager = new BlobVerificationManager(
      mockSuiClient as any,
      mockWalrusClient as any,
      mockSigner as any
    );
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('Transaction Errors', () => {
    it('should handle transaction execution failures', async () => {
      // Create error simulator
      const errorSimulator = new ErrorSimulator({
        enabled: true,
        errorType: ErrorType.TRANSACTION,
        probability: 1.0,
        errorMessage: 'Transaction execution failed: gas limit exceeded',
        additionalContext: {
          operation: 'execute',
          transactionId: 'mock-tx-id'
        }
      });
      
      // Apply simulator to client method
      errorSimulator.simulateErrorOnMethod(
        mockSuiClient,
        'executeTransactionBlock',
        'executeTransaction'
      );
      
      // Create a simple transaction wrapper
      const executeTransaction = async () => {
        try {
          await mockSuiClient.executeTransactionBlock({});
        } catch (error: any) {
          if (error instanceof TransactionError || 
              error.message?.includes('Transaction')) {
            throw new TransactionError('Transaction failed', {
              operation: 'execute',
              transactionId: 'mock-tx-id',
              recoverable: false,
              cause: error
            });
          }
          throw error;
        }
      };
      
      // Attempt transaction
      await expect(executeTransaction())
        .rejects.toThrow(TransactionError);
      
      // Verify specific error properties
      try {
        await executeTransaction();
      } catch (error: any) {
        expect(error.code).toContain('TRANSACTION_EXECUTE_ERROR');
        expect(error.transactionId).toBe('mock-tx-id');
        expect(error.recoverable).toBe(false);
      }
    });
    
    it('should handle transaction timeout errors', async () => {
      // Mock a timeout when waiting for transaction
      mockSuiClient.waitForTransactionBlock.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Transaction wait timed out')), 100);
        });
      });
      
      // Create transaction wrapper with timeout
      const executeWithTimeout = async () => {
        try {
          // First execute, then wait
          await mockSuiClient.executeTransactionBlock({});
          
          // This should timeout
          await mockSuiClient.waitForTransactionBlock({
            digest: 'mock-tx-digest',
            options: { timeout: 50 }
          });
        } catch (error: any) {
          throw new TransactionError('Transaction confirmation timeout', {
            operation: 'confirm',
            transactionId: 'mock-tx-digest',
            recoverable: true, // Can retry confirmation
            cause: error
          });
        }
      };
      
      // Attempt transaction with timeout
      await expect(executeWithTimeout())
        .rejects.toThrow(/Transaction confirmation timeout/);
    });
    
    it('should handle transaction rejection errors', async () => {
      // Mock transaction rejection
      mockSuiClient.executeTransactionBlock.mockRejectedValueOnce({
        code: 'TRANSACTION_REJECTED',
        message: 'Transaction rejected: Insufficient gas',
        details: { reason: 'gas_insufficient' }
      });
      
      // Attempt transaction
      const executeTransaction = async () => {
        try {
          await mockSuiClient.executeTransactionBlock({});
        } catch (error: any) {
          throw new TransactionError(`Transaction rejected: ${error.message}`, {
            operation: 'execute',
            recoverable: false,
            cause: error
          });
        }
      };
      
      await expect(executeTransaction())
        .rejects.toThrow(/Transaction rejected/);
    });
  });
  
  describe('Blockchain Certification Errors', () => {
    it('should handle uncertified blobs correctly', async () => {
      // Mock uncertified blob
      mockWalrusClient.getBlobInfo.mockResolvedValueOnce({
        blob_id: 'test-blob-id',
        registered_epoch: 40,
        certified_epoch: undefined, // Not certified
        size: '9',
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: '9',
            hashes: [{
              primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
              secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
            }],
            $kind: 'V1'
          },
          $kind: 'V1'
        }
      });
      
      // Test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data');
      const expectedAttributes = { contentType: 'text/plain' };
      
      // Verify with certification required
      await expect(verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { requireCertification: true }
      )).rejects.toThrow(BlockchainError);
      
      // Verify without certification requirement
      const result = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { requireCertification: false }
      );
      
      // Should still work but indicate not certified
      expect(result.success).toBe(true);
      expect(result.details.certified).toBe(false);
    });
    
    it('should handle proof of availability verification errors', async () => {
      // Mock PoA verification failure
      mockWalrusClient.verifyPoA.mockRejectedValueOnce(
        new Error('Failed to verify proof of availability')
      );
      
      // Test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data');
      const expectedAttributes = { contentType: 'text/plain' };
      
      // Verification should still succeed overall
      const result = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { requireCertification: false }
      );
      
      // Should indicate PoA issues
      expect(result.success).toBe(true);
      expect(result.poaComplete).toBe(false);
    });
    
    it('should handle providers being unavailable', async () => {
      // Mock no available providers
      mockWalrusClient.getStorageProviders.mockResolvedValueOnce([]);
      
      // Test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data');
      const expectedAttributes = { contentType: 'text/plain' };
      
      // Verification should still succeed but indicate provider issues
      const result = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes
      );
      
      expect(result.success).toBe(true);
      expect(result.providers).toBe(0);
    });
  });
  
  describe('Metadata Verification Errors', () => {
    it('should handle metadata mismatch errors', async () => {
      // Mock metadata with mismatches
      mockWalrusClient.getBlobMetadata.mockResolvedValueOnce({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: '9',
          contentType: 'application/json', // Mismatch, expected text/plain
          hashes: [{
            primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
            secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
          }],
          $kind: 'V1'
        },
        $kind: 'V1'
      });
      
      // Test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data');
      const expectedAttributes = { contentType: 'text/plain' };
      
      // Verify with attribute verification enabled
      await expect(verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { verifyAttributes: true }
      )).rejects.toThrow(BlockchainError);
      
      // Verify detailed error message
      try {
        await verificationManager.verifyBlob(
          blobId,
          testData,
          expectedAttributes,
          { verifyAttributes: true }
        );
      } catch (error: any) {
        expect(error.message).toContain('Metadata verification failed');
        expect(error.message).toContain('contentType');
      }
    });
    
    it('should handle missing metadata', async () => {
      // Mock missing metadata
      mockWalrusClient.getBlobMetadata.mockResolvedValueOnce(null);
      
      // Test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data');
      const expectedAttributes = { contentType: 'text/plain' };
      
      // Verify with attributes verification
      await expect(verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { verifyAttributes: true }
      )).rejects.toThrow(BlockchainError);
    });
  });
  
  describe('Network and RPC Errors', () => {
    it('should handle RPC endpoint failures', async () => {
      // Mock RPC error for blob info
      mockWalrusClient.getBlobInfo
        .mockRejectedValueOnce(new Error('RPC endpoint error'))
        .mockResolvedValueOnce({
          blob_id: 'test-blob-id',
          registered_epoch: 40,
          certified_epoch: 41,
          size: '9',
          metadata: {
            V1: {
              encoding_type: { RedStuff: true, $kind: 'RedStuff' },
              unencoded_length: '9',
              hashes: [{
                primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
                secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
              }],
              $kind: 'V1'
            },
            $kind: 'V1'
          }
        });
      
      // Test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data');
      const expectedAttributes = { contentType: 'text/plain' };
      
      // Verification should succeed after retry
      const result = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes
      );
      
      // Verify success and retry
      expect(result.success).toBe(true);
      expect(mockWalrusClient.getBlobInfo).toHaveBeenCalledTimes(2);
    });
    
    it('should handle sudden disconnection with retries', async () => {
      // Create error simulator for network disconnection
      const errorSimulator = new ErrorSimulator({
        enabled: true,
        errorType: ErrorType.NETWORK,
        probability: 1.0,
        errorMessage: 'Network connection lost',
        additionalContext: {
          // First try fails, then recovers
          errorFactory: () => {
            errorSimulator.updateConfig({ enabled: false }); // Disable for future calls
            return new Error('Connection reset by peer');
          }
        }
      });
      
      // Apply simulator to client method
      errorSimulator.simulateErrorOnMethod(
        mockWalrusClient,
        'readBlob',
        'readOperation'
      );
      
      // Test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data');
      const expectedAttributes = { contentType: 'text/plain' };
      
      // Verification should succeed after retry
      const result = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes
      );
      
      // Verify success
      expect(result.success).toBe(true);
    });
    
    it('should handle epoch validation errors', async () => {
      // Mock epoch issue
      mockSuiClient.getLatestSuiSystemState.mockResolvedValueOnce({
        epoch: '39' // Less than the certified epoch of 41
      });
      
      // Test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data');
      const expectedAttributes = { contentType: 'text/plain' };
      
      // Verification should fail due to epoch validation
      await expect(verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { requireEpochValidation: true }
      )).rejects.toThrow(BlockchainError);
      
      // Verify error details
      try {
        await verificationManager.verifyBlob(
          blobId,
          testData,
          expectedAttributes,
          { requireEpochValidation: true }
        );
      } catch (error: any) {
        expect(error.message).toContain('Epoch validation failed');
      }
    });
  });
  
  describe('Signing Errors', () => {
    it('should handle signing failures', async () => {
      // Create error simulator for signing
      const errorSimulator = new ErrorSimulator({
        enabled: true,
        errorType: ErrorType.PERMISSION_DENIED,
        probability: 1.0,
        errorMessage: 'User denied signing request'
      });
      
      // Apply simulator to signing method
      errorSimulator.simulateErrorOnMethod(
        mockSigner,
        'signPersonalMessage',
        'signMessage'
      );
      
      // Create signing operation
      const signMessage = async () => {
        try {
          await mockSigner.signPersonalMessage(new Uint8Array(Buffer.from('Test message')));
        } catch (error: any) {
          throw new BlockchainError('Signing operation failed', {
            operation: 'sign',
            recoverable: false,
            cause: error
          });
        }
      };
      
      // Attempt signing
      await expect(signMessage())
        .rejects.toThrow(BlockchainError);
      
      // Verify error details
      try {
        await signMessage();
      } catch (error: any) {
        expect(error.code).toBe('BLOCKCHAIN_SIGN_ERROR');
        expect(error.shouldRetry).toBe(false);
      }
    });
  });
  
  describe('Recovery and Resilience', () => {
    it('should recover from transient verification failures', async () => {
      // Mock transient failures for read blob
      mockWalrusClient.readBlob
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValueOnce(new Uint8Array(Buffer.from('test data')));
      
      // Test data
      const blobId = 'test-blob-id';
      const testData = Buffer.from('test data');
      const expectedAttributes = { contentType: 'text/plain' };
      
      // Verification should succeed after retries
      const result = await verificationManager.verifyBlob(
        blobId,
        testData,
        expectedAttributes,
        { maxRetries: 3 }
      );
      
      // Verify success after retries
      expect(result.success).toBe(true);
      expect(mockWalrusClient.readBlob).toHaveBeenCalledTimes(3);
    });
    
    it('should implement circuit breaker for persistently failing operations', async () => {
      // Create a circuit breaker wrapper similar to what's in the app
      const circuitBreakerState = {
        failureCount: 0,
        lastFailure: 0,
        isOpen: false,
        failureThreshold: 3,
        resetTimeout: 1000
      };
      
      // Mock repeatedly failing operation
      mockWalrusClient.readBlob.mockRejectedValue(
        new Error('Persistent network error')
      );
      
      // Create circuit breaker wrapper
      const executeWithCircuitBreaker = async () => {
        // Check if circuit is open
        if (circuitBreakerState.isOpen) {
          // Check if it's time to retry
          const timeElapsed = Date.now() - circuitBreakerState.lastFailure;
          if (timeElapsed < circuitBreakerState.resetTimeout) {
            throw new BlockchainError('Circuit breaker open', {
              operation: 'execute',
              recoverable: false
            });
          }
          // Reset circuit for a retry attempt
          circuitBreakerState.isOpen = false;
        }
        
        try {
          // Execute operation
          return await mockWalrusClient.readBlob('test-blob-id');
        } catch (error: any) {
          // Update circuit state
          circuitBreakerState.failureCount++;
          circuitBreakerState.lastFailure = Date.now();
          
          // Open circuit if threshold exceeded
          if (circuitBreakerState.failureCount >= circuitBreakerState.failureThreshold) {
            circuitBreakerState.isOpen = true;
          }
          
          throw error;
        }
      };
      
      // Attempt multiple operations to trigger circuit breaker
      const operations = [];
      for (let i = 0; i < 5; i++) {
        operations.push(executeWithCircuitBreaker().catch(e => e));
      }
      
      // Wait for all operations
      const results = await Promise.all(operations);
      
      // First 3 should be regular errors, the rest should be circuit breaker errors
      const regularErrors = results.filter(r => 
        r instanceof Error && !r.message.includes('Circuit breaker')
      );
      
      const circuitErrors = results.filter(r => 
        r instanceof Error && r.message.includes('Circuit breaker')
      );
      
      expect(regularErrors.length).toBe(3); // Initial failures
      expect(circuitErrors.length).toBe(2); // Circuit breaker protected
    });
  });
  
  describe('Error Simulation Integration', () => {
    it('should handle progressive blockchain degradation', async () => {
      // Create a progressive blockchain error simulator
      // Each successive failure has a higher probability
      let failureProbability = 0.25;
      
      const errorSimulator = new ErrorSimulator({
        enabled: true,
        errorType: ErrorType.BLOCKCHAIN,
        probability: failureProbability,
        errorMessage: 'Blockchain node degrading',
        additionalContext: {
          operation: 'query'
        },
        errorFactory: () => {
          // Increase failure probability for next time
          failureProbability = Math.min(1.0, failureProbability + 0.15);
          errorSimulator.updateConfig({ probability: failureProbability });
          
          return new BlockchainError('Blockchain node error', {
            operation: 'query',
            recoverable: true
          });
        }
      });
      
      // Apply simulator to blockchain query
      errorSimulator.simulateErrorOnMethod(
        mockSuiClient,
        'getLatestSuiSystemState',
        'getSystemState'
      );
      
      // Make multiple blockchain queries
      const results = [];
      
      for (let i = 0; i < 10; i++) {
        try {
          const result = await mockSuiClient.getLatestSuiSystemState();
          results.push({ success: true, result });
        } catch (error: any) {
          results.push({ success: false, error: error.message });
        }
      }
      
      // Verify progressive degradation pattern
      const successes = results.filter(r => r.success).length;
      const failures = results.filter(r => !r.success).length;
      
      // Should have some successes and some failures
      expect(successes).toBeGreaterThan(0);
      expect(failures).toBeGreaterThan(0);
      
      // Later queries should fail more often
      const firstHalf = results.slice(0, 5);
      const secondHalf = results.slice(5);
      
      const firstHalfSuccesses = firstHalf.filter(r => r.success).length;
      const secondHalfSuccesses = secondHalf.filter(r => r.success).length;
      
      // Second half should have fewer successes
      expect(secondHalfSuccesses).toBeLessThan(firstHalfSuccesses);
    });
  });
});