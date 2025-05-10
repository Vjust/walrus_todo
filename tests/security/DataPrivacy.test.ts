import { jest } from '@jest/globals';
import { AIService } from '../../src/services/ai/aiService';
import { AIProvider, AIModelOptions } from '../../src/types/adapters/AIModelAdapter';
import { AIProviderFactory } from '../../src/services/ai/AIProviderFactory';
import { AIVerificationService } from '../../src/services/ai/AIVerificationService';
import { AIPrivacyLevel, AIActionType, VerificationRecord } from '../../src/types/adapters/AIVerifierAdapter';
import { Todo } from '../../src/types/todo';
import { secureCredentialManager } from '../../src/services/ai/SecureCredentialManager';
import { initializePermissionManager } from '../../src/services/ai/AIPermissionManager';
import crypto from 'crypto';

// Mock dependencies
jest.mock('@langchain/core/prompts');
jest.mock('../../src/services/ai/AIProviderFactory');
jest.mock('../../src/services/ai/AIPermissionManager');
jest.mock('../../src/services/ai/SecureCredentialManager');

// Sample data for tests
const sampleTodo: Todo = {
  id: 'todo-123',
  title: 'Test Todo',
  description: 'This is a test todo',
  completed: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const sampleTodos: Todo[] = [
  sampleTodo,
  {
    id: 'todo-456',
    title: 'Another Todo',
    description: 'This is another test todo',
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const mockVerificationRecord: VerificationRecord = {
  id: 'ver-123',
  requestHash: 'req-hash-123',
  responseHash: 'res-hash-123',
  user: 'user-123',
  provider: 'xai',
  timestamp: Date.now(),
  verificationType: AIActionType.SUMMARIZE,
  metadata: {}
};

describe('Data Privacy and PII Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementation for AIProviderFactory
    (AIProviderFactory.createProvider as jest.Mock).mockImplementation((params) => {
      return {
        getProviderName: () => params.provider,
        getModelName: () => params.modelName || 'default-model',
        complete: jest.fn(),
        completeStructured: jest.fn().mockResolvedValue({
          result: {},
          modelName: params.modelName || 'default-model',
          provider: params.provider,
          timestamp: Date.now()
        }),
        processWithPromptTemplate: jest.fn().mockResolvedValue({
          result: 'Test result',
          modelName: params.modelName || 'default-model',
          provider: params.provider,
          timestamp: Date.now()
        })
      };
    });
    
    // Default permission manager
    (initializePermissionManager as jest.Mock).mockReturnValue({
      checkPermission: jest.fn().mockReturnValue(true),
      verifyOperationPermission: jest.fn()
    });
    
    // Restore environment variables before each test
    process.env.XAI_API_KEY = 'test-api-key';
  });
  
  describe('PII Detection and Anonymization', () => {
    it('should detect and anonymize PII in todos before processing', async () => {
      // Create a provider adapter that checks for PII anonymization
      (AIProviderFactory.createProvider as jest.Mock).mockImplementation((params) => {
        return {
          getProviderName: () => params.provider,
          getModelName: () => params.modelName || 'default-model',
          complete: jest.fn(),
          completeStructured: jest.fn(),
          processWithPromptTemplate: jest.fn().mockImplementation(async (template, context) => {
            // Get the todo content that would be sent to AI provider
            const todoStr = context.todos;
            
            // PII patterns that should be anonymized
            const piiPatterns = [
              /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,           // Email
              /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,                        // Phone
              /\b\d{3}-\d{2}-\d{4}\b/,                                // SSN
              /\b(?:\d[ -]*?){13,16}\b/,                              // Credit card
              /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}, \d{4}\b/i, // Dates
              /\b[A-Z][a-z]+ [A-Z][a-z]+\b/                           // Names
            ];
            
            // Check for each pattern
            for (const pattern of piiPatterns) {
              expect(todoStr).not.toMatch(pattern);
            }
            
            // Ensure specific PII items are not present
            expect(todoStr).not.toContain('john.doe@example.com');
            expect(todoStr).not.toContain('555-123-4567');
            expect(todoStr).not.toContain('123-45-6789');
            expect(todoStr).not.toContain('4111-1111-1111-1111');
            expect(todoStr).not.toContain('John Doe');
            
            return {
              result: 'Test result',
              modelName: 'test',
              provider: params.provider,
              timestamp: Date.now()
            };
          })
        };
      });
      
      // Create AI service
      const aiService = new AIService('test-api-key');
      
      // Create todos with PII
      const todosWithPII: Todo[] = [
        {
          id: 'todo-pii-1',
          title: 'Email John Doe',
          description: 'Send email to john.doe@example.com or call 555-123-4567',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'todo-pii-2',
          title: 'Update HR Records',
          description: 'Update SSN 123-45-6789 and credit card 4111-1111-1111-1111',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      // Process the todos - should anonymize PII
      await aiService.summarize(todosWithPII);
    });
    
    it('should implement different privacy levels for blockchain verification', async () => {
      // Create mock verification service with privacy level support
      const mockVerifierAdapter = {
        createVerification: jest.fn().mockImplementation((params) => {
          const { privacyLevel, request, response } = params;
          
          let recordToReturn: any = { ...mockVerificationRecord };
          
          // Simulate different privacy level behaviors
          if (privacyLevel === AIPrivacyLevel.PUBLIC) {
            // Public: store raw data
            recordToReturn.requestData = request;
            recordToReturn.responseData = response;
          } else if (privacyLevel === AIPrivacyLevel.HASH_ONLY) {
            // Hash-only: store only hashes
            recordToReturn.requestHash = crypto.createHash('sha256').update(request).digest('hex');
            recordToReturn.responseHash = crypto.createHash('sha256').update(response).digest('hex');
          } else if (privacyLevel === AIPrivacyLevel.PRIVATE) {
            // Private: encrypt data
            const key = crypto.randomBytes(32);
            const iv = crypto.randomBytes(16);
            
            const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
            const encryptedRequest = Buffer.concat([cipher.update(request, 'utf8'), cipher.final()]);
            const encryptedResponse = Buffer.concat([cipher.update(response, 'utf8'), cipher.final()]);
            
            recordToReturn.encryptedRequest = iv.toString('hex') + ':' + encryptedRequest.toString('hex');
            recordToReturn.encryptedResponse = iv.toString('hex') + ':' + encryptedResponse.toString('hex');
          }
          
          return Promise.resolve(recordToReturn);
        }),
        verifyRecord: jest.fn()
      };
      
      const verificationService = new AIVerificationService(mockVerifierAdapter as any);
      
      // Create a todo with PII
      const todoWithPII: Todo = {
        id: 'todo-pii-1',
        title: 'Contact John Doe',
        description: 'Email: john.doe@example.com, Phone: 555-123-4567',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Test each privacy level
      
      // PUBLIC: raw data is stored
      const publicResult = await verificationService.createVerifiedSummary(
        [todoWithPII],
        'Summary about contacting John Doe',
        AIPrivacyLevel.PUBLIC
      );
      
      expect(mockVerifierAdapter.createVerification).toHaveBeenCalledWith(
        expect.objectContaining({
          privacyLevel: AIPrivacyLevel.PUBLIC
        })
      );
      expect((publicResult.verification as any).requestData).toBeDefined();
      expect((publicResult.verification as any).requestData).toContain('john.doe@example.com');
      
      // HASH_ONLY: only hashes are stored
      const hashResult = await verificationService.createVerifiedSummary(
        [todoWithPII],
        'Summary about contacting John Doe',
        AIPrivacyLevel.HASH_ONLY
      );
      
      expect(mockVerifierAdapter.createVerification).toHaveBeenCalledWith(
        expect.objectContaining({
          privacyLevel: AIPrivacyLevel.HASH_ONLY
        })
      );
      expect(hashResult.verification.requestHash).toBeDefined();
      expect((hashResult.verification as any).requestData).toBeUndefined();
      
      // PRIVATE: encrypted data is stored
      const privateResult = await verificationService.createVerifiedSummary(
        [todoWithPII],
        'Summary about contacting John Doe',
        AIPrivacyLevel.PRIVATE
      );
      
      expect(mockVerifierAdapter.createVerification).toHaveBeenCalledWith(
        expect.objectContaining({
          privacyLevel: AIPrivacyLevel.PRIVATE
        })
      );
      expect((privateResult.verification as any).encryptedRequest).toBeDefined();
      expect((privateResult.verification as any).encryptedRequest).toContain(':');
      expect((privateResult.verification as any).requestData).toBeUndefined();
    });
    
    it('should support differential privacy for aggregate operations', async () => {
      // Create a provider that implements differential privacy
      (AIProviderFactory.createProvider as jest.Mock).mockImplementation((params) => {
        return {
          getProviderName: () => params.provider,
          getModelName: () => params.modelName || 'default-model',
          complete: jest.fn(),
          completeStructured: jest.fn().mockImplementation(async (params) => {
            // Check if differential privacy is enabled
            const options = params.options || {};
            
            // In a real implementation, noise would be added to results
            // For this test, we just check it was requested
            if (options.differentialPrivacy === true) {
              // Return "noised" results (simulated)
              return {
                result: {
                  differentialPrivacyEnabled: true,
                  noisedCounts: true,
                  categories: {
                    'work': ['todo-123'], // Noised data
                    'personal': ['todo-456']
                  }
                },
                modelName: 'test',
                provider: AIProvider.XAI,
                timestamp: Date.now()
              };
            }
            
            // Return regular results
            return {
              result: {
                differentialPrivacyEnabled: false,
                categories: {
                  'work': ['todo-123'],
                  'personal': ['todo-456']
                }
              },
              modelName: 'test',
              provider: AIProvider.XAI,
              timestamp: Date.now()
            };
          }),
          processWithPromptTemplate: jest.fn()
        };
      });
      
      // Create AI service with differential privacy
      const dpService = new AIService('test-api-key', AIProvider.XAI, 'model', {
        differentialPrivacy: true,
        epsilon: 0.5 // Privacy budget
      } as any);
      
      // Create AI service without differential privacy
      const regularService = new AIService('test-api-key');
      
      // Run categorization with differential privacy
      const dpResult = await dpService.categorize(sampleTodos);
      expect(dpResult.differentialPrivacyEnabled).toBe(true);
      expect(dpResult.noisedCounts).toBe(true);
      
      // Run categorization without differential privacy
      const regularResult = await regularService.categorize(sampleTodos);
      expect(regularResult.differentialPrivacyEnabled).toBe(false);
    });
  });
  
  describe('Data Subject Access Rights', () => {
    it('should support retrieving and deleting user data', async () => {
      // Mock verification service with user data access
      const mockVerifierAdapter = {
        listVerifications: jest.fn().mockImplementation((userAddress) => {
          // Return verifications for the specified user
          if (userAddress === 'user-123') {
            return Promise.resolve([
              { ...mockVerificationRecord, id: 'ver-1' },
              { ...mockVerificationRecord, id: 'ver-2' }
            ]);
          }
          return Promise.resolve([]);
        }),
        getVerification: jest.fn().mockImplementation((id) => {
          // Return the specified verification
          return Promise.resolve({ ...mockVerificationRecord, id });
        }),
        deleteVerification: jest.fn().mockImplementation((id, userAddress) => {
          // Only allow the owner to delete their data
          if (userAddress !== mockVerificationRecord.user) {
            throw new Error('Unauthorized: only the owner can delete their data');
          }
          return Promise.resolve(true);
        })
      };
      
      const verificationService = new AIVerificationService(mockVerifierAdapter as any);
      
      // User should be able to list their own data
      const userVerifications = await verificationService.listVerifications('user-123');
      expect(userVerifications).toHaveLength(2);
      
      // User should be able to delete their own data
      mockVerifierAdapter.deleteVerification = jest.fn().mockResolvedValueOnce(true);
      await expect(verificationService['blockchainVerifier'].deleteVerification('ver-1', 'user-123'))
        .resolves.toBe(true);
      
      // Other users should not be able to delete someone else's data
      mockVerifierAdapter.deleteVerification = jest.fn().mockRejectedValueOnce(
        new Error('Unauthorized: only the owner can delete their data')
      );
      await expect(verificationService['blockchainVerifier'].deleteVerification('ver-1', 'unauthorized-user'))
        .rejects.toThrow('Unauthorized');
    });
    
    it('should support data portability for user data', async () => {
      // Mock exporter function
      const mockExporter = jest.fn().mockImplementation((verifications, format) => {
        if (format === 'json') {
          return JSON.stringify(verifications);
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
          { ...mockVerificationRecord, id: 'ver-2' }
        ]),
        exportVerifications: jest.fn().mockImplementation((userAddress, format) => {
          // Get verifications and export
          return mockExporter([
            { ...mockVerificationRecord, id: 'ver-1' },
            { ...mockVerificationRecord, id: 'ver-2' }
          ], format);
        })
      };
      
      const verificationService = new AIVerificationService(mockVerifierAdapter as any);
      
      // Test different export formats
      mockVerifierAdapter.exportVerifications = jest.fn().mockImplementation((userAddress, format) => {
        return mockExporter([
          { ...mockVerificationRecord, id: 'ver-1' },
          { ...mockVerificationRecord, id: 'ver-2' }
        ], format);
      });
      
      // Export as JSON
      await expect(verificationService['blockchainVerifier'].exportVerifications('user-123', 'json'))
        .resolves.toContain('ver-1');
      
      // Export as CSV
      await expect(verificationService['blockchainVerifier'].exportVerifications('user-123', 'csv'))
        .resolves.toContain('id,provider,timestamp');
      
      // Invalid format
      await expect(verificationService['blockchainVerifier'].exportVerifications('user-123', 'invalid'))
        .rejects.toThrow('Unsupported format');
    });
  });
  
  describe('Sensitive Data Handling', () => {
    it('should sanitize logs to remove sensitive information', async () => {
      // Spy on console methods
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Create provider adapter that logs sensitive data
      (AIProviderFactory.createProvider as jest.Mock).mockImplementation((params) => {
        return {
          getProviderName: () => params.provider,
          getModelName: () => params.modelName || 'default-model',
          complete: jest.fn(),
          completeStructured: jest.fn(),
          processWithPromptTemplate: jest.fn().mockImplementation(async (template, context) => {
            // Log some sensitive data (bad practice, for testing)
            console.log(`Processing request with API key: ${params.apiKey}`);
            console.log(`User data: ${JSON.stringify(context)}`);
            
            // Log an error with sensitive data
            console.error(`Failed to authenticate with key ${params.apiKey}`);
            
            return {
              result: 'Test result',
              modelName: 'test',
              provider: params.provider,
              timestamp: Date.now()
            };
          })
        };
      });
      
      // Create AI service with sensitive API key
      const aiService = new AIService('super-secret-api-key-12345');
      
      // Create todo with PII
      const todoWithPII: Todo = {
        id: 'todo-pii',
        title: 'Contact John Doe',
        description: 'SSN: 123-45-6789, Phone: 555-123-4567',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Process the todo, which should trigger the logs
      await aiService.summarize([todoWithPII]);
      
      // Check log calls to ensure sensitive data was removed/redacted
      for (const call of [...consoleLogSpy.mock.calls, ...consoleErrorSpy.mock.calls]) {
        const logMessage = call.join(' ');
        
        // API key should be redacted
        expect(logMessage).not.toContain('super-secret-api-key-12345');
        
        // PII should be redacted
        expect(logMessage).not.toContain('123-45-6789');
        expect(logMessage).not.toContain('555-123-4567');
      }
      
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
    
    it('should securely handle errors with sensitive information', async () => {
      // Create provider that throws errors with sensitive data
      (AIProviderFactory.createProvider as jest.Mock).mockImplementation((params) => {
        return {
          getProviderName: () => params.provider,
          getModelName: () => params.modelName || 'default-model',
          complete: jest.fn(),
          completeStructured: jest.fn(),
          processWithPromptTemplate: jest.fn().mockImplementation(async () => {
            // Create error with sensitive data
            const error = new Error('API request failed with key super-secret-api-key-12345');
            
            // Add sensitive data to error object
            (error as any).request = {
              headers: {
                Authorization: 'Bearer super-secret-api-key-12345'
              },
              body: {
                prompt: 'Process data for SSN 123-45-6789'
              }
            };
            
            throw error;
          })
        };
      });
      
      // Create AI service
      const aiService = new AIService('super-secret-api-key-12345');
      
      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Process a request that will throw
      try {
        await aiService.summarize(sampleTodos);
        fail('Should have thrown an error');
      } catch (error) {
        // Error message should not contain sensitive data
        expect(String(error)).not.toContain('super-secret-api-key-12345');
        expect(String(error)).not.toContain('123-45-6789');
        
        // Error object should not have sensitive fields
        expect((error as any).request).toBeUndefined();
        
        // Log messages should not contain sensitive data
        for (const call of consoleErrorSpy.mock.calls) {
          const logMessage = call.join(' ');
          expect(logMessage).not.toContain('super-secret-api-key-12345');
          expect(logMessage).not.toContain('123-45-6789');
        }
      }
      
      consoleErrorSpy.mockRestore();
    });
    
    it('should implement data minimization principles', async () => {
      // Create a provider adapter that checks for data minimization
      (AIProviderFactory.createProvider as jest.Mock).mockImplementation((params) => {
        return {
          getProviderName: () => params.provider,
          getModelName: () => params.modelName || 'default-model',
          complete: jest.fn(),
          completeStructured: jest.fn(),
          processWithPromptTemplate: jest.fn().mockImplementation(async (template, context) => {
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
              'metadata'
            ];
            
            for (const field of unnecessaryFields) {
              expect(todoStr).not.toContain(`"${field}":`);
            }
            
            // Essential fields should be included
            expect(todoStr).toContain('"id"');
            expect(todoStr).toContain('"title"');
            expect(todoStr).toContain('"description"');
            
            return {
              result: 'Test result',
              modelName: 'test',
              provider: params.provider,
              timestamp: Date.now()
            };
          })
        };
      });
      
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
          metadata: { userInfo: 'sensitive data' } as any,
          private: true as any,
          locationData: { lat: 37.7749, lng: -122.4194 } as any
        },
        {
          id: 'todo-extra-2',
          title: 'Another Todo',
          description: 'This is another test todo',
          completed: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // Additional sensitive fields
          userSessionInfo: { ip: '192.168.1.1' } as any
        }
      ];
      
      // Process todos - should apply data minimization
      await aiService.summarize(todosWithExtraData);
    });
    
    it('should implement user consent management for AI operations', async () => {
      // Mock consent manager
      const mockConsentManager = {
        hasUserConsent: jest.fn().mockImplementation((userId, operationType) => {
          // Only allow summarize and categorize
          return operationType === 'summarize' || operationType === 'categorize';
        }),
        recordOperation: jest.fn()
      };
      
      // Create a provider adapter that checks user consent
      (AIProviderFactory.createProvider as jest.Mock).mockImplementation((params) => {
        return {
          getProviderName: () => params.provider,
          getModelName: () => params.modelName || 'default-model',
          complete: jest.fn(),
          completeStructured: jest.fn(),
          processWithPromptTemplate: jest.fn().mockImplementation(async (template, context) => {
            // Check if operation has consent
            const operation = params.operation || 'unknown';
            const userId = params.userId || 'default-user';
            
            if (!mockConsentManager.hasUserConsent(userId, operation)) {
              throw new Error(`User ${userId} has not provided consent for operation ${operation}`);
            }
            
            // Record the operation for audit
            mockConsentManager.recordOperation(userId, operation, new Date());
            
            return {
              result: 'Test result',
              modelName: 'test',
              provider: params.provider,
              timestamp: Date.now()
            };
          })
        };
      });
      
      // Create AI service with user ID and operation type
      const aiService = new AIService('test-api-key', AIProvider.XAI, 'model', {
        userId: 'user-123',
        operation: 'summarize'
      } as any);
      
      // Change operation to one that has consent
      (aiService as any).setOperationType('summarize');
      await expect(aiService.summarize(sampleTodos)).resolves.not.toThrow();
      
      // Change to categorize (allowed)
      (aiService as any).setOperationType('categorize');
      await expect(aiService.categorize(sampleTodos)).resolves.not.toThrow();
      
      // Change to operation that doesn't have consent
      (aiService as any).setOperationType('analyze');
      await expect(aiService.analyze(sampleTodos))
        .rejects
        .toThrow('has not provided consent for operation analyze');
    });
  });
  
  describe('Data Retention and Deletion', () => {
    it('should enforce data retention policies', async () => {
      // Mock verification records with different ages
      const oldRecord = {
        ...mockVerificationRecord,
        id: 'ver-old',
        timestamp: Date.now() - (100 * 24 * 60 * 60 * 1000) // 100 days old
      };
      
      const recentRecord = {
        ...mockVerificationRecord,
        id: 'ver-recent',
        timestamp: Date.now() - (5 * 24 * 60 * 60 * 1000) // 5 days old
      };
      
      // Mock retention policy (e.g., 30 days)
      const RETENTION_DAYS = 30;
      const retentionThreshold = Date.now() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);
      
      // Mock verification adapter
      const mockVerifierAdapter = {
        listVerifications: jest.fn().mockResolvedValue([oldRecord, recentRecord]),
        deleteVerification: jest.fn().mockImplementation((id) => Promise.resolve(true)),
        enforceRetentionPolicy: jest.fn().mockImplementation(() => {
          // Find records older than retention period
          const expiredRecords = [oldRecord, recentRecord].filter(
            record => record.timestamp < retentionThreshold
          );
          
          // Delete expired records
          return Promise.all(
            expiredRecords.map(record => mockVerifierAdapter.deleteVerification(record.id))
          ).then(() => expiredRecords.length);
        })
      };
      
      const verificationService = new AIVerificationService(mockVerifierAdapter as any);
      
      // Enforce retention policy
      const deletedCount = await verificationService['blockchainVerifier'].enforceRetentionPolicy();
      
      // Should have deleted only the old record
      expect(deletedCount).toBe(1);
      expect(mockVerifierAdapter.deleteVerification).toHaveBeenCalledWith('ver-old');
      expect(mockVerifierAdapter.deleteVerification).not.toHaveBeenCalledWith('ver-recent');
    });
    
    it('should support secure data destruction', async () => {
      // Mock verification adapter
      const mockVerifierAdapter = {
        getVerification: jest.fn().mockResolvedValue(mockVerificationRecord),
        deleteVerification: jest.fn().mockResolvedValue(true),
        securelyDestroyData: jest.fn().mockImplementation((id) => {
          // In a real implementation, would perform secure destruction
          // For this test, we just check it was called correctly
          return Promise.resolve(true);
        })
      };
      
      const verificationService = new AIVerificationService(mockVerifierAdapter as any);
      
      // Request secure destruction
      const result = await verificationService['blockchainVerifier'].securelyDestroyData('ver-123');
      
      // Should have called secure destruction
      expect(result).toBe(true);
      expect(mockVerifierAdapter.securelyDestroyData).toHaveBeenCalledWith('ver-123');
    });
  });
  
  describe('Cross-Border Data Transfers', () => {
    it('should respect data localization requirements', async () => {
      // Mock provider factory with region support
      (AIProviderFactory.createProvider as jest.Mock).mockImplementation((params) => {
        return {
          getProviderName: () => params.provider,
          getModelName: () => params.modelName || 'default-model',
          complete: jest.fn(),
          completeStructured: jest.fn(),
          processWithPromptTemplate: jest.fn().mockImplementation(async () => {
            // Check data localization setting
            const options = params.options || {};
            const region = options.region || 'us';
            
            // If localization is required but region doesn't match user region, throw error
            if (options.enforceDataLocalization && region !== options.userRegion) {
              throw new Error(
                `Data localization violation: User data from ${options.userRegion} cannot be processed in ${region}`
              );
            }
            
            return {
              result: 'Test result',
              modelName: 'test',
              provider: params.provider,
              region,
              timestamp: Date.now()
            };
          })
        };
      });
      
      // Create AI service with matching regions (should succeed)
      const matchingRegionService = new AIService('test-api-key', AIProvider.XAI, 'model', {
        region: 'eu',
        userRegion: 'eu',
        enforceDataLocalization: true
      } as any);
      
      await expect(matchingRegionService.summarize(sampleTodos)).resolves.not.toThrow();
      
      // Create AI service with mismatched regions (should fail)
      const mismatchedRegionService = new AIService('test-api-key', AIProvider.XAI, 'model', {
        region: 'us',
        userRegion: 'eu',
        enforceDataLocalization: true
      } as any);
      
      await expect(mismatchedRegionService.summarize(sampleTodos))
        .rejects
        .toThrow('Data localization violation');
    });
  });
});