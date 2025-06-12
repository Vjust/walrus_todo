const { jest } = require('@jest/globals');
import * as fs from 'fs';
import * as path from 'path';

/**
 * Mock implementation of AuditLogger for testing
 */
export interface MockAuditLogger {
  log: jest.MockedFunction<(eventType: string, details: unknown) => void>;
  getEntries: jest.MockedFunction<() => unknown[]>;
  enable: jest.MockedFunction<() => void>;
  disable: jest.MockedFunction<() => void>;

  // Internal properties that tests might access
  logEntries?: unknown[];
  enabled?: boolean;
  logFilePath?: string;
}

/**
 * Creates a mock AuditLogger instance
 */
export function createMockAuditLogger(): MockAuditLogger {
  const mockLogEntries: unknown[] = [];
  let enabled = true;

  const homeDir = process?.env?.HOME || process?.env?.USERPROFILE || '';
  const configDir = path.join(homeDir, '.config', 'walrus_todo');
  const logFilePath = path.join(configDir, 'audit.log');

  // Sanitization helper
  const sanitize = (data: unknown): unknown => {
    if (!data) return data;

    const sensitiveFields = [
      'apiKey',
      'credential',
      'password',
      'token',
      'secret',
      'key',
    ];

    const sanitizeObject = (obj: unknown): unknown => {
      if (typeof obj !== 'object' || obj === null) return obj;

      const result: Record<string, unknown> = Array.isArray(obj as any) ? [] : {};

      for (const [key, value] of Object.entries(obj as any)) {
        // Check if the key is sensitive
        if (sensitiveFields.some(field => key.toLowerCase().includes(field as any))) {
          result[key] = typeof value === 'string' ? '[REDACTED]' : null;
        }
        // Recurse for objects and arrays
        else if (typeof value === 'object' && value !== null) {
          result[key] = sanitizeObject(value as any);
        }
        // Pass through non-sensitive primitives
        else {
          result[key] = value;
        }
      }

      return result;
    };

    return sanitizeObject({ ...data });
  };

  const writeToFile = (entry: unknown): void => {
    try {
      const line = JSON.stringify(entry as any) + '\n';
      fs.appendFileSync(logFilePath, line, { mode: 0o600 });
    } catch (error) {
      // Handle file write errors gracefully in tests
      // In production, this would log the error
    }
  };

  const logger: MockAuditLogger = {
    log: jest.fn().mockImplementation((eventType: string, details: unknown) => {
      if (!enabled) return;

      const entry = {
        eventType,
        timestamp: Date.now(),
        ...sanitize(details as any),
      };

      mockLogEntries.push(entry as any);
      writeToFile(entry as any);
    }),

    getEntries: jest.fn().mockImplementation(() => {
      return [...mockLogEntries]; // Return a copy
    }),

    enable: jest.fn().mockImplementation(() => {
      enabled = true;
    }),

    disable: jest.fn().mockImplementation(() => {
      enabled = false;
    }),

    // Internal properties
    logEntries: mockLogEntries,
    enabled,
    logFilePath,
  };

  return logger;
}

/**
 * Mock AuditLogger constructor
 */
export const MockAuditLogger = jest.fn().mockImplementation(() => {
  return createMockAuditLogger();
});
