/**
 * @fileoverview Queue Status Command - Monitor and manage upload queue
 *
 * This command provides comprehensive queue management functionality including
 * status monitoring, job control, and queue statistics.
 */

import { Args, Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import {
  getGlobalUploadQueue,
  QueueJob,
  QueueStats,
} from '../utils/upload-queue';
import { CLIError } from '../types/errors/consolidated';
import chalk = require('chalk');
import * as Table from 'cli-table3';

export default class QueueCommand extends BaseCommand {
  static description =
    'Manage and monitor the upload queue\n\nMonitor upload progress, view queue statistics, and control queue operations.\nThe upload queue processes Walrus uploads in the background without blocking the CLI.';

  static examples = [
    '<%= config.bin %> queue                                    # Show queue status',
    '<%= config.bin %> queue status                             # Detailed status view',
    '<%= config.bin %> queue list                               # List all jobs',
    '<%= config.bin %> queue list --status pending              # List pending jobs only',
    '<%= config.bin %> queue stats                              # Show queue statistics',
    '<%= config.bin %> queue cancel abc123                      # Cancel specific job',
    '<%= config.bin %> queue retry abc123                       # Retry failed job',
    '<%= config.bin %> queue clear completed                    # Clear completed jobs',
    '<%= config.bin %> queue watch                              # Watch queue in real-time',
  ];

  static args = {
    action: Args.string({
      name: 'action',
      description: 'Queue action to perform',
      options: ['status', 'list', 'stats', 'cancel', 'retry', 'clear', 'watch'],
      required: false,
    }),
    target: Args.string({
      name: 'target',
      description: 'Job ID or clear target (completed/failed/all)',
      required: false,
    }),
  };

  static flags = {
    ...BaseCommand.flags,
    status: Flags.string({
      char: 's',
      description: 'Filter by job status',
      options: ['pending', 'processing', 'completed', 'failed', 'retrying'],
    }),
    type: Flags.string({
      char: 't',
      description: 'Filter by job type',
      options: ['todo', 'todo-list', 'blob'],
    }),
    priority: Flags.string({
      char: 'p',
      description: 'Filter by job priority',
      options: ['low', 'medium', 'high'],
    }),
    limit: Flags.integer({
      char: 'l',
      description: 'Limit number of jobs to display',
      default: 20,
    }),
    watch: Flags.boolean({
      char: 'w',
      description: 'Watch queue status in real-time',
      default: false,
    }),
    interval: Flags.integer({
      char: 'i',
      description: 'Watch interval in seconds',
      default: 3,
    }),
  };

  private queue = getGlobalUploadQueue();

  async run() {
    const { args, flags } = await this.parse(QueueCommand);
    const action = args.action || 'status';

    try {
      switch (action) {
        case 'status':
          await this.showStatus(flags.watch, flags.interval);
          break;
        case 'list':
          await this.listJobs(flags);
          break;
        case 'stats':
          await this.showStats();
          break;
        case 'cancel':
          await this.cancelJob(args.target);
          break;
        case 'retry':
          await this.retryJob(args.target);
          break;
        case 'clear':
          await this.clearJobs(args.target);
          break;
        case 'watch':
          await this.watchQueue(flags.interval);
          break;
        default:
          throw new CLIError(`Unknown action: ${action}`, 'INVALID_ACTION');
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Queue operation failed: ${error instanceof Error ? error.message : String(error)}`,
        'QUEUE_ERROR'
      );
    }
  }

  /**
   * Show queue status overview
   */
  private async showStatus(
    watch: boolean = false,
    interval: number = 3
  ): Promise<void> {
    if (watch) {
      await this.watchQueue(interval);
      return;
    }

    const stats = await this.queue.getStats();
    const activeJobs = this.queue.getJobs({ status: 'processing' });
    const recentCompleted = this.queue
      .getJobs({ status: 'completed' })
      .slice(0, 5)
      .sort(
        (a, b) =>
          (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0)
      );

    this.log('');
    this.section('Upload Queue Status', this.formatOverview(stats));

    if (activeJobs.length > 0) {
      this.log('');
      this.log(chalk.cyan.bold('🔄 Currently Processing:'));
      for (const job of activeJobs) {
        this.log(this.formatJobLine(job, true));
      }
    }

    if (recentCompleted.length > 0) {
      this.log('');
      this.log(chalk.green.bold('✅ Recent Completions:'));
      for (const job of recentCompleted.slice(0, 3)) {
        this.log(this.formatJobLine(job, false));
      }
    }

    const pendingJobs = this.queue.getJobs({ status: 'pending' });
    if (pendingJobs.length > 0) {
      this.log('');
      this.log(chalk.yellow.bold(`⏳ ${pendingJobs.length} job(s) pending`));
      if (pendingJobs.length <= 3) {
        for (const job of pendingJobs) {
          this.log(this.formatJobLine(job, false));
        }
      }
    }

    const failedJobs = this.queue.getJobs({ status: 'failed' });
    if (failedJobs.length > 0) {
      this.log('');
      this.log(chalk.red.bold(`❌ ${failedJobs.length} failed job(s)`));
      this.log(
        chalk.gray('  Use "waltodo queue list --status failed" to view details')
      );
      this.log(
        chalk.gray(
          '  Use "waltodo queue retry <job-id>" to retry specific jobs'
        )
      );
    }

    this.log('');
  }

  /**
   * List jobs with filtering
   */
  private async listJobs(flags: {
    status?: string;
    type?: string;
    priority?: string;
    limit: number;
  }): Promise<void> {
    const filter: any = {};
    if (flags.status) filter.status = flags.status;
    if (flags.type) filter.type = flags.type;
    if (flags.priority) filter.priority = flags.priority;

    const jobs = this.queue.getJobs(filter).slice(0, flags.limit);

    if (jobs.length === 0) {
      this.log(chalk.gray('No jobs found matching the criteria.'));
      return;
    }

    // Create table
    const table = new Table({
      head: [
        'Job ID',
        'Type',
        'Status',
        'Priority',
        'Created',
        'Progress',
        'Details',
      ],
      colWidths: [12, 10, 12, 8, 12, 10, 30],
      style: {
        head: ['cyan'],
        border: ['gray'],
      },
    });

    for (const job of jobs) {
      const progress = job.progress ? `${job.progress}%` : '-';
      const details = this.getJobDetails(job);
      const created = this.formatRelativeTime(job.createdAt);

      table.push([
        job.id.substring(0, 10) + '...',
        job.type,
        this.formatStatus(job.status),
        this.formatPriority(job.priority),
        created,
        progress,
        details,
      ]);
    }

    this.log('');
    this.log(table.toString());
    this.log('');
    this.log(chalk.gray(`Showing ${jobs.length} job(s)`));
    if (jobs.length === flags.limit) {
      this.log(chalk.gray(`Use --limit to show more results`));
    }
  }

  /**
   * Show detailed queue statistics
   */
  private async showStats(): Promise<void> {
    const stats = await this.queue.getStats();

    this.log('');
    this.section(
      'Queue Statistics',
      [
        `Total Jobs: ${chalk.cyan(stats.total)}`,
        `Pending: ${chalk.yellow(stats.pending)}`,
        `Processing: ${chalk.blue(stats.processing)}`,
        `Completed: ${chalk.green(stats.completed)}`,
        `Failed: ${chalk.red(stats.failed)}`,
        `Retrying: ${chalk.magenta(stats.retrying)}`,
        '',
        `Total Data Uploaded: ${chalk.cyan(this.formatBytes(stats.totalBytesUploaded))}`,
        `Average Upload Time: ${chalk.cyan(this.formatQueueDuration(stats.averageUploadTime))}`,
        `Success Rate: ${chalk.cyan((stats.successRate * 100).toFixed(1) + '%')}`,
      ].join('\n')
    );

    // Job type breakdown
    const jobs = this.queue.getJobs();
    const typeStats = {
      todo: jobs.filter(j => j.type === 'todo').length,
      'todo-list': jobs.filter(j => j.type === 'todo-list').length,
      blob: jobs.filter(j => j.type === 'blob').length,
    };

    this.log('');
    this.section(
      'Job Types',
      [
        `Todos: ${chalk.cyan(typeStats.todo)}`,
        `Todo Lists: ${chalk.cyan(typeStats['todo-list'])}`,
        `Blobs: ${chalk.cyan(typeStats.blob)}`,
      ].join('\n')
    );

    this.log('');
  }

  /**
   * Cancel a specific job
   */
  private async cancelJob(jobId?: string): Promise<void> {
    if (!jobId) {
      throw new CLIError(
        'Job ID is required for cancel operation',
        'MISSING_JOB_ID'
      );
    }

    const job = this.queue.getJob(jobId);
    if (!job) {
      throw new CLIError(`Job not found: ${jobId}`, 'JOB_NOT_FOUND');
    }

    if (job.status === 'completed') {
      throw new CLIError('Cannot cancel completed job', 'INVALID_OPERATION');
    }

    const success = await this.queue.cancelJob(jobId);
    if (success) {
      this.success(`Job ${jobId} cancelled successfully`);
    } else {
      throw new CLIError('Failed to cancel job', 'CANCEL_FAILED');
    }
  }

  /**
   * Retry a failed job
   */
  private async retryJob(jobId?: string): Promise<void> {
    if (!jobId) {
      throw new CLIError(
        'Job ID is required for retry operation',
        'MISSING_JOB_ID'
      );
    }

    const job = this.queue.getJob(jobId);
    if (!job) {
      throw new CLIError(`Job not found: ${jobId}`, 'JOB_NOT_FOUND');
    }

    if (job.status !== 'failed') {
      throw new CLIError(
        `Job is not in failed status (current: ${job.status})`,
        'INVALID_STATUS'
      );
    }

    const success = await this.queue.retryJob(jobId);
    if (success) {
      this.success(`Job ${jobId} queued for retry`);
    } else {
      throw new CLIError('Failed to retry job', 'RETRY_FAILED');
    }
  }

  /**
   * Clear jobs by status
   */
  private async clearJobs(target?: string): Promise<void> {
    if (!target) {
      throw new CLIError(
        'Clear target is required (completed/failed/all)',
        'MISSING_TARGET'
      );
    }

    let clearedCount = 0;

    switch (target) {
      case 'completed':
        clearedCount = await this.queue.clearCompleted();
        break;
      case 'failed':
        const failedJobs = this.queue.getJobs({ status: 'failed' });
        for (const job of failedJobs) {
          await this.queue.cancelJob(job.id);
        }
        clearedCount = failedJobs.length;
        break;
      case 'all':
        const allJobs = this.queue.getJobs();
        for (const job of allJobs) {
          if (job.status !== 'processing') {
            await this.queue.cancelJob(job.id);
          }
        }
        clearedCount = allJobs.filter(j => j.status !== 'processing').length;
        break;
      default:
        throw new CLIError(`Invalid clear target: ${target}`, 'INVALID_TARGET');
    }

    this.success(`Cleared ${clearedCount} job(s)`);
  }

  /**
   * Watch queue status in real-time
   */
  private async watchQueue(interval: number): Promise<void> {
    this.log(chalk.cyan('📊 Watching upload queue... (Press Ctrl+C to exit)'));
    this.log('');

    // Setup event listeners for real-time updates
    this.queue.on('jobStarted', (job: QueueJob) => {
      this.log(chalk.blue(`🔄 Started: ${this.formatJobLine(job, false)}`));
    });

    this.queue.on('jobCompleted', (job: QueueJob) => {
      this.log(
        chalk.green(
          `✅ Completed: ${this.formatJobLine(job, false)} -> ${job.blobId}`
        )
      );
    });

    this.queue.on('jobFailed', (job: QueueJob) => {
      this.log(
        chalk.red(`❌ Failed: ${this.formatJobLine(job, false)} - ${job.error}`)
      );
    });

    this.queue.on('jobProgress', progress => {
      this.log(
        chalk.yellow(
          `⏳ Progress: ${progress.jobId} - ${progress.message} (${progress.progress}%)`
        )
      );
    });

    // Periodic status updates
    const watchInterval = setInterval(async () => {
      try {
        const stats = await this.queue.getStats();
        process.stdout.write(
          `\r${chalk.cyan('Queue:')} ${stats.pending}⏳ ${stats.processing}🔄 ${stats.completed}✅ ${stats.failed}❌`
        );
      } catch (error) {
        // Ignore errors during watch
      }
    }, interval * 1000);

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      clearInterval(watchInterval);
      this.log('\n');
      this.log(chalk.yellow('Watch mode stopped.'));
      process.exit(0);
    });

    // Keep process alive
    await new Promise(() => {}); // Never resolves
  }

  /**
   * Format queue overview
   */
  private formatOverview(stats: QueueStats): string {
    const totalActive = stats.pending + stats.processing + stats.retrying;

    return [
      `Total Jobs: ${chalk.cyan(stats.total)}`,
      `Active: ${chalk.yellow(totalActive)} (${stats.pending} pending, ${stats.processing} processing, ${stats.retrying} retrying)`,
      `Completed: ${chalk.green(stats.completed)}`,
      `Failed: ${chalk.red(stats.failed)}`,
      '',
      `Success Rate: ${chalk.cyan((stats.successRate * 100).toFixed(1) + '%')}`,
      `Data Uploaded: ${chalk.cyan(this.formatBytes(stats.totalBytesUploaded))}`,
    ].join('\n');
  }

  /**
   * Format job line for display
   */
  private formatJobLine(job: QueueJob, showProgress: boolean): string {
    const details = this.getJobDetails(job);
    const time = this.formatRelativeTime(job.updatedAt);
    const progress = showProgress && job.progress ? ` (${job.progress}%)` : '';

    return `  ${job.id.substring(0, 8)}... | ${job.type} | ${details} | ${time}${progress}`;
  }

  /**
   * Get job details for display
   */
  private getJobDetails(job: QueueJob): string {
    switch (job.type) {
      case 'todo':
        const todo = job.data as any;
        return todo.title?.substring(0, 20) || 'Unknown todo';
      case 'todo-list':
        const list = job.data as any;
        return `${list.name} (${list.todos?.length || 0} todos)`;
      case 'blob':
        const blob = job.data as any;
        return blob.fileName || 'Unknown blob';
      default:
        return 'Unknown';
    }
  }

  /**
   * Format job status with color
   */
  private formatStatus(status: QueueJob['status']): string {
    switch (status) {
      case 'pending':
        return chalk.yellow(status);
      case 'processing':
        return chalk.blue(status);
      case 'completed':
        return chalk.green(status);
      case 'failed':
        return chalk.red(status);
      case 'retrying':
        return chalk.magenta(status);
      default:
        return status;
    }
  }

  /**
   * Format priority with color
   */
  private formatPriority(priority: QueueJob['priority']): string {
    switch (priority) {
      case 'high':
        return chalk.red(priority);
      case 'medium':
        return chalk.yellow(priority);
      case 'low':
        return chalk.gray(priority);
      default:
        return priority;
    }
  }

  /**
   * Format relative time
   */
  private formatRelativeTime(date: Date): string {
    const now = Date.now();
    const diff = now - date.getTime();

    if (diff < 60000) {
      return 'now';
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}m ago`;
    } else if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}h ago`;
    } else {
      return `${Math.floor(diff / 86400000)}d ago`;
    }
  }

  /**
   * Format duration in milliseconds
   */
  private formatQueueDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  /**
   * Format bytes in human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}
