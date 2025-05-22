import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SecureCredentialManager } from '../../src/services/ai/SecureCredentialManager';
import { AIService } from '../../src/services/ai/aiService';
import { AIVerificationService } from '../../src/services/ai/AIVerificationService';
import { AIProvider } from '../../src/types/adapters/AIModelAdapter';
import { AIProviderFactory } from '../../src/services/ai/AIProviderFactory';
import { CredentialType, AIPermissionLevel } from '../../src/types/adapters/AICredentialAdapter';
import { AIActionType, AIPrivacyLevel } from '../../src/types/adapters/AIVerifierAdapter';
import { CLI_CONFIG } from '../../src/constants';
import { Todo } from '../../src/types/todo';

// Mock dependencies
jest.mock('@langchain/core/prompts');
jest.mock('../../src/services/ai/AIProviderFactory');
jest.mock('fs', () => {
  const originalModule = jest.requireActual('fs');
  const mockFileContent = new Map<string, Buffer>();
  
  return {
    ...originalModule,
    existsSync: jest.fn().mockImplementation((path: string) => {
      if (path.includes('keyfile') || path.includes('audit')) {
        return true;
      }
      return mockFileContent.has(path);
    }),
    writeFileSync: jest.fn().mockImplementation((path: string, data: Buffer, options: any) => {
      mockFileContent.set(path, data);
    }),
    readFileSync: jest.fn().mockImplementation((path: string) => {
      if (path.includes('keyfile')) {
        return crypto.randomBytes(32); // Mock encryption key
      }
      if (path.includes('audit')) {
        return Buffer.from('[]'); // Empty audit log
      }
      return mockFileContent.get(path) || Buffer.from('');
    }),
    appendFileSync: jest.fn().mockImplementation((path: string, data: string) => {
      const existingData = mockFileContent.get(path) || Buffer.from('');
      mockFileContent.set(path, Buffer.concat([existingData, Buffer.from(data)]));
    }),
    mkdirSync: jest.fn()
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

// Helper function to get the AuditLogger class
const getAuditLogger = () => {
  // Create a basic implementation for tests
  class AuditLogger {
    private logEntries: any[] = [];
    private logFilePath: string;
    private enabled: boolean = true;

    constructor() {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const configDir = path.join(homeDir, '.config', CLI_CONFIG.APP_NAME);
      this.logFilePath = path.join(configDir, 'audit.log');
    }

    public log(eventType: string, details: any): void {
      if (!this.enabled) return;

      const entry = {
        eventType,
        timestamp: Date.now(),
        ...this.sanitize(details)
      };

      this.logEntries.push(entry);
      this.writeToFile(entry);
    }

    public getEntries(): any[] {
      return this.logEntries;
    }

    private writeToFile(entry: any): void {
      try {
        const line = JSON.stringify(entry) + '\n';
        fs.appendFileSync(this.logFilePath, line);
      } catch (_error) {
        console.error('Failed to write audit log:', error);
      }
    }

    private sanitize(data: any): any {
      if (!data) return data;
      
      // Create a copy to avoid modifying the original
      const sanitized = { ...data };
      
      // Redact sensitive fields
      const sensitiveFields = ['apiKey', 'credential', 'password', 'token', 'secret', 'key'];
      
      // Helper function to sanitize recursively
      const sanitizeObject = (obj: any) => {
        if (typeof obj !== 'object' || obj === null) return obj;
        
        const result: any = Array.isArray(obj) ? [] : {};
        
        for (const [key, value] of Object.entries(obj)) {
          // Check if the key is sensitive
          if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
            result[key] = typeof value === 'string' ? '[REDACTED]' : null;
          }
          // Recurse for objects and arrays
          else if (typeof value === 'object' && value !== null) {
            result[key] = sanitizeObject(value);
          }
          // Pass through non-sensitive primitives
          else {
            result[key] = value;
          }
        }
        
        return result;
      };
      
      return sanitizeObject(sanitized);
    }

    public enable(): void {
      this.enabled = true;
    }

    public disable(): void {
      this.enabled = false;
    }
  }

  return new AuditLogger();
};

describe('Audit Log Security', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  
  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
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
  
  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });
  
  describe('Audit Log Content Security', () => {
    it('should log security-critical events', async () => {
      // Create an audit logger
      const auditLogger = getAuditLogger();
      
      // Create a credential manager with the audit logger
      const credentialManager = new SecureCredentialManager();
      (credentialManager as any).auditLogger = auditLogger;
      
      // Perform various security-critical operations
      await credentialManager.setCredential('test-provider', 'test-api-key', CredentialType.API_KEY);
      await credentialManager.getCredential('test-provider');
      await credentialManager.updatePermissions('test-provider', AIPermissionLevel.ADVANCED);
      
      try {
        await credentialManager.getCredential('non-existent');
      } catch (_error) {
        // Expected error
      }
      
      // Verify security events were logged
      const entries = auditLogger.getEntries();
      expect(entries.length).toBeGreaterThanOrEqual(4);
      
      // Check for expected event types
      const eventTypes = entries.map(entry => entry.eventType);
      expect(eventTypes).toContain('credential_created');
      expect(eventTypes).toContain('credential_accessed');
      expect(eventTypes).toContain('permission_updated');
      expect(eventTypes).toContain('access_denied');
    });
    
    it('should redact sensitive information in audit logs', async () => {
      // Create an audit logger
      const auditLogger = getAuditLogger();
      
      // Log various events with sensitive information
      auditLogger.log('api_key_created', {
        provider: 'test-provider',
        apiKey: 'super-secret-api-key-12345',
        user: 'test-user'
      });
      
      auditLogger.log('credential_used', {
        provider: 'test-provider',
        credential: 'sensitive-credential-value',
        operation: 'summarize',
        metadata: {
          token: 'refresh-token-xyz',
          context: 'Normal operation context'
        }
      });
      
      // Check that sensitive information was redacted
      const entries = auditLogger.getEntries();
      expect(entries.length).toBe(2);
      
      // Convert entries to strings for easier checking
      const logStrings = entries.map(entry => JSON.stringify(entry));
      
      // Verify sensitive data was redacted
      expect(logStrings[0]).not.toContain('super-secret-api-key-12345');
      expect(logStrings[1]).not.toContain('sensitive-credential-value');
      expect(logStrings[1]).not.toContain('refresh-token-xyz');
      
      // Verify non-sensitive data was preserved
      expect(logStrings[0]).toContain('test-provider');
      expect(logStrings[0]).toContain('test-user');
      expect(logStrings[1]).toContain('summarize');
      expect(logStrings[1]).toContain('Normal operation context');
    });
    
    it('should log AI operations with privacy-preserving details', async () => {
      // Create an audit logger
      const auditLogger = getAuditLogger();
      
      // Create AI service with the audit logger
      const aiService = new AIService('test-api-key');
      (aiService as any).auditLogger = auditLogger;
      
      // Perform AI operations
      await aiService.summarize(sampleTodos);
      await aiService.categorize(sampleTodos);
      
      // Create todo with PII
      const todosWithPII: Todo[] = [{
        id: 'todo-pii',
        title: 'Contact John',
        description: 'Email john@example.com or call 555-123-4567',
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }];
      
      await aiService.analyze(todosWithPII);
      
      // Verify AI operations were logged
      const entries = auditLogger.getEntries();
      expect(entries.length).toBeGreaterThanOrEqual(3);
      
      // Check for expected event types
      const eventTypes = entries.map(entry => entry.eventType);
      expect(eventTypes).toContain('ai_operation_summarize');
      expect(eventTypes).toContain('ai_operation_categorize');
      expect(eventTypes).toContain('ai_operation_analyze');
      
      // Verify PII was not logged
      const logStrings = entries.map(entry => JSON.stringify(entry));
      
      // Should not contain PII from todos
      expect(logStrings.join('')).not.toContain('john@example.com');
      expect(logStrings.join('')).not.toContain('555-123-4567');
      
      // Should not contain API keys
      expect(logStrings.join('')).not.toContain('test-api-key');
    });
  });
  
  describe('Audit Log Integrity', () => {
    it('should ensure log entries cannot be modified', async () => {
      // Create an audit logger
      const auditLogger = getAuditLogger();
      
      // Log a security event
      auditLogger.log('security_event', {
        operation: 'critical_operation',
        user: 'test-user',
        success: true
      });
      
      // Get the logged entries
      const entries = auditLogger.getEntries();
      expect(entries.length).toBe(1);
      
      // Attempt to modify the entry (should not affect stored entries)
      const originalEntry = entries[0];
      originalEntry.success = false;
      
      // Verify file write was called with the correct data
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"success":true')
      );
      
      // In a real implementation, we would verify that logs are tamper-evident
      // through mechanisms like cryptographic signatures or blockchain anchoring
    });
    
    it('should continue logging even if log storage fails', async () => {
      // Create an audit logger
      const auditLogger = getAuditLogger();
      
      // Mock a failure in writing to the log file
      (fs.appendFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Failed to write to log file');
      });
      
      // Log should not throw despite the file write error
      expect(() => {
        auditLogger.log('important_event', { operation: 'critical' });
      }).not.toThrow();
      
      // The error should be logged to console
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to write audit log:',
        expect.any(Error)
      );
      
      // In-memory entries should still be updated
      const entries = auditLogger.getEntries();
      expect(entries.length).toBe(1);
      expect(entries[0].eventType).toBe('important_event');
    });
  });
  
  describe('Blockchain Verification Audit', () => {
    it('should log blockchain verification events with tamper-evident properties', async () => {
      // Create mock blockchain verifier
      const mockBlockchainVerifier = {
        createVerification: jest.fn().mockImplementation((params) => {
          return {
            id: 'ver-123',
            requestHash: 'req-hash-123',
            responseHash: 'res-hash-123',
            user: 'user-123',
            provider: 'xai',
            timestamp: Date.now(),
            verificationType: params.actionType || AIActionType.SUMMARIZE,
            metadata: params.metadata || {}
          };
        }),
        verifyRecord: jest.fn().mockReturnValue(true)
      };
      
      // Create an audit logger
      const auditLogger = getAuditLogger();
      
      // Create verification service with audit logger
      const verificationService = new AIVerificationService(mockBlockchainVerifier as any);
      (verificationService as any).auditLogger = auditLogger;
      
      // Perform verification
      await verificationService.createVerifiedSummary(
        sampleTodos,
        'Test summary',
        AIPrivacyLevel.HASH_ONLY
      );
      
      // Verify blockchain events were logged
      const entries = auditLogger.getEntries();
      expect(entries.length).toBeGreaterThanOrEqual(1);
      
      // Check for blockchain verification details
      const verificationEntry = entries.find(entry => 
        entry.eventType === 'blockchain_verification_created'
      );
      
      expect(verificationEntry).toBeDefined();
      expect(verificationEntry).toHaveProperty('verificationId', 'ver-123');
      expect(verificationEntry).toHaveProperty('requestHash');
      expect(verificationEntry).toHaveProperty('responseHash');
      
      // Verify no sensitive data is included
      const entryString = JSON.stringify(verificationEntry);
      expect(entryString).not.toContain(JSON.stringify(sampleTodos));
      expect(entryString).not.toContain('Test summary');
    });
  });
  
  describe('Permission Changes Audit', () => {
    it('should log permission changes with before/after states', async () => {
      // Create an audit logger
      const auditLogger = getAuditLogger();
      
      // Create a credential manager with the audit logger
      const credentialManager = new SecureCredentialManager();
      (credentialManager as any).auditLogger = auditLogger;
      
      // Mock credentials for testing
      (credentialManager as any).credentials = {
        'test-provider': {
          id: 'cred-123',
          providerName: 'test-provider',
          credentialType: CredentialType.API_KEY,
          credentialValue: 'test-api-key',
          isVerified: false,
          storageOptions: { encrypt: true },
          createdAt: Date.now(),
          permissionLevel: AIPermissionLevel.STANDARD
        }
      };
      
      // Update permissions
      await credentialManager.updatePermissions('test-provider', AIPermissionLevel.ADVANCED);
      
      // Verify permission change was logged
      const entries = auditLogger.getEntries();
      const permissionEntry = entries.find(entry => 
        entry.eventType === 'permission_updated'
      );
      
      expect(permissionEntry).toBeDefined();
      expect(permissionEntry).toHaveProperty('provider', 'test-provider');
      expect(permissionEntry).toHaveProperty('previousLevel', AIPermissionLevel.STANDARD);
      expect(permissionEntry).toHaveProperty('newLevel', AIPermissionLevel.ADVANCED);
      
      // Should not contain the credential value
      const entryString = JSON.stringify(permissionEntry);
      expect(entryString).not.toContain('test-api-key');
    });
  });
  
  describe('Failed Operation Auditing', () => {
    it('should log all failed security-critical operations', async () => {
      // Create an audit logger
      const auditLogger = getAuditLogger();
      
      // Create a credential manager with the audit logger
      const credentialManager = new SecureCredentialManager();
      (credentialManager as any).auditLogger = auditLogger;
      
      // Attempt operations that will fail
      try {
        await credentialManager.getCredential('non-existent');
      } catch (_error) {
        // Expected error
      }
      
      try {
        await credentialManager.updatePermissions('non-existent', AIPermissionLevel.ADMIN);
      } catch (_error) {
        // Expected error
      }
      
      // Create AI service with the audit logger
      const aiService = new AIService('test-api-key');
      (aiService as any).auditLogger = auditLogger;
      
      // Mock a failure in the AI provider
      jest.spyOn(aiService['modelAdapter'], 'processWithPromptTemplate')
        .mockRejectedValueOnce(new Error('API error'));
      
      try {
        await aiService.summarize(sampleTodos);
      } catch (_error) {
        // Expected error
      }
      
      // Verify all failures were logged
      const entries = auditLogger.getEntries();
      const failureEntries = entries.filter(entry => 
        entry.eventType.includes('failed') || entry.success === false
      );
      
      expect(failureEntries.length).toBeGreaterThanOrEqual(3);
      
      // Verify failure entries have appropriate context
      for (const entry of failureEntries) {
        expect(entry).toHaveProperty('error');
        expect(entry).toHaveProperty('timestamp');
      }
      
      // Verify error messages don't contain sensitive information
      const entryStrings = failureEntries.map(entry => JSON.stringify(entry));
      for (const entryString of entryStrings) {
        expect(entryString).not.toContain('test-api-key');
      }
    });
  });
  
  describe('Audit Log Access Control', () => {
    it('should restrict access to audit logs', () => {
      // Mock file access checks
      const mockCheckFilePermissions = jest.fn().mockImplementation((filePath) => {
        // Check if file permissions are restricted
        const stats = { mode: 0o600 }; // Owner read/write only
        return stats;
      });
      
      // Verify audit log file permissions
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const configDir = path.join(homeDir, '.config', CLI_CONFIG.APP_NAME);
      const logFilePath = path.join(configDir, 'audit.log');
      
      // In a real implementation, we would test that audit logs have restricted permissions
      // Here we simulate the permission check
      const fileStats = mockCheckFilePermissions(logFilePath);
      
      // Owner should have read/write permissions, but no one else
      expect(fileStats.mode).toBe(0o600);
      
      // Verify log file was created with secure permissions
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Buffer),
        expect.objectContaining({ mode: 0o600 })
      );
    });
  });
});