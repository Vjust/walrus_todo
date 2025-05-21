import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createMockWalrusClient } from '../../../src/utils/MockWalrusClient';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SignatureWithBytes, IntentScope } from '@mysten/sui/cryptography';
import { CLIError } from '../../../src/types/error';
import { CredentialVerificationService } from '../../../src/services/ai/credentials/CredentialVerificationService';
import * as crypto from 'crypto';

// Mock the SuiClient
const mockGetLatestSuiSystemState = jest.fn().mockResolvedValue({ epoch: '42' });
const mockGetObject = jest.fn();
const mockSuiClient = {
  getLatestSuiSystemState: mockGetLatestSuiSystemState,
  getObject: mockGetObject
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

describe('CredentialVerificationService Integration', () => {
  let service: CredentialVerificationService;
  let mockWalrusClient: ReturnType<typeof createMockWalrusClient>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockWalrusClient = createMockWalrusClient();
    
    // Set up spy methods on the mock client
    jest.spyOn(mockWalrusClient, 'readBlob');
    jest.spyOn(mockWalrusClient, 'getBlobInfo');
    jest.spyOn(mockWalrusClient, 'getBlobMetadata');
    jest.spyOn(mockWalrusClient, 'writeBlob');
    
    service = new CredentialVerificationService(
      mockSuiClient, 
      mockWalrusClient as any, // Cast to WalrusClientExt type
      mockSigner
    );
    
    // Spy on private methods but ensure they return proper boolean types
    jest.spyOn(service as any, 'verifyDigitalSignature').mockResolvedValue(true);
    jest.spyOn(service as any, 'verifyTimestamps').mockReturnValue(true);
    jest.spyOn(service as any, 'checkRevocationStatus').mockResolvedValue(true);
    jest.spyOn(service as any, 'validateSchema').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('verifyCredential', () => {
    it('should successfully verify a valid credential', async () => {
      // Create a sample credential
      const credentialId = 'test-credential-id';
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const credential = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://w3id.org/security/suites/ed25519-2020/v1'
        ],
        id: 'uuid:1234-5678-9012',
        type: ['VerifiableCredential', 'TodoAccess'],
        issuer: 'did:sui:0x123abc',
        issuanceDate: now.toISOString(),
        expirationDate: tomorrow.toISOString(),
        credentialSubject: {
          id: 'did:sui:0x456def',
          access: 'read-write',
          resource: 'todo-list-123'
        },
        proof: {
          type: 'Ed25519Signature2020',
          created: now.toISOString(),
          verificationMethod: 'did:sui:0x123abc#key-1',
          proofPurpose: 'assertionMethod',
          proofValue: 'z3SBDZq5euEoASJo8PXY8Xba4Q2n1qv2Kk4JHTo1TnKGmVSYxMi7VrRwJrzdjVgeg1rvGJmDTDkqwR6SVXqFKx4'
        }
      };
      
      // Set up mock responses
      (mockWalrusClient.readBlob as jest.Mock).mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(credential))
      );
      
      (mockWalrusClient.getBlobInfo as jest.Mock).mockResolvedValue({
        blob_id: credentialId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: '1000',
        metadata: {
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: '1000',
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
          unencoded_length: '1000',
          contentType: 'application/json',
          credentialType: 'TodoAccess',
          issuer: 'did:sui:0x123abc',
          subject: 'did:sui:0x456def',
          $kind: 'V1'
        },
        $kind: 'V1'
      });
      
      // Execute the verification
      const result = await service.verifyCredential(credentialId);
      
      // Verify the results - all should be boolean types
      expect(result.valid).toBe(true);
      expect(result.signature).toBe(true);
      expect(result.timestamp).toBe(true);
      expect(result.revocation).toBe(true);
      expect(result.schemaCompliance).toBe(true);
      expect(result.issuer).toBe('did:sui:0x123abc');
      expect(result.subject).toBe('did:sui:0x456def');
      expect(result.issuanceDate).toBeInstanceOf(Date);
      expect(result.expirationDate).toBeInstanceOf(Date);
      
      // Verify the client calls
      expect(mockWalrusClient.readBlob).toHaveBeenCalledWith({ blobId: credentialId });
      expect(mockWalrusClient.getBlobMetadata).toHaveBeenCalledWith({ blobId: credentialId });
      expect(mockWalrusClient.getBlobInfo).toHaveBeenCalledWith(credentialId);
      
      // Verify private method calls with proper types
      expect((service as any).verifyDigitalSignature).toHaveBeenCalled();
      expect((service as any).verifyTimestamps).toHaveBeenCalled();
      expect((service as any).checkRevocationStatus).toHaveBeenCalled();
      expect((service as any).validateSchema).toHaveBeenCalled();
    });
    
    it('should fail verification when credential has invalid signature', async () => {
      // Create a sample credential
      const credentialId = 'test-credential-id';
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const credential = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1'
        ],
        id: 'uuid:1234-5678-9012',
        type: ['VerifiableCredential', 'TodoAccess'],
        issuer: 'did:sui:0x123abc',
        issuanceDate: now.toISOString(),
        expirationDate: tomorrow.toISOString(),
        credentialSubject: {
          id: 'did:sui:0x456def',
          access: 'read-write',
          resource: 'todo-list-123'
        },
        proof: {
          type: 'Ed25519Signature2020',
          created: now.toISOString(),
          verificationMethod: 'did:sui:0x123abc#key-1',
          proofPurpose: 'assertionMethod',
          proofValue: 'INVALID_SIGNATURE'
        }
      };
      
      // Set up mock responses
      (mockWalrusClient.readBlob as jest.Mock).mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(credential))
      );
      
      (mockWalrusClient.getBlobInfo as jest.Mock).mockResolvedValue({
        blob_id: credentialId,
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
      
      // Mock private methods to simulate signature failure - return boolean false
      (service as any).verifyDigitalSignature.mockResolvedValue(false);
      // Keep other validations as true
      
      // Execute the verification
      const result = await service.verifyCredential(credentialId);
      
      // Verify the results - ensure all are boolean types
      expect(result.valid).toBe(false);
      expect(result.signature).toBe(false);
      expect(result.timestamp).toBe(true); // Other validations still pass
      expect(result.revocation).toBe(true);
      expect(result.schemaCompliance).toBe(true);
    });
    
    it('should fail verification when credential is expired', async () => {
      // Create a sample credential
      const credentialId = 'test-credential-id';
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const credential = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1'
        ],
        id: 'uuid:1234-5678-9012',
        type: ['VerifiableCredential', 'TodoAccess'],
        issuer: 'did:sui:0x123abc',
        issuanceDate: yesterday.toISOString(),
        expirationDate: yesterday.toISOString(), // Expired
        credentialSubject: {
          id: 'did:sui:0x456def',
          access: 'read-write',
          resource: 'todo-list-123'
        },
        proof: {
          type: 'Ed25519Signature2020',
          created: yesterday.toISOString(),
          verificationMethod: 'did:sui:0x123abc#key-1',
          proofPurpose: 'assertionMethod',
          proofValue: 'z3SBDZq5euEoASJo8PXY8Xba4Q2n1qv2Kk4JHTo1TnKGmVSYxMi7VrRwJrzdjVgeg1rvGJmDTDkqwR6SVXqFKx4'
        }
      };
      
      // Set up mock responses
      (mockWalrusClient.readBlob as jest.Mock).mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(credential))
      );
      
      // Mock timestamp verification to return false for expired credential
      (service as any).verifyTimestamps.mockReturnValue(false);
      
      // Execute the verification
      const result = await service.verifyCredential(credentialId);
      
      // Verify the results - ensure all are boolean types
      expect(result.valid).toBe(false);
      expect(result.timestamp).toBe(false); // Timestamp validation fails
    });
    
    it('should fail verification when credential has been revoked', async () => {
      // Create a sample credential
      const credentialId = 'test-credential-id';
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const credential = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1'
        ],
        id: 'uuid:1234-5678-9012',
        type: ['VerifiableCredential', 'TodoAccess'],
        issuer: 'did:sui:0x123abc',
        issuanceDate: now.toISOString(),
        expirationDate: tomorrow.toISOString(),
        credentialSubject: {
          id: 'did:sui:0x456def',
          access: 'read-write',
          resource: 'todo-list-123'
        },
        proof: {
          type: 'Ed25519Signature2020',
          created: now.toISOString(),
          verificationMethod: 'did:sui:0x123abc#key-1',
          proofPurpose: 'assertionMethod',
          proofValue: 'z3SBDZq5euEoASJo8PXY8Xba4Q2n1qv2Kk4JHTo1TnKGmVSYxMi7VrRwJrzdjVgeg1rvGJmDTDkqwR6SVXqFKx4'
        }
      };
      
      // Set up mock responses
      (mockWalrusClient.readBlob as jest.Mock).mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(credential))
      );
      
      // Mock revocation check to return false
      (service as any).checkRevocationStatus.mockResolvedValue(false);
      // Keep other validations as true
      
      // Execute the verification
      const result = await service.verifyCredential(credentialId);
      
      // Verify the results - ensure all are boolean types
      expect(result.valid).toBe(false);
      expect(result.revocation).toBe(false); // Revocation check fails
      expect(result.signature).toBe(true); // Other validations still pass
      expect(result.timestamp).toBe(true);
      expect(result.schemaCompliance).toBe(true);
    });
    
    it('should fail verification when credential has invalid schema', async () => {
      // Create an invalid credential missing required fields
      const credentialId = 'test-credential-id';
      const now = new Date();
      
      const invalidCredential = {
        id: 'uuid:1234-5678-9012',
        type: ['VerifiableCredential', 'TodoAccess'],
        // Missing issuer
        issuanceDate: now.toISOString(),
        // Missing credentialSubject
        proof: {
          type: 'Ed25519Signature2020',
          created: now.toISOString(),
          verificationMethod: 'did:sui:0x123abc#key-1',
          proofPurpose: 'assertionMethod',
          proofValue: 'z3SBDZq5euEoASJo8PXY8Xba4Q2n1qv2Kk4JHTo1TnKGmVSYxMi7VrRwJrzdjVgeg1rvGJmDTDkqwR6SVXqFKx4'
        }
      };
      
      // Set up mock responses
      (mockWalrusClient.readBlob as jest.Mock).mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(invalidCredential))
      );
      
      // Mock schema validation to return false
      (service as any).validateSchema.mockReturnValue(false);
      
      // Execute the verification
      const result = await service.verifyCredential(credentialId);
      
      // Verify the results - ensure all are boolean types
      expect(result.valid).toBe(false);
      expect(result.schemaCompliance).toBe(false); // Schema validation fails
    });
    
    it('should handle missing credentials', async () => {
      const credentialId = 'non-existent-credential';
      
      // Mock the blob not being found
      (mockWalrusClient.readBlob as jest.Mock).mockRejectedValue(
        new Error('Blob not found')
      );
      
      // Execute the verification and expect it to fail
      await expect(service.verifyCredential(credentialId)).rejects.toThrow(CLIError);
    });
  });

  describe('issueCredential', () => {
    it('should successfully issue a new credential', async () => {
      // Set up credential data
      const credentialData = {
        type: ['TodoAccess'],
        issuer: 'did:sui:0x123abc',
        subject: 'did:sui:0x456def',
        claims: {
          access: 'read-write',
          resource: 'todo-list-123'
        },
        expirationDate: new Date('2024-12-31')
      };
      
      // Mock Walrus client response
      (mockWalrusClient.writeBlob as jest.Mock).mockResolvedValue({
        blobId: 'new-credential-id',
        blobObject: { blob_id: 'new-credential-id' }
      });
      
      // Issue the credential
      const result = await service.issueCredential(credentialData);
      
      // Verify the results
      expect(result.credentialId).toBe('new-credential-id');
      expect(result.credential).toBeDefined();
      expect(result.registered).toBe(true);
      expect(result.transactionDigest).toBe('mock-transaction-digest');
      
      // Verify the credential structure
      expect(result.credential['@context']).toContain('https://www.w3.org/2018/credentials/v1');
      expect(result.credential.type).toContain('TodoAccess');
      expect(result.credential.issuer).toBe('did:sui:0x123abc');
      expect(result.credential.credentialSubject.id).toBe('did:sui:0x456def');
      expect(result.credential.credentialSubject.access).toBe('read-write');
      expect(result.credential.proof).toBeDefined();
      expect(result.credential.expirationDate).toBeDefined();
      
      // Verify the Walrus client was called correctly
      expect(mockWalrusClient.writeBlob).toHaveBeenCalled();
      const writeArgs = (mockWalrusClient.writeBlob as jest.Mock).mock.calls[0][0];
      expect(writeArgs.signer).toBe(mockSigner);
      expect(writeArgs.deletable).toBe(false);
      expect(writeArgs.attributes).toEqual({
        contentType: 'application/json',
        credentialType: 'TodoAccess',
        issuer: 'did:sui:0x123abc',
        subject: 'did:sui:0x456def'
      });
    });
    
    it('should handle errors during credential issuance', async () => {
      // Set up credential data
      const credentialData = {
        type: ['TodoAccess'],
        issuer: 'did:sui:0x123abc',
        subject: 'did:sui:0x456def',
        claims: {
          access: 'read-write',
          resource: 'todo-list-123'
        }
      };
      
      // Mock Walrus client error
      (mockWalrusClient.writeBlob as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );
      
      // Attempt to issue the credential and expect failure
      await expect(service.issueCredential(credentialData)).rejects.toThrow(CLIError);
    });
  });
  
  describe('revokeCredential', () => {
    it('should successfully revoke a credential', async () => {
      const credentialId = 'credential-to-revoke';
      
      // Mock the credential existing
      (mockWalrusClient.getBlobInfo as jest.Mock).mockResolvedValue({
        blob_id: credentialId,
        registered_epoch: 40,
        certified_epoch: 41,
        size: '1000'
      });
      
      // Revoke the credential
      const result = await service.revokeCredential(credentialId, 'compromised');
      
      // Verify the results
      expect(result.revoked).toBe(true);
      expect(result.transactionDigest).toBe('mock-revocation-digest');
      
      // Verify the client was called
      expect(mockWalrusClient.getBlobInfo).toHaveBeenCalledWith(credentialId);
    });
    
    it('should handle revocation of non-existent credential', async () => {
      const credentialId = 'non-existent-credential';
      
      // Mock the credential not existing
      (mockWalrusClient.getBlobInfo as jest.Mock).mockRejectedValue(
        new Error('Blob not found')
      );
      
      // Attempt to revoke and expect failure
      await expect(service.revokeCredential(credentialId, 'compromised')).rejects.toThrow(CLIError);
    });
  });
});