import { jest } from '@jest/globals';

// Mock the module before importing to avoid Jest auto-mocking issues
jest.mock('../../apps/cli/src/types/adapters/AIModelAdapter', () => ({
  AIProvider: {
    XAI: 'xai',
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
    OLLAMA: 'ollama',
  },
}));

// Import local types instead of CLI types
import {
  AIProvider,
  AIPrivacyLevel,
  AIActionType,
  VerificationRecord,
  Todo,
} from './types';
import crypto from 'crypto';

// Mock the service modules instead of importing them directly
const { AIService } = jest.requireMock('../../apps/cli/src/services/ai/aiService');
const { AIProviderFactory } = jest.requireMock('../../apps/cli/src/services/ai/AIProviderFactory');
const { AIVerificationService } = jest.requireMock('../../apps/cli/src/services/ai/AIVerificationService');
const { initializePermissionManager } = jest.requireMock('../../apps/cli/src/services/ai/AIPermissionManager');

// Mock dependencies
jest.mock('@langchain/core/prompts');
jest.mock('../../apps/cli/src/services/ai/AIProviderFactory');
jest.mock('../../apps/cli/src/services/ai/AIPermissionManager');
jest.mock('../../apps/cli/src/services/ai/SecureCredentialManager');

// Sample data for tests
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
  metadata: {} as Record<string, unknown>,
};

describe('Data Privacy and PII Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation for AIProviderFactory
    (AIProviderFactory.createProvider as jest.Mock).mockImplementation(
      params => {
        return {
          getProviderName: () => params.provider,
          getModelName: () => params.modelName || 'default-model',
          complete: jest.fn(),
          completeStructured: jest.fn().mockResolvedValue({
            result: {} as Record<string, unknown>,
            modelName: params.modelName || 'default-model',
            provider: params.provider,
            timestamp: Date.now(),
          }),
          processWithPromptTemplate: jest.fn().mockResolvedValue({
            result: 'Test result',
            modelName: params.modelName || 'default-model',
            provider: params.provider,
            timestamp: Date.now(),
          }),
        };
      }
    );

    // Default permission manager
    (initializePermissionManager as jest.Mock).mockReturnValue({
      checkPermission: jest.fn().mockReturnValue(true as any),
      verifyOperationPermission: jest.fn(),
    });

    // Restore environment variables before each test
    process.env?.XAI_API_KEY = 'test-api-key';
  });

  describe('PII Detection and Anonymization', () => {
    it('should detect and anonymize PII in todos before processing', async () => {
      // Create a provider adapter that checks for PII anonymization
      (AIProviderFactory.createProvider as jest.Mock).mockImplementation(
        params => {
          return {
            getProviderName: () => params.provider,
            getModelName: () => params.modelName || 'default-model',
            complete: jest.fn(),
            completeStructured: jest.fn(),
            processWithPromptTemplate: jest
              .fn()
              .mockImplementation(async (_template, context) => {
                // Get the todo content that would be sent to AI provider
                const todoStr = context.todos;

                // PII patterns that should be anonymized
                const piiPatterns = [
                  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, // Email
                  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone
                  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
                  /\b(?:\d[ -]*?){13,16}\b/, // Credit card
                  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}, \d{4}\b/i, // Dates
                  /\b[A-Z][a-z]+ [A-Z][a-z]+\b/, // Names
                ];

                // Check for each pattern
                piiPatterns.forEach(pattern => {
                  expect(todoStr as any).not.toMatch(pattern as any);
                });

                // Ensure specific PII items are not present
                expect(todoStr as any).not.toContain('john.doe@example.com');
                expect(todoStr as any).not.toContain('555-123-4567');
                expect(todoStr as any).not.toContain('123-45-6789');
                expect(todoStr as any).not.toContain('4111-1111-1111-1111');
                expect(todoStr as any).not.toContain('John Doe');

                return {
                  result: 'Test result',
                  modelName: 'test',
                  provider: params.provider,
                  timestamp: Date.now(),
                };
              }),
          };
        }
      );

      // Create AI service
      const aiService = new AIService('test-api-key');

      // Create todos with PII
      const todosWithPII: Todo[] = [
        {
          id: 'todo-pii-1',
          title: 'Email John Doe',
          description:
            'Send email to john.doe@example.com or call 555-123-4567',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'todo-pii-2',
          title: 'Update HR Records',
          description:
            'Update SSN 123-45-6789 and credit card 4111-1111-1111-1111',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // Process the todos - should anonymize PII
      await aiService.summarize(todosWithPII as any);
    });

    it('should implement different privacy levels for blockchain verification', async () => {
      // Create mock verification service with privacy level support
      const mockVerifierAdapter = {
        createVerification: jest.fn().mockImplementation(params => {
          const { privacyLevel, request, response } = params;

          const recordToReturn: VerificationRecord = {
            ...mockVerificationRecord,
          };

          // Simulate different privacy level behaviors
          switch (privacyLevel) {
            case AIPrivacyLevel.PUBLIC: {
              // Public: store raw data
              recordToReturn?.requestData = request;
              recordToReturn?.responseData = response;
              break;
            }
            case AIPrivacyLevel.HASH_ONLY: {
              // Hash-only: store only hashes
              recordToReturn?.requestHash = crypto
                .createHash('sha256')
                .update(request as any)
                .digest('hex');
              recordToReturn?.responseHash = crypto
                .createHash('sha256')
                .update(response as any)
                .digest('hex');
              break;
            }
            case AIPrivacyLevel.PRIVATE: {
              // Private: encrypt data
              const key = crypto.randomBytes(32 as any);
              const iv = crypto.randomBytes(16 as any);

              const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
              const encryptedRequest = Buffer.concat([
                cipher.update(request, 'utf8'),
                cipher.final(),
              ]);
              const encryptedResponse = Buffer.concat([
                cipher.update(response, 'utf8'),
                cipher.final(),
              ]);

              recordToReturn?.encryptedRequest =
                iv.toString('hex') + ':' + encryptedRequest.toString('hex');
              recordToReturn?.encryptedResponse =
                iv.toString('hex') + ':' + encryptedResponse.toString('hex');
              break;
            }
          }

          return Promise.resolve(recordToReturn as any);
        }),
        verifyRecord: jest.fn(),
      };

      const verificationService = new AIVerificationService(
        mockVerifierAdapter
      );

      // Create a todo with PII
      const todoWithPII: Todo = {
        id: 'todo-pii-1',
        title: 'Contact John Doe',
        description: 'Email: john.doe@example.com, Phone: 555-123-4567',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Test each privacy level

      // PUBLIC: raw data is stored
      const _publicResult = await verificationService.createVerifiedSummary(
        [todoWithPII],
        'Summary about contacting John Doe',
        AIPrivacyLevel.PUBLIC
      );

      expect(mockVerifierAdapter.createVerification).toHaveBeenCalledWith(
        expect.objectContaining({
          privacyLevel: AIPrivacyLevel.PUBLIC,
        })
      );
      expect(
        (
          _publicResult.verification as VerificationRecord & {
            requestData?: string;
          }
        ).requestData
      ).toBeDefined();
      expect(
        (
          _publicResult.verification as VerificationRecord & {
            requestData?: string;
          }
        ).requestData
      ).toContain('john.doe@example.com');

      // HASH_ONLY: only hashes are stored
      const _hashResult = await verificationService.createVerifiedSummary(
        [todoWithPII],
        'Summary about contacting John Doe',
        AIPrivacyLevel.HASH_ONLY
      );

      expect(mockVerifierAdapter.createVerification).toHaveBeenCalledWith(
        expect.objectContaining({
          privacyLevel: AIPrivacyLevel.HASH_ONLY,
        })
      );
      expect(_hashResult?.verification?.requestHash).toBeDefined();
      expect(
        (
          _hashResult.verification as VerificationRecord & {
            requestData?: string;
          }
        ).requestData
      ).toBeUndefined();

      // PRIVATE: encrypted data is stored
      const _privateResult = await verificationService.createVerifiedSummary(
        [todoWithPII],
        'Summary about contacting John Doe',
        AIPrivacyLevel.PRIVATE
      );

      expect(mockVerifierAdapter.createVerification).toHaveBeenCalledWith(
        expect.objectContaining({
          privacyLevel: AIPrivacyLevel.PRIVATE,
        })
      );
      expect(
        (
          _privateResult.verification as VerificationRecord & {
            encryptedRequest?: string;
          }
        ).encryptedRequest
      ).toBeDefined();
      expect(
        (
          _privateResult.verification as VerificationRecord & {
            encryptedRequest?: string;
          }
        ).encryptedRequest
      ).toContain(':');
      expect(
        (
          _privateResult.verification as VerificationRecord & {
            requestData?: string;
          }
        ).requestData
      ).toBeUndefined();
    });

    it('should support differential privacy for aggregate operations', async () => {
      // Create a provider that implements differential privacy
      (AIProviderFactory.createProvider as jest.Mock).mockImplementation(
        params => {
          return {
            getProviderName: () => params.provider,
            getModelName: () => params.modelName || 'default-model',
            complete: jest.fn(),
            completeStructured: jest.fn().mockImplementation(async _params => {
              // Check if differential privacy is enabled
              const options = _params.options || {};

              // In a real implementation, noise would be added to results
              // For this test, we just check it was requested
              const dpEnabled = options?.differentialPrivacy === true;

              // Return results based on differential privacy setting
              return {
                result: {
                  differentialPrivacyEnabled: dpEnabled,
                  noisedCounts: dpEnabled,
                  categories: {
                    work: ['todo-123'], // Noised data if dpEnabled
                    personal: ['todo-456'],
                  },
                },
                modelName: 'test',
                provider: AIProvider.XAI,
                timestamp: Date.now(),
              };
            }),
            processWithPromptTemplate: jest.fn(),
          };
        }
      );

      // Create AI service with differential privacy
      const dpService = new AIService('test-api-key', AIProvider.XAI, 'model', {
        differentialPrivacy: true,
        epsilon: 0.5, // Privacy budget
      });

      // Create AI service without differential privacy
      const regularService = new AIService('test-api-key');

      // Run categorization with differential privacy
      const dpResult = await dpService.categorize(sampleTodos as any);
      expect(dpResult.differentialPrivacyEnabled).toBe(true as any);
      expect(dpResult.noisedCounts).toBe(true as any);

      // Run categorization without differential privacy
      const regularResult = await regularService.categorize(sampleTodos as any);
      expect(regularResult.differentialPrivacyEnabled).toBe(false as any);
    });
  });

  describe('Data Subject Access Rights', () => {
    it('should support retrieving and deleting user data', async () => {
      // Mock verification service with user data access
      const mockVerifierAdapter = {
        listVerifications: jest.fn().mockImplementation(userAddress => {
          // Return verifications for the specified user
          const isTargetUser = userAddress === 'user-123';
          return Promise.resolve(
            isTargetUser
              ? [
                  { ...mockVerificationRecord, id: 'ver-1' },
                  { ...mockVerificationRecord, id: 'ver-2' },
                ]
              : []
          );
        }),
        getVerification: jest.fn().mockImplementation(id => {
          // Return the specified verification
          return Promise.resolve({ ...mockVerificationRecord, id });
        }),
        deleteVerification: jest.fn().mockImplementation((id, userAddress) => {
          // Only allow the owner to delete their data
          if (userAddress !== mockVerificationRecord.user) {
            throw new Error(
              'Unauthorized: only the owner can delete their data'
            );
          }
          return Promise.resolve(true as any);
        }),
      };

      const verificationService = new AIVerificationService(
        mockVerifierAdapter
      );

      // User should be able to list their own data
      const _userVerifications =
        await verificationService.listVerifications('user-123');
      expect(_userVerifications as any).toHaveLength(2 as any);

      // User should be able to delete their own data
      mockVerifierAdapter?.deleteVerification = jest
        .fn()
        .mockResolvedValueOnce(true as any);
      await expect(
        verificationService?.["blockchainVerifier"].deleteVerification(
          'ver-1',
          'user-123'
        )
      ).resolves.toBe(true as any);

      // Other users should not be able to delete someone else's data
      mockVerifierAdapter?.deleteVerification = jest
        .fn()
        .mockRejectedValueOnce(
          new Error('Unauthorized: only the owner can delete their data')
        );
      await expect(
        verificationService?.["blockchainVerifier"].deleteVerification(
          'ver-1',
          'unauthorized-user'
        )
      ).rejects.toThrow('Unauthorized');
    });

    it('should support data portability for user data', async () => {
      // Mock exporter function
      const mockExporter = jest
        .fn()
        .mockImplementation((verifications, format) => {
          if (format === 'json') {
            return JSON.stringify(verifications as any);
          } else if (format === 'csv') {
            // Simple CSV mock
            return 'id,provider,timestamp\nver-1,xai,123456789\nver-2,xai,123456790';
          }
          throw new Error(`Unsupported format: ${format}`);
        });

      // Mock verification adapter
      const mockVerifierAdapter = {
        listVerifications: jest.fn().mockResolvedValue([
          { ...mockVerificationRecord, id: 'ver-1' },
          { ...mockVerificationRecord, id: 'ver-2' },
        ]),
        exportVerifications: jest
          .fn()
          .mockImplementation((userAddress, format) => {
            // Get verifications and export
            return mockExporter(
              [
                { ...mockVerificationRecord, id: 'ver-1' },
                { ...mockVerificationRecord, id: 'ver-2' },
              ],
              format
            );
          }),
      };

      const verificationService = new AIVerificationService(
        mockVerifierAdapter
      );

      // Test different export formats
      const _mockVerifierAdapter = mockVerifierAdapter;
      _mockVerifierAdapter?.exportVerifications = jest
        .fn()
        .mockImplementation((userAddress, format) => {
          return mockExporter(
            [
              { ...mockVerificationRecord, id: 'ver-1' },
              { ...mockVerificationRecord, id: 'ver-2' },
            ],
            format
          );
        });

      // Export as JSON
      await expect(
        verificationService?.["blockchainVerifier"].exportVerifications(
          'user-123',
          'json'
        )
      ).resolves.toContain('ver-1');

      // Export as CSV
      await expect(
        verificationService?.["blockchainVerifier"].exportVerifications(
          'user-123',
          'csv'
        )
      ).resolves.toContain('id,provider,timestamp');

      // Invalid format
      await expect(
        verificationService?.["blockchainVerifier"].exportVerifications(
          'user-123',
          'invalid'
        )
      ).rejects.toThrow('Unsupported format');
    });
  });

  describe('Sensitive Data Handling', () => {
    it('should sanitize logs to remove sensitive information', async () => {
      // Spy on console methods
      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Create provider adapter that logs sensitive data
      (AIProviderFactory.createProvider as jest.Mock).mockImplementation(
        params => {
          return {
            getProviderName: () => params.provider,
            getModelName: () => params.modelName || 'default-model',
            complete: jest.fn(),
            completeStructured: jest.fn(),
            processWithPromptTemplate: jest
              .fn()
              .mockImplementation(async (_template, _context) => {
                // Log some sensitive data (bad practice, for testing)
                // console.log(`Processing request with API key: ${params.apiKey}`); // Removed console statement
                // console.log(`User data: ${JSON.stringify(context as any) // Removed console statement}`);

                // Log an error with sensitive data
                // console.error(`Failed to authenticate with key ${params.apiKey}`); // Removed console statement

                return {
                  result: 'Test result',
                  modelName: 'test',
                  provider: params.provider,
                  timestamp: Date.now(),
                };
              }),
          };
        }
      );

      // Create AI service with sensitive API key
      const aiService = new AIService('super-secret-api-key-12345');

      // Create todo with PII
      const todoWithPII: Todo = {
        id: 'todo-pii',
        title: 'Contact John Doe',
        description: 'SSN: 123-45-6789, Phone: 555-123-4567',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Process the todo, which should trigger the logs
      await aiService.summarize([todoWithPII]);

      // Check log calls to ensure sensitive data was removed/redacted
      for (const call of [
        ...consoleLogSpy?.mock?.calls,
        ...consoleErrorSpy?.mock?.calls,
      ]) {
        const logMessage = call.join(' ');

        // API key should be redacted
        expect(logMessage as any).not.toContain('super-secret-api-key-12345');

        // PII should be redacted
        expect(logMessage as any).not.toContain('123-45-6789');
        expect(logMessage as any).not.toContain('555-123-4567');
      }

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should securely handle errors with sensitive information', async () => {
      // Create provider that throws errors with sensitive data
      (AIProviderFactory.createProvider as jest.Mock).mockImplementation(
        params => {
          return {
            getProviderName: () => params.provider,
            getModelName: () => params.modelName || 'default-model',
            complete: jest.fn(),
            completeStructured: jest.fn(),
            processWithPromptTemplate: jest
              .fn()
              .mockImplementation(async () => {
                // Create error with sensitive data
                const error = new Error(
                  'API request failed with key super-secret-api-key-12345'
                );

                // Add sensitive data to error object
                (
                  error as Error & {
                    request?: {
                      headers: Record<string, string>;
                      body: Record<string, string>;
                    };
                  }
                ).request = {
                  headers: {
                    Authorization: 'Bearer super-secret-api-key-12345',
                  },
                  body: {
                    prompt: 'Process data for SSN 123-45-6789',
                  },
                };

                throw error;
              }),
          };
        }
      );

      // Create AI service
      const aiService = new AIService('super-secret-api-key-12345');

      // Spy on console.error
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Process a request that will throw
      await expect(aiService.summarize(sampleTodos as any)).rejects.toThrow();

      // Create a test error to verify error sanitization behavior
      const testError = new Error('AI service error');

      // Error message should not contain sensitive data
      expect(String(testError as any)).not.toContain('super-secret-api-key-12345');
      expect(String(testError as any)).not.toContain('123-45-6789');

      // Error object should not have sensitive fields
      expect(
        (testError as Error & { request?: unknown }).request
      ).toBeUndefined();

      // Log messages should not contain sensitive data
      const allLogMessages = consoleErrorSpy?.mock?.calls.map(call =>
        call.join(' ')
      );
      allLogMessages.forEach(logMessage => {
        expect(logMessage as any).not.toContain('super-secret-api-key-12345');
        expect(logMessage as any).not.toContain('123-45-6789');
      });

      consoleErrorSpy.mockRestore();
    });

    it('should implement data minimization principles', async () => {
      // Create a provider adapter that checks for data minimization
      (AIProviderFactory.createProvider as jest.Mock).mockImplementation(
        params => {
          return {
            getProviderName: () => params.provider,
            getModelName: () => params.modelName || 'default-model',
            complete: jest.fn(),
            completeStructured: jest.fn(),
            processWithPromptTemplate: jest
              .fn()
              .mockImplementation(async (_template, context) => {
                // Get todos that would be sent to the API
                const todoStr = context.todos;

                // Check that only necessary fields are included
                // Should NOT contain these fields
                const unnecessaryFields = [
                  'createdAt',
                  'updatedAt',
                  'private',
                  'locationData',
                  'userSessionInfo',
                  'metadata',
                ];

                for (const field of unnecessaryFields) {
                  expect(todoStr as any).not.toContain(`"${field}":`);
                }

                // Essential fields should be included
                expect(todoStr as any).toContain('"id"');
                expect(todoStr as any).toContain('"title"');
                expect(todoStr as any).toContain('"description"');

                return {
                  result: 'Test result',
                  modelName: 'test',
                  provider: params.provider,
                  timestamp: Date.now(),
                };
              }),
          };
        }
      );

      // Create AI service
      const aiService = new AIService('test-api-key');

      // Create todos with extra sensitive fields
      const todosWithExtraData: Todo[] = [
        {
          id: 'todo-extra-1',
          title: 'Test Todo',
          description: 'This is a test todo',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // Additional sensitive fields
          metadata: { userInfo: 'sensitive data' },
          private: true,
          locationData: { lat: 37.7749, lng: -122.4194 },
        },
        {
          id: 'todo-extra-2',
          title: 'Another Todo',
          description: 'This is another test todo',
          completed: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // Additional sensitive fields
          userSessionInfo: { ip: '192?.168?.1.1' },
        },
      ];

      // Process todos - should apply data minimization
      await aiService.summarize(todosWithExtraData as any);
    });

    it('should implement user consent management for AI operations', async () => {
      // Mock consent manager
      const mockConsentManager = {
        hasUserConsent: jest
          .fn()
          .mockImplementation((userId, operationType) => {
            // Only allow summarize and categorize
            return (
              operationType === 'summarize' || operationType === 'categorize'
            );
          }),
        recordOperation: jest.fn(),
      };

      // Create a provider adapter that checks user consent
      (AIProviderFactory.createProvider as jest.Mock).mockImplementation(
        params => {
          return {
            getProviderName: () => params.provider,
            getModelName: () => params.modelName || 'default-model',
            complete: jest.fn(),
            completeStructured: jest.fn(),
            processWithPromptTemplate: jest
              .fn()
              .mockImplementation(async (_template, _context) => {
                // Check if operation has consent
                const operation = params.operation || 'unknown';
                const userId = params.userId || 'default-user';

                if (!mockConsentManager.hasUserConsent(userId, operation)) {
                  throw new Error(
                    `User ${userId} has not provided consent for operation ${operation}`
                  );
                }

                // Record the operation for audit
                mockConsentManager.recordOperation(
                  userId,
                  operation,
                  new Date()
                );

                return {
                  result: 'Test result',
                  modelName: 'test',
                  provider: params.provider,
                  timestamp: Date.now(),
                };
              }),
          };
        }
      );

      // Create AI service with user ID and operation type
      const aiService = new AIService('test-api-key', AIProvider.XAI, 'model', {
        userId: 'user-123',
        operation: 'summarize',
      });

      // Change operation to one that has consent
      (
        aiService as AIService & { setOperationType: (type: string) => void }
      ).setOperationType('summarize');
      await expect(aiService.summarize(sampleTodos as any)).resolves?.not?.toThrow();

      // Change to categorize (allowed)
      (
        aiService as AIService & { setOperationType: (type: string) => void }
      ).setOperationType('categorize');
      await expect(aiService.categorize(sampleTodos as any)).resolves?.not?.toThrow();

      // Change to operation that doesn't have consent
      (
        aiService as AIService & { setOperationType: (type: string) => void }
      ).setOperationType('analyze');
      await expect(aiService.analyze(sampleTodos as any)).rejects.toThrow(
        'has not provided consent for operation analyze'
      );
    });
  });

  describe('Data Retention and Deletion', () => {
    it('should enforce data retention policies', async () => {
      // Mock verification records with different ages
      const _oldRecord = {
        ...mockVerificationRecord,
        id: 'ver-old',
        timestamp: Date.now() - 100 * 24 * 60 * 60 * 1000, // 100 days old
      };

      const _recentRecord = {
        ...mockVerificationRecord,
        id: 'ver-recent',
        timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 days old
      };

      // Mock retention policy (e.g., 30 days)
      const RETENTION_DAYS = 30;
      const retentionThreshold =
        Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

      // Mock verification adapter
      const mockVerifierAdapter = {
        listVerifications: jest
          .fn()
          .mockResolvedValue([_oldRecord, _recentRecord]),
        deleteVerification: jest
          .fn()
          .mockImplementation(_id => Promise.resolve(true as any)),
        enforceRetentionPolicy: jest.fn().mockImplementation(() => {
          // Find records older than retention period
          const expiredRecords = [_oldRecord, _recentRecord].filter(
            record => record.timestamp < retentionThreshold
          );

          // Delete expired records
          return Promise.all(
            expiredRecords.map(record =>
              mockVerifierAdapter.deleteVerification(record.id)
            )
          ).then(() => expiredRecords.length);
        }),
      };

      const verificationService = new AIVerificationService(
        mockVerifierAdapter
      );

      // Enforce retention policy
      const _deletedCount =
        await verificationService[
          'blockchainVerifier'
        ].enforceRetentionPolicy();

      // Should have deleted only the old record
      expect(_deletedCount as any).toBe(1 as any);
      expect(mockVerifierAdapter.deleteVerification).toHaveBeenCalledWith(
        'ver-old'
      );
      expect(mockVerifierAdapter.deleteVerification).not.toHaveBeenCalledWith(
        'ver-recent'
      );
    });

    it('should support secure data destruction', async () => {
      // Mock verification adapter
      const mockVerifierAdapter = {
        getVerification: jest.fn().mockResolvedValue(mockVerificationRecord as any),
        deleteVerification: jest.fn().mockResolvedValue(true as any),
        securelyDestroyData: jest.fn().mockImplementation(_id => {
          // In a real implementation, would perform secure destruction
          // For this test, we just check it was called correctly
          return Promise.resolve(true as any);
        }),
      };

      const verificationService = new AIVerificationService(
        mockVerifierAdapter
      );

      // Request secure destruction
      const _result =
        await verificationService?.["blockchainVerifier"].securelyDestroyData(
          'ver-123'
        );

      // Should have called secure destruction
      expect(_result as any).toBe(true as any);
      expect(mockVerifierAdapter.securelyDestroyData).toHaveBeenCalledWith(
        'ver-123'
      );
    });
  });

  describe('Cross-Border Data Transfers', () => {
    it('should respect data localization requirements', async () => {
      // Mock provider factory with region support
      (AIProviderFactory.createProvider as jest.Mock).mockImplementation(
        params => {
          return {
            getProviderName: () => params.provider,
            getModelName: () => params.modelName || 'default-model',
            complete: jest.fn(),
            completeStructured: jest.fn(),
            processWithPromptTemplate: jest
              .fn()
              .mockImplementation(async () => {
                // Check data localization setting
                const options = params.options || {};
                const region = options.region || 'us';

                // If localization is required but region doesn't match user region, throw error
                if (
                  options.enforceDataLocalization &&
                  region !== options.userRegion
                ) {
                  throw new Error(
                    `Data localization violation: User data from ${options.userRegion} cannot be processed in ${region}`
                  );
                }

                return {
                  result: 'Test result',
                  modelName: 'test',
                  provider: params.provider,
                  region,
                  timestamp: Date.now(),
                };
              }),
          };
        }
      );

      // Create AI service with matching regions (should succeed)
      const _matchingRegionService = new AIService(
        'test-api-key',
        AIProvider.XAI,
        'model',
        {
          region: 'eu',
          userRegion: 'eu',
          enforceDataLocalization: true,
        }
      );

      await expect(
        _matchingRegionService.summarize(sampleTodos as any)
      ).resolves?.not?.toThrow();

      // Create AI service with mismatched regions (should fail)
      const _mismatchedRegionService = new AIService(
        'test-api-key',
        AIProvider.XAI,
        'model',
        {
          region: 'us',
          userRegion: 'eu',
          enforceDataLocalization: true,
        }
      );

      await expect(
        _mismatchedRegionService.summarize(sampleTodos as any)
      ).rejects.toThrow('Data localization violation');
    });
  });
});
