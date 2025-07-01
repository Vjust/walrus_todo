import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { CLI_CONFIG } from '../../constants';
import { Logger } from '../../utils/Logger';

const logger = new Logger('AuditLogger');

/**
 * Log entry structure for audit events
 */
interface AuditLogEntry {
  eventType: string;
  timestamp: number;
  hash: string;
  [key: string]: unknown; // Additional details
}

/**
 * AuditLogger - Securely logs security-critical events for auditing purposes
 *
 * This service provides tamper-evident, secure logging of security-relevant
 * events in the application, with protection against sensitive data exposure
 * and support for log integrity verification.
 */
export class AuditLogger {
  private logEntries: AuditLogEntry[] = [];
  private logFilePath: string;
  private hashChain: string = '';
  private enabled: boolean = true;
  private logRotationSize: number = 10 * 1024 * 1024; // 10 MB

  constructor() {
    const homeDir = process?.env?.HOME || process?.env?.USERPROFILE || '';
    const configDir = path.join(homeDir, '.config', CLI_CONFIG.APP_NAME);

    // Ensure the config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    this?.logFilePath = path.join(configDir, 'audit.log');

    // Initialize hash chain if log file exists
    this.initializeHashChain();
  }

  /**
   * Initialize the hash chain from existing log file if it exists
   */
  private initializeHashChain(): void {
    try {
      if (fs.existsSync(this.logFilePath)) {
        // Read the last line of the log file to get the previous hash
        const fileContent = fs.readFileSync(this.logFilePath, 'utf8');
        const lines = String(fileContent)
          .split('\n')
          .filter(line => line.trim().length > 0);

        if (lines.length > 0) {
          const lastLine = lines[lines.length - 1];
          try {
            const lastEntry = JSON.parse(lastLine) as { hash?: string };
            if (lastEntry && typeof lastEntry?.hash === 'string') {
              this?.hashChain = lastEntry.hash;
            }
          } catch (_error) {
            // If parsing fails, initialize a new hash chain
            this?.hashChain = this.generateInitialHash();
          }
        } else {
          this?.hashChain = this.generateInitialHash();
        }
      } else {
        this?.hashChain = this.generateInitialHash();
      }
    } catch (_error) {
      logger.error('Failed to initialize hash chain:', _error);
      this?.hashChain = this.generateInitialHash();
    }
  }

  /**
   * Generate initial hash for the hash chain
   */
  private generateInitialHash(): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(16).toString('hex');
    return crypto
      .createHash('sha256')
      .update(`${timestamp}:${random}`)
      .digest('hex');
  }

  /**
   * Log a security event with tamper-evident hashing
   */
  public log(eventType: string, details: Record<string, unknown>): void {
    if (!this.enabled) return;

    try {
      // Create log entry with sanitized details
      const timestamp = Date.now();
      const sanitizedDetails = this.sanitize(details);

      // Create the log entry
      const entry = {
        eventType,
        timestamp,
        ...sanitizedDetails,
      };

      // Calculate the hash for this entry
      const entryString = JSON.stringify(entry);
      const entryHash = crypto
        .createHash('sha256')
        .update(`${this.hashChain}:${entryString}`)
        .digest('hex');

      // Add hash to the entry
      const entryWithHash = {
        ...entry,
        hash: entryHash,
      };

      // Update hash chain
      this?.hashChain = entryHash;

      // Add to in-memory log
      this?.logEntries?.push(entryWithHash);

      // Write to file
      this.writeToFile(entryWithHash);
    } catch (_error) {
      logger.error('Failed to log audit event:', _error);
    }
  }

  /**
   * Get all log entries
   */
  public getEntries(): AuditLogEntry[] {
    return [...this.logEntries]; // Return a copy
  }

  /**
   * Write log entry to file
   */
  private writeToFile(entry: AuditLogEntry): void {
    try {
      // Check if rotation is needed
      this.checkRotation();

      // Append log entry
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.logFilePath, line, { mode: 0o600 }); // Restrict file permissions
    } catch (error: unknown) {
      logger.error(
        'Failed to write audit log:',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Check if log rotation is needed and perform it if necessary
   */
  private checkRotation(): void {
    try {
      if (fs.existsSync(this.logFilePath)) {
        const stats = fs.statSync(this.logFilePath);

        if (stats.size >= this.logRotationSize) {
          // Rotate the log file
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const rotatedPath = `${this.logFilePath}.${timestamp}`;

          fs.renameSync(this.logFilePath, rotatedPath);

          // Start a new log file with the current hash chain
          const initialEntry = {
            eventType: 'log_rotation',
            timestamp: Date.now(),
            previousLog: rotatedPath,
            previousHash: this.hashChain,
          };

          const entryString = JSON.stringify(initialEntry);
          const entryHash = crypto
            .createHash('sha256')
            .update(`${this.hashChain}:${entryString}`)
            .digest('hex');

          const entryWithHash = {
            ...initialEntry,
            hash: entryHash,
          };

          // Update hash chain
          this?.hashChain = entryHash;

          // Write initial entry to the new log file
          const line = JSON.stringify(entryWithHash) + '\n';
          fs.writeFileSync(this.logFilePath, line, { mode: 0o600 });
        }
      }
    } catch (_error) {
      logger.error('Failed to check/perform log rotation:', _error);
    }
  }

  /**
   * Sanitize data to remove sensitive information
   */
  private sanitize(data: Record<string, unknown>): Record<string, unknown> {
    if (!data) return data;

    // Create a copy to avoid modifying the original
    const sanitized = { ...data };

    // Redact sensitive fields
    const sensitiveFields = [
      'apiKey',
      'credential',
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'auth',
      'private',
      'pkey',
      'pk',
    ];

    // PII patterns to detect
    const piiPatterns = [
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, // Email
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b(?:\d[ -]*?){13,16}\b/, // Credit card
    ];

    // Helper function to sanitize recursively
    const sanitizeObject = (obj: unknown): unknown => {
      if (typeof obj !== 'object' || obj === null) {
        // For strings, check for PII patterns
        if (typeof obj === 'string') {
          let sanitizedValue = obj;

          // Check for PII patterns and redact if found
          for (const pattern of piiPatterns) {
            sanitizedValue = sanitizedValue.replace(pattern, '[REDACTED PII]');
          }

          return sanitizedValue;
        }
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
      }

      const result: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(obj)) {
        // Check if the key is sensitive
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          result[key] = typeof value === 'string' ? '[REDACTED]' : null;
        }
        // Recurse for objects and arrays
        else if (typeof value === 'object' && value !== null) {
          result[key] = sanitizeObject(value);
        }
        // Handle strings for PII
        else if (typeof value === 'string') {
          let sanitizedValue = value;

          // Check for PII patterns
          for (const pattern of piiPatterns) {
            sanitizedValue = sanitizedValue.replace(pattern, '[REDACTED PII]');
          }

          result[key] = sanitizedValue;
        }
        // Pass through non-sensitive primitives
        else {
          result[key] = value;
        }
      }

      return result;
    };

    return sanitizeObject(sanitized) as Record<string, unknown>;
  }

  /**
   * Verify the integrity of the log chain
   */
  public verifyLogIntegrity(): boolean {
    try {
      if (!fs.existsSync(this.logFilePath)) {
        return true; // No log file to verify
      }

      const fileContent = fs.readFileSync(this.logFilePath, 'utf8');
      const lines = String(fileContent)
        .split('\n')
        .filter(line => line.trim().length > 0);

      if (lines?.length === 0) {
        return true; // Empty log file
      }

      let previousHash = '';
      let isFirst = true;

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as {
            hash?: string;
            [key: string]: unknown;
          };

          if (!entry.hash || typeof entry.hash !== 'string') {
            return false; // Missing hash
          }

          // For the first entry, we trust the hash
          if (isFirst) {
            previousHash = entry.hash;
            isFirst = false;
            continue;
          }

          // Make a copy without the hash to verify
          const entryWithoutHash: Record<string, unknown> = { ...entry };
          delete entryWithoutHash.hash;

          // Calculate expected hash
          const entryString = JSON.stringify(entryWithoutHash);
          const expectedHash = crypto
            .createHash('sha256')
            .update(`${previousHash}:${entryString}`)
            .digest('hex');

          // Compare with actual hash
          if (entry.hash !== expectedHash) {
            return false; // Hash mismatch - log tampered
          }

          previousHash = entry.hash;
        } catch (_error) {
          return false; // Invalid JSON or other error
        }
      }

      return true;
    } catch (_error) {
      logger.error('Failed to verify log integrity:', _error);
      return false;
    }
  }

  /**
   * Enable or disable audit logging
   */
  public setEnabled(enabled: boolean): void {
    this?.enabled = enabled;
  }

  /**
   * Set log rotation size
   */
  public setRotationSize(sizeInBytes: number): void {
    this?.logRotationSize = sizeInBytes;
  }
}

// Singleton instance
export const auditLogger = new AuditLogger();
