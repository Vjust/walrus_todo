import { jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { AuditLogger } from '../../apps/cli/src/services/ai/AuditLogger';
import { CLI_CONFIG } from '../../apps/cli/src/constants';

// Mock fs module
jest.mock('fs', () => {
  const originalModule = jest.requireActual('fs');
  const mockFileContent = new Map<string, string>();
  const mockFileStats = new Map<string, any>();

  return {
    ...originalModule,
    existsSync: jest.fn().mockImplementation((path: string) => {
      return mockFileContent.has(path);
    }),
    writeFileSync: jest
      .fn()
      .mockImplementation((path: string, data: string, _options: any) => {
        mockFileContent.set(path, data);
      }),
    appendFileSync: jest
      .fn()
      .mockImplementation((path: string, data: string, _options: any) => {
        const existingData = mockFileContent.get(path) || '';
        mockFileContent.set(path, existingData + data);
      }),
    readFileSync: jest
      .fn()
      .mockImplementation((path: string, _encoding: string) => {
        if (!mockFileContent.has(path)) {
          throw new Error(`File not found: ${path}`);
        }
        return mockFileContent.get(path);
      }),
    statSync: jest.fn().mockImplementation((path: string) => {
      if (mockFileStats.has(path)) {
        return mockFileStats.get(path);
      }
      return { size: 1000 }; // Default size
    }),
    renameSync: jest
      .fn()
      .mockImplementation((oldPath: string, newPath: string) => {
        if (mockFileContent.has(oldPath)) {
          mockFileContent.set(newPath, mockFileContent.get(oldPath) || '');
          mockFileContent.delete(oldPath);
        }
      }),
    mkdirSync: jest.fn(),
  };
});

describe('Audit Log Verification Tests', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock the file system
    (fs.existsSync as jest.Mock).mockReturnValue(false);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Log Entry Creation and Sanitization', () => {
    it('should create tamper-evident log entries with hash chaining', () => {
      // Create audit logger
      const auditLogger = new AuditLogger();

      // Log a series of events
      auditLogger.log('test_event', { action: 'test1', user: 'user1' });
      auditLogger.log('test_event', { action: 'test2', user: 'user2' });
      auditLogger.log('test_event', { action: 'test3', user: 'user3' });

      // Get all entries
      const entries = auditLogger.getEntries();

      // Should have all entries
      expect(entries.length).toBe(3);

      // Each entry should have a hash
      entries.forEach(entry => {
        expect(entry).toHaveProperty('hash');
        expect(entry.hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash is 64 hex chars
      });

      // Verify hash chaining
      for (let i = 1; i < entries.length; i++) {
        const prevEntry = { ...entries[i - 1] };
        delete prevEntry.hash;

        const currentEntry = { ...entries[i] };
        delete currentEntry.hash;

        // Calculate expected hash
        const prevHash = entries[i - 1].hash;
        const entryString = JSON.stringify(currentEntry);
        const expectedHash = crypto
          .createHash('sha256')
          .update(`${prevHash}:${entryString}`)
          .digest('hex');

        // Verify hash matches
        expect(entries[i].hash).toBe(expectedHash);
      }
    });

    it('should sanitize sensitive information in log entries', () => {
      // Create audit logger
      const auditLogger = new AuditLogger();

      // Log events with sensitive information
      auditLogger.log('credential_event', {
        action: 'credential_created',
        provider: 'test-provider',
        apiKey: 'super-secret-api-key-12345',
        user: 'test-user',
      });

      auditLogger.log('user_data_event', {
        action: 'user_updated',
        user: 'test-user',
        email: 'user@example.com',
        phone: '555-123-4567',
        ssn: '123-45-6789',
        creditCard: '4111-1111-1111-1111',
        normalData: 'This is normal data',
      });

      // Get all entries
      const entries = auditLogger.getEntries();

      // Convert entries to strings for easier checking
      const logStrings = entries.map(entry => JSON.stringify(entry));

      // API key should be redacted
      expect(logStrings[0]).not.toContain('super-secret-api-key-12345');
      expect(logStrings[0]).toContain('[REDACTED]');

      // PII should be redacted
      expect(logStrings[1]).not.toContain('user@example.com');
      expect(logStrings[1]).not.toContain('555-123-4567');
      expect(logStrings[1]).not.toContain('123-45-6789');
      expect(logStrings[1]).not.toContain('4111-1111-1111-1111');

      // Normal data should be preserved
      expect(logStrings[1]).toContain('This is normal data');
      expect(logStrings[1]).toContain('test-user');
    });

    it('should sanitize nested sensitive information', () => {
      // Create audit logger
      const auditLogger = new AuditLogger();

      // Log event with nested sensitive information
      auditLogger.log('nested_sensitive_event', {
        action: 'nested_test',
        user: 'test-user',
        data: {
          apiDetails: {
            key: 'sensitive-nested-key',
            endpoint: 'https://api.example.com',
          },
          userDetails: {
            contact: {
              email: 'user@example.com',
              phone: '555-123-4567',
            },
          },
        },
      });

      // Get entry
      const entry = auditLogger.getEntries()[0];
      const entryString = JSON.stringify(entry);

      // Sensitive nested fields should be redacted
      expect(entryString).not.toContain('sensitive-nested-key');
      expect(entryString).not.toContain('user@example.com');
      expect(entryString).not.toContain('555-123-4567');

      // Non-sensitive fields should be preserved
      expect(entryString).toContain('https://api.example.com');
      expect(entryString).toContain('test-user');
    });
  });

  describe('Log Integrity Verification', () => {
    it('should detect tampering with log file contents', () => {
      // Create a mocked log file with initial entries
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      // Setup configuration directory for audit logging
      const configDir = path.join(homeDir, '.config', CLI_CONFIG.APP_NAME);
      expect(configDir).toBeDefined(); // Validate config path exists
      // const _logFilePath = path.join(configDir, 'audit.log');

      // Generate some log entries with hash chaining
      let previousHash = '';
      const logEntries = [];

      for (let i = 0; i < 5; i++) {
        const entry = {
          eventType: 'test_event',
          timestamp: Date.now() + i * 1000,
          action: `action_${i}`,
          user: `user_${i}`,
        };

        const entryString = JSON.stringify(entry);
        const entryHash = crypto
          .createHash('sha256')
          .update(`${previousHash || 'initial'}:${entryString}`)
          .digest('hex');

        const entryWithHash = {
          ...entry,
          hash: entryHash,
        };

        logEntries.push(entryWithHash);
        previousHash = entryHash;
      }

      // Create the log file
      const logContent =
        logEntries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(logContent);

      // Create audit logger and verify intact log
      const auditLogger = new AuditLogger();
      expect(auditLogger.verifyLogIntegrity()).toBe(true);

      // Now tamper with a log entry
      logEntries[2].action = 'tampered_action';
      const tamperedLogContent =
        logEntries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
      (fs.readFileSync as jest.Mock).mockReturnValue(tamperedLogContent);

      // Create a new logger and verify tampered log
      const newAuditLogger = new AuditLogger();
      expect(newAuditLogger.verifyLogIntegrity()).toBe(false);
    });

    it('should handle log file rotation', () => {
      // Create audit logger
      const auditLogger = new AuditLogger();

      // Mock fs.statSync to return a large file size
      (fs.statSync as jest.Mock).mockReturnValue({ size: 20 * 1024 * 1024 }); // 20 MB
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Current log file path
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const configDir = path.join(homeDir, '.config', CLI_CONFIG.APP_NAME);
      const logFilePath = path.join(configDir, 'audit.log');

      // Create an initial log entry
      auditLogger.log('test_event', { action: 'test' });

      // Rotation should have been triggered
      expect(fs.renameSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        logFilePath,
        expect.stringContaining('"eventType":"log_rotation"'),
        expect.anything()
      );
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle errors gracefully when logging fails', () => {
      // Create audit logger
      const auditLogger = new AuditLogger();

      // Force fs.appendFileSync to throw an error
      (fs.appendFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Disk full');
      });

      // Log should not throw despite the error
      expect(() => {
        auditLogger.log('test_event', { action: 'test' });
      }).not.toThrow();

      // Error should be logged to console
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to write audit log:',
        expect.any(Error)
      );
    });

    it('should recover from corrupted log files', () => {
      // Create a corrupted log file
      const corruptedContent =
        '{"eventType":"valid_event","timestamp":123,"hash":"hash1"}\nINVALID JSON\n{"eventType":"another_event","timestamp":456,"hash":"hash3"}\n';

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(corruptedContent);

      // Create audit logger
      const auditLogger = new AuditLogger();

      // Log integrity check should fail due to corruption
      expect(auditLogger.verifyLogIntegrity()).toBe(false);

      // But we should still be able to log new events
      expect(() => {
        auditLogger.log('recovery_event', { action: 'recover' });
      }).not.toThrow();
    });
  });

  describe('Audit Log Security Controls', () => {
    it('should apply proper file permissions to log files', () => {
      // Create audit logger
      const auditLogger = new AuditLogger();

      // Log an event
      auditLogger.log('test_event', { action: 'test' });

      // Check appendFileSync was called with proper permissions
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ mode: 0o600 }) // Owner read/write only
      );
    });

    it('should support enabling and disabling logging', () => {
      // Create audit logger
      const auditLogger = new AuditLogger();

      // Initial log
      auditLogger.log('initial_event', { action: 'initial' });
      expect(fs.appendFileSync).toHaveBeenCalledTimes(1);

      // Disable logging
      auditLogger.setEnabled(false);

      // This log should be ignored
      auditLogger.log('ignored_event', { action: 'ignored' });
      expect(fs.appendFileSync).toHaveBeenCalledTimes(1); // Still 1

      // Re-enable logging
      auditLogger.setEnabled(true);

      // This log should be processed
      auditLogger.log('resumed_event', { action: 'resumed' });
      expect(fs.appendFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration with System Components', () => {
    it('should integrate with credential operations', () => {
      // Create audit logger
      const auditLogger = new AuditLogger();

      // Mock credential manager actions
      const mockCredentialManager = {
        setCredential: async (
          provider: string,
          credential: string,
          type: number
        ) => {
          // Log the credential creation
          auditLogger.log('credential_created', {
            provider,
            type,
            // Credential value should NOT be included here!
            success: true,
          });

          return { id: 'cred-123', providerName: provider };
        },

        getCredential: async (provider: string) => {
          // Log the credential access
          auditLogger.log('credential_accessed', {
            provider,
            timestamp: Date.now(),
            success: true,
          });

          return 'mock-credential';
        },

        removeCredential: async (provider: string) => {
          // Log the credential removal
          auditLogger.log('credential_removed', {
            provider,
            timestamp: Date.now(),
            success: true,
          });

          return true;
        },
      };

      // Use the credential manager with audit logging
      mockCredentialManager.setCredential('test-provider', 'secret-api-key', 1);
      mockCredentialManager.getCredential('test-provider');
      mockCredentialManager.removeCredential('test-provider');

      // Get all log entries
      const entries = auditLogger.getEntries();

      // Should have logged all three operations
      expect(entries.length).toBe(3);
      expect(entries[0].eventType).toBe('credential_created');
      expect(entries[1].eventType).toBe('credential_accessed');
      expect(entries[2].eventType).toBe('credential_removed');

      // No entry should contain the credential value
      entries.forEach(entry => {
        const entryStr = JSON.stringify(entry);
        expect(entryStr).not.toContain('secret-api-key');
      });
    });

    it('should record security-critical AI operations', () => {
      // Create audit logger
      const auditLogger = new AuditLogger();

      // Mock AI service operations
      const mockAIService = {
        summarize: async (todos: any[]) => {
          // Log the AI operation
          auditLogger.log('ai_operation', {
            operation: 'summarize',
            todoCount: todos.length,
            timestamp: Date.now(),
            provider: 'openai',
            model: 'gpt-4',
          });

          return 'Summary result';
        },

        analyze: async (todos: any[]) => {
          // Log the AI operation with PII (should be sanitized)
          auditLogger.log('ai_operation', {
            operation: 'analyze',
            todoCount: todos.length,
            timestamp: Date.now(),
            provider: 'openai',
            model: 'gpt-4',
            userEmail: 'user@example.com', // This should be sanitized
          });

          return 'Analysis result';
        },
      };

      // Use the AI service with audit logging
      mockAIService.summarize([{ id: 'todo-1' }, { id: 'todo-2' }]);
      mockAIService.analyze([
        { id: 'todo-3', description: 'Contains user@example.com' },
      ]);

      // Get all log entries
      const entries = auditLogger.getEntries();

      // Should have logged both operations
      expect(entries.length).toBe(2);
      expect(entries[0].operation).toBe('summarize');
      expect(entries[1].operation).toBe('analyze');

      // Email should be sanitized
      const analyzeEntryStr = JSON.stringify(entries[1]);
      expect(analyzeEntryStr).not.toContain('user@example.com');
      expect(analyzeEntryStr).toContain('[REDACTED PII]');
    });
  });
});
