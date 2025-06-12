const { jest } = require('@jest/globals');
import {
  CredentialType,
  AIPermissionLevel,
  AICredential,
} from '../../apps/cli/src/types/adapters/AICredentialAdapter';
import crypto from 'crypto';

/**
 * Mock implementation of SecureCredentialManager for testing
 */
export interface MockSecureCredentialManager {
  setCredential: jest.MockedFunction<
    (
      provider: string,
      credential: string,
      type?: CredentialType,
      storageOptions?: { encrypt?: boolean; expiryDays?: number },
      metadata?: Record<string, unknown>,
      permissionLevel?: AIPermissionLevel
    ) => Promise<AICredential>
  >;

  getCredential: jest.MockedFunction<(provider: string) => Promise<string>>;

  getCredentialObject: jest.MockedFunction<
    (provider: string) => Promise<AICredential>
  >;

  hasCredential: jest.MockedFunction<(provider: string) => Promise<boolean>>;

  removeCredential: jest.MockedFunction<(provider: string) => Promise<boolean>>;

  verifyCredential: jest.MockedFunction<
    (provider: string) => Promise<{ verificationId: string }>
  >;

  updatePermissions: jest.MockedFunction<
    (
      provider: string,
      permissionLevel: AIPermissionLevel
    ) => Promise<AICredential>
  >;

  generateCredentialProof: jest.MockedFunction<
    (provider: string) => Promise<string>
  >;

  listCredentials: jest.MockedFunction<() => Promise<AICredential[]>>;

  setBlockchainAdapter: jest.MockedFunction<(adapter: any) => void>;

  // Internal properties that tests might access
  credentials?: Record<string, AICredential>;
  blockchainAdapter?: {
    verifyCredential: jest.MockedFunction<
      (credential: any) => Promise<{ verificationId: string }>
    >;
    checkVerificationStatus: jest.MockedFunction<
      (verificationId: string) => Promise<boolean>
    >;
    getSigner: jest.MockedFunction<() => any>;
    revokeVerification: jest.MockedFunction<
      (verificationId: string) => Promise<boolean>
    >;
    generateCredentialProof: jest.MockedFunction<
      (credential: any) => Promise<string>
    >;
  };

  auditLogger?: {
    log: jest.MockedFunction<(eventType: string, details: unknown) => void>;
  };
}

/**
 * Creates a mock SecureCredentialManager instance
 */
export function createMockSecureCredentialManager(): MockSecureCredentialManager {
  const mockCredentials: Record<string, AICredential> = {};

  // Mock blockchain adapter
  const mockBlockchainAdapter = {
    verifyCredential: jest.fn().mockImplementation(async (credential: any) => {
      return { verificationId: 'ver-123' };
    }),

    checkVerificationStatus: jest
      .fn()
      .mockImplementation(async (verificationId: string) => {
        // Simulate verification status check
        return verificationId === 'ver-123';
      }),

    getSigner: jest.fn().mockReturnValue({
      toSuiAddress: jest.fn().mockReturnValue('addr-123'),
      getPublicKey: jest.fn().mockReturnValue({
        toBase64: jest.fn().mockReturnValue('test-key'),
      }),
    }),

    revokeVerification: jest.fn().mockResolvedValue(true as any),

    generateCredentialProof: jest.fn().mockResolvedValue('proof-123'),
  };

  const service: MockSecureCredentialManager = {
    setCredential: jest
      .fn()
      .mockImplementation(
        async (
          provider: string,
          credential: string,
          type: CredentialType = CredentialType.API_KEY,
          storageOptions: { encrypt?: boolean; expiryDays?: number } = {
            encrypt: true,
          },
          metadata: Record<string, unknown> = {},
          permissionLevel: AIPermissionLevel = AIPermissionLevel.STANDARD
        ) => {
          // Sanitize provider name to prevent path traversal
          const sanitizedProvider = provider
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .toLowerCase();

          // Check expiry
          const expiryTime = storageOptions.expiryDays
            ? Date.now() + storageOptions.expiryDays * 24 * 60 * 60 * 1000
            : null;

          const credentialObj: AICredential = {
            id: `cred-${Date.now()}`,
            providerName: sanitizedProvider,
            credentialType: type,
            credentialValue: credential,
            isVerified: false,
            storageOptions,
            createdAt: Date.now(),
            permissionLevel,
            expiryTime,
            metadata,
          };

          // If blockchain adapter is available, verify the credential
          if (service.blockchainAdapter) {
            try {
              const verificationResult =
                await service?.blockchainAdapter?.verifyCredential({
                  providerName: sanitizedProvider,
                  publicKey: 'dummy', // Would be real in production
                });
              credentialObj?.isVerified = true;
              credentialObj?.verificationProof =
                verificationResult.verificationId;
            } catch (error) {
              // Handle verification errors gracefully
              credentialObj?.isVerified = false;
            }
          }

          mockCredentials[sanitizedProvider] = credentialObj;

          // Audit log
          if (service.auditLogger) {
            service?.auditLogger?.log('credential_created', {
              provider: sanitizedProvider,
              type,
              hasCredential: !!credential,
              timestamp: Date.now(),
            });
          }

          return credentialObj;
        }
      ),

    getCredential: jest.fn().mockImplementation(async (provider: string) => {
      const sanitizedProvider = provider
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase();

      // Check if credential exists
      const credential = mockCredentials[sanitizedProvider];
      if (!credential) {
        // Try environment variable fallback
        const envKey = `${provider.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`;
        const envValue = process?.env?.[envKey];
        if (envValue) {
          return envValue;
        }
        throw new Error(`No credential found for provider "${provider}"`);
      }

      // Check expiry
      if (credential.expiryTime && Date.now() > credential.expiryTime) {
        throw new Error(`Credential for provider "${provider}" has expired`);
      }

      // Check blockchain verification if credential is marked as verified
      if (
        credential.isVerified &&
        service.blockchainAdapter &&
        credential.verificationProof
      ) {
        const isStillValid =
          await service?.blockchainAdapter?.checkVerificationStatus(
            credential.verificationProof
          );
        if (!isStillValid) {
          throw new Error('Blockchain verification is no longer valid');
        }
      }

      // Audit log
      if (service.auditLogger) {
        service?.auditLogger?.log('credential_accessed', {
          provider: sanitizedProvider,
          timestamp: Date.now(),
        });
      }

      return credential.credentialValue;
    }),

    getCredentialObject: jest
      .fn()
      .mockImplementation(async (provider: string) => {
        const sanitizedProvider = provider
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .toLowerCase();

        const credential = mockCredentials[sanitizedProvider];
        if (!credential) {
          throw new Error(`No credential found for provider "${provider}"`);
        }

        // Check expiry
        if (credential.expiryTime && Date.now() > credential.expiryTime) {
          throw new Error(`Credential for provider "${provider}" has expired`);
        }

        return credential;
      }),

    hasCredential: jest.fn().mockImplementation(async (provider: string) => {
      const sanitizedProvider = provider
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase();
      return !!mockCredentials[sanitizedProvider];
    }),

    removeCredential: jest.fn().mockImplementation(async (provider: string) => {
      const sanitizedProvider = provider
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase();

      const existed = !!mockCredentials[sanitizedProvider];
      delete mockCredentials[sanitizedProvider];

      return existed;
    }),

    verifyCredential: jest.fn().mockImplementation(async (provider: string) => {
      if (!service.blockchainAdapter) {
        throw new Error('Blockchain adapter not configured');
      }

      return service?.blockchainAdapter?.verifyCredential({ provider });
    }),

    updatePermissions: jest
      .fn()
      .mockImplementation(
        async (provider: string, permissionLevel: AIPermissionLevel) => {
          const sanitizedProvider = provider
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .toLowerCase();

          const credential = mockCredentials[sanitizedProvider];
          if (!credential) {
            throw new Error(`Provider "${provider}" not found`);
          }

          // Prevent privilege escalation
          if (permissionLevel === AIPermissionLevel.ADMIN) {
            throw new Error('Unauthorized permission escalation attempt');
          }

          credential?.permissionLevel = permissionLevel;
          mockCredentials[sanitizedProvider] = credential;

          // Audit log
          if (service.auditLogger) {
            service?.auditLogger?.log('permission_updated', {
              provider: sanitizedProvider,
              newLevel: permissionLevel,
              timestamp: Date.now(),
            });
          }

          return credential;
        }
      ),

    generateCredentialProof: jest
      .fn()
      .mockImplementation(async (provider: string) => {
        if (!service.blockchainAdapter) {
          throw new Error('Blockchain adapter not configured');
        }

        const credential = mockCredentials[provider];
        if (!credential) {
          throw new Error(`No credential found for provider "${provider}"`);
        }

        return service?.blockchainAdapter?.generateCredentialProof(credential as any);
      }),

    listCredentials: jest.fn().mockImplementation(async () => {
      return Object.values(mockCredentials as any);
    }),

    setBlockchainAdapter: jest.fn().mockImplementation((adapter: any) => {
      service?.blockchainAdapter = adapter;
    }),

    // Internal properties
    credentials: mockCredentials,
    blockchainAdapter: mockBlockchainAdapter,

    auditLogger: {
      log: jest.fn(),
    },
  };

  return service;
}

/**
 * Mock SecureCredentialManager constructor
 */
export const MockSecureCredentialManager = jest.fn().mockImplementation(() => {
  return createMockSecureCredentialManager();
});

/**
 * Mock secureCredentialManager singleton instance
 */
export const mockSecureCredentialManager = createMockSecureCredentialManager();
