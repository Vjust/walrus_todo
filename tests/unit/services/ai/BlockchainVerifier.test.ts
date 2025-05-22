import { BlockchainVerifier } from '../../../../src/services/ai/BlockchainVerifier';
import { AIVerifierAdapter, VerificationParams, VerificationRecord, VerificationType } from '../../../../src/types/adapters/AIVerifierAdapter';
import { AICredentialAdapter, CredentialVerificationParams, CredentialVerificationResult } from '../../../../src/types/adapters/AICredentialAdapter';
import { WalrusClientAdapter } from '../../../../src/types/adapters/WalrusClientAdapter';
import { SignerAdapter } from '../../../../src/types/adapters/SignerAdapter';

describe('BlockchainVerifier', () => {
  let blockchainVerifier: BlockchainVerifier;
  let mockVerifierAdapter: jest.Mocked<AIVerifierAdapter>;
  let mockCredentialAdapter: jest.Mocked<AICredentialAdapter>;
  let mockWalrusAdapter: jest.Mocked<WalrusClientAdapter>;
  let _mockSigner: jest.Mocked<SignerAdapter>;

  beforeEach(() => {
    // Create mock signer
    mockSigner = {
      getAddress: jest.fn().mockResolvedValue('0x1234567890abcdef'),
      signMessage: jest.fn().mockResolvedValue('mock_signature'),
      signTransactionBlock: jest.fn(),
      getPublicKey: jest.fn().mockResolvedValue('mock_public_key')
    };

    // Create mock verifier adapter
    mockVerifierAdapter = {
      createVerification: jest.fn(),
      verifyRecord: jest.fn(),
      getVerification: jest.fn(),
      listVerifications: jest.fn(),
      getRegistryAddress: jest.fn().mockResolvedValue('0xregistry123'),
      getSigner: jest.fn().mockReturnValue(mockSigner)
    };

    // Create mock credential adapter
    mockCredentialAdapter = {
      verifyCredential: jest.fn()
    } as any;

    // Create mock Walrus adapter
    mockWalrusAdapter = {
      writeBlob: jest.fn(),
      readBlob: jest.fn()
    } as any;

    // Create BlockchainVerifier instance
    blockchainVerifier = new BlockchainVerifier(
      mockVerifierAdapter,
      mockCredentialAdapter,
      mockWalrusAdapter
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with only verifier adapter', () => {
      const verifier = new BlockchainVerifier(mockVerifierAdapter);
      expect(verifier).toBeDefined();
      expect(verifier.getVerifierAdapter()).toBe(mockVerifierAdapter);
      expect(verifier.getCredentialAdapter()).toBeUndefined();
    });

    it('should create instance with all adapters', () => {
      expect(blockchainVerifier).toBeDefined();
      expect(blockchainVerifier.getVerifierAdapter()).toBe(mockVerifierAdapter);
      expect(blockchainVerifier.getCredentialAdapter()).toBe(mockCredentialAdapter);
    });
  });

  describe('setters', () => {
    it('should set credential adapter', () => {
      const newVerifier = new BlockchainVerifier(mockVerifierAdapter);
      expect(newVerifier.getCredentialAdapter()).toBeUndefined();
      
      newVerifier.setCredentialAdapter(mockCredentialAdapter);
      expect(newVerifier.getCredentialAdapter()).toBe(mockCredentialAdapter);
    });

    it('should set Walrus adapter', () => {
      const newVerifier = new BlockchainVerifier(mockVerifierAdapter);
      newVerifier.setWalrusAdapter(mockWalrusAdapter);
      // Can't directly test walrusAdapter, but we can test it in verifyOperation
    });
  });

  describe('verifyOperation', () => {
    const mockParams: VerificationParams = {
      request: 'test request',
      response: 'test response',
      tipo: VerificationType.ANALYSIS,
      privacyLevel: 'private',
      metadata: { source: 'test' }
    };

    const mockRecord: VerificationRecord = {
      id: 'verification_123',
      requestHash: 'hash1',
      responseHash: 'hash2',
      tipo: VerificationType.ANALYSIS,
      timestamp: Date.now(),
      user: '0x1234567890abcdef',
      metadata: {}
    };

    it('should verify operation without Walrus storage', async () => {
      const verifierWithoutWalrus = new BlockchainVerifier(mockVerifierAdapter);
      mockVerifierAdapter.createVerification.mockResolvedValue(mockRecord);

      const result = await verifierWithoutWalrus.verifyOperation(mockParams);

      expect(mockVerifierAdapter.createVerification).toHaveBeenCalledWith(mockParams);
      expect(result).toEqual(mockRecord);
    });

    it('should verify operation with Walrus storage', async () => {
      const blobResult = { blobId: 'blob_123', blobObject: {} };
      mockWalrusAdapter.writeBlob.mockResolvedValue(blobResult);
      mockVerifierAdapter.createVerification.mockResolvedValue(mockRecord);

      const result = await blockchainVerifier.verifyOperation(mockParams);

      expect(mockWalrusAdapter.writeBlob).toHaveBeenCalledTimes(2);
      expect(mockWalrusAdapter.writeBlob).toHaveBeenCalledWith({
        blob: new TextEncoder().encode(mockParams.request),
        signer: mockSigner
      });
      expect(mockWalrusAdapter.writeBlob).toHaveBeenCalledWith({
        blob: new TextEncoder().encode(mockParams.response),
        signer: mockSigner
      });

      // Updated params should include blob IDs
      const expectedParams = {
        ...mockParams,
        metadata: {
          ...mockParams.metadata,
          requestBlobId: 'blob_123',
          responseBlobId: 'blob_123',
          storageType: 'walrus'
        }
      };
      expect(mockVerifierAdapter.createVerification).toHaveBeenCalledWith(expectedParams);
      expect(result).toEqual(mockRecord);
    });

    it('should continue with hashes if Walrus storage fails', async () => {
      mockWalrusAdapter.writeBlob.mockRejectedValue(new Error('Storage failed'));
      mockVerifierAdapter.createVerification.mockResolvedValue(mockRecord);

      const result = await blockchainVerifier.verifyOperation(mockParams);

      expect(mockWalrusAdapter.writeBlob).toHaveBeenCalled();
      expect(mockVerifierAdapter.createVerification).toHaveBeenCalledWith(mockParams);
      expect(result).toEqual(mockRecord);
    });

    it('should not use Walrus for public privacy level', async () => {
      const publicParams = { ...mockParams, privacyLevel: 'public' };
      mockVerifierAdapter.createVerification.mockResolvedValue(mockRecord);

      const result = await blockchainVerifier.verifyOperation(publicParams);

      expect(mockWalrusAdapter.writeBlob).not.toHaveBeenCalled();
      expect(mockVerifierAdapter.createVerification).toHaveBeenCalledWith(publicParams);
      expect(result).toEqual(mockRecord);
    });
  });

  describe('verifyCredential', () => {
    const mockCredentialParams: CredentialVerificationParams = {
      credentialId: 'cred_123',
      provider: 'test_provider',
      verificationType: VerificationType.CREDENTIAL
    };

    const mockCredentialResult: CredentialVerificationResult = {
      credentialId: 'cred_123',
      provider: 'test_provider',
      verificationId: 'verify_123',
      verified: true,
      timestamp: Date.now()
    };

    it('should verify credential successfully', async () => {
      mockCredentialAdapter.verifyCredential.mockResolvedValue(mockCredentialResult);

      const result = await blockchainVerifier.verifyCredential(mockCredentialParams);

      expect(mockCredentialAdapter.verifyCredential).toHaveBeenCalledWith(mockCredentialParams);
      expect(result).toEqual(mockCredentialResult);
    });

    it('should throw error if credential adapter not configured', async () => {
      const verifierWithoutCredential = new BlockchainVerifier(mockVerifierAdapter);

      await expect(verifierWithoutCredential.verifyCredential(mockCredentialParams))
        .rejects.toThrow('Credential adapter not configured');
    });
  });

  describe('verifyRecord', () => {
    const mockRecord: VerificationRecord = {
      id: 'verification_123',
      requestHash: 'hash1',
      responseHash: 'hash2',
      tipo: VerificationType.ANALYSIS,
      timestamp: Date.now(),
      user: '0x1234567890abcdef',
      metadata: {}
    };

    it('should verify record against provided data', async () => {
      mockVerifierAdapter.verifyRecord.mockResolvedValue(true);

      const result = await blockchainVerifier.verifyRecord(mockRecord, 'request', 'response');

      expect(mockVerifierAdapter.verifyRecord).toHaveBeenCalledWith(mockRecord, 'request', 'response');
      expect(result).toBe(true);
    });
  });

  describe('getVerification', () => {
    const mockRecord: VerificationRecord = {
      id: 'verification_123',
      requestHash: 'hash1',
      responseHash: 'hash2',
      tipo: VerificationType.ANALYSIS,
      timestamp: Date.now(),
      user: '0x1234567890abcdef',
      metadata: {}
    };

    it('should get verification by ID', async () => {
      mockVerifierAdapter.getVerification.mockResolvedValue(mockRecord);

      const result = await blockchainVerifier.getVerification('verification_123');

      expect(mockVerifierAdapter.getVerification).toHaveBeenCalledWith('verification_123');
      expect(result).toEqual(mockRecord);
    });
  });

  describe('listVerifications', () => {
    const mockRecords: VerificationRecord[] = [
      {
        id: 'verification_1',
        requestHash: 'hash1',
        responseHash: 'hash2',
        tipo: VerificationType.ANALYSIS,
        timestamp: Date.now(),
        user: '0x1234567890abcdef',
        metadata: {}
      },
      {
        id: 'verification_2',
        requestHash: 'hash3',
        responseHash: 'hash4',
        tipo: VerificationType.CATEGORIZATION,
        timestamp: Date.now(),
        user: '0x1234567890abcdef',
        metadata: {}
      }
    ];

    it('should list verifications without user address', async () => {
      mockVerifierAdapter.listVerifications.mockResolvedValue(mockRecords);

      const result = await blockchainVerifier.listVerifications();

      expect(mockVerifierAdapter.listVerifications).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockRecords);
    });

    it('should list verifications with user address', async () => {
      mockVerifierAdapter.listVerifications.mockResolvedValue(mockRecords);

      const result = await blockchainVerifier.listVerifications('0x1234567890abcdef');

      expect(mockVerifierAdapter.listVerifications).toHaveBeenCalledWith('0x1234567890abcdef');
      expect(result).toEqual(mockRecords);
    });
  });

  describe('retrieveVerificationData', () => {
    const mockRecord: VerificationRecord = {
      id: 'verification_123',
      requestHash: 'hash1',
      responseHash: 'hash2',
      tipo: VerificationType.ANALYSIS,
      timestamp: Date.now(),
      user: '0x1234567890abcdef',
      metadata: {
        requestBlobId: 'request_blob_123',
        responseBlobId: 'response_blob_123'
      }
    };

    it('should retrieve full verification data from Walrus', async () => {
      const requestBlob = new TextEncoder().encode('original request');
      const responseBlob = new TextEncoder().encode('original response');
      
      mockWalrusAdapter.readBlob
        .mockResolvedValueOnce(requestBlob)
        .mockResolvedValueOnce(responseBlob);

      const result = await blockchainVerifier.retrieveVerificationData(mockRecord);

      expect(mockWalrusAdapter.readBlob).toHaveBeenCalledTimes(2);
      expect(mockWalrusAdapter.readBlob).toHaveBeenCalledWith({ blobId: 'request_blob_123' });
      expect(mockWalrusAdapter.readBlob).toHaveBeenCalledWith({ blobId: 'response_blob_123' });
      expect(result).toEqual({
        request: 'original request',
        response: 'original response'
      });
    });

    it('should throw error if blob IDs are missing', async () => {
      const recordWithoutBlobs: VerificationRecord = {
        ...mockRecord,
        metadata: {}
      };

      await expect(blockchainVerifier.retrieveVerificationData(recordWithoutBlobs))
        .rejects.toThrow('Verification does not contain blob IDs for full data retrieval');
    });

    it('should throw error if Walrus adapter not configured', async () => {
      const verifierWithoutWalrus = new BlockchainVerifier(mockVerifierAdapter);

      await expect(verifierWithoutWalrus.retrieveVerificationData(mockRecord))
        .rejects.toThrow('Walrus adapter not configured');
    });

    it('should throw error if blob retrieval fails', async () => {
      mockWalrusAdapter.readBlob.mockRejectedValue(new Error('Read failed'));

      await expect(blockchainVerifier.retrieveVerificationData(mockRecord))
        .rejects.toThrow('Failed to retrieve full data:');
    });
  });

  describe('generateVerificationProof', () => {
    const mockRecord: VerificationRecord = {
      id: 'verification_123',
      requestHash: 'hash1',
      responseHash: 'hash2',
      tipo: VerificationType.ANALYSIS,
      timestamp: 1234567890,
      user: '0x1234567890abcdef',
      metadata: { test: 'data' }
    };

    it('should generate a base64 encoded proof', async () => {
      mockVerifierAdapter.getVerification.mockResolvedValue(mockRecord);

      const proof = await blockchainVerifier.generateVerificationProof('verification_123');

      expect(mockVerifierAdapter.getVerification).toHaveBeenCalledWith('verification_123');
      expect(mockVerifierAdapter.getRegistryAddress).toHaveBeenCalled();

      // Decode and verify the proof
      const decodedProof = JSON.parse(Buffer.from(proof, 'base64').toString());
      expect(decodedProof).toMatchObject({
        verificationId: 'verification_123',
        verifierAddress: '0xregistry123',
        timestamp: 1234567890,
        requestHash: 'hash1',
        responseHash: 'hash2',
        metadata: { test: 'data' },
        verificationType: VerificationType.ANALYSIS,
        chainInfo: {
          network: 'sui',
          objectId: 'verification_123',
          registryId: '0xregistry123'
        },
        verificationUrl: 'https://explorer.sui.io/objects/verification_123'
      });
    });
  });

  describe('verifyProof', () => {
    const mockRecord: VerificationRecord = {
      id: 'verification_123',
      requestHash: 'hash1',
      responseHash: 'hash2',
      tipo: VerificationType.ANALYSIS,
      timestamp: 1234567890,
      user: '0x1234567890abcdef',
      metadata: {}
    };

    const validProof = {
      verificationId: 'verification_123',
      verifierAddress: '0xregistry123',
      timestamp: 1234567890,
      requestHash: 'hash1',
      responseHash: 'hash2',
      metadata: {},
      verificationType: VerificationType.ANALYSIS,
      chainInfo: {
        network: 'sui',
        objectId: 'verification_123',
        registryId: '0xregistry123'
      },
      verificationUrl: 'https://explorer.sui.io/objects/verification_123'
    };

    it('should verify a valid proof', async () => {
      const proofString = Buffer.from(JSON.stringify(validProof)).toString('base64');
      mockVerifierAdapter.getVerification.mockResolvedValue(mockRecord);

      const result = await blockchainVerifier.verifyProof(proofString);

      expect(mockVerifierAdapter.getVerification).toHaveBeenCalledWith('verification_123');
      expect(result).toEqual({
        isValid: true,
        record: mockRecord
      });
    });

    it('should reject an invalid proof', async () => {
      const invalidProof = {
        ...validProof,
        requestHash: 'wrong_hash'
      };
      const proofString = Buffer.from(JSON.stringify(invalidProof)).toString('base64');
      mockVerifierAdapter.getVerification.mockResolvedValue(mockRecord);

      const result = await blockchainVerifier.verifyProof(proofString);

      expect(result).toEqual({
        isValid: false,
        record: undefined
      });
    });

    it('should reject if verification record not found', async () => {
      const proofString = Buffer.from(JSON.stringify(validProof)).toString('base64');
      mockVerifierAdapter.getVerification.mockResolvedValue(null as any);

      const result = await blockchainVerifier.verifyProof(proofString);

      expect(result).toEqual({
        isValid: false
      });
    });

    it('should handle malformed proof strings', async () => {
      const result = await blockchainVerifier.verifyProof('invalid_base64_proof');

      expect(result).toEqual({
        isValid: false
      });
    });
  });

  describe('getSigner', () => {
    it('should return the signer from verifier adapter', () => {
      const signer = blockchainVerifier.getSigner();
      
      expect(signer).toBe(mockSigner);
      expect(mockVerifierAdapter.getSigner).toHaveBeenCalled();
    });
  });
});