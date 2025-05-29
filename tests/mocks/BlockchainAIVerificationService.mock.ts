const { jest } = require('@jest/globals');
import {
  AIActionType,
  AIPrivacyLevel,
  VerificationRecord,
} from '../../apps/cli/src/types/adapters/AIVerifierAdapter';
import type { Todo } from '../../apps/cli/src/types/todo';
import { VerifiedAIResult } from './AIVerificationService.mock';
import crypto from 'crypto';

/**
 * Mock implementation of BlockchainAIVerificationService for testing
 */
export interface MockBlockchainAIVerificationService {
  createVerification: jest.MockedFunction<
    (
      verificationType: AIActionType,
      request: string,
      response: string,
      metadata?: Record<string, unknown>
    ) => Promise<VerificationRecord>
  >;

  createVerifiedSummary: jest.MockedFunction<
    (
      todos: Todo[],
      summary: string,
      privacyLevel: AIPrivacyLevel
    ) => Promise<VerifiedAIResult<string>>
  >;

  verifyExternalProof: jest.MockedFunction<
    (
      proofId: string,
      signature: string,
      data: Record<string, unknown>
    ) => Promise<boolean>
  >;

  generateProof: jest.MockedFunction<
    (
      actionType: AIActionType,
      request: string,
      response: string
    ) => Promise<{
      proofId: string;
      signature: string;
      data: Record<string, unknown>;
    }>
  >;

  verifyProof: jest.MockedFunction<
    (
      proofId: string,
      signature: string,
      data: Record<string, unknown>
    ) => Promise<boolean>
  >;

  // Internal properties that tests might access
  blockchainVerifier?: {
    verifySignature: jest.MockedFunction<
      (data: string, signature: string, publicKey: string) => boolean
    >;
    createVerification: jest.MockedFunction<
      (params: unknown) => Promise<VerificationRecord>
    >;
    generateProof: jest.MockedFunction<(data: unknown) => Promise<string>>;
  };

  permissionManager?: {
    checkPermission: jest.MockedFunction<
      (provider: string, operation: string) => boolean
    >;
  };

  credentialManager?: {
    getCredential: jest.MockedFunction<(provider: string) => Promise<string>>;
  };
}

/**
 * Creates a mock BlockchainAIVerificationService instance
 */
export function createMockBlockchainAIVerificationService(
  blockchainVerifier?: any,
  permissionManager?: any,
  credentialManager?: any,
  provider?: string
): MockBlockchainAIVerificationService {
  // Generate a mock key pair for testing
  const mockKeyPair = {
    publicKey:
      '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
    privateKey:
      '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----',
  };

  function signData(data: string): string {
    // Mock signature generation
    return Buffer.from(`signature_${data.slice(0, 10)}_${Date.now()}`).toString(
      'base64'
    );
  }

  function verifySignature(
    data: string,
    signature: string,
    publicKey: string
  ): boolean {
    // Mock signature verification - check if signature was created for this data
    try {
      const decoded = Buffer.from(signature, 'base64').toString();
      return decoded.includes(data.slice(0, 10));
    } catch {
      return false;
    }
  }

  const mockBlockchainVerifier = blockchainVerifier || {
    verifySignature: jest.fn().mockImplementation(verifySignature),
    createVerification: jest.fn().mockImplementation(async (params: any) => {
      const { actionType, request, response, metadata } = params;

      // Check user authorization
      if (metadata?.userAddress) {
        const authorizedAddresses = ['user-123', 'admin-456'];
        if (!authorizedAddresses.includes(metadata.userAddress)) {
          throw new Error('Missing user address for authorization');
        }
      }

      return {
        id: `ver-${Date.now()}`,
        requestHash: crypto.createHash('sha256').update(request).digest('hex'),
        responseHash: crypto
          .createHash('sha256')
          .update(response)
          .digest('hex'),
        user: metadata?.userAddress || 'user-123',
        provider: provider || 'xai',
        timestamp: Date.now(),
        verificationType: actionType,
        metadata: metadata || {},
        signature: signData(`${actionType}:${request}:${response}`),
        publicKey: mockKeyPair.publicKey,
      };
    }),
    generateProof: jest.fn().mockImplementation(async (data: any) => {
      return Buffer.from(JSON.stringify({ id: 'test-proof', data })).toString(
        'base64'
      );
    }),
  };

  const mockPermissionManager = permissionManager || {
    checkPermission: jest
      .fn()
      .mockImplementation((prov: string, operation: string) => {
        // Restrict blockchain_verification operation
        if (operation === 'blockchain_verification') {
          return false;
        }
        return true;
      }),
  };

  const mockCredentialManager = credentialManager || {
    getCredential: jest.fn().mockResolvedValue('test-api-key'),
  };

  const service: MockBlockchainAIVerificationService = {
    createVerification: jest
      .fn()
      .mockImplementation(
        async (
          verificationType: AIActionType,
          request: string,
          response: string,
          metadata: Record<string, unknown> = {}
        ) => {
          // Check permissions for blockchain verification
          if (
            !mockPermissionManager.checkPermission(
              provider || 'xai',
              'blockchain_verification'
            )
          ) {
            throw new Error(
              'Insufficient permissions for blockchain verification'
            );
          }

          return mockBlockchainVerifier.createVerification({
            actionType: verificationType,
            request,
            response,
            metadata,
          });
        }
      ),

    createVerifiedSummary: jest
      .fn()
      .mockImplementation(
        async (
          todos: Todo[],
          summary: string,
          privacyLevel: AIPrivacyLevel
        ) => {
          // Check permissions
          if (
            !mockPermissionManager.checkPermission(
              provider || 'xai',
              'blockchain_verification'
            )
          ) {
            throw new Error(
              'Insufficient permissions for blockchain verification'
            );
          }

          const verification = await mockBlockchainVerifier.createVerification({
            actionType: AIActionType.SUMMARIZE,
            request: JSON.stringify(todos),
            response: summary,
            metadata: { privacyLevel },
          });

          return {
            result: summary,
            verification,
            metadata: { privacyLevel },
          };
        }
      ),

    verifyExternalProof: jest
      .fn()
      .mockImplementation(
        async (
          proofId: string,
          signature: string,
          data: Record<string, unknown>
        ) => {
          // Simulate signature verification
          const isValidSignature = mockBlockchainVerifier.verifySignature(
            JSON.stringify(data),
            signature,
            mockKeyPair.publicKey
          );

          if (!isValidSignature) {
            throw new Error('Invalid signature');
          }

          return true;
        }
      ),

    generateProof: jest
      .fn()
      .mockImplementation(
        async (actionType: AIActionType, request: string, response: string) => {
          const data = { actionType, request, response };
          const dataString = JSON.stringify(data);
          const signature = signData(dataString);

          return {
            proofId: `proof-${Date.now()}`,
            signature,
            data,
          };
        }
      ),

    verifyProof: jest
      .fn()
      .mockImplementation(
        async (
          proofId: string,
          signature: string,
          data: Record<string, unknown>
        ) => {
          // Check if signature matches data
          const dataString = JSON.stringify(data);
          return verifySignature(dataString, signature, mockKeyPair.publicKey);
        }
      ),

    // Internal properties
    blockchainVerifier: mockBlockchainVerifier,
    permissionManager: mockPermissionManager,
    credentialManager: mockCredentialManager,
  };

  return service;
}

/**
 * Mock BlockchainAIVerificationService constructor
 */
export const MockBlockchainAIVerificationService = jest
  .fn()
  .mockImplementation(
    (
      blockchainVerifier?: any,
      permissionManager?: any,
      credentialManager?: any,
      provider?: string
    ) => {
      return createMockBlockchainAIVerificationService(
        blockchainVerifier,
        permissionManager,
        credentialManager,
        provider
      );
    }
  );
