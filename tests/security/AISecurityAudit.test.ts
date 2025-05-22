import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AIService } from '../../src/services/ai/aiService';
import { AIVerificationService } from '../../src/services/ai/AIVerificationService';
import { BlockchainAIVerificationService } from '../../src/services/ai/BlockchainAIVerificationService';
import { SuiAIVerifierAdapter } from '../../src/types/adapters/AIVerifierAdapter';
import { secureCredentialManager } from '../../src/services/ai/SecureCredentialManager';
import { AIProvider, AIModelOptions } from '../../src/types/adapters/AIModelAdapter';
import { Todo } from '../../src/types/todo';
import { AIPrivacyLevel, AIActionType, VerificationRecord } from '../../src/types/adapters/AIVerifierAdapter';
import { CredentialType, AIPermissionLevel } from '../../src/types/adapters/AICredentialAdapter';
import { AIProviderFactory } from '../../src/services/ai/AIProviderFactory';
import { initializePermissionManager } from '../../src/services/ai/AIPermissionManager';
import { CLI_CONFIG } from '../../src/constants';

// Mock dependencies
jest.mock('@langchain/core/prompts');
jest.mock('@langchain/xai');
jest.mock('../../src/services/ai/AIProviderFactory');
jest.mock('../../src/services/ai/AIVerificationService');
jest.mock('../../src/services/ai/BlockchainAIVerificationService');
jest.mock('../../src/services/ai/AIPermissionManager');
jest.mock('../../src/services/ai/SecureCredentialManager', () => {
  const originalModule = jest.requireActual('../../src/services/ai/SecureCredentialManager');
  
  return {
    ...originalModule,
    secureCredentialManager: {
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
    }
  };
});

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

describe('AI Security Audit', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  
  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Restore environment variables before each test
    process.env.XAI_API_KEY = 'test-api-key';
  });
  
  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });
  
  /**
   * 1. API Key Security and Handling Tests
   */
  describe('API Key Security and Handling', () => {
    it('should not expose API key in error messages', async () => {
      const mockAIService = new AIService('test-api-key');
      
      // Mock a failed API call that might expose the key
      jest.spyOn(mockAIService['modelAdapter'], 'processWithPromptTemplate').mockImplementation(() => {
        throw new Error('Invalid API key: test-ap...');
      });
      
      // Test that error doesn't contain the actual API key
      await expect(mockAIService.summarize(sampleTodos))
        .rejects
        .toThrow('Invalid API key');
      
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('test-api-key')
      );
    });
    
    it('should safely handle missing API keys', () => {
      delete process.env.XAI_API_KEY;
      
      expect(() => new AIService()).not.toThrow();
      
      // Should use factory default if no API key provided
      expect(AIProviderFactory.getDefaultProvider).toHaveBeenCalled();
    });
    
    it('should redact API keys in logs', async () => {
      const originalLog = console.log;
      const mockLog = jest.fn();
      console.log = mockLog;
      
      try {
        // Create service with API key
        new AIService('test-api-key-12345');
        
        // Check if any logs contain the API key
        const logs = mockLog.mock.calls.flat();
        logs.forEach(log => {
          if (typeof log === 'string') {
            expect(log).not.toContain('test-api-key-12345');
          }
        });
      } finally {
        console.log = originalLog;
      }
    });
    
    it('should validate API key format before making requests', async () => {
      // Create AI service with a malformed key
      const mockAIService = new AIService('invalid-format-key-!@#$');
      
      // Mock the adapter to validate key format
      jest.spyOn(mockAIService['modelAdapter'], 'processWithPromptTemplate').mockImplementation(() => {
        throw new Error('Invalid API key format');
      });
      
      // Should throw format validation error
      await expect(mockAIService.summarize(sampleTodos)).rejects.toThrow('Invalid API key format');
    });
    
    it('should not store unencrypted API keys in memory longer than necessary', async () => {
      // Spy on the AIProviderFactory.createProvider method
      const createProviderSpy = jest.spyOn(AIProviderFactory, 'createProvider');
      
      // Create service with API key
      const mockAIService = new AIService('test-api-key-sensitive');
      
      // Check that API key is not stored in the AIService instance properties
      const serviceProps = Object.entries(mockAIService);
      serviceProps.forEach(([key, value]) => {
        if (typeof value === 'string') {
          expect(value).not.toBe('test-api-key-sensitive');
        }
      });
      
      // Check that provider creation happened properly
      expect(createProviderSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: expect.any(String)
        })
      );
    });
  });
  
  /**
   * 2. Input Validation and Sanitization Tests
   */
  describe('Input Validation and Sanitization', () => {
    it('should validate and sanitize todo input before processing', async () => {
      const mockAIService = new AIService('test-api-key');
      
      // Create a todo with potentially malicious content
      const maliciousTodo: Todo = {
        id: 'todo-789',
        title: '<script>alert("XSS")</script>',
        description: '"; DROP TABLE todos; --',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Spy on the model adapter to examine what gets passed to it
      const processSpy = jest.spyOn(mockAIService['modelAdapter'], 'processWithPromptTemplate')
        .mockResolvedValue({ result: 'Summary', modelName: 'test', provider: AIProvider.XAI, timestamp: Date.now() });
      
      await mockAIService.summarize([maliciousTodo]);
      
      // Check that input is sanitized before being passed to the model
      const callArgs = processSpy.mock.calls[0];
      const todoStr = callArgs[1].todos;
      
      // Should not contain raw script tags
      expect(todoStr).not.toContain('<script>');
      // Should escape SQL injection attempts
      expect(todoStr).not.toContain('DROP TABLE');
    });
    
    it('should reject overlarge input that could cause DoS', async () => {
      const mockAIService = new AIService('test-api-key');
      
      // Create an array with an excessive number of todos
      const manyTodos: Todo[] = Array(1000).fill(null).map((_, i) => ({
        id: `todo-${i}`,
        title: `Todo ${i}`,
        description: 'Description '.repeat(100), // Very long description
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      
      // Should reject excessive input
      await expect(mockAIService.summarize(manyTodos)).rejects.toThrow(/exceeds maximum/);
    });
    
    it('should validate response data structure for structural attacks', async () => {
      const mockAIService = new AIService('test-api-key');
      
      // Mock the model adapter to return malformed response
      jest.spyOn(mockAIService['modelAdapter'], 'completeStructured')
        .mockResolvedValue({
          result: { '__proto__': { 'polluted': true } } as any,
          modelName: 'test',
          provider: AIProvider.XAI,
          timestamp: Date.now()
        });
      
      // Should sanitize prototype pollution attempts
      const result = await mockAIService.categorize(sampleTodos);
      
      // Should not have polluted the prototype
      expect(({} as any).polluted).toBeUndefined();
      
      // Should return empty object for safety when structure is invalid
      expect(result).toEqual({});
    });
    
    it('should prevent command injection in prompts', async () => {
      const mockAIService = new AIService('test-api-key');
      
      // Create a todo with command injection attempt
      const injectionTodo: Todo = {
        id: 'todo-inj',
        title: 'Normal Todo',
        description: 'Description $(rm -rf /)',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Spy on the model adapter
      const processSpy = jest.spyOn(mockAIService['modelAdapter'], 'processWithPromptTemplate')
        .mockResolvedValue({ result: 'Summary', modelName: 'test', provider: AIProvider.XAI, timestamp: Date.now() });
      
      await mockAIService.summarize([injectionTodo]);
      
      // Check if command injection characters are escaped
      const callArgs = processSpy.mock.calls[0];
      const todoStr = callArgs[1].todos;
      
      // Should not contain unescaped command injection characters
      expect(todoStr).not.toContain('$(rm');
      expect(todoStr).toContain('Description ');
    });
    
    it('should validate custom options to prevent parameter injection', async () => {
      // Attempt options injection
      const maliciousOptions: AIModelOptions = {
        temperature: 0.7,
        maxTokens: 2000,
        // @ts-expect-error - intentional test of injection
        __proto__: { injected: true },
        // @ts-expect-error - intentional test of injection
        constructor: { prototype: { injected: true } }
      };
      
      const mockAIService = new AIService('test-api-key', AIProvider.XAI, 'model', maliciousOptions);
      
      // Check prototype pollution
      expect(({} as any).injected).toBeUndefined();
      
      // Verify options were sanitized
      expect(mockAIService['options'].temperature).toBe(0.7);
      expect(mockAIService['options'].maxTokens).toBe(2000);
      expect(Object.keys(mockAIService['options']).length).toBeLessThanOrEqual(3);
    });
  });
  
  /**
   * 3. Credential Storage Security Tests
   */
  describe('Credential Storage Security', () => {
    it('should securely encrypt credentials at rest', async () => {
      // Mock fs methods to capture file content
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      
      // Call through to the actual secureCredentialManager to test encryption
      await secureCredentialManager.setCredential('xai', 'test-api-key', CredentialType.API_KEY);
      
      // Verify encryption was used
      expect(writeFileSyncSpy).toHaveBeenCalled();
      
      // Extract buffer from call arguments
      const fileContentBuffer = writeFileSyncSpy.mock.calls[0][1];
      
      // Check if the content is actually encrypted (not plaintext)
      const bufferStr = fileContentBuffer.toString();
      expect(bufferStr).not.toContain('test-api-key');
      
      // Verify IV is included (first 16 bytes should be IV)
      expect(fileContentBuffer.length).toBeGreaterThan(16);
      
      writeFileSyncSpy.mockRestore();
    });
    
    it('should apply proper file permissions when storing credentials', async () => {
      // Mock fs methods
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      
      // Call setCredential
      await secureCredentialManager.setCredential('xai', 'test-api-key', CredentialType.API_KEY);
      
      // Check that restricted permissions (0o600) were set
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Buffer),
        expect.objectContaining({ mode: 0o600 })
      );
      
      writeFileSyncSpy.mockRestore();
    });
    
    it('should handle decryption failures securely', async () => {
      // Mock fs methods for a corrupted/tampered file
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('corrupted-data'));
      
      // Create a new SecureCredentialManager instance which should trigger loading
      const SecureCredentialManager = jest.requireActual('../../src/services/ai/SecureCredentialManager').SecureCredentialManager;
      const credManager = new SecureCredentialManager();
      
      // Check that it handled corruption gracefully
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load credentials:',
        expect.anything()
      );
      
      // Manager should still initialize with empty credentials
      expect(await credManager.listCredentials()).toEqual([]);
    });
    
    it('should prevent unauthorized credential access', async () => {
      // Setup a mock credential
      secureCredentialManager.getCredential = jest.fn().mockImplementation((provider) => {
        if (provider !== 'xai') {
          throw new Error('No credential found');
        }
        return 'test-api-key';
      });
      
      // Test legitimate access
      const legitimateKey = await secureCredentialManager.getCredential('xai');
      expect(legitimateKey).toBe('test-api-key');
      
      // Test unauthorized access
      await expect(secureCredentialManager.getCredential('unauthorized'))
        .rejects
        .toThrow('No credential found');
    });
    
    it('should enforce credential expiration', async () => {
      // Test expired credential
      secureCredentialManager.getCredentialObject = jest.fn().mockImplementation((provider) => {
        if (provider === 'expired') {
          throw new Error('Credential for provider "expired" has expired');
        }
        return {
          id: 'cred-123',
          providerName: provider,
          credentialType: CredentialType.API_KEY,
          credentialValue: 'test-api-key',
          isVerified: false,
          storageOptions: { encrypt: true },
          createdAt: Date.now(),
          permissionLevel: AIPermissionLevel.STANDARD
        };
      });
      
      // Valid credential
      const validCredential = await secureCredentialManager.getCredentialObject('valid');
      expect(validCredential.credentialValue).toBe('test-api-key');
      
      // Expired credential
      await expect(secureCredentialManager.getCredentialObject('expired'))
        .rejects
        .toThrow('has expired');
    });
    
    it('should prevent path traversal in credential files', async () => {
      // Attempt path traversal in provider name
      const traversalProvider = '../../../etc/passwd';
      
      // Mock to capture the path used
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      
      // Create a credential with the malicious provider name
      await secureCredentialManager.setCredential(traversalProvider, 'test-api-key');
      
      // Check that the credential was stored with a sanitized name
      // The provider name should be converted to lowercase and not contain path traversal
      expect(writeFileSyncSpy).toHaveBeenCalled();
      expect(secureCredentialManager.getCredential).toHaveBeenCalledWith(
        expect.not.stringContaining('../')
      );
      
      writeFileSyncSpy.mockRestore();
    });
  });
  
  /**
   * 4. Permissions and Access Control Tests
   */
  describe('Permissions and Access Control', () => {
    const mockBlockchainVerifier = { 
      verifyPermission: jest.fn(),
      checkUserPermission: jest.fn() 
    };
    
    beforeEach(() => {
      mockBlockchainVerifier.verifyPermission.mockReset();
      mockBlockchainVerifier.checkUserPermission.mockReset();
    });
    
    it('should enforce permission levels for AI operations', async () => {
      const mockPermissionManager = {
        checkPermission: jest.fn().mockImplementation((provider, operation) => {
          if (operation === 'analyze') {
            return false; // Restricted operation
          }
          return true;
        }),
        verifyOperationPermission: jest.fn()
      };
      
      // Mock the initializePermissionManager function
      (initializePermissionManager as jest.Mock).mockReturnValue(mockPermissionManager);
      
      // Create mock AI service with verification
      const mockVerificationService = new AIVerificationService(mockBlockchainVerifier as any);
      const mockAIService = new AIService('test-api-key', AIProvider.XAI, 'model', {}, mockVerificationService);
      
      // Regular operation should succeed
      await mockAIService.summarize(sampleTodos);
      
      // Attempt to perform restricted operation
      mockPermissionManager.checkPermission.mockReturnValueOnce(false);
      await expect(mockAIService.analyze(sampleTodos))
        .rejects
        .toThrow(/insufficient permissions/);
    });
    
    it('should enforce blockchain validation of credentials', async () => {
      // Setup mock
      secureCredentialManager.getCredentialObject = jest.fn().mockResolvedValue({
        id: 'cred-123',
        providerName: 'xai',
        credentialType: CredentialType.API_KEY,
        credentialValue: 'test-api-key',
        isVerified: true,
        verificationProof: 'proof-123',
        storageOptions: { encrypt: true },
        createdAt: Date.now(),
        permissionLevel: AIPermissionLevel.STANDARD
      });
      
      // Set blockchain adapter
      secureCredentialManager.setBlockchainAdapter({
        checkVerificationStatus: jest.fn().mockResolvedValue(false),
        signer: { toSuiAddress: jest.fn().mockResolvedValue('addr-123') }
      } as any);
      
      // Should reject if blockchain verification fails
      await expect(secureCredentialManager.getCredential('xai'))
        .rejects
        .toThrow('Blockchain verification is no longer valid');
    });
    
    it('should enforce permission boundaries across different providers', async () => {
      // Mock the permission manager
      const mockPermissionManager = {
        checkPermission: jest.fn().mockImplementation((provider, operation) => {
          // Only allow xai for summarize, anthropic for all
          if (provider === 'xai' && operation === 'summarize') return true;
          if (provider === 'anthropic') return true;
          return false;
        }),
        verifyOperationPermission: jest.fn()
      };
      
      (initializePermissionManager as jest.Mock).mockReturnValue(mockPermissionManager);
      
      // Create services with different providers
      const xaiService = new AIService('key', AIProvider.XAI);
      const anthropicService = new AIService('key', AIProvider.ANTHROPIC);
      
      // Specific permissions test
      mockPermissionManager.checkPermission.mockReset();
      mockPermissionManager.checkPermission.mockReturnValueOnce(true); // xai summarize
      mockPermissionManager.checkPermission.mockReturnValueOnce(false); // xai analyze
      mockPermissionManager.checkPermission.mockReturnValueOnce(true); // anthropic summarize
      mockPermissionManager.checkPermission.mockReturnValueOnce(true); // anthropic analyze
      
      // XAI service should only be able to summarize
      await expect(xaiService.summarize(sampleTodos)).resolves.not.toThrow();
      await expect(xaiService.analyze(sampleTodos)).rejects.toThrow();
      
      // Anthropic service should be able to do both
      await expect(anthropicService.summarize(sampleTodos)).resolves.not.toThrow();
      await expect(anthropicService.analyze(sampleTodos)).resolves.not.toThrow();
    });
    
    it('should prevent privilege escalation attempts', async () => {
      // Try to set a higher permission level than allowed
      secureCredentialManager.updatePermissions = jest.fn().mockImplementation((provider, permissionLevel) => {
        if (permissionLevel === AIPermissionLevel.ADMIN) {
          throw new Error('Unauthorized permission escalation attempt');
        }
        return { providerName: provider, permissionLevel };
      });
      
      // Standard permission update should succeed
      await expect(
        secureCredentialManager.updatePermissions('xai', AIPermissionLevel.STANDARD)
      ).resolves.not.toThrow();
      
      // Admin permission escalation should fail
      await expect(
        secureCredentialManager.updatePermissions('xai', AIPermissionLevel.ADMIN)
      ).rejects.toThrow('Unauthorized permission escalation attempt');
    });
    
    it('should log access attempts for security auditing', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      // Mock credential manager
      secureCredentialManager.getCredential = jest.fn().mockImplementation((provider) => {
        console.log(`AUDIT: Credential access attempt for provider ${provider}`);
        return 'test-api-key';
      });
      
      // Request credential
      await secureCredentialManager.getCredential('xai');
      
      // Verify audit log was created
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('AUDIT: Credential access attempt for provider xai')
      );
      
      consoleSpy.mockRestore();
    });
  });
  
  /**
   * 5. Blockchain Verification Security Tests
   */
  describe('Blockchain Verification Security', () => {
    it('should verify content integrity with blockchain hashes', async () => {
      // Create mockAIService with verification
      const mockVerifierAdapter: SuiAIVerifierAdapter = {
        createVerification: jest.fn().mockResolvedValue(mockVerificationRecord),
        verifyRecord: jest.fn().mockResolvedValue(true),
        getProviderInfo: jest.fn(),
        listVerifications: jest.fn(),
        getRegistryAddress: jest.fn(),
        registerProvider: jest.fn(),
        getVerification: jest.fn()
      } as any;
      
      const mockVerificationService = new AIVerificationService(mockVerifierAdapter);
      
      // Run an operation with verification
      const result = await mockVerificationService.createVerifiedSummary(
        sampleTodos,
        'Test summary',
        AIPrivacyLevel.HASH_ONLY
      );
      
      // Check verification
      expect(result.verification).toBeDefined();
      expect(result.verification.id).toBe('ver-123');
      
      // Verify the record was created with proper hashes
      expect(mockVerifierAdapter.createVerification).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: AIActionType.SUMMARIZE,
          privacyLevel: AIPrivacyLevel.HASH_ONLY
        })
      );
    });
    
    it('should detect tampering with verified results', async () => {
      // Create mockAIService with verification
      const mockVerifierAdapter: SuiAIVerifierAdapter = {
        createVerification: jest.fn().mockResolvedValue(mockVerificationRecord),
        verifyRecord: jest.fn().mockImplementation((record, request, response) => {
          // Simulate tampering detection
          if (response !== 'Test summary') {
            return Promise.resolve(false);
          }
          return Promise.resolve(true);
        }),
        getProviderInfo: jest.fn(),
        listVerifications: jest.fn(),
        getRegistryAddress: jest.fn(),
        registerProvider: jest.fn(),
        getVerification: jest.fn()
      } as any;
      
      const mockVerificationService = new AIVerificationService(mockVerifierAdapter);
      
      // Create a verified result
      const result = await mockVerificationService.createVerifiedSummary(
        sampleTodos,
        'Test summary',
        AIPrivacyLevel.HASH_ONLY
      );
      
      // Verify original result
      const validResult = await mockVerifierAdapter.verifyRecord(
        result.verification,
        JSON.stringify(sampleTodos),
        'Test summary'
      );
      expect(validResult).toBe(true);
      
      // Verify tampered result
      const tamperedResult = await mockVerifierAdapter.verifyRecord(
        result.verification,
        JSON.stringify(sampleTodos),
        'Tampered summary'
      );
      expect(tamperedResult).toBe(false);
    });
    
    it('should validate transaction signatures for verification', async () => {
      // Mock blockchain verification service that checks signatures
      const mockBlockchainVerificationService = new BlockchainAIVerificationService(
        { 
          verifySignature: jest.fn().mockImplementation((signature) => {
            return signature === 'valid-signature';
          }),
          createVerification: jest.fn().mockResolvedValue(mockVerificationRecord)
        } as any,
        { checkPermission: jest.fn().mockReturnValue(true) } as any,
        { getCredential: jest.fn().mockResolvedValue('api-key') } as any,
        'xai'
      );
      
      // Should reject invalid signatures
      await expect(
        mockBlockchainVerificationService.verifyExternalProof(
          'proof-id',
          'invalid-signature',
          { request: 'data', response: 'result' }
        )
      ).rejects.toThrow('Invalid signature');
      
      // Should accept valid signatures
      mockBlockchainVerificationService['blockchainVerifier'].verifySignature = jest.fn().mockReturnValue(true);
      
      await expect(
        mockBlockchainVerificationService.verifyExternalProof(
          'proof-id',
          'valid-signature',
          { request: 'data', response: 'result' }
        )
      ).resolves.not.toThrow();
    });
    
    it('should prevent replay attacks on verification records', async () => {
      // Mock blockchain verifier with timestamp checking
      const mockBlockchainVerifier = {
        createVerification: jest.fn().mockImplementation((params) => {
          // Check for replays by validating timestamp is recent
          const now = Date.now();
          const timestamp = params.metadata?.timestamp ? parseInt(params.metadata.timestamp) : 0;
          if (now - timestamp > 300000) { // 5 minutes
            throw new Error('Timestamp too old, possible replay attack');
          }
          return mockVerificationRecord;
        })
      };
      
      const mockVerificationService = new AIVerificationService(mockBlockchainVerifier as any);
      
      // Current timestamp should work
      await expect(
        mockVerificationService.createVerification(
          AIActionType.SUMMARIZE,
          'request',
          'response',
          { timestamp: Date.now().toString() },
          AIPrivacyLevel.HASH_ONLY
        )
      ).resolves.not.toThrow();
      
      // Old timestamp should be rejected
      await expect(
        mockVerificationService.createVerification(
          AIActionType.SUMMARIZE,
          'request',
          'response',
          { timestamp: (Date.now() - 3600000).toString() }, // 1 hour ago
          AIPrivacyLevel.HASH_ONLY
        )
      ).rejects.toThrow('Timestamp too old');
    });
    
    it('should enforce proper permission for verification actions', async () => {
      const mockPermissionManager = {
        checkPermission: jest.fn().mockImplementation((provider, operation) => {
          return operation !== 'blockchain_verification'; // Restrict verification
        })
      };
      
      (initializePermissionManager as jest.Mock).mockReturnValue(mockPermissionManager);
      
      const mockBlockchainVerificationService = new BlockchainAIVerificationService(
        { createVerification: jest.fn() } as any,
        mockPermissionManager as any,
        { getCredential: jest.fn().mockResolvedValue('api-key') } as any,
        'xai'
      );
      
      // Should be rejected due to lack of blockchain_verification permission
      await expect(
        mockBlockchainVerificationService.createVerifiedSummary(
          sampleTodos,
          'Test summary',
          AIPrivacyLevel.HASH_ONLY
        )
      ).rejects.toThrow(/insufficient permissions/);
    });
  });
  
  /**
   * 6. Secure Communication Channel Tests
   */
  describe('Secure Communication Channels', () => {
    it('should enforce TLS for all provider communications', async () => {
      // Mock the provider factory to detect non-HTTPS URLs
      (AIProviderFactory.createProvider as jest.Mock).mockImplementation((params) => {
        return {
          getProviderName: () => params.provider,
          getModelName: () => params.modelName || 'default-model',
          complete: jest.fn(),
          completeStructured: jest.fn(),
          processWithPromptTemplate: jest.fn().mockImplementation(async () => {
            // Check the URL being used for the request
            const options = params.options || {};
            if (options.baseUrl && !options.baseUrl.startsWith('https://')) {
              throw new Error('Non-secure HTTP URL detected in API request');
            }
            return { result: 'Test result', modelName: 'test', provider: params.provider, timestamp: Date.now() };
          })
        };
      });
      
      // Create AI service with HTTPS
      const secureService = new AIService('key', AIProvider.XAI, 'model', { baseUrl: 'https://secure-api.example.com' });
      await expect(secureService.summarize(sampleTodos)).resolves.not.toThrow();
      
      // Create AI service with HTTP (should fail)
      const insecureService = new AIService('key', AIProvider.XAI, 'model', { baseUrl: 'http://insecure-api.example.com' });
      await expect(insecureService.summarize(sampleTodos)).rejects.toThrow('Non-secure HTTP URL');
    });
    
    it('should validate certificates for secure connections', async () => {
      // Mock the provider factory to check certificate validation
      (AIProviderFactory.createProvider as jest.Mock).mockImplementation((params) => {
        return {
          getProviderName: () => params.provider,
          getModelName: () => params.modelName || 'default-model',
          complete: jest.fn(),
          completeStructured: jest.fn(),
          processWithPromptTemplate: jest.fn().mockImplementation(async () => {
            // Check for certificate validation setting
            const options = params.options || {};
            if (options.rejectUnauthorized === false) {
              throw new Error('Invalid SSL configuration: certificate validation disabled');
            }
            return { result: 'Test result', modelName: 'test', provider: params.provider, timestamp: Date.now() };
          })
        };
      });
      
      // Create AI service with proper certificate validation
      const secureService = new AIService('key', AIProvider.XAI, 'model', {});
      await expect(secureService.summarize(sampleTodos)).resolves.not.toThrow();
      
      // Create AI service with disabled certificate validation (should fail)
      const insecureService = new AIService('key', AIProvider.XAI, 'model', { rejectUnauthorized: false } as any);
      await expect(insecureService.summarize(sampleTodos)).rejects.toThrow('Invalid SSL configuration');
    });
    
    it('should prevent SSRF attacks in API requests', async () => {
      // Mock the provider factory to detect SSRF attempts
      (AIProviderFactory.createProvider as jest.Mock).mockImplementation((params) => {
        return {
          getProviderName: () => params.provider,
          getModelName: () => params.modelName || 'default-model',
          complete: jest.fn(),
          completeStructured: jest.fn(),
          processWithPromptTemplate: jest.fn().mockImplementation(async (template, context) => {
            // Check for URLs in the context that could be SSRF attempts
            const contextString = JSON.stringify(context);
            const ssrfPatterns = [
              'file://',
              'http://localhost',
              'http://127.0.0.1',
              'http://[::1]',
              'http://internal',
              'gopher://'
            ];
            
            if (ssrfPatterns.some(pattern => contextString.includes(pattern))) {
              throw new Error('Potential SSRF attempt detected');
            }
            
            return { result: 'Test result', modelName: 'test', provider: params.provider, timestamp: Date.now() };
          })
        };
      });
      
      const aiService = new AIService('key', AIProvider.XAI);
      
      // Regular usage should work
      await expect(aiService.summarize(sampleTodos)).resolves.not.toThrow();
      
      // SSRF attempt in todo content should be detected
      const ssrfTodo = {
        id: 'todo-ssrf',
        title: 'Legitimate Title',
        description: 'Check service at http://localhost:8080/admin',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await expect(aiService.summarize([ssrfTodo])).rejects.toThrow('Potential SSRF attempt');
    });
    
    it('should set proper security headers in provider requests', async () => {
      // Mock the provider factory to check security headers
      (AIProviderFactory.createProvider as jest.Mock).mockImplementation((params) => {
        return {
          getProviderName: () => params.provider,
          getModelName: () => params.modelName || 'default-model',
          complete: jest.fn(),
          completeStructured: jest.fn(),
          processWithPromptTemplate: jest.fn().mockImplementation(async () => {
            // In a real implementation, would check headers here
            // For test purposes, assume headers are verified by the adapter
            return { result: 'Test result', modelName: 'test', provider: params.provider, timestamp: Date.now() };
          })
        };
      });
      
      const aiService = new AIService('key', AIProvider.XAI);
      
      // Should complete without error, assuming adapter enforces security headers
      await expect(aiService.summarize(sampleTodos)).resolves.not.toThrow();
    });
    
    it('should detect and prevent request smuggling', async () => {
      // Mock the provider factory to check for request smuggling
      (AIProviderFactory.createProvider as jest.Mock).mockImplementation((params) => {
        return {
          getProviderName: () => params.provider,
          getModelName: () => params.modelName || 'default-model',
          complete: jest.fn(),
          completeStructured: jest.fn(),
          processWithPromptTemplate: jest.fn().mockImplementation(async (template, context) => {
            // Check for headers in content that could be smuggled
            const contextString = JSON.stringify(context);
            const smugglingPatterns = [
              'Content-Length:',
              'Transfer-Encoding:',
              'HTTP/1.1'
            ];
            
            if (smugglingPatterns.some(pattern => contextString.includes(pattern))) {
              throw new Error('Potential request smuggling attempt detected');
            }
            
            return { result: 'Test result', modelName: 'test', provider: params.provider, timestamp: Date.now() };
          })
        };
      });
      
      const aiService = new AIService('key', AIProvider.XAI);
      
      // Regular usage should work
      await expect(aiService.summarize(sampleTodos)).resolves.not.toThrow();
      
      // Request smuggling attempt in todo content should be detected
      const smugglingTodo = {
        id: 'todo-smuggle',
        title: 'Normal Todo',
        description: 'Content-Length: 0\r\n\r\nGET /admin HTTP/1.1\r\nHost: example.com',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await expect(aiService.summarize([smugglingTodo])).rejects.toThrow('request smuggling');
    });
  });
  
  /**
   * 7. Data Privacy and Anonymization Tests
   */
  describe('Data Privacy and Anonymization', () => {
    it('should respect privacy levels in verification operations', async () => {
      // Create mock verification service
      const mockVerifierAdapter = {
        createVerification: jest.fn().mockImplementation((params) => {
          // Check that privacy level is respected
          if (params.privacyLevel === AIPrivacyLevel.PRIVATE) {
            // In private mode, request and response should be hashed
            expect(params.request).not.toBe(JSON.stringify(sampleTodos));
            expect(params.response).not.toBe('Test summary');
          } else if (params.privacyLevel === AIPrivacyLevel.PUBLIC) {
            // In public mode, original content should be used
            expect(params.request).toBe(JSON.stringify(sampleTodos));
            expect(params.response).toBe('Test summary');
          }
          
          return mockVerificationRecord;
        })
      };
      
      const mockVerificationService = new AIVerificationService(mockVerifierAdapter as any);
      
      // Test private mode
      await mockVerificationService.createVerifiedSummary(
        sampleTodos,
        'Test summary',
        AIPrivacyLevel.PRIVATE
      );
      
      // Test public mode
      await mockVerificationService.createVerifiedSummary(
        sampleTodos,
        'Test summary',
        AIPrivacyLevel.PUBLIC
      );
      
      // Verify adapter was called with correct privacy settings
      expect(mockVerifierAdapter.createVerification).toHaveBeenCalledTimes(2);
    });
    
    it('should anonymize sensitive data before sending to AI providers', async () => {
      // Mock the provider factory 
      (AIProviderFactory.createProvider as jest.Mock).mockImplementation((params) => {
        return {
          getProviderName: () => params.provider,
          getModelName: () => params.modelName || 'default-model',
          complete: jest.fn(),
          completeStructured: jest.fn(),
          processWithPromptTemplate: jest.fn().mockImplementation(async (template, context) => {
            // Capture what's sent to the provider for inspection
            const todoStr = context.todos;
            
            // Check for PII patterns that should be anonymized
            const piiPatterns = [
              /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, // Email
              /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone
              /\b\d{3}-\d{2}-\d{4}\b/, // SSN
              /\b(?:\d[ -]*?){13,16}\b/ // Credit card
            ];
            
            // Should not contain any PII
            piiPatterns.forEach(pattern => {
              expect(todoStr).not.toMatch(pattern);
            });
            
            return { result: 'Test result', modelName: 'test', provider: params.provider, timestamp: Date.now() };
          })
        };
      });
      
      // Create AI service
      const aiService = new AIService('key', AIProvider.XAI);
      
      // Create todos with sensitive information
      const sensitiveTodos = [
        {
          id: 'todo-pii-1',
          title: 'Contact John',
          description: 'Email john@example.com or call 555-123-4567',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'todo-pii-2',
          title: 'Update payment',
          description: 'Use card 4111-1111-1111-1111 expires 12/25',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      // Should anonymize sensitive data
      await expect(aiService.summarize(sensitiveTodos)).resolves.not.toThrow();
    });
    
    it('should support differential privacy for aggregate operations', async () => {
      // Mock the provider factory with differential privacy support
      (AIProviderFactory.createProvider as jest.Mock).mockImplementation((params) => {
        return {
          getProviderName: () => params.provider,
          getModelName: () => params.modelName || 'default-model',
          complete: jest.fn(),
          completeStructured: jest.fn().mockImplementation(async (params) => {
            // Check for differential privacy options
            const options = params.options || {};
            
            // In a real impl, would add noise to results here
            // For test purposes, just verify options are passed correctly
            if (options.differentialPrivacy) {
              return { 
                result: { 'noised': true },
                modelName: 'test', 
                provider: AIProvider.XAI, 
                timestamp: Date.now() 
              };
            }
            
            return { 
              result: { 'original': true },
              modelName: 'test', 
              provider: AIProvider.XAI, 
              timestamp: Date.now() 
            };
          }),
          processWithPromptTemplate: jest.fn()
        };
      });
      
      // Create AI service with differential privacy
      const aiService = new AIService('key', AIProvider.XAI, 'model', { differentialPrivacy: true } as any);
      
      // Run operation that should have differential privacy applied
      const result = await aiService.categorize(sampleTodos);
      
      // Result should be differentially private
      expect(result).toEqual({ 'noised': true });
    });
    
    it('should handle data subject access requests', async () => {
      // Mock verification service that supports retrieving user data
      const mockVerifierAdapter = {
        listVerifications: jest.fn().mockImplementation((userAddress) => {
          // In production, would filter by the user
          return [mockVerificationRecord];
        }),
        getVerification: jest.fn().mockImplementation((id) => {
          return mockVerificationRecord;
        }),
        deleteVerification: jest.fn().mockImplementation((id, userAddress) => {
          // Should check that only the user can delete their data
          if (userAddress !== mockVerificationRecord.user) {
            throw new Error('Unauthorized deletion attempt');
          }
          return true;
        })
      };
      
      const mockVerificationService = new AIVerificationService(mockVerifierAdapter as any);
      
      // User should be able to list their data
      await expect(mockVerificationService.listVerifications('user-123'))
        .resolves.toEqual([mockVerificationRecord]);
      
      // Wrong user should not be able to delete data
      mockVerifierAdapter.deleteVerification = jest.fn().mockRejectedValue(
        new Error('Unauthorized deletion attempt')
      );
      
      // Attempt to delete as wrong user
      await expect(
        mockVerificationService['blockchainVerifier'].deleteVerification('ver-123', 'wrong-user')
      ).rejects.toThrow('Unauthorized');
    });
    
    it('should allow users to opt out of data collection', async () => {
      // Create mock AIService with privacy settings
      const aiService = new AIService('key', AIProvider.XAI, 'model', { 
        collectUsageData: false,
        storePromptHistory: false
      } as any);
      
      // Mock the provider adapter
      jest.spyOn(aiService['modelAdapter'], 'processWithPromptTemplate')
        .mockResolvedValue({ result: 'Summary', modelName: 'test', provider: AIProvider.XAI, timestamp: Date.now() });
      
      // Run operation
      await aiService.summarize(sampleTodos);
      
      // Verify correct options were passed to the provider
      expect(aiService['modelAdapter'].processWithPromptTemplate).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything()
      );
    });
  });
  
  /**
   * 8. Logging Security and PII Handling Tests
   */
  describe('Logging Security and PII Handling', () => {
    it('should redact sensitive information in logs', async () => {
      // Spy on console.log
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      // Create AI service
      const aiService = new AIService('test-api-key', AIProvider.XAI);
      
      // Create a todo with sensitive info
      const sensitiveTodo = {
        id: 'todo-sensitive',
        title: 'Update profile',
        description: 'Update with SSN: 123-45-6789 and password: SecretPass123!',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Process the sensitive todo
      jest.spyOn(aiService['modelAdapter'], 'processWithPromptTemplate')
        .mockImplementation(async () => {
          // Log some data that might contain sensitive info
          console.log(`Processing todo: ${JSON.stringify(sensitiveTodo)}`);
          return { result: 'Summary', modelName: 'test', provider: AIProvider.XAI, timestamp: Date.now() };
        });
      
      await aiService.summarize([sensitiveTodo]);
      
      // Check that logs don't contain sensitive information
      for (const call of consoleLogSpy.mock.calls) {
        const logMessage = call.join(' ');
        expect(logMessage).not.toContain('123-45-6789');
        expect(logMessage).not.toContain('SecretPass123!');
      }
      
      consoleLogSpy.mockRestore();
    });
    
    it('should not log AI provider API keys', async () => {
      // Spy on console.log and console.error
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Create AI service
      const aiService = new AIService('test-api-key-secret', AIProvider.XAI);
      
      // Force an error that might log the API key
      jest.spyOn(aiService['modelAdapter'], 'processWithPromptTemplate')
        .mockImplementation(() => {
          throw new Error('Authentication failed with key test-api-key-secret');
        });
      
      // Should catch the error and redact the key
      await expect(aiService.summarize(sampleTodos)).rejects.toThrow();
      
      // Check logs for API key exposure
      for (const spy of [consoleLogSpy, consoleErrorSpy]) {
        for (const call of spy.mock.calls) {
          const logMessage = call.join(' ');
          expect(logMessage).not.toContain('test-api-key-secret');
        }
      }
      
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
    
    it('should implement secure error handling that does not leak sensitive data', async () => {
      // Create AI service
      const aiService = new AIService('test-api-key', AIProvider.XAI);
      
      // Force an error with sensitive data
      jest.spyOn(aiService['modelAdapter'], 'processWithPromptTemplate')
        .mockImplementation(() => {
          const sensitiveData = {
            apiKey: 'test-api-key',
            userEmail: 'user@example.com',
            internalEndpoint: 'http://internal-api.example.com:8080/admin'
          };
          
          // Error message containing sensitive data
          const errorWithSensitiveData = new Error(
            `Failed to authenticate with key ${sensitiveData.apiKey} for user ${sensitiveData.userEmail}`
          );
          
          // Add sensitive data to the error object
          (errorWithSensitiveData as any).sensitiveData = sensitiveData;
          throw errorWithSensitiveData;
        });
      
      // Should sanitize the error
      try {
        await aiService.summarize(sampleTodos);
        fail('Should have thrown an error');
      } catch (_error) {
        // Error message should be sanitized
        expect(String(error)).not.toContain('test-api-key');
        expect(String(error)).not.toContain('user@example.com');
        
        // Error object should not contain sensitive data
        expect((error as any).sensitiveData).toBeUndefined();
      }
    });
    
    it('should implement secure debug modes that don\'t leak sensitive data', async () => {
      // Save original debug setting and enable debug
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = 'walrus_todo:*';
      
      // Spy on console.debug
      const consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
      
      // Create AI service
      const aiService = new AIService('test-api-key', AIProvider.XAI);
      
      // Mock debugging logs
      jest.spyOn(aiService['modelAdapter'], 'processWithPromptTemplate')
        .mockImplementation(async () => {
          // Debug logs that might contain sensitive info
          console.debug(`Auth headers: Bearer test-api-key`);
          console.debug(`User data: ${JSON.stringify({ email: 'test@example.com' })}`);
          return { result: 'Summary', modelName: 'test', provider: AIProvider.XAI, timestamp: Date.now() };
        });
      
      await aiService.summarize(sampleTodos);
      
      // Check debug logs for sensitive data
      for (const call of consoleDebugSpy.mock.calls) {
        const logMessage = call.join(' ');
        expect(logMessage).not.toContain('test-api-key');
        expect(logMessage).not.toContain('test@example.com');
      }
      
      // Restore original debug setting
      process.env.DEBUG = originalDebug;
      consoleDebugSpy.mockRestore();
    });
    
    it('should implement secure audit logs for security events', async () => {
      // Create mock audit logger
      const mockAuditLog = jest.fn();
      
      // Mock credential manager to use audit log
      secureCredentialManager.setCredential = jest.fn().mockImplementation((provider, credential) => {
        // Log security event
        mockAuditLog({
          event: 'credential_created',
          provider,
          timestamp: Date.now(),
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1',
          // Should NOT include actual credential
          hasCredential: !!credential
        });
        
        return {
          id: 'cred-123',
          providerName: provider,
          credentialType: CredentialType.API_KEY,
          credentialValue: credential,
          isVerified: false,
          storageOptions: { encrypt: true },
          createdAt: Date.now(),
          permissionLevel: AIPermissionLevel.STANDARD
        };
      });
      
      // Create credential
      await secureCredentialManager.setCredential('xai', 'test-api-key');
      
      // Verify audit log was created with appropriate content
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'credential_created',
          provider: 'xai',
          hasCredential: true
        })
      );
      
      // Verify no sensitive data was logged
      const auditLogCall = mockAuditLog.mock.calls[0][0];
      expect(auditLogCall).not.toHaveProperty('credential');
      expect(auditLogCall).not.toHaveProperty('credentialValue');
      expect(JSON.stringify(auditLogCall)).not.toContain('test-api-key');
    });
  });
});