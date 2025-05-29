/**
 * AuditLogger
 *
 * Specialized logger for security audit events with features for
 * tamper-evident logging and optional blockchain verification.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { AuditLogEntry } from '../types/permissions';
import { Logger } from './Logger';

export enum AuditLogStorage {
  FILE = 'file',
  BLOCKCHAIN = 'blockchain',
  MEMORY = 'memory',
}

export interface AuditLogConfig {
  enabled: boolean;
  storage: {
    type: AuditLogStorage;
    path?: string;
    rotationSizeKB?: number;
    retentionDays?: number;
  };
  blockchainBackup?: {
    enabled: boolean;
    frequency: 'realtime' | 'hourly' | 'daily';
    criticalEventsOnly: boolean;
  };
}

export class AuditLogger {
  private static instance: AuditLogger;
  private logger: Logger;
  private config: AuditLogConfig = {
    enabled: true,
    storage: {
      type: AuditLogStorage.FILE,
      path: './audit-logs',
      rotationSizeKB: 10240, // 10MB
      retentionDays: 90,
    },
  };

  private currentLogFile: string = '';
  private currentLogSize: number = 0;
  private memoryLogs: AuditLogEntry[] = [];
  private lastHash: string = '';

  private constructor() {
    this.logger = Logger.getInstance();
    this.initializeStorage();
  }

  /**
   * Get singleton instance of AuditLogger
   */
  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * Configure the audit logger
   */
  public configure(config: Partial<AuditLogConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      storage: {
        ...this.config.storage,
        ...config.storage,
      },
      blockchainBackup: {
        ...this.config.blockchainBackup,
        ...config.blockchainBackup,
      },
    };

    this.initializeStorage();
  }

  /**
   * Initialize storage based on configuration
   */
  private initializeStorage(): void {
    if (
      this.config.storage.type === AuditLogStorage.FILE &&
      this.config.storage.path
    ) {
      try {
        // Create logs directory if it doesn't exist
        if (!fs.existsSync(this.config.storage.path)) {
          fs.mkdirSync(this.config.storage.path, { recursive: true });
        }

        // Set current log file
        this.currentLogFile = path.join(
          this.config.storage.path,
          `audit-${new Date().toISOString().slice(0, 10)}.log`
        );

        // Check if file exists and get size
        if (fs.existsSync(this.currentLogFile)) {
          const stats = fs.statSync(this.currentLogFile);
          this.currentLogSize = stats.size / 1024; // Convert to KB

          // Read last line to get last hash
          const content = fs.readFileSync(this.currentLogFile, 'utf-8');
          const lines = content
            .split('\n')
            .filter((line: string) => line.trim().length > 0);
          if (lines.length > 0) {
            try {
              const lastEntry = JSON.parse(lines[lines.length - 1]);
              if (lastEntry.hash) {
                this.lastHash = lastEntry.hash;
              }
            } catch (e) {
              this.logger.warn('Failed to parse last audit log entry', {
                error: e,
              });
            }
          }
        }
      } catch (error) {
        this.logger.error(
          'Failed to initialize audit log storage',
          error as Error
        );
      }
    }
  }

  /**
   * Get critical event types that should always be backed up
   */
  private isCriticalEvent(entry: AuditLogEntry): boolean {
    const criticalActions = [
      'LOGIN',
      'FAILED_LOGIN',
      'PASSWORD_CHANGED',
      'ROLE_ASSIGNED',
      'ROLE_REMOVED',
      'PERMISSION_GRANTED',
      'PERMISSION_REVOKED',
      'API_KEY_CREATED',
      'API_KEY_REVOKED',
      'USER_CREATED',
      'ALL_SESSIONS_INVALIDATED',
    ];

    return criticalActions.includes(entry.action);
  }

  /**
   * Generate hash for tamper-evidence
   */
  private generateHash(entry: AuditLogEntry): string {
    // Create a hash of the current entry combined with the previous hash
    const entryStr = JSON.stringify({
      id: entry.id,
      timestamp: entry.timestamp,
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      operation: entry.operation,
      outcome: entry.outcome,
      metadata: entry.metadata,
    });

    // Combine with previous hash for chain of trust
    return createHash('sha256')
      .update(this.lastHash + entryStr)
      .digest('hex');
  }

  /**
   * Rotate log file if it exceeds maximum size
   */
  private rotateLogFileIfNeeded(): void {
    if (
      this.config.storage.type !== AuditLogStorage.FILE ||
      !this.config.storage.rotationSizeKB ||
      this.currentLogSize < this.config.storage.rotationSizeKB
    ) {
      return;
    }

    try {
      // Create new log file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.currentLogFile = path.join(
        this.config.storage.path || '.audit',
        `audit-${timestamp}.log`
      );
      this.currentLogSize = 0;

      // Clean up old log files
      this.cleanupOldLogFiles();
    } catch (error) {
      this.logger.error('Failed to rotate audit log file', error as Error);
    }
  }

  /**
   * Clean up old log files based on retention policy
   */
  private cleanupOldLogFiles(): void {
    if (
      this.config.storage.type !== AuditLogStorage.FILE ||
      !this.config.storage.path ||
      !this.config.storage.retentionDays
    ) {
      return;
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(
        cutoffDate.getDate() - this.config.storage.retentionDays
      );

      // Get all log files
      const files = fs
        .readdirSync(this.config.storage.path)
        .filter(file => file.startsWith('audit-') && file.endsWith('.log'));

      // Delete files older than retention period
      for (const file of files) {
        try {
          const filePath = path.join(this.config.storage.path, file);
          const stats = fs.statSync(filePath);
          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filePath);
          }
        } catch (error) {
          this.logger.warn(`Failed to delete old audit log file: ${file}`, {
            error: error,
          });
        }
      }
    } catch (error) {
      this.logger.error(
        'Failed to clean up old audit log files',
        error as Error
      );
    }
  }

  /**
   * Back up logs to blockchain
   */
  private async backupToBlockchain(entry: AuditLogEntry): Promise<void> {
    if (
      !this.config.blockchainBackup?.enabled ||
      (this.config.blockchainBackup.criticalEventsOnly &&
        !this.isCriticalEvent(entry))
    ) {
      return;
    }

    // PLANNED FEATURE: Blockchain backup for critical audit logs
    // This will store audit trails on-chain for tamper-evidence
    // See docs/ai-blockchain-verification-roadmap.md for roadmap
    // Current implementation uses secure file-based logging

    this.logger.debug('Blockchain backup would happen here', {
      entryId: entry.id,
      action: entry.action,
    });
  }

  /**
   * Write log entry to storage
   */
  private async writeToStorage(entry: AuditLogEntry): Promise<void> {
    // Add hash for tamper-evidence
    const entryWithHash = {
      ...entry,
      hash: this.generateHash(entry),
    };

    // Update last hash
    this.lastHash = entryWithHash.hash;

    // Store based on configuration
    switch (this.config.storage.type) {
      case AuditLogStorage.FILE:
        await this.writeToFile(entryWithHash);
        break;

      case AuditLogStorage.MEMORY:
        this.memoryLogs.push(entry);
        break;

      case AuditLogStorage.BLOCKCHAIN:
        await this.backupToBlockchain(entry);
        break;
    }

    // Additional blockchain backup if configured
    if (
      this.config.storage.type !== AuditLogStorage.BLOCKCHAIN &&
      this.config.blockchainBackup?.enabled
    ) {
      await this.backupToBlockchain(entry);
    }
  }

  /**
   * Write log entry to file
   */
  private async writeToFile(entry: AuditLogEntry): Promise<void> {
    if (!this.config.storage.path || !this.currentLogFile) {
      return;
    }

    try {
      // Rotate log file if needed
      this.rotateLogFileIfNeeded();

      // Write entry to file
      const entryStr = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.currentLogFile, entryStr);

      // Update current log size
      this.currentLogSize += Buffer.byteLength(entryStr) / 1024;
    } catch (error) {
      this.logger.error('Failed to write audit log to file', error as Error);
    }
  }

  /**
   * Log an audit event
   */
  public async log(entry: AuditLogEntry): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      // Ensure entry has required fields
      const completeEntry: AuditLogEntry = {
        id: entry.id || uuidv4(),
        timestamp: entry.timestamp || Date.now(),
        userId: entry.userId,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        operation: entry.operation,
        outcome: entry.outcome,
        metadata: entry.metadata || {},
      };

      // Write to storage
      await this.writeToStorage(completeEntry);

      // Log to regular logger for visibility (debug level)
      this.logger.debug(`AUDIT: ${completeEntry.action}`, {
        userId: completeEntry.userId,
        resource: completeEntry.resource,
        outcome: completeEntry.outcome,
      });
    } catch (error) {
      this.logger.error('Failed to log audit event', error as Error, {
        action: entry.action,
        userId: entry.userId,
      });
    }
  }

  /**
   * Search audit logs
   */
  public async search(options: {
    userId?: string;
    action?: string;
    resource?: string;
    resourceId?: string;
    outcome?: 'SUCCESS' | 'DENIED' | 'FAILED';
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    if (this.config.storage.type === AuditLogStorage.MEMORY) {
      // Search in-memory logs
      return this.searchMemoryLogs(options);
    } else if (this.config.storage.type === AuditLogStorage.FILE) {
      // Search file logs
      return this.searchFileLogs(options);
    }

    return [];
  }

  /**
   * Search in-memory logs
   */
  private searchMemoryLogs(options: {
    userId?: string;
    action?: string;
    outcome?: string;
    resource?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): AuditLogEntry[] {
    let results = [...this.memoryLogs];

    // Apply filters
    if (options.userId) {
      results = results.filter(entry => entry.userId === options.userId);
    }

    if (options.action) {
      results = results.filter(entry => entry.action === options.action);
    }

    if (options.resource) {
      results = results.filter(entry => entry.resource === options.resource);
    }

    if (options.resourceId) {
      results = results.filter(
        entry => entry.resourceId === options.resourceId
      );
    }

    if (options.outcome) {
      results = results.filter(entry => entry.outcome === options.outcome);
    }

    if (options.startDate) {
      const startTimestamp = options.startDate.getTime();
      results = results.filter(entry => entry.timestamp >= startTimestamp);
    }

    if (options.endDate) {
      const endTimestamp = options.endDate.getTime();
      results = results.filter(entry => entry.timestamp <= endTimestamp);
    }

    // Apply limit
    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Search file logs
   */
  private async searchFileLogs(options: {
    userId?: string;
    action?: string;
    outcome?: string;
    resource?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    const results: AuditLogEntry[] = [];

    if (!this.config.storage.path) {
      return results;
    }

    try {
      // Get all log files
      const storagePath = this.config.storage.path || '.audit';
      const files = fs
        .readdirSync(storagePath)
        .filter(file => file.startsWith('audit-') && file.endsWith('.log'))
        .sort((a, b) => {
          const statA = fs.statSync(path.join(storagePath, a));
          const statB = fs.statSync(path.join(storagePath, b));
          return statB.mtime.getTime() - statA.mtime.getTime();
        });

      // Process each file
      for (const file of files) {
        if (options.limit && results.length >= options.limit) {
          break;
        }

        const filePath = path.join(this.config.storage.path, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = (content as string)
          .split('\n')
          .filter(line => line.trim().length > 0);

        for (const line of lines) {
          if (options.limit && results.length >= options.limit) {
            break;
          }

          try {
            const entry = JSON.parse(line) as AuditLogEntry;

            // Apply filters
            if (options.userId && entry.userId !== options.userId) continue;
            if (options.action && entry.action !== options.action) continue;
            if (options.resource && entry.resource !== options.resource)
              continue;
            if (options.resourceId && entry.resourceId !== options.resourceId)
              continue;
            if (options.outcome && entry.outcome !== options.outcome) continue;

            if (
              options.startDate &&
              entry.timestamp < options.startDate.getTime()
            )
              continue;
            if (options.endDate && entry.timestamp > options.endDate.getTime())
              continue;

            // Add to results
            results.push(entry);
          } catch (error) {
            this.logger.warn('Failed to parse audit log entry', {
              error,
              line,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to search audit logs', error as Error);
    }

    return results;
  }

  /**
   * Check for tampering by validating hash chain
   */
  public async verifyLogs(filePath?: string): Promise<{
    valid: boolean;
    invalidEntries: number;
    totalEntries: number;
  }> {
    let currentFilePath = filePath;
    if (!currentFilePath && this.config.storage.type === AuditLogStorage.FILE) {
      currentFilePath = this.currentLogFile;
    }

    if (!currentFilePath || !fs.existsSync(currentFilePath)) {
      return { valid: false, invalidEntries: 0, totalEntries: 0 };
    }

    try {
      const content = fs.readFileSync(currentFilePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim().length > 0);

      let prevHash = '';
      let invalidEntries = 0;

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);

          // Skip entries without hash
          if (!entry.hash) continue;

          // For first entry, just store hash
          if (!prevHash) {
            prevHash = entry.hash;
            continue;
          }

          // Calculate expected hash
          const entryWithoutHash = { ...entry };
          delete entryWithoutHash.hash;

          const expectedHash = createHash('sha256')
            .update(prevHash + JSON.stringify(entryWithoutHash))
            .digest('hex');

          // Verify hash
          if (entry.hash !== expectedHash) {
            invalidEntries++;
          }

          // Update previous hash
          prevHash = entry.hash;
        } catch (error) {
          invalidEntries++;
        }
      }

      return {
        valid: invalidEntries === 0,
        invalidEntries,
        totalEntries: lines.length,
      };
    } catch (error) {
      this.logger.error('Failed to verify audit logs', error as Error);
      return { valid: false, invalidEntries: 0, totalEntries: 0 };
    }
  }
}

// Export singleton instance
export const auditLogger = AuditLogger.getInstance();
