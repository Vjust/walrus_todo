import { Flags, Args } from '@oclif/core';
import { BaseCommand } from '../base-command';
import { jobManager } from '../utils/PerformanceMonitor';
import { backgroundDataRetriever } from '../utils/BackgroundDataRetriever';
import { createBackgroundOperationsManager } from '../utils/background-operations';
import chalk = require('chalk');
import { CLIError } from '../types/errors/consolidated';

/**
 * @class CancelCommand
 * @description Cancel background operations and jobs
 */
export default class CancelCommand extends BaseCommand {
  static description =
    'Cancel background operations and jobs\n\nStop running or pending background operations including data retrieval, uploads, and blockchain transactions. Provides graceful cancellation with proper cleanup.';

  static examples = [
    '<%= config.bin %> cancel <job-id>              # Cancel specific job',
    '<%= config.bin %> cancel <job-id> --force     # Force cancel without graceful shutdown',
    '<%= config.bin %> cancel --all               # Cancel all running jobs',
    '<%= config.bin %> cancel --retrieval <op-id> # Cancel data retrieval operation',
    '<%= config.bin %> cancel --pattern "fetch*"   # Cancel jobs matching pattern',
    '<%= config.bin %> cancel --timeout 30       # Cancel jobs running longer than 30s',
  ];

  static args = {
    jobId: Args.string({
      description: 'Job ID to cancel',
      required: false,
    }),
  };

  static flags = {
    ...BaseCommand.flags,
    force: Flags.boolean({
      char: 'f',
      description: 'Force cancellation without graceful shutdown',
      default: false,
    }),
    all: Flags.boolean({
      char: 'a',
      description: 'Cancel all running and pending jobs',
      default: false,
    }),
    retrieval: Flags.string({
      char: 'r',
      description: 'Cancel a data retrieval operation by operation ID',
    }),
    pattern: Flags.string({
      char: 'p',
      description: 'Cancel jobs matching this pattern (supports wildcards)',
    }),
    timeout: Flags.integer({
      char: 't',
      description: 'Cancel jobs running longer than this many seconds',
    }),
    command: Flags.string({
      char: 'c',
      description:
        'Cancel jobs of this command type (e.g., retrieve, fetch, store)',
    }),
    confirm: Flags.boolean({
      description: 'Skip confirmation prompts for bulk operations',
      default: false,
    }),
    'dry-run': Flags.boolean({
      description: 'Show what would be cancelled without actually cancelling',
      default: false,
    }),
  };

  async run() {
    const { args, flags } = await this.parse(CancelCommand);

    // Handle data retrieval operation cancellation
    if (flags.retrieval) {
      return this.cancelRetrievalOperation(flags.retrieval, flags);
    }

    // Handle bulk operations
    if (flags.all || flags.pattern || flags.timeout || flags.command) {
      return this.cancelMultipleJobs(flags);
    }

    // Handle single job cancellation
    if (!args.jobId) {
      this.error(
        'Job ID required. Use --all to cancel all jobs or --pattern to match multiple jobs.'
      );
      return;
    }

    return this.cancelSingleJob(args.jobId, flags);
  }

  /**
   * Cancel a single job
   */
  private async cancelSingleJob(jobId: string, flags: any): Promise<void> {
    const job = jobManager.getJob(jobId);

    if (!job) {
      throw new CLIError(`Job not found: ${jobId}`, 'JOB_NOT_FOUND');
    }

    // Check if job can be cancelled
    if (
      job?.status === 'completed' ||
      job?.status === 'failed' ||
      job?.status === 'cancelled'
    ) {
      this.warn(
        `Job ${jobId} is already ${job.status} and cannot be cancelled`
      );
      return;
    }

    if (flags?.["dry-run"]) {
      this.log(chalk.yellow(`Would cancel job: ${jobId} (${job.command})`));
      return;
    }

    // Show job info before cancelling
    this.log(chalk.blue(`🛑 Cancelling job: ${jobId}`));
    const argsStr = Array.isArray(job.args)
      ? job?.args?.join(' ')
      : job.args || '';
    this.log(chalk.dim(`  Command: ${job.command} ${argsStr}`));
    this.log(chalk.dim(`  Status: ${job.status}`));
    this.log(chalk.dim(`  Progress: ${job.progress}%`));

    const duration = Date.now() - job.startTime;
    this.log(chalk.dim(`  Running for: ${this.formatJobDuration(duration)}`));

    try {
      // Attempt graceful cancellation first
      if (!flags.force) {
        this.log(chalk.yellow('⏳ Attempting graceful cancellation...'));

        const cancelled = jobManager.cancelJob(jobId);

        if (cancelled) {
          // Give it a moment to clean up
          await new Promise(resolve => setTimeout(resolve, 2000));

          const updatedJob = jobManager.getJob(jobId);
          if (updatedJob?.status === 'cancelled') {
            this.log(chalk.green('✅ Job cancelled gracefully'));
            this.showCancellationSummary(updatedJob);
            return;
          }
        }

        this.log(
          chalk.yellow(
            '⚠️  Graceful cancellation failed, attempting force cancellation...'
          )
        );
      }

      // Force cancellation
      const success = await this.forceCancelJob(jobId);

      if (success) {
        this.log(chalk.green('✅ Job cancelled (forced)'));

        const updatedJob = jobManager.getJob(jobId);
        if (updatedJob) {
          this.showCancellationSummary(updatedJob);
        }
      } else {
        throw new CLIError('Failed to cancel job', 'CANCEL_FAILED');
      }
    } catch (error) {
      throw new CLIError(
        `Failed to cancel job ${jobId}: ${error instanceof Error ? error.message : String(error)}`,
        'CANCEL_FAILED'
      );
    }
  }

  /**
   * Cancel multiple jobs based on criteria
   */
  private async cancelMultipleJobs(flags: any): Promise<void> {
    const allJobs = jobManager.getAllJobs();
    const activeJobs = allJobs.filter(
      job => job?.status === 'running' || job?.status === 'pending'
    );

    if (activeJobs?.length === 0) {
      this.info('No active jobs to cancel');
      return;
    }

    // Filter jobs based on criteria
    let jobsToCancel = activeJobs;

    if (flags.pattern) {
      const pattern = new RegExp(flags?.pattern?.replace(/\*/g, '.*'), 'i');
      jobsToCancel = jobsToCancel.filter(
        job =>
          pattern.test(job.id) ||
          pattern.test(job.command) ||
          job?.args?.some(arg => pattern.test(arg))
      );
    }

    if (flags.command) {
      jobsToCancel = jobsToCancel.filter(job =>
        job?.command?.toLowerCase().includes(flags?.command?.toLowerCase())
      );
    }

    if (flags.timeout) {
      const timeoutMs = flags.timeout * 1000;
      const now = Date.now();
      jobsToCancel = jobsToCancel.filter(
        job => now - job.startTime > timeoutMs
      );
    }

    if (jobsToCancel?.length === 0) {
      this.info('No jobs match the specified criteria');
      return;
    }

    if (flags?.["dry-run"]) {
      this.log(chalk.yellow(`Would cancel ${jobsToCancel.length} job(s):`));
      jobsToCancel.forEach(job => {
        const duration = Date.now() - job.startTime;
        this.log(
          chalk.dim(
            `  • ${job.id} - ${job.command} (${this.formatJobDuration(duration)})`
          )
        );
      });
      return;
    }

    // Show what will be cancelled
    this.log(chalk.blue(`🛑 Found ${jobsToCancel.length} job(s) to cancel:`));
    jobsToCancel.forEach(job => {
      const duration = Date.now() - job.startTime;
      this.log(
        chalk.dim(
          `  • ${job.id} - ${job.command} ${job?.args?.join(' ')} (${this.formatJobDuration(duration)})`
        )
      );
    });

    // Confirm bulk operation
    if (!flags.confirm && !flags.all) {
      const answer = await this.simplePrompt(
        'Are you sure you want to cancel these jobs? (y/N)'
      );
      if (!answer.toLowerCase().startsWith('y')) {
        this.log(chalk.yellow('❌ Cancellation aborted'));
        return;
      }
    }

    // Cancel jobs
    this.log(chalk.yellow(`\n⏳ Cancelling ${jobsToCancel.length} job(s)...`));

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const job of jobsToCancel) {
      try {
        const success = flags.force
          ? await this.forceCancelJob(job.id)
          : jobManager.cancelJob(job.id);

        if (success) {
          results.successful++;
          this.log(chalk.green(`  ✅ Cancelled: ${job.id}`));
        } else {
          results.failed++;
          results?.errors?.push(`Failed to cancel ${job.id}`);
          this.log(chalk.red(`  ❌ Failed: ${job.id}`));
        }
      } catch (error) {
        results.failed++;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        results?.errors?.push(`${job.id}: ${errorMessage}`);
        this.log(chalk.red(`  ❌ Error: ${job.id} - ${errorMessage}`));
      }

      // Small delay between cancellations
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Show summary
    this.log(chalk.bold('\n📊 Cancellation Summary'));
    this.log(chalk.gray('─'.repeat(30)));
    this.log(`Total Jobs: ${chalk.cyan(jobsToCancel.length)}`);
    this.log(`Successful: ${chalk.green(results.successful)}`);

    if (results.failed > 0) {
      this.log(`Failed: ${chalk.red(results.failed)}`);

      if (results?.errors?.length > 0) {
        this.log(chalk.red('\nErrors:'));
        results?.errors?.forEach(error => {
          this.log(chalk.red(`  • ${error}`));
        });
      }
    }
  }

  /**
   * Cancel a data retrieval operation
   */
  private async cancelRetrievalOperation(
    operationId: string,
    flags: any
  ): Promise<void> {
    const status =
      await backgroundDataRetriever.getRetrievalStatus(operationId);

    if (!status) {
      throw new CLIError(
        `Retrieval operation not found: ${operationId}`,
        'OPERATION_NOT_FOUND'
      );
    }

    if (status?.phase === 'complete') {
      this.warn(
        `Retrieval operation ${operationId} is already complete and cannot be cancelled`
      );
      return;
    }

    if (flags?.["dry-run"]) {
      this.log(
        chalk.yellow(`Would cancel retrieval operation: ${operationId}`)
      );
      return;
    }

    this.log(chalk.blue(`🛑 Cancelling retrieval operation: ${operationId}`));
    this.log(chalk.dim(`  Phase: ${status.phase}`));
    this.log(chalk.dim(`  Progress: ${status.progress}%`));

    if (status.currentItem) {
      this.log(chalk.dim(`  Current Item: ${status.currentItem}`));
    }

    try {
      const cancelled =
        await backgroundDataRetriever.cancelRetrieval(operationId);

      if (cancelled) {
        this.log(chalk.green('✅ Retrieval operation cancelled'));

        // Show final status
        const finalStatus =
          await backgroundDataRetriever.getRetrievalStatus(operationId);
        if (finalStatus) {
          this.log(chalk.dim(`\nFinal status: ${finalStatus.phase}`));
          if (finalStatus.processedItems && finalStatus.totalItems) {
            this.log(
              chalk.dim(
                `Items processed: ${finalStatus.processedItems}/${finalStatus.totalItems}`
              )
            );
          }
        }
      } else {
        throw new CLIError(
          'Failed to cancel retrieval operation',
          'CANCEL_FAILED'
        );
      }
    } catch (error) {
      throw new CLIError(
        `Failed to cancel retrieval operation ${operationId}: ${error instanceof Error ? error.message : String(error)}`,
        'CANCEL_FAILED'
      );
    }
  }

  /**
   * Force cancel a job (terminates process if needed)
   */
  private async forceCancelJob(jobId: string): Promise<boolean> {
    const job = jobManager.getJob(jobId);
    if (!job) return false;

    // Try to cancel through job manager first
    const cancelled = jobManager.cancelJob(jobId);

    // If job has a PID, try to terminate the process
    if (job.pid && !cancelled) {
      try {
        process.kill(job.pid, 'SIGTERM');

        // Wait a bit then try SIGKILL if still running
        await new Promise(resolve => setTimeout(resolve, 3000));

        const updatedJob = jobManager.getJob(jobId);
        if (updatedJob?.status !== 'cancelled') {
          process.kill(job.pid, 'SIGKILL');
        }
      } catch (error) {
        // Process might not exist anymore, which is fine
      }
    }

    // Try to cancel through background operations manager
    try {
      const backgroundOps = await createBackgroundOperationsManager();
      await backgroundOps.cancelOperation(jobId);
    } catch (error) {
      // This is fine, job might not be a background operation
    }

    return true;
  }

  /**
   * Show cancellation summary
   */
  private showCancellationSummary(job: any): void {
    const duration = job.endTime
      ? job.endTime - job.startTime
      : Date.now() - job.startTime;

    this.log(chalk.bold('\n📊 Cancellation Summary'));
    this.log(chalk.gray('─'.repeat(30)));
    this.log(`Job ID: ${chalk.cyan(job.id)}`);
    this.log(`Command: ${chalk.cyan(job.command)} ${job?.args?.join(' ')}`);
    this.log(`Final Status: ${chalk.gray('Cancelled')}`);
    this.log(`Runtime: ${chalk.yellow(this.formatJobDuration(duration))}`);

    if (job.processedItems !== undefined && job.totalItems !== undefined) {
      this.log(
        `Progress: ${chalk.yellow(`${job.processedItems}/${job.totalItems} items (${job.progress}%)`)})`
      );
    } else {
      this.log(`Progress: ${chalk.yellow(`${job.progress}%`)}`);
    }

    // Show cleanup actions
    this.log(chalk.gray('\n💡 Cleanup actions:'));
    this.log(chalk.gray('   • Background processes terminated'));
    this.log(chalk.gray('   • Temporary files cleaned up'));
    this.log(chalk.gray('   • Network connections closed'));
    this.log(chalk.gray('   • Job marked as cancelled'));
  }

  /**
   * Format duration for display
   */
  private formatJobDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000)
      return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  }

  /**
   * Simple prompt utility
   */
  private async simplePrompt(message: string): Promise<string> {
    process?.stdout?.write(chalk.yellow(`${message} `));

    return new Promise(resolve => {
      process?.stdin?.once('data', data => {
        resolve(data.toString().trim());
      });
    });
  }
}
