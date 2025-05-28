/**
 * Mock implementation of AIVerifierAdapter for testing
 */

import {
  AIVerifierAdapter,
  VerificationRecord,
  VerificationParams,
  ProviderInfo,
  ProviderRegistrationParams,
} from '../../apps/cli/src/types/adapters/AIVerifierAdapter';
import { SignerAdapter } from '../../apps/cli/src/types/adapters/SignerAdapter';

export const createMockAIVerifierAdapter =
  (): jest.Mocked<AIVerifierAdapter> => {
    const mockSigner: jest.Mocked<SignerAdapter> = {
      getAddress: jest.fn().mockResolvedValue('0x1234567890abcdef'),
      signMessage: jest.fn().mockResolvedValue('mock_signature'),
      signTransactionBlock: jest.fn(),
      getPublicKey: jest.fn().mockReturnValue({
        toBase64: jest.fn().mockReturnValue('mock_public_key_base64'),
      }),
    };

    return {
      createVerification: jest
        .fn()
        .mockImplementation(
          async (params: VerificationParams): Promise<VerificationRecord> => {
            return {
              id: `verification_${Date.now()}`,
              requestHash: 'mock_request_hash',
              responseHash: 'mock_response_hash',
              user: '0x1234567890abcdef',
              provider: params.provider || 'test_provider',
              timestamp: Date.now(),
              verificationType: params.actionType,
              metadata: params.metadata || {},
            };
          }
        ),
      verifyRecord: jest.fn().mockResolvedValue(true),
      getProviderInfo: jest
        .fn()
        .mockImplementation(
          async (providerAddress: string): Promise<ProviderInfo> => {
            return {
              name: `provider_${providerAddress}`,
              publicKey: 'mock_public_key',
              verificationCount: 0,
              isActive: true,
              metadata: {},
            };
          }
        ),
      listVerifications: jest.fn().mockResolvedValue([]),
      getRegistryAddress: jest.fn().mockResolvedValue('0xregistry123'),
      registerProvider: jest
        .fn()
        .mockImplementation(
          async (params: ProviderRegistrationParams): Promise<string> => {
            return `provider_id_${params.name}`;
          }
        ),
      getVerification: jest
        .fn()
        .mockImplementation(
          async (verificationId: string): Promise<VerificationRecord> => {
            return {
              id: verificationId,
              requestHash: 'mock_request_hash',
              responseHash: 'mock_response_hash',
              user: '0x1234567890abcdef',
              provider: 'test_provider',
              timestamp: Date.now(),
              verificationType: 0, // AIActionType.SUMMARIZE
              metadata: {},
            };
          }
        ),
      getSigner: jest.fn().mockReturnValue(mockSigner),
      generateProof: jest.fn().mockResolvedValue('base64_encoded_proof'),
      exportVerifications: jest.fn().mockResolvedValue(JSON.stringify([])),
      enforceRetentionPolicy: jest.fn().mockResolvedValue(0),
      securelyDestroyData: jest.fn().mockResolvedValue(true),
    };
  };

export const createMockBlockchainVerifier = () => {
  const mockVerifierAdapter = createMockAIVerifierAdapter();

  return {
    verifyOperation: jest
      .fn()
      .mockImplementation(
        async (params: VerificationParams): Promise<VerificationRecord> => {
          return {
            id: `verification_${Date.now()}`,
            requestHash: 'mock_request_hash',
            responseHash: 'mock_response_hash',
            user: '0x1234567890abcdef',
            provider: params.provider || 'test_provider',
            timestamp: Date.now(),
            verificationType: params.actionType,
            metadata: params.metadata || {},
          };
        }
      ),
    getVerification: jest
      .fn()
      .mockImplementation(
        async (verificationId: string): Promise<VerificationRecord> => {
          return {
            id: verificationId,
            requestHash: 'mock_request_hash',
            responseHash: 'mock_response_hash',
            user: '0x1234567890abcdef',
            provider: 'test_provider',
            timestamp: Date.now(),
            verificationType: 0, // AIActionType.SUMMARIZE
            metadata: {},
          };
        }
      ),
    listVerifications: jest.fn().mockResolvedValue([]),
    getVerifierAdapter: jest.fn().mockReturnValue(mockVerifierAdapter),
    getSigner: jest.fn().mockReturnValue(mockVerifierAdapter.getSigner()),
    generateProof: jest.fn().mockResolvedValue('base64_encoded_proof'),
    setCredentialAdapter: jest.fn(),
    setWalrusAdapter: jest.fn(),
    verifyRecord: jest.fn().mockResolvedValue(true),
    retrieveVerificationData: jest.fn().mockResolvedValue({
      request: 'mock_request',
      response: 'mock_response',
    }),
    generateVerificationProof: jest
      .fn()
      .mockResolvedValue('base64_encoded_proof'),
    verifyProof: jest.fn().mockResolvedValue({ isValid: true }),
    exportVerifications: jest.fn().mockResolvedValue('[]'),
    enforceRetentionPolicy: jest.fn().mockResolvedValue(0),
    securelyDestroyData: jest.fn().mockResolvedValue(true),
    deleteVerification: jest.fn().mockResolvedValue(true),
    verifySignature: jest.fn().mockResolvedValue(true),
  };
};
