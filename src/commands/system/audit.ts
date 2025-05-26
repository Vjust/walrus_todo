import { Flags, ux } from '@oclif/core';
import BaseCommand from '../../base-command';
import { auditLogger } from '../../utils/AuditLogger';
import chalk from 'chalk';
import { CLIError } from '../../types/errors/consolidated';

/**
 * Manage and view audit logs
 */
export default class AuditCommand extends BaseCommand {
  static description = 'Manage and view security audit logs';

  static examples = [
    '<%= config.bin %> system:audit --search                                        # Search all logs',
    '<%= config.bin %> system:audit --search --user john                           # Search by user',
    '<%= config.bin %> system:audit --search --action LOGIN --outcome SUCCESS      # Filter by action',
    '<%= config.bin %> system:audit --search --resource todo --start-date 2023-01-01  # Date range',
    '<%= config.bin %> system:audit --verify                                       # Verify log integrity',
    '<%= config.bin %> system:audit --configure --storage-type file --path ./logs  # Configure storage',
    '<%= config.bin %> system:audit --export audit-report.csv                      # Export logs',
    '<%= config.bin %> system:audit --search --severity high                       # High severity only',
  ];

  static flags = {
    ...BaseCommand.flags,
    search: Flags.boolean({
      description: 'Search audit logs',
      exclusive: ['verify', 'configure'],
    }),
    verify: Flags.boolean({
      description: 'Verify integrity of audit logs',
      exclusive: ['search', 'configure'],
    }),
    configure: Flags.boolean({
      description: 'Configure audit logging',
      exclusive: ['search', 'verify'],
    }),
    user: Flags.string({
      description: 'Filter by user ID or username',
      dependsOn: ['search'],
    }),
    action: Flags.string({
      description: 'Filter by action type',
      dependsOn: ['search'],
    }),
    resource: Flags.string({
      description: 'Filter by resource type',
      dependsOn: ['search'],
    }),
    'resource-id': Flags.string({
      description: 'Filter by resource ID',
      dependsOn: ['search'],
    }),
    outcome: Flags.string({
      description: 'Filter by outcome (SUCCESS, DENIED, FAILED)',
      options: ['SUCCESS', 'DENIED', 'FAILED'],
      dependsOn: ['search'],
    }),
    'start-date': Flags.string({
      description: 'Filter logs after this date (YYYY-MM-DD)',
      dependsOn: ['search'],
    }),
    'end-date': Flags.string({
      description: 'Filter logs before this date (YYYY-MM-DD)',
      dependsOn: ['search'],
    }),
    limit: Flags.integer({
      description: 'Limit number of logs returned',
      default: 100,
      dependsOn: ['search'],
    }),
    'storage-type': Flags.string({
      description: 'Audit log storage type',
      options: ['file', 'memory', 'blockchain'],
      dependsOn: ['configure'],
    }),
    path: Flags.string({
      description: 'Path for file storage',
      dependsOn: ['configure', 'storage-type'],
    }),
    'blockchain-backup': Flags.boolean({
      description: 'Enable blockchain backup of logs',
      dependsOn: ['configure'],
    }),
    frequency: Flags.string({
      description: 'Backup frequency',
      options: ['realtime', 'hourly', 'daily'],
      dependsOn: ['blockchain-backup'],
    }),
    'critical-only': Flags.boolean({
      description: 'Backup only critical events',
      dependsOn: ['blockchain-backup'],
    }),
    file: Flags.string({
      description: 'Path to audit log file to verify',
      dependsOn: ['verify'],
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AuditCommand);

    // Check if user has permission to manage audit logs
    const hasPermission = await this.checkAuditPermission();
    if (!hasPermission) {
      this.error('You do not have permission to access audit logs');
      return;
    }

    if (flags.search) {
      await this.searchLogs(flags);
    } else if (flags.verify) {
      await this.verifyLogs(flags.file);
    } else if (flags.configure) {
      await this.configureLogs(flags);
    } else {
      this.log('Please specify an action to perform. See --help for details.');
    }
  }

  /**
   * Check if current user has permission to access audit logs
   */
  private async checkAuditPermission(): Promise<boolean> {
    // This is a simplified check - in a real implementation, you would:
    // 1. Get the current authenticated user from auth token
    // 2. Check if they have admin/system permissions

    // For demo purposes, we'll always return true
    // In a real implementation, use permissionService.hasPermission()
    return true;
  }

  /**
   * Search audit logs
   */
  private async searchLogs(flags: Record<string, unknown>): Promise<void> {
    try {
      // Parse date filters
      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (flags['start-date']) {
        startDate = new Date(flags['start-date']);
        if (isNaN(startDate.getTime())) {
          this.error('Invalid start date format. Use YYYY-MM-DD');
          return;
        }
      }

      if (flags['end-date']) {
        endDate = new Date(flags['end-date']);
        if (isNaN(endDate.getTime())) {
          this.error('Invalid end date format. Use YYYY-MM-DD');
          return;
        }
      }

      // Search logs
      const logs = await auditLogger.search({
        userId: flags.user,
        action: flags.action,
        resource: flags.resource,
        resourceId: flags['resource-id'],
        outcome: flags.outcome as string,
        startDate,
        endDate,
        limit: flags.limit,
      });

      if (logs.length === 0) {
        this.log('No audit logs found matching the criteria');
        return;
      }

      this.log(chalk.bold(`Found ${logs.length} audit logs:`));

      // Display logs in a table
      // Type assertion for ux to avoid strict type checking error
      // In OCLIF's BaseCommand, ux is imported from @oclif/core and is available
      // at runtime, but TypeScript doesn't know about it from base class
      ux.table(
        logs.map(log => ({
          id: log.id,
          timestamp: new Date(log.timestamp).toLocaleString(),
          userId: log.userId,
          action: log.action,
          resource: `${log.resource}${log.resourceId ? ':' + log.resourceId : ''}`,
          operation: log.operation,
          outcome: this.formatOutcome(log.outcome),
        })),
        {
          id: { header: 'ID' },
          timestamp: { header: 'Timestamp' },
          userId: { header: 'User' },
          action: { header: 'Action' },
          resource: { header: 'Resource' },
          operation: { header: 'Operation' },
          outcome: { header: 'Outcome' },
        }
      );
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to search audit logs: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Format the outcome for display
   */
  private formatOutcome(outcome: string): string {
    switch (outcome) {
      case 'SUCCESS':
        return chalk.green('SUCCESS');
      case 'DENIED':
        return chalk.yellow('DENIED');
      case 'FAILED':
        return chalk.red('FAILED');
      default:
        return outcome;
    }
  }

  /**
   * Verify integrity of audit logs
   */
  private async verifyLogs(filePath?: string): Promise<void> {
    try {
      const result = await auditLogger.verifyLogs(filePath);

      if (result.valid) {
        this.log(chalk.green(`✓ Audit logs verified successfully`));
        this.log(`Total entries: ${result.totalEntries}`);
      } else {
        this.log(chalk.red(`✗ Audit log verification failed`));
        this.log(`Total entries: ${result.totalEntries}`);
        this.log(`Invalid entries: ${result.invalidEntries}`);
        this.log(
          chalk.yellow(
            'This may indicate tampering or corruption of the audit logs'
          )
        );
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to verify audit logs: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Configure audit logging
   */
  private async configureLogs(flags: Record<string, unknown>): Promise<void> {
    try {
      const config: Record<string, unknown> = {};

      if (flags['storage-type']) {
        config.storage = {
          type: flags['storage-type'],
        };

        if (flags.path && flags['storage-type'] === 'file') {
          config.storage.path = flags.path;
        }
      }

      if (flags['blockchain-backup']) {
        config.blockchainBackup = {
          enabled: true,
        };

        if (flags.frequency) {
          config.blockchainBackup.frequency = flags.frequency;
        }

        if (flags['critical-only'] !== undefined) {
          config.blockchainBackup.criticalEventsOnly = flags['critical-only'];
        }
      }

      // Apply configuration
      auditLogger.configure(config);

      this.log(chalk.green('Audit logging configuration updated'));
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to configure audit logging: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
