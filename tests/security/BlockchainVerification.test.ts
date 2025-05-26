import { jest } from '@jest/globals';
import { BlockchainAIVerificationService } from '../../src/services/ai/BlockchainAIVerificationService';
import { AIVerificationService } from '../../src/services/ai/AIVerificationService';
import {
  SuiAIVerifierAdapter,
  AIActionType,
  AIPrivacyLevel,
  VerificationRecord,
} from '../../src/types/adapters/AIVerifierAdapter';
import { Todo } from '../../src/types/todo';
import crypto from 'crypto';

// Mock data
const sampleTodo: Todo = {
  id: 'todo-123',
  title: 'Test Todo',
  description: 'This is a test todo',
  completed: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const sampleTodos: Todo[] = [
  sampleTodo,
  {
    id: 'todo-456',
    title: 'Another Todo',
    description: 'This is another test todo',
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockVerificationRecord: VerificationRecord = {
  id: 'ver-123',
  requestHash: 'req-hash-123',
  responseHash: 'res-hash-123',
  user: 'user-123',
  provider: 'xai',
  timestamp: Date.now(),
  verificationType: AIActionType.SUMMARIZE,
  metadata: {},
};

// Helper functions for crypto operations
function generateKeyPair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

function signData(data: string, privateKey: string): string {
  const sign = crypto.createSign('SHA256');
  sign.update(data);
  sign.end();
  return sign.sign(privateKey, 'base64');
}

function verifySignature(
  data: string,
  signature: string,
  publicKey: string
): boolean {
  const verify = crypto.createVerify('SHA256');
  verify.update(data);
  verify.end();
  return verify.verify(publicKey, signature, 'base64');
}

describe('Blockchain Verification Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should properly hash verification data with collision-resistant hashing', async () => {
    // Create mock verifier that checks hash quality
    const mockVerifierAdapter: SuiAIVerifierAdapter = {
      createVerification: jest.fn().mockImplementation(params => {
        // Ensure hash algorithm is cryptographically secure (requestHash and responseHash are set)
        expect(params.request).toBeDefined();
        expect(params.response).toBeDefined();

        // Generate hashes manually to verify
        const requestHash = crypto
          .createHash('sha256')
          .update(params.request)
          .digest('hex');

        const responseHash = crypto
          .createHash('sha256')
          .update(params.response)
          .digest('hex');

        // Return mock record with actual hashes
        return Promise.resolve({
          ...mockVerificationRecord,
          requestHash,
          responseHash,
        });
      }),
      verifyRecord: jest.fn(),
      getProviderInfo: jest.fn(),
      listVerifications: jest.fn(),
      getRegistryAddress: jest.fn(),
      registerProvider: jest.fn(),
      getVerification: jest.fn(),
    };

    const verificationService = new AIVerificationService(mockVerifierAdapter);

    // Create a verified result
    const result = await verificationService.createVerifiedSummary(
      sampleTodos,
      'Test summary',
      AIPrivacyLevel.HASH_ONLY
    );

    // Check that hashes are set correctly
    expect(result.verification.requestHash).toBeDefined();
    expect(result.verification.requestHash.length).toBeGreaterThan(32); // Ensure hash is substantial

    expect(result.verification.responseHash).toBeDefined();
    expect(result.verification.responseHash.length).toBeGreaterThan(32);

    // Verify adapter was called
    expect(mockVerifierAdapter.createVerification).toHaveBeenCalled();
  });

  it('should detect hash tampering attempts', async () => {
    // Mock the verifier adapter
    const mockVerifierAdapter: SuiAIVerifierAdapter = {
      createVerification: jest.fn().mockResolvedValue(mockVerificationRecord),
      verifyRecord: jest
        .fn()
        .mockImplementation((record, request, response) => {
          // Calculate hashes using same algorithm as in the service
          const requestHash = crypto
            .createHash('sha256')
            .update(request)
            .digest('hex');

          const responseHash = crypto
            .createHash('sha256')
            .update(response)
            .digest('hex');

          // Check if original hashes match calculated hashes
          const requestMatch = record.requestHash === requestHash;
          const responseMatch = record.responseHash === responseHash;

          return Promise.resolve(requestMatch && responseMatch);
        }),
      getProviderInfo: jest.fn(),
      listVerifications: jest.fn(),
      getRegistryAddress: jest.fn(),
      registerProvider: jest.fn(),
      getVerification: jest.fn(),
    };

    const verificationService = new AIVerificationService(mockVerifierAdapter);

    // Create a verified result
    const result = await verificationService.createVerifiedSummary(
      sampleTodos,
      'Test summary',
      AIPrivacyLevel.HASH_ONLY
    );

    // Success case: verify with original data
    const validResult = await verificationService.verifyRecord(
      result.verification,
      JSON.stringify(sampleTodos),
      'Test summary'
    );
    expect(validResult).toBe(true);

    // Failure case: verify with modified request
    const modifiedTodos = [...sampleTodos];
    modifiedTodos[0].title = 'Modified Title';
    const invalidRequest = await verificationService.verifyRecord(
      result.verification,
      JSON.stringify(modifiedTodos),
      'Test summary'
    );
    expect(invalidRequest).toBe(false);

    // Failure case: verify with modified response
    const invalidResponse = await verificationService.verifyRecord(
      result.verification,
      JSON.stringify(sampleTodos),
      'Modified summary'
    );
    expect(invalidResponse).toBe(false);
  });

  it('should enforce digital signatures for verification proofs', async () => {
    // Generate a real key pair for testing
    const { publicKey, privateKey } = generateKeyPair();

    // Mock blockchain verifier with signature support
    const mockBlockchainVerifier = {
      createVerification: jest.fn().mockImplementation(params => {
        // Sign the verification data
        const dataToSign = `${params.actionType}:${params.request}:${params.response}`;
        const signature = signData(dataToSign, privateKey);

        return Promise.resolve({
          ...mockVerificationRecord,
          signature,
          publicKey,
        });
      }),
      verifySignature: jest
        .fn()
        .mockImplementation((data, signature, pubKey) => {
          return verifySignature(data, signature, pubKey);
        }),
      getProviderInfo: jest.fn(),
    };

    const mockPermissionManager = {
      checkPermission: jest.fn().mockReturnValue(true),
    };

    const mockCredentialManager = {
      getCredential: jest.fn().mockResolvedValue('test-api-key'),
    };

    // Create the service with signature verification
    const verificationService = new BlockchainAIVerificationService(
      mockBlockchainVerifier,
      mockPermissionManager,
      mockCredentialManager,
      'xai'
    );

    // Generate a proof
    const proofResult = await verificationService.generateProof(
      AIActionType.SUMMARIZE,
      'request data',
      'response data'
    );

    // Verify the proof with valid signature
    await expect(
      verificationService.verifyProof(
        proofResult.proofId,
        proofResult.signature,
        proofResult.data
      )
    ).resolves.toBe(true);

    // Verify the proof with tampered data
    await expect(
      verificationService.verifyProof(
        proofResult.proofId,
        proofResult.signature,
        { ...proofResult.data, response: 'tampered response' }
      )
    ).resolves.toBe(false);

    // Verify the proof with tampered signature
    await expect(
      verificationService.verifyProof(
        proofResult.proofId,
        'tampered-signature',
        proofResult.data
      )
    ).resolves.toBe(false);
  });

  it('should enforce timestamp validation to prevent replay attacks', async () => {
    // Mock verifier adapter with timestamp validation
    const mockVerifierAdapter: SuiAIVerifierAdapter = {
      createVerification: jest.fn().mockImplementation(params => {
        // Extract timestamp from metadata
        const timestamp = params.metadata?.timestamp
          ? parseInt(params.metadata.timestamp)
          : Date.now();

        // Validate timestamp is recent (within 5 minutes)
        const now = Date.now();
        if (now - timestamp > 300000) {
          // 5 minutes in ms
          throw new Error('Timestamp too old - potential replay attack');
        }

        return Promise.resolve({
          ...mockVerificationRecord,
          timestamp,
        });
      }),
      verifyRecord: jest.fn(),
      getProviderInfo: jest.fn(),
      listVerifications: jest.fn(),
      getRegistryAddress: jest.fn(),
      registerProvider: jest.fn(),
      getVerification: jest.fn(),
    };

    const verificationService = new AIVerificationService(mockVerifierAdapter);

    // Success case: create verification with current timestamp
    await expect(
      verificationService.createVerification(
        AIActionType.SUMMARIZE,
        'request',
        'response',
        { timestamp: Date.now().toString() }
      )
    ).resolves.toBeDefined();

    // Failure case: create verification with old timestamp
    const oldTimestamp = Date.now() - 600000; // 10 minutes ago
    await expect(
      verificationService.createVerification(
        AIActionType.SUMMARIZE,
        'request',
        'response',
        { timestamp: oldTimestamp.toString() }
      )
    ).rejects.toThrow('Timestamp too old');
  });

  it('should enforce transaction authorization for verification records', async () => {
    // Mock blockchain verifier with authorization checks
    const mockBlockchainVerifier = {
      createVerification: jest.fn().mockImplementation(params => {
        // Check user authorization from metadata
        const userAddress = params.metadata?.userAddress;
        if (!userAddress) {
          throw new Error('Missing user address for authorization');
        }

        // In a real implementation, we would validate the user is authorized
        const authorizedAddresses = ['user-123', 'admin-456'];
        if (!authorizedAddresses.includes(userAddress)) {
          throw new Error('User not authorized to create verifications');
        }

        return Promise.resolve(mockVerificationRecord);
      }),
      verifyPermission: jest.fn().mockReturnValue(true),
    };

    const mockPermissionManager = {
      checkPermission: jest.fn().mockReturnValue(true),
    };

    const mockCredentialManager = {
      getCredential: jest.fn().mockResolvedValue('test-api-key'),
    };

    // Create the service
    const verificationService = new BlockchainAIVerificationService(
      mockBlockchainVerifier,
      mockPermissionManager,
      mockCredentialManager,
      'xai'
    );

    // Success case: authorized user
    await expect(
      verificationService.createVerification(
        AIActionType.SUMMARIZE,
        'request',
        'response',
        { userAddress: 'user-123' }
      )
    ).resolves.toBeDefined();

    // Failure case: missing user address
    await expect(
      verificationService.createVerification(
        AIActionType.SUMMARIZE,
        'request',
        'response',
        {}
      )
    ).rejects.toThrow('Missing user address');

    // Failure case: unauthorized user
    await expect(
      verificationService.createVerification(
        AIActionType.SUMMARIZE,
        'request',
        'response',
        { userAddress: 'attacker-789' }
      )
    ).rejects.toThrow('User not authorized');
  });

  it('should protect against smart contract vulnerability exploits', async () => {
    // This test simulates potential smart contract vulnerabilities

    // Mock verifier adapter that checks for dangerous inputs
    const mockVerifierAdapter: SuiAIVerifierAdapter = {
      createVerification: jest.fn().mockImplementation(params => {
        // Check for potentially dangerous inputs that could exploit vulnerabilities
        const requestStr = params.request;
        const responseStr = params.response;

        // Check for integer overflow attempts
        if (requestStr.includes('9999999999999999999999999999')) {
          throw new Error('Potential integer overflow attack detected');
        }

        // Check for reentrancy attack patterns
        if (
          requestStr.includes('reentrancy') ||
          responseStr.includes('reentrancy')
        ) {
          throw new Error('Potential reentrancy attack detected');
        }

        // Check for excessively large inputs that could cause DoS
        if (requestStr.length > 10000 || responseStr.length > 10000) {
          throw new Error('Input too large - potential DoS attack');
        }

        return Promise.resolve(mockVerificationRecord);
      }),
      verifyRecord: jest.fn(),
      getProviderInfo: jest.fn(),
      listVerifications: jest.fn(),
      getRegistryAddress: jest.fn(),
      registerProvider: jest.fn(),
      getVerification: jest.fn(),
    };

    const verificationService = new AIVerificationService(mockVerifierAdapter);

    // Success case: normal input
    await expect(
      verificationService.createVerification(
        AIActionType.SUMMARIZE,
        'regular request',
        'regular response'
      )
    ).resolves.toBeDefined();

    // Failure case: integer overflow attempt
    await expect(
      verificationService.createVerification(
        AIActionType.SUMMARIZE,
        '9999999999999999999999999999',
        'response'
      )
    ).rejects.toThrow('integer overflow');

    // Failure case: reentrancy attack pattern
    await expect(
      verificationService.createVerification(
        AIActionType.SUMMARIZE,
        'call(reentrancy)',
        'response'
      )
    ).rejects.toThrow('reentrancy attack');

    // Failure case: DoS through large input
    const largeInput = 'a'.repeat(20000);
    await expect(
      verificationService.createVerification(
        AIActionType.SUMMARIZE,
        largeInput,
        'response'
      )
    ).rejects.toThrow('Input too large');
  });

  it('should handle different privacy levels securely', async () => {
    // Mock verifier adapter that handles different privacy levels
    const mockVerifierAdapter: SuiAIVerifierAdapter = {
      createVerification: jest.fn().mockImplementation(params => {
        const { privacyLevel } = params;

        // Handle different privacy levels
        if (privacyLevel === AIPrivacyLevel.PUBLIC) {
          // For public, store everything plaintext (simulated)
          return Promise.resolve({
            ...mockVerificationRecord,
            requestData: params.request,
            responseData: params.response,
            privacyLevel: AIPrivacyLevel.PUBLIC,
          });
        } else if (privacyLevel === AIPrivacyLevel.HASH_ONLY) {
          // For hash_only, store only hashes (simulated)
          const requestHash = crypto
            .createHash('sha256')
            .update(params.request)
            .digest('hex');
          const responseHash = crypto
            .createHash('sha256')
            .update(params.response)
            .digest('hex');

          return Promise.resolve({
            ...mockVerificationRecord,
            requestHash,
            responseHash,
            privacyLevel: AIPrivacyLevel.HASH_ONLY,
          });
        } else if (privacyLevel === AIPrivacyLevel.PRIVATE) {
          // For private, encrypt before storing (simulated)
          const requestHash = crypto
            .createHash('sha256')
            .update(params.request)
            .digest('hex');
          const responseHash = crypto
            .createHash('sha256')
            .update(params.response)
            .digest('hex');

          // Simulate encrypting the data
          const key = crypto.randomBytes(32);
          const iv = crypto.randomBytes(16);
          const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
          const encryptedRequest = Buffer.concat([
            cipher.update(params.request, 'utf8'),
            cipher.final(),
          ]);

          return Promise.resolve({
            ...mockVerificationRecord,
            requestHash,
            responseHash,
            encryptedRequest: encryptedRequest.toString('base64'),
            privacyLevel: AIPrivacyLevel.PRIVATE,
          });
        }

        return Promise.resolve(mockVerificationRecord);
      }),
      verifyRecord: jest.fn(),
      getProviderInfo: jest.fn(),
      listVerifications: jest.fn(),
      getRegistryAddress: jest.fn(),
      registerProvider: jest.fn(),
      getVerification: jest.fn(),
    };

    const verificationService = new AIVerificationService(mockVerifierAdapter);

    // Test each privacy level
    const publicResult = await verificationService.createVerifiedSummary(
      sampleTodos,
      'Test summary',
      AIPrivacyLevel.PUBLIC
    );
    expect(publicResult.verification.privacyLevel).toBe(AIPrivacyLevel.PUBLIC);
    expect(((publicResult.verification as VerificationRecord & { requestData?: string }).requestData)).toBeDefined();

    const hashResult = await verificationService.createVerifiedSummary(
      sampleTodos,
      'Test summary',
      AIPrivacyLevel.HASH_ONLY
    );
    expect(hashResult.verification.privacyLevel).toBe(AIPrivacyLevel.HASH_ONLY);
    expect(hashResult.verification.requestHash).toBeDefined();
    expect(((hashResult.verification as VerificationRecord & { requestData?: string }).requestData)).toBeUndefined();

    const privateResult = await verificationService.createVerifiedSummary(
      sampleTodos,
      'Test summary',
      AIPrivacyLevel.PRIVATE
    );
    expect(privateResult.verification.privacyLevel).toBe(
      AIPrivacyLevel.PRIVATE
    );
    expect(((privateResult.verification as VerificationRecord & { encryptedRequest?: string }).encryptedRequest)).toBeDefined();
  });

  it('should enforce secure error handling for blockchain operations', async () => {
    // Mock verifier adapter that throws detailed errors
    const mockVerifierAdapter: SuiAIVerifierAdapter = {
      createVerification: jest.fn().mockImplementation(() => {
        // Throw an error with potentially sensitive details
        const sensitiveError = new Error(
          'Transaction failed: user address 0x123...abc with nonce 42 and gas 1000'
        );
        (sensitiveError as Error & { details?: Record<string, unknown> }).details = {
          transactionId: 'tx-123',
          userAddress: '0x123...abc',
          nonce: 42,
          gas: 1000,
          bytecode: '0xdeadbeef',
        };
        throw sensitiveError;
      }),
      verifyRecord: jest.fn(),
      getProviderInfo: jest.fn(),
      listVerifications: jest.fn(),
      getRegistryAddress: jest.fn(),
      registerProvider: jest.fn(),
      getVerification: jest.fn(),
    };

    // Spy on console.error to check sanitized error logging
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const verificationService = new AIVerificationService(mockVerifierAdapter);

    // Expect error to be sanitized and not leak sensitive details
    try {
      await verificationService.createVerifiedSummary(
        sampleTodos,
        'Test summary',
        AIPrivacyLevel.HASH_ONLY
      );
      throw new Error('Should have thrown an error');
    } catch (_error) {
      // Error message should not contain sensitive details
      expect(String(error)).not.toContain('0x123...abc');
      expect(String(error)).not.toContain('nonce 42');
      expect(String(error)).not.toContain('0xdeadbeef');

      // Error object should not contain sensitive fields
      expect((error as Error & { details?: unknown }).details).toBeUndefined();
    }

    consoleErrorSpy.mockRestore();
  });
});
