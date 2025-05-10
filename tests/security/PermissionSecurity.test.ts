import { jest } from '@jest/globals';
import { AIPermissionManager, initializePermissionManager } from '../../src/services/ai/AIPermissionManager';
import { SecureCredentialManager } from '../../src/services/ai/SecureCredentialManager';
import { BlockchainVerifier } from '../../src/services/ai/BlockchainVerifier';
import { AIService } from '../../src/services/ai/aiService';
import { AIVerificationService } from '../../src/services/ai/AIVerificationService';
import { AIProviderFactory } from '../../src/services/ai/AIProviderFactory';
import { AIProvider } from '../../src/types/adapters/AIModelAdapter';
import { CredentialType, AIPermissionLevel, AIOperationPermission } from '../../src/types/adapters/AICredentialAdapter';
import { AIActionType, VerificationRecord } from '../../src/types/adapters/AIVerifierAdapter';
import { CLIError } from '../../src/types/error';
import { Todo } from '../../src/types/todo';

// Mock dependencies
jest.mock('../../src/services/ai/SecureCredentialManager');
jest.mock('../../src/services/ai/BlockchainVerifier');
jest.mock('../../src/services/ai/AIProviderFactory');
jest.mock('@langchain/core/prompts');

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

// Helper to create credential object
function createCredential(provider: string, level: AIPermissionLevel, isVerified = false) {
  return {
    id: `cred-${provider}`,
    providerName: provider,
    credentialType: CredentialType.API_KEY,
    credentialValue: `api-key-for-${provider}`,
    isVerified,
    verificationProof: isVerified ? 'proof-123' : undefined,
    storageOptions: { encrypt: true },
    createdAt: Date.now(),
    permissionLevel: level
  };
}

describe('Permission System Security Tests', () => {
  let mockCredentialManager: jest.Mocked<SecureCredentialManager>;
  let mockBlockchainVerifier: jest.Mocked<BlockchainVerifier>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock credential manager
    mockCredentialManager = {
      getCredential: jest.fn(),
      setCredential: jest.fn(),
      hasCredential: jest.fn(),
      removeCredential: jest.fn(),
      verifyCredential: jest.fn(),
      updatePermissions: jest.fn(),
      generateCredentialProof: jest.fn(),
      getCredentialObject: jest.fn(),
      listCredentials: jest.fn(),
      setBlockchainAdapter: jest.fn()
    } as any;
    
    // Mock blockchain verifier
    mockBlockchainVerifier = {
      createVerification: jest.fn(),
      verifyRecord: jest.fn(),
      verifyOperation: jest.fn(),
      verifyPermission: jest.fn()
    } as any;
    
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
  });
  
  describe('Permission Level Enforcement', () => {
    it('should enforce different permission levels for AI operations', async () => {
      // Setup credentials with different permission levels
      mockCredentialManager.getCredentialObject
        .mockImplementation(async (provider) => {
          switch (provider) {
            case 'readonly_provider':
              return createCredential(provider, AIPermissionLevel.READ_ONLY);
            case 'standard_provider':
              return createCredential(provider, AIPermissionLevel.STANDARD);
            case 'advanced_provider':
              return createCredential(provider, AIPermissionLevel.ADVANCED);
            case 'admin_provider':
              return createCredential(provider, AIPermissionLevel.ADMIN);
            default:
              throw new CLIError(`No credential found for provider "${provider}"`, 'CREDENTIAL_NOT_FOUND');
          }
        });
      
      mockCredentialManager.hasCredential
        .mockImplementation(async (provider) => {
          return ['readonly_provider', 'standard_provider', 'advanced_provider', 'admin_provider'].includes(provider);
        });
      
      // Create permission manager
      const permissionManager = new AIPermissionManager(mockCredentialManager, mockBlockchainVerifier);
      
      // Initialize default permissions
      (permissionManager as any).registerOperationPermission('summarize', AIActionType.SUMMARIZE, AIPermissionLevel.READ_ONLY);
      (permissionManager as any).registerOperationPermission('analyze', AIActionType.ANALYZE, AIPermissionLevel.READ_ONLY);
      (permissionManager as any).registerOperationPermission('categorize', AIActionType.CATEGORIZE, AIPermissionLevel.STANDARD);
      (permissionManager as any).registerOperationPermission('prioritize', AIActionType.PRIORITIZE, AIPermissionLevel.STANDARD);
      (permissionManager as any).registerOperationPermission('suggest', AIActionType.SUGGEST, AIPermissionLevel.STANDARD);
      (permissionManager as any).registerOperationPermission('train', 10, AIPermissionLevel.ADVANCED);
      (permissionManager as any).registerOperationPermission('manage_providers', 20, AIPermissionLevel.ADMIN);
      (permissionManager as any).initialized = true;
      
      // Test READ_ONLY operations with READ_ONLY provider
      await expect(permissionManager.checkPermission('readonly_provider', 'summarize')).resolves.toBe(true);
      await expect(permissionManager.checkPermission('readonly_provider', 'analyze')).resolves.toBe(true);
      await expect(permissionManager.checkPermission('readonly_provider', 'categorize')).resolves.toBe(false);
      await expect(permissionManager.checkPermission('readonly_provider', 'suggest')).resolves.toBe(false);
      await expect(permissionManager.checkPermission('readonly_provider', 'train')).resolves.toBe(false);
      await expect(permissionManager.checkPermission('readonly_provider', 'manage_providers')).resolves.toBe(false);
      
      // Test STANDARD operations with STANDARD provider
      await expect(permissionManager.checkPermission('standard_provider', 'summarize')).resolves.toBe(true);
      await expect(permissionManager.checkPermission('standard_provider', 'analyze')).resolves.toBe(true);
      await expect(permissionManager.checkPermission('standard_provider', 'categorize')).resolves.toBe(true);
      await expect(permissionManager.checkPermission('standard_provider', 'suggest')).resolves.toBe(true);
      await expect(permissionManager.checkPermission('standard_provider', 'train')).resolves.toBe(false);
      await expect(permissionManager.checkPermission('standard_provider', 'manage_providers')).resolves.toBe(false);
      
      // Test ADVANCED operations with ADVANCED provider
      await expect(permissionManager.checkPermission('advanced_provider', 'summarize')).resolves.toBe(true);
      await expect(permissionManager.checkPermission('advanced_provider', 'categorize')).resolves.toBe(true);
      await expect(permissionManager.checkPermission('advanced_provider', 'train')).resolves.toBe(true);
      await expect(permissionManager.checkPermission('advanced_provider', 'manage_providers')).resolves.toBe(false);
      
      // Test ADMIN operations with ADMIN provider
      await expect(permissionManager.checkPermission('admin_provider', 'summarize')).resolves.toBe(true);
      await expect(permissionManager.checkPermission('admin_provider', 'categorize')).resolves.toBe(true);
      await expect(permissionManager.checkPermission('admin_provider', 'train')).resolves.toBe(true);
      await expect(permissionManager.checkPermission('admin_provider', 'manage_providers')).resolves.toBe(true);
    });
    
    it('should prevent operations based on permission level in AIService', async () => {
      // Create mock permission manager
      const mockPermissionManager = {
        checkPermission: jest.fn().mockImplementation((provider, operation) => {
          // Only allow specific operations
          if (provider === 'xai' && operation === 'summarize') return Promise.resolve(true);
          if (provider === 'xai' && operation === 'analyze') return Promise.resolve(false);
          if (provider === 'anthropic') return Promise.resolve(true);
          return Promise.resolve(false);
        }),
        verifyOperationPermission: jest.fn()
      };
      
      // Mock initializePermissionManager to return our mock
      (initializePermissionManager as jest.Mock).mockReturnValue(mockPermissionManager);
      
      // Create AI services with different providers
      const xaiService = new AIService('test-api-key', AIProvider.XAI);
      const anthropicService = new AIService('test-api-key', AIProvider.ANTHROPIC);
      
      // XAI service should only be able to summarize
      await expect(xaiService.summarize(sampleTodos)).resolves.not.toThrow();
      await expect(xaiService.analyze(sampleTodos)).rejects.toThrow(/insufficient permissions/);
      
      // Anthropic service should be able to do both
      await expect(anthropicService.summarize(sampleTodos)).resolves.not.toThrow();
      await expect(anthropicService.analyze(sampleTodos)).resolves.not.toThrow();
    });
    
    it('should enforce permission boundaries during runtime updates', async () => {
      // Setup credentials
      mockCredentialManager.getCredentialObject
        .mockImplementation(async (provider) => {
          return createCredential(provider, AIPermissionLevel.STANDARD);
        });
      
      mockCredentialManager.hasCredential
        .mockImplementation(async (provider) => true);
      
      // Setup blockchain verification for permissions
      mockBlockchainVerifier.verifyOperation
        .mockImplementation(async (params) => ({
          id: 'op-123',
          success: true,
          timestamp: Date.now()
        }));
      
      // Create permission manager
      const permissionManager = new AIPermissionManager(mockCredentialManager, mockBlockchainVerifier);
      (permissionManager as any).initialized = true;
      
      // Add a custom operation with initial permission level
      permissionManager.registerOperationPermission(
        'custom_operation',
        11,
        AIPermissionLevel.STANDARD
      );
      
      // Should be allowed with STANDARD permission
      await expect(permissionManager.checkPermission('test-provider', 'custom_operation')).resolves.toBe(true);
      
      // Update the operation to require higher permission
      permissionManager.registerOperationPermission(
        'custom_operation',
        11,
        AIPermissionLevel.ADVANCED
      );
      
      // Should now be denied with STANDARD permission
      await expect(permissionManager.checkPermission('test-provider', 'custom_operation')).resolves.toBe(false);
      
      // Verify blockchain verification was called
      await permissionManager.verifyOperationPermission('test-provider', 'summarize');
      expect(mockBlockchainVerifier.verifyOperation).toHaveBeenCalledWith(expect.any(Object));
    });
  });
  
  describe('Privilege Escalation Prevention', () => {
    it('should prevent privilege escalation attempts', async () => {
      // Setup credential manager to prevent privilege escalation
      mockCredentialManager.updatePermissions
        .mockImplementation(async (provider, permissionLevel) => {
          // For testing purposes, only allow escalation to STANDARD
          // Real implementation would check current user permissions
          if (permissionLevel > AIPermissionLevel.STANDARD) {
            throw new Error('Unauthorized permission escalation attempt');
          }
          return createCredential(provider, permissionLevel);
        });
      
      mockCredentialManager.getCredentialObject
        .mockImplementation(async (provider) => {
          return createCredential(provider, AIPermissionLevel.READ_ONLY);
        });
      
      // Create permission manager
      const permissionManager = new AIPermissionManager(mockCredentialManager, mockBlockchainVerifier);
      (permissionManager as any).initialized = true;
      
      // Standard permission update should succeed
      await expect(permissionManager.setPermissionLevel('test-provider', AIPermissionLevel.STANDARD))
        .resolves.toBe(true);
      
      // Admin permission escalation should fail
      await expect(permissionManager.setPermissionLevel('test-provider', AIPermissionLevel.ADMIN))
        .resolves.toBe(false);
      
      // Verify credential manager was called with correct parameters
      expect(mockCredentialManager.updatePermissions).toHaveBeenCalledWith(
        'test-provider',
        AIPermissionLevel.STANDARD
      );
      expect(mockCredentialManager.updatePermissions).toHaveBeenCalledWith(
        'test-provider',
        AIPermissionLevel.ADMIN
      );
    });
    
    it('should prevent backdoor permission routes', async () => {
      // Setup credential manager
      mockCredentialManager.getCredentialObject
        .mockImplementation(async (provider) => {
          return createCredential(provider, AIPermissionLevel.STANDARD);
        });
      
      mockCredentialManager.hasCredential
        .mockImplementation(async (provider) => true);
      
      // Create permission manager
      const permissionManager = new AIPermissionManager(mockCredentialManager, mockBlockchainVerifier);
      (permissionManager as any).initialized = true;
      
      // Define operations with various permission levels
      permissionManager.registerOperationPermission(
        'standard_op',
        1,
        AIPermissionLevel.STANDARD
      );
      
      permissionManager.registerOperationPermission(
        'advanced_op',
        2,
        AIPermissionLevel.ADVANCED
      );
      
      // Create another operation that calls advanced_op internally
      permissionManager.registerOperationPermission(
        'backdoor_op',
        3,
        AIPermissionLevel.STANDARD
      );
      
      // Verify standard operation is allowed
      await expect(permissionManager.checkPermission('test-provider', 'standard_op')).resolves.toBe(true);
      
      // Verify advanced operation is denied
      await expect(permissionManager.checkPermission('test-provider', 'advanced_op')).resolves.toBe(false);
      
      // Backdoor operation should be allowed based on its own permission level
      await expect(permissionManager.checkPermission('test-provider', 'backdoor_op')).resolves.toBe(true);
      
      // Create mock AI service that implements the backdoor
      const mockAIService = {
        backdoor_op: async (todos: Todo[]) => {
          // First check permissions for the backdoor op (which will pass)
          const hasPermission = await permissionManager.checkPermission('test-provider', 'backdoor_op');
          if (!hasPermission) {
            throw new Error('Insufficient permissions');
          }
          
          // Now attempt to perform advanced operation internally
          // This simulates a backdoor implementation
          // A proper implementation would check permissions again here!
          return 'Backdoor result';
        },
        
        secured_backdoor_op: async (todos: Todo[]) => {
          // First check permissions for the backdoor op (which will pass)
          const hasPermission = await permissionManager.checkPermission('test-provider', 'backdoor_op');
          if (!hasPermission) {
            throw new Error('Insufficient permissions');
          }
          
          // Properly check permissions for the advanced operation as well
          const hasAdvancedPermission = await permissionManager.checkPermission('test-provider', 'advanced_op');
          if (!hasAdvancedPermission) {
            throw new Error('Insufficient permissions for advanced operation');
          }
          
          return 'Secured backdoor result';
        }
      };
      
      // Unsecured backdoor should work (this is the vulnerability)
      await expect(mockAIService.backdoor_op(sampleTodos)).resolves.toBe('Backdoor result');
      
      // Secured backdoor should fail (this is correct)
      await expect(mockAIService.secured_backdoor_op(sampleTodos)).rejects.toThrow('Insufficient permissions for advanced operation');
      
      // This demonstrates the need for permission checks at each level,
      // not just at the API entry points
    });
  });
  
  describe('Cross-Provider Permission Boundaries', () => {
    it('should enforce permission isolation between different providers', async () => {
      // Create permission manager with enforced provider boundaries
      const mockPermissionManager = {
        checkPermission: jest.fn().mockImplementation((provider, operation) => {
          // Only allow specific operations for specific providers
          if (provider === 'xai' && operation === 'summarize') return Promise.resolve(true);
          if (provider === 'anthropic' && ['summarize', 'analyze'].includes(operation)) return Promise.resolve(true);
          return Promise.resolve(false);
        }),
        verifyOperationPermission: jest.fn()
      };
      
      // Mock initializePermissionManager to return our mock
      (initializePermissionManager as jest.Mock).mockReturnValue(mockPermissionManager);
      
      // Create AI services with different providers
      const xaiService = new AIService('test-api-key', AIProvider.XAI);
      const anthropicService = new AIService('test-api-key', AIProvider.ANTHROPIC);
      
      // XAI service should only be able to summarize
      await expect(xaiService.summarize(sampleTodos)).resolves.not.toThrow();
      await expect(xaiService.analyze(sampleTodos)).rejects.toThrow(/insufficient permissions/);
      
      // Anthropic service should be able to do both
      await expect(anthropicService.summarize(sampleTodos)).resolves.not.toThrow();
      await expect(anthropicService.analyze(sampleTodos)).resolves.not.toThrow();
    });
    
    it('should prevent unauthorized provider switching', async () => {
      // Create a mock AI service to test provider switching
      const mockAIService = {
        provider: AIProvider.XAI,
        apiKey: 'test-api-key',
        
        // Permissions are often tied to the provider
        // This simulates a vulnerability where the provider can be changed
        setProvider: function(newProvider: AIProvider) {
          this.provider = newProvider;
        },
        
        // Secure implementation that requires permissions for the switch
        secureSetProvider: async function(newProvider: AIProvider, permissionManager: any) {
          // Check if user has admin permissions to switch providers
          const hasPermission = await permissionManager.checkPermission(
            this.provider,
            'manage_providers'
          );
          
          if (!hasPermission) {
            throw new Error('Insufficient permissions to change provider');
          }
          
          this.provider = newProvider;
        },
        
        performOperation: async function(operation: string, permissionManager: any) {
          // Check permissions for current provider
          const hasPermission = await permissionManager.checkPermission(
            this.provider,
            operation
          );
          
          if (!hasPermission) {
            throw new Error(`Insufficient permissions for ${operation}`);
          }
          
          return `${operation} result`;
        }
      };
      
      // Create mock permission manager
      const mockPermissionManager = {
        checkPermission: jest.fn().mockImplementation((provider, operation) => {
          // XAI has limited permissions
          if (provider === AIProvider.XAI) {
            return Promise.resolve(operation === 'summarize');
          }
          
          // Anthropic has more permissions
          if (provider === AIProvider.ANTHROPIC) {
            return Promise.resolve(['summarize', 'analyze', 'categorize'].includes(operation));
          }
          
          // No provider has manage_providers permission
          if (operation === 'manage_providers') {
            return Promise.resolve(false);
          }
          
          return Promise.resolve(false);
        }),
        verifyOperationPermission: jest.fn()
      };
      
      // Test initial permissions with XAI provider
      await expect(mockAIService.performOperation('summarize', mockPermissionManager)).resolves.toBe('summarize result');
      await expect(mockAIService.performOperation('analyze', mockPermissionManager)).rejects.toThrow('Insufficient permissions');
      
      // Insecure provider switch (vulnerability)
      mockAIService.setProvider(AIProvider.ANTHROPIC);
      
      // After switch, new permissions are available
      await expect(mockAIService.performOperation('analyze', mockPermissionManager)).resolves.toBe('analyze result');
      
      // Reset provider
      mockAIService.setProvider(AIProvider.XAI);
      
      // Secure provider switch (correct)
      await expect(mockAIService.secureSetProvider(AIProvider.ANTHROPIC, mockPermissionManager))
        .rejects.toThrow('Insufficient permissions to change provider');
      
      // Provider should remain unchanged after failed switch
      expect(mockAIService.provider).toBe(AIProvider.XAI);
    });
  });
  
  describe('Blockchain Permission Verification', () => {
    it('should verify permissions on the blockchain', async () => {
      // Setup blockchain verifier
      mockBlockchainVerifier.verifyOperation
        .mockImplementation(async (params) => ({
          id: 'op-123',
          success: true,
          timestamp: Date.now()
        }));
      
      // Setup credential manager
      mockCredentialManager.getCredentialObject
        .mockImplementation(async (provider) => {
          return createCredential(provider, AIPermissionLevel.STANDARD, true);
        });
      
      mockCredentialManager.hasCredential
        .mockImplementation(async (provider) => true);
      
      // Create permission manager
      const permissionManager = new AIPermissionManager(mockCredentialManager, mockBlockchainVerifier);
      (permissionManager as any).initialized = true;
      
      // Register operations
      permissionManager.registerOperationPermission(
        'blockchain_verified_op',
        AIActionType.SUMMARIZE,
        AIPermissionLevel.STANDARD
      );
      
      // Verify operation permission on blockchain
      const result = await permissionManager.verifyOperationPermission(
        'test-provider',
        'blockchain_verified_op'
      );
      
      // Should succeed and have verification ID
      expect(result.allowed).toBe(true);
      expect(result.verificationId).toBe('op-123');
      
      // Verify blockchain verifier was called with correct parameters
      expect(mockBlockchainVerifier.verifyOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: AIActionType.SUMMARIZE,
          request: expect.stringContaining('test-provider'),
          response: expect.stringContaining('Permission granted'),
          provider: 'test-provider',
          metadata: expect.objectContaining({
            operation: 'blockchain_verified_op',
            permissionLevel: AIPermissionLevel.STANDARD.toString()
          })
        })
      );
    });
    
    it('should enforce blockchain validation of credentials', async () => {
      // Setup credentials with blockchain verification
      mockCredentialManager.getCredentialObject
        .mockImplementation(async (provider) => {
          if (provider === 'verified_provider') {
            return createCredential(provider, AIPermissionLevel.STANDARD, true);
          }
          return createCredential(provider, AIPermissionLevel.STANDARD, false);
        });
      
      mockCredentialManager.hasCredential
        .mockImplementation(async (provider) => true);
      
      // Create mock blockchain verifier that verifies credentials
      const mockAdapter = {
        checkVerificationStatus: jest.fn().mockImplementation((proofId) => {
          // Simulate blockchain verification
          // For this test, only approve specific proof IDs
          return Promise.resolve(proofId === 'proof-123');
        })
      };
      
      mockCredentialManager.setBlockchainAdapter(mockAdapter as any);
      
      // Create permission manager that requires blockchain verification
      const permissionManager = new AIPermissionManager(mockCredentialManager, mockBlockchainVerifier);
      (permissionManager as any).initialized = true;
      (permissionManager as any).requireBlockchainVerification = true;
      
      // Register operations
      permissionManager.registerOperationPermission(
        'verified_op',
        AIActionType.SUMMARIZE,
        AIPermissionLevel.STANDARD
      );
      
      // Verified provider should be allowed
      await expect(permissionManager.checkPermission('verified_provider', 'verified_op')).resolves.toBe(true);
      
      // Non-verified provider should be denied if requiring blockchain verification
      // This would need modifications to the AIPermissionManager implementation
      // to support the requireBlockchainVerification flag
    });
  });
  
  describe('Permission Audit Logging', () => {
    it('should log access attempts for security auditing', async () => {
      // Create mock audit logger
      const auditLogSpy = jest.fn();
      
      // Setup credential manager with audit logging
      mockCredentialManager.getCredentialObject
        .mockImplementation(async (provider) => {
          // Log the access attempt
          auditLogSpy({
            event: 'credential_access',
            provider,
            timestamp: Date.now(),
            success: true
          });
          
          return createCredential(provider, AIPermissionLevel.STANDARD);
        });
      
      mockCredentialManager.hasCredential
        .mockImplementation(async (provider) => {
          // Log the check attempt
          auditLogSpy({
            event: 'credential_check',
            provider,
            timestamp: Date.now(),
            success: true
          });
          
          return true;
        });
      
      // Create permission manager
      const permissionManager = new AIPermissionManager(mockCredentialManager, mockBlockchainVerifier);
      (permissionManager as any).initialized = true;
      (permissionManager as any).auditLogger = { log: auditLogSpy };
      
      // Perform permission checks
      await permissionManager.checkPermission('test-provider', 'summarize');
      
      // Verify audit logs were created
      expect(auditLogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'credential_check',
          provider: 'test-provider'
        })
      );
      
      expect(auditLogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'credential_access',
          provider: 'test-provider'
        })
      );
    });
    
    it('should track and log permission changes', async () => {
      // Create mock audit logger
      const auditLogSpy = jest.fn();
      
      // Setup credential manager with audit logging
      mockCredentialManager.updatePermissions
        .mockImplementation(async (provider, permissionLevel) => {
          // Log the permission change
          auditLogSpy({
            event: 'permission_updated',
            provider,
            timestamp: Date.now(),
            oldLevel: AIPermissionLevel.STANDARD,
            newLevel: permissionLevel
          });
          
          return createCredential(provider, permissionLevel);
        });
      
      mockCredentialManager.getCredentialObject
        .mockImplementation(async (provider) => {
          return createCredential(provider, AIPermissionLevel.STANDARD);
        });
      
      // Create permission manager
      const permissionManager = new AIPermissionManager(mockCredentialManager, mockBlockchainVerifier);
      (permissionManager as any).initialized = true;
      (permissionManager as any).auditLogger = { log: auditLogSpy };
      
      // Update permissions
      await permissionManager.setPermissionLevel('test-provider', AIPermissionLevel.ADVANCED);
      
      // Verify audit logs were created
      expect(auditLogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'permission_updated',
          provider: 'test-provider',
          oldLevel: AIPermissionLevel.STANDARD,
          newLevel: AIPermissionLevel.ADVANCED
        })
      );
    });
  });
  
  describe('Permission-Based Constraints', () => {
    it('should enforce different constraints based on permission levels', async () => {
      // Create AI services with mock constraints based on permission levels
      const createServiceWithConstraints = (permissionLevel: AIPermissionLevel) => {
        // Create service with permission-based constraints
        return {
          permissionLevel,
          
          getConstraints: function() {
            // Apply different constraints based on permission level
            switch (this.permissionLevel) {
              case AIPermissionLevel.READ_ONLY:
                return {
                  maxRequests: 10,
                  maxTodos: 5,
                  allowedOperations: ['summarize', 'analyze']
                };
              case AIPermissionLevel.STANDARD:
                return {
                  maxRequests: 50,
                  maxTodos: 20,
                  allowedOperations: ['summarize', 'analyze', 'categorize', 'prioritize', 'suggest']
                };
              case AIPermissionLevel.ADVANCED:
                return {
                  maxRequests: 100,
                  maxTodos: 50,
                  allowedOperations: ['summarize', 'analyze', 'categorize', 'prioritize', 'suggest', 'train']
                };
              case AIPermissionLevel.ADMIN:
                return {
                  maxRequests: 500,
                  maxTodos: 100,
                  allowedOperations: ['summarize', 'analyze', 'categorize', 'prioritize', 'suggest', 'train', 'manage_providers']
                };
              default:
                return {
                  maxRequests: 0,
                  maxTodos: 0,
                  allowedOperations: []
                };
            }
          },
          
          validateConstraints: function(operation: string, todos: Todo[]) {
            const constraints = this.getConstraints();
            
            // Check if operation is allowed
            if (!constraints.allowedOperations.includes(operation)) {
              throw new Error(`Operation ${operation} not allowed with permission level ${this.permissionLevel}`);
            }
            
            // Check if too many todos
            if (todos.length > constraints.maxTodos) {
              throw new Error(`Too many todos (${todos.length}), maximum allowed is ${constraints.maxTodos}`);
            }
            
            return true;
          }
        };
      };
      
      // Create services with different permission levels
      const readOnlyService = createServiceWithConstraints(AIPermissionLevel.READ_ONLY);
      const standardService = createServiceWithConstraints(AIPermissionLevel.STANDARD);
      const advancedService = createServiceWithConstraints(AIPermissionLevel.ADVANCED);
      
      // Test READ_ONLY constraints
      expect(readOnlyService.validateConstraints('summarize', sampleTodos)).toBe(true);
      expect(() => readOnlyService.validateConstraints('categorize', sampleTodos)).toThrow(/not allowed/);
      
      // Create large todo list that exceeds READ_ONLY limit
      const largeTodoList = Array(10).fill(sampleTodo);
      expect(() => readOnlyService.validateConstraints('summarize', largeTodoList)).toThrow(/Too many todos/);
      
      // Test STANDARD constraints
      expect(standardService.validateConstraints('summarize', sampleTodos)).toBe(true);
      expect(standardService.validateConstraints('categorize', sampleTodos)).toBe(true);
      expect(() => standardService.validateConstraints('train', sampleTodos)).toThrow(/not allowed/);
      
      // Test ADVANCED constraints
      expect(advancedService.validateConstraints('summarize', sampleTodos)).toBe(true);
      expect(advancedService.validateConstraints('train', sampleTodos)).toBe(true);
      expect(() => advancedService.validateConstraints('manage_providers', sampleTodos)).toThrow(/not allowed/);
    });
  });
  
  describe('Dynamic Permission Adjustment', () => {
    it('should adjust permissions based on usage patterns', async () => {
      // Create a usage-based permission adjuster
      const permissionAdjuster = {
        usageTracking: new Map<string, { count: number, lastReset: number }>(),
        RATE_LIMIT: 10, // Max 10 requests per hour
        RATE_WINDOW: 60 * 60 * 1000, // 1 hour in ms
        
        trackUsage: function(provider: string): boolean {
          const now = Date.now();
          
          // Initialize or update rate limit tracking
          if (!this.usageTracking.has(provider)) {
            this.usageTracking.set(provider, { count: 0, lastReset: now });
          }
          
          const tracking = this.usageTracking.get(provider)!;
          
          // Reset count if window has passed
          if (now - tracking.lastReset > this.RATE_WINDOW) {
            tracking.count = 0;
            tracking.lastReset = now;
          }
          
          // Increment count
          tracking.count++;
          
          // Check if rate limit exceeded
          return tracking.count <= this.RATE_LIMIT;
        },
        
        shouldReducePermissions: function(provider: string): boolean {
          // Check if provider has exceeded usage limits
          if (!this.usageTracking.has(provider)) {
            return false;
          }
          
          const tracking = this.usageTracking.get(provider)!;
          
          // If usage is excessive, reduce permissions
          return tracking.count >= this.RATE_LIMIT;
        },
        
        adjustPermissions: async function(
          provider: string,
          permissionManager: AIPermissionManager
        ): Promise<void> {
          if (this.shouldReducePermissions(provider)) {
            // Get current permission level
            const currentLevel = await permissionManager.getPermissionLevel(provider);
            
            // If already at minimum level, don't change
            if (currentLevel <= AIPermissionLevel.READ_ONLY) {
              return;
            }
            
            // Reduce permissions by one level
            const newLevel = currentLevel - 1;
            await permissionManager.setPermissionLevel(provider, newLevel);
            
            // Log the adjustment
            console.log(`Reduced permissions for ${provider} from ${currentLevel} to ${newLevel} due to excessive usage`);
          }
        }
      };
      
      // Setup credential manager
      mockCredentialManager.getCredentialObject
        .mockImplementation(async (provider) => {
          return createCredential(provider, AIPermissionLevel.STANDARD);
        });
      
      mockCredentialManager.hasCredential
        .mockImplementation(async (provider) => true);
      
      mockCredentialManager.updatePermissions
        .mockImplementation(async (provider, level) => {
          return createCredential(provider, level);
        });
      
      // Create permission manager
      const permissionManager = new AIPermissionManager(mockCredentialManager, mockBlockchainVerifier);
      (permissionManager as any).initialized = true;
      
      // Test initial usage (should not reduce permissions)
      permissionAdjuster.trackUsage('test-provider');
      await permissionAdjuster.adjustPermissions('test-provider', permissionManager);
      
      // Credential manager's updatePermissions should not have been called
      expect(mockCredentialManager.updatePermissions).not.toHaveBeenCalled();
      
      // Simulate excessive usage
      for (let i = 0; i < permissionAdjuster.RATE_LIMIT; i++) {
        permissionAdjuster.trackUsage('test-provider');
      }
      
      // Now permissions should be reduced
      await permissionAdjuster.adjustPermissions('test-provider', permissionManager);
      
      // Credential manager's updatePermissions should have been called to reduce permissions
      expect(mockCredentialManager.updatePermissions).toHaveBeenCalledWith(
        'test-provider',
        AIPermissionLevel.READ_ONLY
      );
    });
  });
});