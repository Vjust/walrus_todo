import { BlobVerificationManager } from '../../apps/cli/src/utils/blob-verification';
import { AIVerificationService } from '../../apps/cli/src/services/ai/AIVerificationService';
import { SuiAIVerifierAdapter } from '../../apps/cli/src/services/ai/adapters/SuiAIVerifierAdapter';
import {
  AIActionType,
  AIPrivacyLevel,
  VerificationRecord,
} from '../../apps/cli/src/types/adapters/AIVerifierAdapter';
import { createHash } from 'crypto';
import { Logger } from '../../apps/cli/src/utils/Logger';

// Mock the logger to avoid console noise during tests
jest.mock('../../apps/cli/src/utils/Logger');

describe('Hash Verification and Tamper Detection Fixes', () => {
  describe('BlobVerificationManager', () => {
    let mockSuiClient: any;
    let mockWalrusClient: any;
    let verificationManager: BlobVerificationManager;

    beforeEach(() => {
      mockSuiClient = {
        getLatestSuiSystemState: jest.fn().mockResolvedValue({
          epoch: '42',
        }),
      };

      mockWalrusClient = {
        readBlob: jest.fn(),
        getBlobInfo: jest.fn(),
        getBlobMetadata: jest.fn(),
        getStorageProviders: jest
          .fn()
          .mockResolvedValue(['provider1', 'provider2']),
        verifyPoA: jest.fn().mockResolvedValue(true),
      };

      verificationManager = new BlobVerificationManager(
        mockSuiClient,
        mockWalrusClient
      );
    });

    it('should properly detect hash tampering and return correct boolean values', async () => {
      const originalData = Buffer.from('original data');
      const tamperedData = Buffer.from('tampered data');

      // Setup mocks to return tampered data
      mockWalrusClient.readBlob.mockResolvedValue(tamperedData);
      mockWalrusClient.getBlobInfo.mockResolvedValue({
        blob_id: 'test-blob',
        certified_epoch: 41,
        registered_epoch: 40,
      });

      // Verification should FAIL (throw error) when data is tampered
      await expect(
        verificationManager.verifyBlob('test-blob', originalData, {})
      ).rejects.toThrow('TAMPERING DETECTED');
    });

    it('should pass verification when hashes match correctly', async () => {
      const originalData = Buffer.from('test data');

      // Setup mocks to return same data
      mockWalrusClient.readBlob.mockResolvedValue(originalData);
      mockWalrusClient.getBlobInfo.mockResolvedValue({
        blob_id: 'test-blob',
        certified_epoch: 41,
        registered_epoch: 40,
      });
      mockWalrusClient.getBlobMetadata.mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: '9',
          hashes: [],
          $kind: 'V1',
        },
        $kind: 'V1',
      });

      // Verification should PASS when data matches
      const result = await verificationManager.verifyBlob(
        'test-blob',
        originalData,
        {}
      );
      expect(result.success).toBe(true);
    });

    it('should generate collision-resistant hashes with proper validation', async () => {
      const data = Buffer.from('test data for hash validation');
      const originalData = Buffer.from('test data for hash validation');

      mockWalrusClient.readBlob.mockResolvedValue(data);
      mockWalrusClient.getBlobInfo.mockResolvedValue({
        blob_id: 'test-blob',
        certified_epoch: 41,
        registered_epoch: 40,
      });
      mockWalrusClient.getBlobMetadata.mockResolvedValue({
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: String(data.length),
          hashes: [],
          $kind: 'V1',
        },
        $kind: 'V1',
      });

      const result = await verificationManager.verifyBlob(
        'test-blob',
        originalData,
        {}
      );

      // Verify hash formats and collision resistance
      expect(result.details.checksum).toMatch(/^[a-fA-F0-9]{64}$/); // SHA-256 format
      expect(result.details.checksum.length).toBe(64); // Proper length
      expect(result.success).toBe(true);
    });
  });

  describe('SuiAIVerifierAdapter', () => {
    let mockSuiClient: any;
    let mockSigner: any;
    let adapter: SuiAIVerifierAdapter;

    beforeEach(() => {
      mockSuiClient = {};
      mockSigner = {
        toSuiAddress: jest.fn().mockReturnValue('0x123'),
        signAndExecuteTransaction: jest.fn(),
        signPersonalMessage: jest.fn(),
        getPublicKey: jest.fn().mockReturnValue({
          toBase64: jest.fn().mockReturnValue('mockPublicKey'),
        }),
      };

      adapter = new SuiAIVerifierAdapter(
        mockSuiClient,
        mockSigner,
        'package-id',
        'registry-id'
      );
    });

    it('should return true for valid hash verification and false for tampering', async () => {
      const request = 'test request';
      const response = 'test response';

      // Calculate expected hashes
      const expectedRequestHash = createHash('sha256')
        .update(request)
        .digest('hex');
      const expectedResponseHash = createHash('sha256')
        .update(response)
        .digest('hex');

      const validRecord: VerificationRecord = {
        id: 'test-id',
        requestHash: expectedRequestHash,
        responseHash: expectedResponseHash,
        user: '0x123',
        provider: 'test',
        timestamp: Date.now(),
        verificationType: AIActionType.SUMMARIZE,
        metadata: {},
      };

      // Should return TRUE for valid verification (no tampering)
      const validResult = await adapter.verifyRecord(
        validRecord,
        request,
        response
      );
      expect(validResult).toBe(true);

      // Should return FALSE for tampered request
      const tamperedResult = await adapter.verifyRecord(
        validRecord,
        'tampered request',
        response
      );
      expect(tamperedResult).toBe(false);

      // Should return FALSE for tampered response
      const tamperedResponse = await adapter.verifyRecord(
        validRecord,
        request,
        'tampered response'
      );
      expect(tamperedResponse).toBe(false);
    });

    it('should validate hash format for collision resistance', async () => {
      const request = 'test request';
      const response = 'test response';

      // Invalid hash format should fail validation
      const invalidRecord: VerificationRecord = {
        id: 'test-id',
        requestHash: 'invalid-hash', // Not 64 hex chars
        responseHash: 'another-invalid-hash',
        user: '0x123',
        provider: 'test',
        timestamp: Date.now(),
        verificationType: AIActionType.SUMMARIZE,
        metadata: {},
      };

      const result = await adapter.verifyRecord(
        invalidRecord,
        request,
        response
      );
      expect(result).toBe(false);
    });

    it('should prevent timestamp manipulation and replay attacks', async () => {
      // Test with future timestamp (should be rejected)
      const futureTimestamp = Date.now() + 10 * 60 * 1000; // 10 minutes in future
      const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago

      // Mock the retention policy method to test timestamp validation
      const mockVerifications = [
        {
          id: 'future-record',
          timestamp: futureTimestamp,
          requestHash: 'a'.repeat(64),
          responseHash: 'b'.repeat(64),
          user: '0x123',
          provider: 'test',
          verificationType: AIActionType.SUMMARIZE,
          metadata: {},
        },
        {
          id: 'old-record',
          timestamp: oldTimestamp,
          requestHash: 'c'.repeat(64),
          responseHash: 'd'.repeat(64),
          user: '0x123',
          provider: 'test',
          verificationType: AIActionType.SUMMARIZE,
          metadata: {},
        },
      ];

      // Mock listVerifications to return our test data
      jest
        .spyOn(adapter, 'listVerifications')
        .mockResolvedValue(mockVerifications);

      // Mock successful transaction execution
      mockSigner.signAndExecuteTransaction.mockResolvedValue({
        effects: { created: [] },
      });

      // Should reject old records and skip invalid timestamps
      const deletedCount = await adapter.enforceRetentionPolicy(1); // 1 day retention
      expect(deletedCount).toBe(1); // Only the old record should be deleted
    });
  });

  describe('AIVerificationService', () => {
    let mockVerifierAdapter: jest.Mocked<SuiAIVerifierAdapter>;
    let service: AIVerificationService;

    beforeEach(() => {
      mockVerifierAdapter = {
        createVerification: jest.fn(),
        verifyRecord: jest.fn(),
        getVerification: jest.fn(),
        getProviderInfo: jest.fn(),
        listVerifications: jest.fn(),
        getRegistryAddress: jest.fn(),
        registerProvider: jest.fn(),
        getSigner: jest.fn(),
        generateProof: jest.fn(),
        exportVerifications: jest.fn(),
        enforceRetentionPolicy: jest.fn(),
        securelyDestroyData: jest.fn(),
      } as any;

      service = new AIVerificationService(mockVerifierAdapter);
    });

    it('should properly validate verification record structure', async () => {
      // Valid record
      const validRecord: VerificationRecord = {
        id: 'valid-id',
        requestHash: 'a'.repeat(64), // Valid SHA-256 format
        responseHash: 'b'.repeat(64), // Valid SHA-256 format
        user: '0x123',
        provider: 'test',
        timestamp: Date.now(),
        verificationType: AIActionType.SUMMARIZE,
        metadata: {},
      };

      mockVerifierAdapter.verifyRecord.mockResolvedValue(true);

      const result = await service.verifyRecord(
        validRecord,
        'request',
        'response'
      );
      expect(result).toBe(true);

      // Invalid record with bad hash format
      const invalidRecord: VerificationRecord = {
        ...validRecord,
        requestHash: 'invalid', // Too short
        responseHash: 'also-invalid', // Too short
      };

      const invalidResult = await service.verifyRecord(
        invalidRecord,
        'request',
        'response'
      );
      expect(invalidResult).toBe(false); // Should reject invalid format
    });

    it('should prevent replay attacks with timestamp validation', async () => {
      const currentTime = Date.now();

      // Record with future timestamp (suspicious)
      const futureRecord: VerificationRecord = {
        id: 'future-id',
        requestHash: 'a'.repeat(64),
        responseHash: 'b'.repeat(64),
        user: '0x123',
        provider: 'test',
        timestamp: currentTime + 10 * 60 * 1000, // 10 minutes in future
        verificationType: AIActionType.SUMMARIZE,
        metadata: {},
      };

      mockVerifierAdapter.getVerification.mockResolvedValue(futureRecord);

      const result = await service.verifyExistingOperation('future-id');
      expect(result).toBe(false); // Should reject future timestamps

      // Record with old timestamp (potential replay)
      const oldRecord: VerificationRecord = {
        ...futureRecord,
        timestamp: currentTime - 25 * 60 * 60 * 1000, // 25 hours ago
      };

      mockVerifierAdapter.getVerification.mockResolvedValue(oldRecord);

      const oldResult = await service.verifyExistingOperation('old-id');
      expect(oldResult).toBe(false); // Should reject old records
    });

    it('should handle hash collision resistance properly', async () => {
      // Test that the service properly validates hash formats for collision resistance
      const requestData = 'test request data';
      const responseData = 'test response data';

      // Calculate proper hashes
      const requestHash = createHash('sha256')
        .update(requestData)
        .digest('hex');
      const responseHash = createHash('sha256')
        .update(responseData)
        .digest('hex');

      const record: VerificationRecord = {
        id: 'hash-test',
        requestHash,
        responseHash,
        user: '0x123',
        provider: 'test',
        timestamp: Date.now(),
        verificationType: AIActionType.SUMMARIZE,
        metadata: {},
      };

      // Mock successful verification
      mockVerifierAdapter.verifyRecord.mockResolvedValue(true);

      const result = await service.verifyRecord(
        record,
        requestData,
        responseData
      );
      expect(result).toBe(true);

      // Verify that the adapter was called with sanitized inputs
      expect(mockVerifierAdapter.verifyRecord).toHaveBeenCalledWith(
        record,
        requestData, // Should be sanitized but same content
        responseData // Should be sanitized but same content
      );
    });
  });

  describe('Hash Generation and Validation', () => {
    it('should generate consistent collision-resistant hashes', () => {
      const data = 'test data for consistent hashing';

      // Generate hashes multiple times
      const hash1 = createHash('sha256').update(data).digest('hex');
      const hash2 = createHash('sha256').update(data).digest('hex');

      // Should be identical (deterministic)
      expect(hash1).toBe(hash2);

      // Should be proper SHA-256 format
      expect(hash1).toMatch(/^[a-fA-F0-9]{64}$/);
      expect(hash1.length).toBe(64);
    });

    it('should detect hash collisions and different inputs', () => {
      const data1 = 'original data';
      const data2 = 'modified data';

      const hash1 = createHash('sha256').update(data1).digest('hex');
      const hash2 = createHash('sha256').update(data2).digest('hex');

      // Different inputs should produce different hashes
      expect(hash1).not.toBe(hash2);

      // Both should be valid SHA-256 format
      expect(hash1).toMatch(/^[a-fA-F0-9]{64}$/);
      expect(hash2).toMatch(/^[a-fA-F0-9]{64}$/);
    });

    it('should validate hash format for security', () => {
      const validHash = 'a'.repeat(64); // 64 hex chars
      const invalidHashes = [
        'invalid', // Too short
        'a'.repeat(63), // One char short
        'a'.repeat(65), // One char too long
        'g'.repeat(64), // Invalid hex char
        '', // Empty
        'ABCD'.repeat(16), // Valid length but mixed case (still valid)
      ];

      const hashPattern = /^[a-fA-F0-9]{64}$/;

      expect(hashPattern.test(validHash)).toBe(true);
      expect(hashPattern.test(invalidHashes[0])).toBe(false);
      expect(hashPattern.test(invalidHashes[1])).toBe(false);
      expect(hashPattern.test(invalidHashes[2])).toBe(false);
      expect(hashPattern.test(invalidHashes[3])).toBe(false);
      expect(hashPattern.test(invalidHashes[4])).toBe(false);
      expect(hashPattern.test(invalidHashes[5])).toBe(true); // Mixed case is valid
    });
  });
});
