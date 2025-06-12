const { jest } = require('@jest/globals');
import {
  AIActionType,
  AIPrivacyLevel,
  VerificationRecord,
} from '../../apps/cli/src/types/adapters/AIVerifierAdapter';
import type { Todo } from '../../apps/cli/src/types/todo';
import crypto from 'crypto';

export interface VerifiedAIResult<T> {
  result: T;
  verification: VerificationRecord;
  metadata?: Record<string, unknown>;
}

/**
 * Mock implementation of AIVerificationService for testing
 */
export interface MockAIVerificationService {
  createVerification: jest.MockedFunction<
    (
      verificationType: AIActionType,
      request: unknown,
      response: unknown,
      metadata?: Record<string, string>,
      privacyLevel?: AIPrivacyLevel
    ) => Promise<VerificationRecord>
  >;

  createVerifiedSummary: jest.MockedFunction<
    (
      todos: Todo[],
      summary: string,
      privacyLevel: AIPrivacyLevel
    ) => Promise<VerifiedAIResult<string>>
  >;

  verifyRecord: jest.MockedFunction<
    (
      record: VerificationRecord,
      request: string,
      response: string
    ) => Promise<boolean>
  >;

  listVerifications: jest.MockedFunction<
    (userAddress: string) => Promise<VerificationRecord[]>
  >;

  // Internal properties
  blockchainVerifier?: {
    createVerification: jest.MockedFunction<
      (params: unknown) => Promise<VerificationRecord>
    >;
    verifyRecord: jest.MockedFunction<
      (
        record: VerificationRecord,
        request: string,
        response: string
      ) => Promise<boolean>
    >;
    deleteVerification: jest.MockedFunction<
      (id: string, userAddress: string) => Promise<boolean>
    >;
    exportVerifications: jest.MockedFunction<
      (userAddress: string, format: string) => Promise<string>
    >;
    enforceRetentionPolicy: jest.MockedFunction<() => Promise<number>>;
    securelyDestroyData: jest.MockedFunction<(id: string) => Promise<boolean>>;
  };

  auditLogger?: {
    log: jest.MockedFunction<(eventType: string, details: unknown) => void>;
  };
}

/**
 * Creates a mock AIVerificationService instance
 */
export function createMockAIVerificationService(): MockAIVerificationService {
  const mockBlockchainVerifier = {
    createVerification: jest.fn().mockImplementation(async (params: any) => {
      const { actionType, request, response, privacyLevel, metadata } = params;

      // Simulate timestamp validation
      if (metadata?.timestamp) {
        const timestamp = parseInt(metadata.timestamp);
        const now = Date.now();
        if (now - timestamp > 300000) {
          // 5 minutes
          throw new Error('Timestamp too old - potential replay attack');
        }
      }

      // Simulate authorization checks
      if (metadata?.userAddress) {
        const authorizedAddresses = ['user-123', 'admin-456'];
        if (!authorizedAddresses.includes(metadata.userAddress)) {
          throw new Error('User not authorized to create verifications');
        }
      }

      // Simulate smart contract vulnerability checks
      const requestStr =
        typeof request === 'string' ? request : JSON.stringify(request as any);
      const responseStr =
        typeof response === 'string' ? response : JSON.stringify(response as any);

      if (requestStr.includes('9999999999999999999999999999')) {
        throw new Error('Potential integer overflow attack detected');
      }
      if (
        requestStr.includes('reentrancy') ||
        responseStr.includes('reentrancy')
      ) {
        throw new Error('Potential reentrancy attack detected');
      }
      if (requestStr.length > 10000 || responseStr.length > 10000) {
        throw new Error('Input too large - potential DoS attack');
      }

      // Create verification record based on privacy level
      const baseRecord: VerificationRecord = {
        id: `ver-${Date.now()}`,
        requestHash: crypto
          .createHash('sha256')
          .update(requestStr as any)
          .digest('hex'),
        responseHash: crypto
          .createHash('sha256')
          .update(responseStr as any)
          .digest('hex'),
        user: metadata?.userAddress || 'user-123',
        provider: 'test-provider',
        timestamp: Date.now(),
        verificationType: actionType,
        metadata: metadata || {},
      };

      // Add privacy-level specific data
      switch (privacyLevel) {
        case AIPrivacyLevel.PUBLIC:
          return {
            ...baseRecord,
            requestData: requestStr,
            responseData: responseStr,
            privacyLevel: AIPrivacyLevel.PUBLIC,
          };

        case AIPrivacyLevel.HASH_ONLY:
          return {
            ...baseRecord,
            privacyLevel: AIPrivacyLevel.HASH_ONLY,
          };

        case AIPrivacyLevel.PRIVATE:
          // Simulate encryption
          const key = crypto.randomBytes(32 as any);
          const iv = crypto.randomBytes(16 as any);
          const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
          const encryptedRequest = Buffer.concat([
            cipher.update(requestStr, 'utf8'),
            cipher.final(),
          ]);
          return {
            ...baseRecord,
            encryptedRequest:
              iv.toString('hex') + ':' + encryptedRequest.toString('hex'),
            privacyLevel: AIPrivacyLevel.PRIVATE,
          };

        default:
          return baseRecord;
      }
    }),

    verifyRecord: jest
      .fn()
      .mockImplementation(
        async (
          record: VerificationRecord,
          request: string,
          response: string
        ) => {
          // Simulate hash verification
          const requestHash = crypto
            .createHash('sha256')
            .update(request as any)
            .digest('hex');
          const responseHash = crypto
            .createHash('sha256')
            .update(response as any)
            .digest('hex');

          return (
            record?.requestHash === requestHash &&
            record?.responseHash === responseHash
          );
        }
      ),

    deleteVerification: jest
      .fn()
      .mockImplementation(async (id: string, userAddress: string) => {
        // Simulate authorization check
        if (userAddress !== 'user-123') {
          throw new Error('Unauthorized: only the owner can delete their data');
        }
        return true;
      }),

    exportVerifications: jest
      .fn()
      .mockImplementation(async (userAddress: string, format: string) => {
        const mockVerifications = [
          { id: 'ver-1', provider: 'xai', timestamp: 123456789 },
          { id: 'ver-2', provider: 'xai', timestamp: 123456790 },
        ];

        if (format === 'json') {
          return JSON.stringify(mockVerifications as any);
        } else if (format === 'csv') {
          return 'id,provider,timestamp\nver-1,xai,123456789\nver-2,xai,123456790';
        }
        throw new Error(`Unsupported format: ${format}`);
      }),

    enforceRetentionPolicy: jest.fn().mockImplementation(async () => {
      // Simulate retention policy enforcement
      const RETENTION_DAYS = 30;
      const retentionThreshold =
        Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

      // Mock old and recent records
      const mockRecords = [
        { id: 'ver-old', timestamp: Date.now() - 100 * 24 * 60 * 60 * 1000 },
        { id: 'ver-recent', timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000 },
      ];

      const expiredRecords = mockRecords.filter(
        record => record.timestamp < retentionThreshold
      );
      return expiredRecords.length;
    }),

    securelyDestroyData: jest.fn().mockResolvedValue(true as any),
  };

  const service: MockAIVerificationService = {
    createVerification: jest
      .fn()
      .mockImplementation(
        async (
          verificationType: AIActionType,
          request: unknown,
          response: unknown,
          metadata: Record<string, string> = {},
          privacyLevel: AIPrivacyLevel = AIPrivacyLevel.HASH_ONLY
        ) => {
          return mockBlockchainVerifier.createVerification({
            actionType: verificationType,
            request,
            response,
            privacyLevel,
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
          const verification = await mockBlockchainVerifier.createVerification({
            actionType: AIActionType.SUMMARIZE,
            request: JSON.stringify(todos as any),
            response: summary,
            privacyLevel,
          });

          return {
            result: summary,
            verification,
            metadata: { privacyLevel },
          };
        }
      ),

    verifyRecord: jest
      .fn()
      .mockImplementation(
        async (
          record: VerificationRecord,
          request: string,
          response: string
        ) => {
          return mockBlockchainVerifier.verifyRecord(record, request, response);
        }
      ),

    listVerifications: jest
      .fn()
      .mockImplementation(async (userAddress: string) => {
        if (userAddress === 'user-123') {
          return [
            { ...mockVerificationRecord, id: 'ver-1' },
            { ...mockVerificationRecord, id: 'ver-2' },
          ];
        }
        return [];
      }),

    blockchainVerifier: mockBlockchainVerifier,

    auditLogger: {
      log: jest.fn(),
    },
  };

  return service;
}

/**
 * Mock AIVerificationService constructor
 */
export const MockAIVerificationService = jest.fn().mockImplementation(() => {
  return createMockAIVerificationService();
});

/**
 * Mock verification record for tests
 */
export const mockVerificationRecord: VerificationRecord = {
  id: 'ver-123',
  requestHash: 'req-hash-123',
  responseHash: 'res-hash-123',
  user: 'user-123',
  provider: 'xai',
  timestamp: Date.now(),
  verificationType: AIActionType.SUMMARIZE,
  metadata: {},
};
