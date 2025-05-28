import { Flags, Args } from '@oclif/core';
import BaseCommand from '../base-command';
import { jobManager } from '../utils/PerformanceMonitor';
import { backgroundDataRetriever } from '../utils/BackgroundDataRetriever';
import chalk = require('chalk');
import { CLIError } from '../types/errors/consolidated';

/**
 * @class StatusCommand
 * @description Check status of background operations and jobs
 */
export default class StatusCommand extends BaseCommand {
  static description = 'Check status of background operations and jobs\n\nMonitor progress, view logs, and get detailed information about running or completed background operations including data retrieval, uploads, and blockchain transactions.';

  static examples = [
    '<%= config.bin %> status <job-id>                    # Check specific job status',
    '<%= config.bin %> status <job-id> --verbose          # Show detailed logs and metadata',
    '<%= config.bin %> status <job-id> --follow           # Follow job progress in real-time',
    '<%= config.bin %> status --latest                    # Show status of most recent job',
    '<%= config.bin %> status --summary                   # Show summary of all jobs',
    '<%= config.bin %> status --retrieval <operation-id>  # Check data retrieval operation',
  ];

  static args = {
    jobId: Args.string({
      description: 'Job ID to check status for',
      required: false,
    }),
  };

  static flags = {
    ...BaseCommand.flags,
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show detailed logs and metadata',
      default: false,
    }),
    follow: Flags.boolean({
      char: 'f',
      description: 'Follow job progress in real-time until completion',
      default: false,
    }),
    latest: Flags.boolean({
      char: 'l',
      description: 'Show status of the most recent job',
      default: false,
    }),
    summary: Flags.boolean({
      char: 's',
      description: 'Show summary of all jobs instead of specific job',
      default: false,
    }),
    retrieval: Flags.string({
      char: 'r',
      description: 'Check status of a data retrieval operation by operation ID',
    }),
    refresh: Flags.integer({
      description: 'Refresh interval in seconds for --follow mode',
      default: 2,
      min: 1,
    }),
    limit: Flags.integer({
      description: 'Limit number of log entries shown',
      default: 20,
      min: 1,
    }),
  };

  async run() {
    const { args, flags } = await this.parse(StatusCommand);

    // Handle data retrieval operation status
    if (flags.retrieval) {
      return this.showRetrievalStatus(flags.retrieval, flags);
    }

    // Handle summary mode
    if (flags.summary) {
      return this.showJobsSummary(flags);
    }

    // Determine job ID to check
    let jobId = args.jobId;
    
    if (!jobId && flags.latest) {
      const jobs = jobManager.getAllJobs();
      if (jobs.length === 0) {
        this.info('No jobs found');
        return;
      }
      jobId = jobs[0].id; // Most recent job
    }

    if (!jobId) {
      this.error('Job ID required. Use --latest for most recent job or --summary for overview.');
      return;
    }

    // Handle follow mode
    if (flags.follow) {
      return this.followJobProgress(jobId, flags);
    }

    // Show single job status
    return this.showJobStatus(jobId, flags);
  }

  /**
   * Show status of a single job
   */
  private async showJobStatus(jobId: string, flags: any): Promise<void> {
    const job = jobManager.getJob(jobId);
    
    if (!job) {
      throw new CLIError(`Job not found: ${jobId}`, 'JOB_NOT_FOUND');
    }

    // Calculate duration
    const duration = job.endTime ? job.endTime - job.startTime : Date.now() - job.startTime;
    const durationStr = this.formatDuration(duration);
    
    // Status header
    this.section(`Job Status: ${jobId}`, this.getStatusDisplay(job.status));
    
    // Basic information
    const argsStr = Array.isArray(job.args) ? job.args.join(' ') : (job.args || '');
    this.log(`Command: ${chalk.cyan(job.command)} ${argsStr}`);
    this.log(`Status: ${this.getStatusDisplay(job.status)}`);
    this.log(`Progress: ${this.createProgressBarVisual(job.progress)} ${chalk.yellow(job.progress + '%')}`);
    this.log(`Duration: ${chalk.yellow(durationStr)}`);
    this.log(`Started: ${chalk.dim(new Date(job.startTime).toLocaleString())}`);
    
    if (job.endTime) {
      this.log(`Ended: ${chalk.dim(new Date(job.endTime).toLocaleString())}`);
    }
    
    if (job.pid) {
      this.log(`Process ID: ${chalk.dim(job.pid)}`);
    }

    // Progress details
    if (job.processedItems !== undefined && job.totalItems !== undefined) {
      this.log(`Items: ${chalk.green(job.processedItems)}/${chalk.blue(job.totalItems)}`);
      
      if (job.totalItems > 0) {
        const completionRate = (job.processedItems / job.totalItems) * 100;
        this.log(`Completion Rate: ${chalk.yellow(completionRate.toFixed(1) + '%')}`);
      }
    }

    // Error information
    if (job.status === 'failed' && job.errorMessage) {
      this.log(`\n${chalk.red('Error Details:')}`);
      this.log(chalk.red(`  ${job.errorMessage}`));
    }

    // Metadata
    if (job.metadata && Object.keys(job.metadata).length > 0) {
      this.log(`\n${chalk.bold('Metadata:')}`);
      Object.entries(job.metadata).forEach(([key, value]) => {
        this.log(`  ${chalk.dim(key)}: ${chalk.white(JSON.stringify(value))}`);
      });
    }

    // Show logs if verbose or if job failed
    if (flags.verbose || job.status === 'failed') {
      this.showJobLogs(jobId, flags.limit);
    }

    // Show next steps based on status
    this.showJobActions(job);
  }

  /**
   * Show logs for a job
   */
  private showJobLogs(jobId: string, limit: number): void {
    const logs = jobManager.readJobLog(jobId);
    
    if (!logs) {
      this.log(chalk.dim('\nNo logs available'));
      return;
    }

    const logLines = logs.trim().split('\n');
    const recentLogs = logLines.slice(-limit);
    
    this.log(chalk.bold(`\n📋 Recent Logs (${recentLogs.length}/${logLines.length}):`));
    this.log(chalk.gray('─'.repeat(60)));
    
    recentLogs.forEach(line => {
      const timestampMatch = line.match(/^\[([^\]]+)\]/);
      if (timestampMatch) {
        const timestamp = timestampMatch[1];
        const message = line.substring(timestampMatch[0].length).trim();
        this.log(`${chalk.dim(timestamp)} ${message}`);
      } else {
        this.log(chalk.dim(line));
      }
    });
    
    if (logLines.length > limit) {
      this.log(chalk.dim(`\n... and ${logLines.length - limit} more entries`));
      this.log(chalk.dim(`Use --limit ${logLines.length} to see all logs`));
    }
  }

  /**
   * Show actions available for a job
   */
  private showJobActions(job: any): void {
    this.log(chalk.bold('\n🔧 Available Actions:'));
    
    if (job.status === 'running' || job.status === 'pending') {
      this.log(chalk.dim(`  waltodo cancel ${job.id}                 # Cancel this job`));
      this.log(chalk.dim(`  waltodo status ${job.id} --follow        # Follow progress`));
    }
    
    if (job.status === 'completed') {
      this.log(chalk.dim(`  waltodo status ${job.id} --verbose       # View detailed logs`));
    }
    
    if (job.status === 'failed') {
      this.log(chalk.dim(`  waltodo status ${job.id} --verbose       # View error details`));
      // Could add restart functionality in the future
      // this.log(chalk.dim(`  waltodo restart ${job.id}                # Retry this job`));
    }
    
    this.log(chalk.dim(`  waltodo jobs                             # View all jobs`));
  }

  /**
   * Follow job progress in real-time
   */
  private async followJobProgress(jobId: string, flags: any): Promise<void> {
    let job = jobManager.getJob(jobId);
    
    if (!job) {
      throw new CLIError(`Job not found: ${jobId}`, 'JOB_NOT_FOUND');
    }

    this.log(chalk.blue(`👀 Following job progress: ${jobId}`));
    this.log(chalk.dim(`Press Ctrl+C to stop following\n`));

    const refreshInterval = flags.refresh * 1000;
    let lastProgress = -1;
    let lastStatus = '';

    const updateDisplay = () => {
      job = jobManager.getJob(jobId);
      if (!job) {
        this.log(chalk.red('\n❌ Job no longer exists'));
        process.exit(1);
      }

      // Only update if progress or status changed
      if (job.progress !== lastProgress || job.status !== lastStatus) {
        const progressBar = this.createProgressBarVisual(job.progress, 30);
        const statusIcon = this.getStatusIcon(job.status);
        const duration = job.endTime ? job.endTime - job.startTime : Date.now() - job.startTime;
        const durationStr = this.formatDuration(duration);

        // Clear line and show progress
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(`${statusIcon} ${progressBar} ${job.progress}% | ${durationStr}`);

        if (job.processedItems !== undefined && job.totalItems !== undefined) {
          process.stdout.write(` | Items: ${job.processedItems}/${job.totalItems}`);
        }

        lastProgress = job.progress;
        lastStatus = job.status;
      }

      // Check if job is complete
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        process.stdout.write('\n\n');
        
        if (job.status === 'completed') {
          this.log(chalk.green('✅ Job completed successfully!'));
        } else if (job.status === 'failed') {
          this.log(chalk.red('❌ Job failed'));
          if (job.errorMessage) {
            this.log(chalk.red(`Error: ${job.errorMessage}`));
          }
        } else {
          this.log(chalk.yellow('⚪ Job was cancelled'));
        }
        
        // Show final summary
        this.showJobStatus(jobId, { verbose: job.status === 'failed' });
        return;
      }

      // Schedule next update
      setTimeout(updateDisplay, refreshInterval);
    };

    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      process.stdout.write('\n\n');
      this.log(chalk.yellow('👋 Stopped following job progress'));
      this.log(chalk.dim(`Job is still running. Check status with: waltodo status ${jobId}`));
      process.exit(0);
    });

    // Start following
    updateDisplay();
  }

  /**
   * Show data retrieval operation status
   */
  private async showRetrievalStatus(operationId: string, flags: any): Promise<void> {
    const status = await backgroundDataRetriever.getRetrievalStatus(operationId);
    
    if (!status) {
      throw new CLIError(`Retrieval operation not found: ${operationId}`, 'OPERATION_NOT_FOUND');
    }

    this.section(`Data Retrieval Status: ${operationId}`, this.getPhaseDisplay(status.phase));
    
    this.log(`Phase: ${this.getPhaseDisplay(status.phase)}`);
    this.log(`Progress: ${this.createProgressBarVisual(status.progress)} ${chalk.yellow(status.progress + '%')}`);
    
    if (status.currentItem) {
      this.log(`Current Item: ${chalk.cyan(status.currentItem)}`);
    }
    
    if (status.totalItems && status.processedItems !== undefined) {
      this.log(`Items: ${chalk.green(status.processedItems)}/${chalk.blue(status.totalItems)}`);
    }
    
    if (status.bytesTransferred && status.totalBytes) {
      const transferredMB = (status.bytesTransferred / 1024 / 1024).toFixed(2);
      const totalMB = (status.totalBytes / 1024 / 1024).toFixed(2);
      this.log(`Data: ${chalk.green(transferredMB)}/${chalk.blue(totalMB)} MB`);
    }
    
    if (status.chunksCompleted && status.totalChunks) {
      this.log(`Chunks: ${chalk.green(status.chunksCompleted)}/${chalk.blue(status.totalChunks)}`);
    }

    // Check if operation is complete and show result
    if (status.phase === 'complete') {
      const result = await backgroundDataRetriever.getRetrievalResult(operationId);
      
      if (result) {
        this.log(chalk.bold('\n📊 Retrieval Result:'));
        this.log(`Success: ${result.success ? chalk.green('✓') : chalk.red('✗')}`);
        
        if (result.metadata) {
          this.log(`Duration: ${chalk.yellow(this.formatDuration(result.metadata.duration))}`);
          this.log(`Items Retrieved: ${chalk.green(result.metadata.totalItems)}`);
          this.log(`Bytes Transferred: ${chalk.blue(this.formatBytes(result.metadata.bytesTransferred))}`);
          
          if (result.metadata.errors.length > 0) {
            this.log(`Errors: ${chalk.red(result.metadata.errors.length)}`);
            if (flags.verbose) {
              this.log(chalk.red('\nErrors:'));
              result.metadata.errors.forEach(error => {
                this.log(chalk.red(`  • ${error}`));
              });
            }
          }
        }
        
        if (result.error) {
          this.log(`Error: ${chalk.red(result.error.message)}`);
        }
      }
    }
  }

  /**
   * Show summary of all jobs
   */
  private showJobsSummary(flags: any): void {
    const allJobs = jobManager.getAllJobs();
    
    if (allJobs.length === 0) {
      this.info('No jobs found');
      return;
    }

    // Group jobs by status
    const jobsByStatus = {
      running: allJobs.filter(j => j.status === 'running'),
      pending: allJobs.filter(j => j.status === 'pending'),
      completed: allJobs.filter(j => j.status === 'completed'),
      failed: allJobs.filter(j => j.status === 'failed'),
      cancelled: allJobs.filter(j => j.status === 'cancelled'),
    };

    this.section('Jobs Summary', `${allJobs.length} total jobs`);

    // Show active jobs first
    const activeJobs = [...jobsByStatus.running, ...jobsByStatus.pending];
    if (activeJobs.length > 0) {
      this.log(chalk.bold(`\n🔄 Active Jobs (${activeJobs.length})`));
      this.log(chalk.gray('─'.repeat(50)));
      
      activeJobs.forEach(job => {
        const duration = Date.now() - job.startTime;
        const durationStr = this.formatDuration(duration);
        const progressBar = this.createProgressBarVisual(job.progress, 15);
        const statusIcon = this.getStatusIcon(job.status);
        
        this.log(`${statusIcon} ${job.id} - ${chalk.cyan(job.command)}`);
        this.log(`   ${progressBar} ${job.progress}% | ${chalk.gray(durationStr)}`);
        
        if (job.processedItems !== undefined && job.totalItems !== undefined) {
          this.log(`   Items: ${chalk.green(job.processedItems)}/${chalk.blue(job.totalItems)}`);
        }
        this.log('');
      });
    }

    // Show statistics
    this.log(chalk.bold('\n📊 Statistics'));
    this.log(chalk.gray('─'.repeat(30)));
    this.log(`Total Jobs: ${chalk.cyan(allJobs.length)}`);
    
    if (jobsByStatus.running.length > 0) {
      this.log(`Running: ${chalk.blue(jobsByStatus.running.length)}`);
    }
    if (jobsByStatus.pending.length > 0) {
      this.log(`Pending: ${chalk.yellow(jobsByStatus.pending.length)}`);
    }
    if (jobsByStatus.completed.length > 0) {
      this.log(`Completed: ${chalk.green(jobsByStatus.completed.length)}`);
    }
    if (jobsByStatus.failed.length > 0) {
      this.log(`Failed: ${chalk.red(jobsByStatus.failed.length)}`);
    }
    if (jobsByStatus.cancelled.length > 0) {
      this.log(`Cancelled: ${chalk.gray(jobsByStatus.cancelled.length)}`);
    }

    // Show recent completed/failed jobs if verbose
    if (flags.verbose) {
      const recentJobs = [...jobsByStatus.completed, ...jobsByStatus.failed]
        .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))
        .slice(0, 5);
        
      if (recentJobs.length > 0) {
        this.log(chalk.bold('\n📋 Recent Completed Jobs'));
        this.log(chalk.gray('─'.repeat(40)));
        
        recentJobs.forEach(job => {
          const statusIcon = this.getStatusIcon(job.status);
          const duration = job.endTime ? job.endTime - job.startTime : 0;
          const durationStr = this.formatDuration(duration);
          const timeAgo = job.endTime ? this.formatTimeAgo(Date.now() - job.endTime) : '';
          
          this.log(`${statusIcon} ${job.id} - ${chalk.cyan(job.command)} ${chalk.gray(`(${durationStr}, ${timeAgo} ago)`)}`);
        });
      }
    }

    // Show helpful commands
    this.log(chalk.gray('\n💡 Useful commands:'));
    this.log(chalk.gray('   waltodo status <job-id>      - View detailed job status'));
    this.log(chalk.gray('   waltodo status --latest      - View most recent job'));
    this.log(chalk.gray('   waltodo jobs                 - List all jobs'));
    this.log(chalk.gray('   waltodo cancel <job-id>      - Cancel a running job'));
  }

  /**
   * Get status display with color and icon
   */
  private getStatusDisplay(status: string): string {
    const icon = this.getStatusIcon(status);
    const color = this.getStatusColor(status);
    return `${icon} ${color(status.charAt(0).toUpperCase() + status.slice(1))}`;
  }

  /**
   * Get phase display for retrieval operations
   */
  private getPhaseDisplay(phase: string): string {
    const icons = {
      connecting: '🔗',
      fetching: '📥',
      processing: '⚙️',
      saving: '💾',
      complete: '✅',
    };
    
    const colors = {
      connecting: chalk.yellow,
      fetching: chalk.blue,
      processing: chalk.cyan,
      saving: chalk.green,
      complete: chalk.green,
    };
    
    const icon = icons[phase as keyof typeof icons] || '❓';
    const color = colors[phase as keyof typeof colors] || chalk.white;
    
    return `${icon} ${color(phase.charAt(0).toUpperCase() + phase.slice(1))}`;
  }

  /**
   * Get status icon
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'pending': return '⏳';
      case 'running': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'cancelled': return '⚪';
      default: return '❓';
    }
  }

  /**
   * Get status color function
   */
  private getStatusColor(status: string): (text: string) => string {
    switch (status) {
      case 'pending': return chalk.yellow;
      case 'running': return chalk.blue;
      case 'completed': return chalk.green;
      case 'failed': return chalk.red;
      case 'cancelled': return chalk.gray;
      default: return chalk.white;
    }
  }

  /**
   * Create progress bar
   */
  private createProgressBarVisual(progress: number, width: number = 20): string {
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;
    return chalk.green('[') + 
           chalk.green('█'.repeat(filled)) + 
           chalk.gray('░'.repeat(empty)) + 
           chalk.green(']');
  }

  /**
   * Format duration
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  }

  /**
   * Format bytes
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }

  /**
   * Format time ago
   */
  private formatTimeAgo(ms: number): string {
    if (ms < 60000) return 'just now';
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
    if (ms < 86400000) return `${Math.floor(ms / 3600000)}h`;
    return `${Math.floor(ms / 86400000)}d`;
  }
}