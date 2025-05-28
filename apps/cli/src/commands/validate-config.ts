import BaseCommand from '../base-command';
import chalk = require('chalk');
import ConfigCommand from './config';
import { jobManager } from '../utils/PerformanceMonitor';

/**
 * @class ValidateConfigCommand
 * @description Legacy command that redirects to the config validate command.
 * Kept for backward compatibility.
 */
export default class ValidateConfigCommand extends BaseCommand {
  static description =
    'Validate configuration consistency (redirects to config validate)';

  static hidden = true; // Hide from help since it's a legacy command

  static examples = [
    '<%= config.bin %> validate-config                        # Redirects to: config validate',
    '<%= config.bin %> validate-config --network testnet      # Redirects to: config validate --network testnet',
    '<%= config.bin %> validate-config --detailed             # Redirects to: config validate --detailed',
  ];

  static flags = ConfigCommand.flags;

  async run(): Promise<void> {
    const { flags, argv } = await this.parse(ValidateConfigCommand);

    // Show deprecation notice
    this.log(
      chalk.yellow(
        '⚠️  This command is deprecated. Please use "waltodo config validate" instead.\n'
      )
    );

    // Handle background mode directly for legacy support
    if (flags.background) {
      return this.runLegacyValidationInBackground(flags);
    }

    // Build args for config command
    const args = ['validate'];

    // Add flags
    const flagArgs: string[] = [];
    if (flags.network) flagArgs.push('--network', flags.network);
    if (flags.detailed) flagArgs.push('--detailed');
    if (flags['report-file'])
      flagArgs.push('--report-file', flags['report-file']);
    if (flags.background) flagArgs.push('--background');

    // Run the config command with validate action
    await this.config.runCommand('config', [...args, ...flagArgs]);
  }

  /**
   * Run legacy validation in background (for backward compatibility)
   */
  private async runLegacyValidationInBackground(flags: any): Promise<void> {
    // Create background job for legacy validation
    const job = jobManager.createJob('validate-config', ['legacy'], flags);
    jobManager.startJob(job.id);

    this.log(
      chalk.blue(`🔍 Starting legacy configuration validation in background...`)
    );
    this.log(chalk.gray(`Job ID: ${job.id}`));
    this.log(
      chalk.gray(
        `Note: Consider using "waltodo config validate --background" instead`
      )
    );
    this.log(chalk.gray(`Use "waltodo jobs" to check progress`));

    // Run validation in background
    setImmediate(async () => {
      try {
        jobManager.writeJobLog(
          job.id,
          'Starting legacy configuration validation'
        );
        jobManager.updateProgress(job.id, 25);

        // Redirect to modern config validation
        const configCmd = new ConfigCommand([], this.config);
        await configCmd.init();

        jobManager.updateProgress(job.id, 50);
        jobManager.writeJobLog(
          job.id,
          'Running comprehensive validation via config command'
        );

        // Run the actual validation (non-background since we're already in background)
        const modifiedFlags = { ...flags, background: false };
        await (configCmd as any).validateConfig('comprehensive', modifiedFlags);

        jobManager.updateProgress(job.id, 100);
        jobManager.writeJobLog(
          job.id,
          'Legacy validation completed successfully'
        );
        jobManager.completeJob(job.id, {
          success: true,
          method: 'legacy-redirect',
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        jobManager.writeJobLog(
          job.id,
          `Legacy validation failed: ${errorMessage}`
        );
        jobManager.failJob(job.id, errorMessage);
      }
    });

    return;
  }
}
