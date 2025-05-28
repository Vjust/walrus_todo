import { Args, Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import { jobManager } from '../utils/PerformanceMonitor';
import { backgroundOrchestrator } from '../utils/BackgroundCommandOrchestrator';
import chalk = require('chalk');

/**
 * @class JobsCommand
 * @description List and manage background jobs
 */
export default class JobsCommand extends BaseCommand {
  static description = 'List and manage background jobs\n\nShow all background operations, their status, and progress. Use filters to show only specific job types or statuses.';

  static examples = [
    '<%= config.bin %> jobs                           # List all jobs',
    '<%= config.bin %> jobs --active                  # List only active jobs', 
    '<%= config.bin %> jobs --completed               # List only completed jobs',
    '<%= config.bin %> jobs --failed                  # List only failed jobs',
    '<%= config.bin %> jobs --cleanup                 # Clean up old completed jobs',
    '<%= config.bin %> jobs --json                    # Output in JSON format',
    '<%= config.bin %> jobs status <job-id>           # Show detailed job status',
    '<%= config.bin %> jobs cancel <job-id>           # Cancel a running job',
    '<%= config.bin %> jobs logs <job-id>             # Show job logs',
    '<%= config.bin %> jobs report                    # Show comprehensive status report',
  ];

  static flags = {
    ...BaseCommand.flags,
    active: Flags.boolean({
      char: 'a',
      description: 'Show only active (pending/running) jobs',
      default: false,
    }),
    completed: Flags.boolean({
      char: 'c', 
      description: 'Show only completed jobs',
      default: false,
    }),
    failed: Flags.boolean({
      char: 'f',
      description: 'Show only failed jobs',
      default: false,
    }),
    cleanup: Flags.boolean({
      description: 'Clean up old completed jobs (older than 7 days)',
      default: false,
    }),
    'max-age': Flags.integer({
      description: 'Maximum age for cleanup in days',
      default: 7,
      min: 1,
    }),
    limit: Flags.integer({
      char: 'l',
      description: 'Limit number of jobs to display',
      default: 20,
      min: 1,
    }),
    watch: Flags.boolean({
      char: 'w',
      description: 'Watch for job updates',
      default: false,
    }),
    status: Flags.boolean({
      description: 'Show orchestrator status report',
      default: false,
    }),
  };

  static args = {
    action: Args.string({
      name: 'action',
      description: 'Action: list, status, cancel, logs, report',
      required: false,
    }),
    jobId: Args.string({
      name: 'jobId',
      description: 'Job ID for status, cancel, or logs actions',
      required: false,
    }),
  };

  async run() {
    const { args, flags } = await this.parse(JobsCommand);
    const action = args.action || 'list';

    // Handle orchestrator status report
    if (flags.status || action === 'report') {
      this.log(backgroundOrchestrator.generateStatusReport());
      return;
    }

    // Handle specific actions
    switch (action) {
      case 'status':
        return this.showJobStatus(args.jobId, flags);
      case 'cancel':
        return this.cancelJob(args.jobId);
      case 'logs':
        return this.showJobLogs(args.jobId);
      case 'report':
        this.log(backgroundOrchestrator.generateStatusReport());
        return;
    }

    // Handle cleanup operation
    if (flags.cleanup) {
      return this.handleCleanup(flags['max-age']);
    }

    // Get jobs based on filters - use both job manager and orchestrator
    let jobs = [...jobManager.getAllJobs(), ...backgroundOrchestrator.getJobStatus()];
    
    // Remove duplicates by ID
    const uniqueJobs = jobs.filter((job, index, self) => 
      index === self.findIndex(j => j.id === job.id)
    );

    if (flags.active) {
      jobs = uniqueJobs.filter(job => job.status === 'pending' || job.status === 'running');
    } else if (flags.completed) {
      jobs = uniqueJobs.filter(job => job.status === 'completed');
    } else if (flags.failed) {
      jobs = uniqueJobs.filter(job => job.status === 'failed');
    } else {
      jobs = uniqueJobs;
    }

    // Apply limit
    jobs = jobs.slice(0, flags.limit);

    // Handle JSON output
    if (flags.output === 'json') {
      this.log(JSON.stringify(jobs, null, 2));
      return;
    }

    // Handle watch mode
    if (flags.watch) {
      return this.watchJobs(jobs);
    }

    // Display jobs
    if (jobs.length === 0) {
      this.displayNoJobs(flags);
      return;
    }

    this.displayJobs(jobs, flags);
  }

  private async handleCleanup(maxAgeDays: number): Promise<void> {
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    
    this.log(chalk.yellow(`🧹 Cleaning up jobs older than ${maxAgeDays} days...`));
    
    const removedCount = jobManager.cleanupOldJobs(maxAgeMs);
    
    if (removedCount > 0) {
      this.success(`Cleaned up ${removedCount} old jobs`);
    } else {
      this.info('No old jobs to clean up');
    }
  }

  private displayNoJobs(flags: any): void {
    let message = 'No jobs found';
    
    if (flags.active) {
      message = 'No active jobs running';
      this.info(message);
      this.log(chalk.gray('💡 Use --background flag with commands to run them in background'));
    } else if (flags.completed) {
      message = 'No completed jobs found';
      this.info(message);
    } else if (flags.failed) {
      message = 'No failed jobs found';
      this.info(message);
    } else {
      this.info(message);
      this.log(chalk.gray('💡 Background jobs will appear here when created'));
    }
  }

  private displayJobs(jobs: any[], flags: any): void {
    // Display header
    const statusFilter = flags.active ? 'Active' : flags.completed ? 'Completed' : flags.failed ? 'Failed' : 'All';
    this.section(`${statusFilter} Background Jobs`, `Found ${jobs.length} job(s)`);

    // Group jobs by status for better organization
    const groupedJobs = this.groupJobsByStatus(jobs);

    // Display each status group
    Object.entries(groupedJobs).forEach(([status, statusJobs]) => {
      if (statusJobs.length === 0) return;

      const statusIcon = this.getStatusIcon(status);
      const statusColor = this.getStatusColor(status);
      
      this.log(chalk.bold(`\n${statusIcon} ${statusColor(status.toUpperCase())} (${statusJobs.length})`));
      this.log(chalk.gray('─'.repeat(60)));

      statusJobs.forEach(job => {
        this.displayJob(job);
      });
    });

    // Display summary
    this.displayJobsSummary(jobs);
  }

  private groupJobsByStatus(jobs: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {
      running: [],
      pending: [],
      completed: [],
      failed: [],
      cancelled: []
    };

    jobs.forEach(job => {
      if (groups[job.status]) {
        groups[job.status].push(job);
      }
    });

    return groups;
  }

  private displayJob(job: any): void {
    const duration = job.endTime ? job.endTime - job.startTime : Date.now() - job.startTime;
    const durationStr = this.formatDuration(duration);
    const progressBar = this.createTextProgressBar(job.progress);
    
    // Main job info
    const argsStr = Array.isArray(job.args) ? job.args.join(' ') : (job.args || '');
    this.log(`${chalk.bold(job.id)} - ${chalk.cyan(job.command)} ${argsStr}`);
    
    // Progress and timing
    this.log(`  ${progressBar} ${chalk.yellow(job.progress + '%')} | ${chalk.gray(durationStr)}`);
    
    // Items processed (if available)
    if (job.processedItems !== undefined && job.totalItems !== undefined) {
      this.log(`  Items: ${chalk.green(job.processedItems)}/${chalk.blue(job.totalItems)}`);
    }
    
    // Error message (if failed)
    if (job.status === 'failed' && job.errorMessage) {
      this.log(`  ${chalk.red('Error:')} ${job.errorMessage}`);
    }
    
    // Started time
    const startedAt = new Date(job.startTime).toLocaleString();
    this.log(`  ${chalk.gray('Started:')} ${startedAt}`);
    
    this.log(''); // Empty line for spacing
  }

  private displayJobsSummary(jobs: any[]): void {
    const summary = {
      total: jobs.length,
      running: jobs.filter(j => j.status === 'running').length,
      pending: jobs.filter(j => j.status === 'pending').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      cancelled: jobs.filter(j => j.status === 'cancelled').length,
    };

    this.log(chalk.bold('\n📊 Summary'));
    this.log(chalk.gray('─'.repeat(30)));
    this.log(`Total: ${chalk.cyan(summary.total)}`);
    
    if (summary.running > 0) this.log(`Running: ${chalk.blue(summary.running)}`);
    if (summary.pending > 0) this.log(`Pending: ${chalk.yellow(summary.pending)}`);
    if (summary.completed > 0) this.log(`Completed: ${chalk.green(summary.completed)}`);
    if (summary.failed > 0) this.log(`Failed: ${chalk.red(summary.failed)}`);
    if (summary.cancelled > 0) this.log(`Cancelled: ${chalk.gray(summary.cancelled)}`);

    // Show helpful commands
    this.log(chalk.gray('\n💡 Useful commands:'));
    this.log(chalk.gray('   waltodo status <job-id>  - View detailed job status'));
    this.log(chalk.gray('   waltodo cancel <job-id>  - Cancel a running job'));
    this.log(chalk.gray('   waltodo jobs --cleanup   - Clean up old completed jobs'));
  }

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

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  }

  private createTextProgressBar(progress: number, width: number = 20): string {
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;
    return chalk.green('[') + 
           chalk.green('█'.repeat(filled)) + 
           chalk.gray(' '.repeat(empty)) + 
           chalk.green(']');
  }

  private async showJobStatus(jobId: string | undefined, flags: any): Promise<void> {
    if (!jobId) {
      this.error('Job ID is required for status command', { exit: 1 });
    }

    const job = backgroundOrchestrator.getJob(jobId) || jobManager.getJob(jobId);
    if (!job) {
      this.error(`Job not found: ${jobId}`, { exit: 1 });
    }

    this.log(chalk.bold.cyan(`\n🔍 Job Status: ${job.id}\n`));
    
    this.log(`Command: ${chalk.bold(job.command)} ${job.args.join(' ')}`);
    this.log(`Status: ${this.getStatusIcon(job.status)} ${chalk.bold(job.status.toUpperCase())}`);
    
    const duration = job.endTime ? job.endTime - job.startTime : Date.now() - job.startTime;
    this.log(`Duration: ${this.formatDuration(duration)}`);
    
    if (job.progress > 0) {
      const progressBar = this.createTextProgressBar(job.progress, 30);
      this.log(`Progress: ${progressBar} ${job.progress}%`);
    }
    
    if (job.metadata?.currentStage) {
      this.log(`Current Stage: ${job.metadata.currentStage}`);
    }
    
    if (job.processedItems && job.totalItems) {
      this.log(`Items Processed: ${job.processedItems}/${job.totalItems}`);
    }
    
    if (job.pid) {
      this.log(`Process ID: ${job.pid}`);
    }
    
    if (job.errorMessage) {
      this.log(`\n${chalk.red('Error:')} ${job.errorMessage}`);
    }
    
    if (job.logFile) {
      this.log(`\n${chalk.gray('💡 View logs with:')} waltodo jobs logs ${job.id}`);
    }
  }

  private async cancelJob(jobId: string | undefined): Promise<void> {
    if (!jobId) {
      this.error('Job ID is required for cancel command', { exit: 1 });
    }

    const job = backgroundOrchestrator.getJob(jobId) || jobManager.getJob(jobId);
    if (!job) {
      this.error(`Job not found: ${jobId}`, { exit: 1 });
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      this.log(chalk.yellow(`Job ${jobId} is already ${job.status}`));
      return;
    }

    const confirmed = await this.confirm(`Cancel job ${jobId} (${job.command})?`);
    if (!confirmed) {
      this.log('Cancelled');
      return;
    }

    const success = backgroundOrchestrator.cancelJob(jobId);
    if (success) {
      this.log(chalk.green(`✅ Job ${jobId} cancelled`));
    } else {
      this.error(`Failed to cancel job ${jobId}`, { exit: 1 });
    }
  }

  private async showJobLogs(jobId: string | undefined): Promise<void> {
    if (!jobId) {
      this.error('Job ID is required for logs command', { exit: 1 });
    }

    const job = backgroundOrchestrator.getJob(jobId) || jobManager.getJob(jobId);
    if (!job) {
      this.error(`Job not found: ${jobId}`, { exit: 1 });
    }

    // Try to read logs from the job manager
    const logContent = jobManager.readJobLog(jobId);
    
    if (!logContent) {
      this.log(chalk.gray('No logs available for this job'));
      return;
    }

    this.log(chalk.bold.cyan(`\n📄 Job Logs: ${jobId}\n`));
    this.log(logContent);
  }

  private async watchJobs(jobs: any[]): Promise<void> {
    this.log('👀 Watching jobs (Press Ctrl+C to stop)...');
    
    const interval = setInterval(() => {
      // Clear screen and show updated job list
      process.stdout.write('\x1Bc');
      
      // Get fresh job data
      const allJobs = [...jobManager.getAllJobs(), ...backgroundOrchestrator.getJobStatus()];
      const uniqueJobs = allJobs.filter((job, index, self) => 
        index === self.findIndex(j => j.id === job.id)
      );
      
      this.displayJobs(uniqueJobs.slice(0, 20), {});
      this.log(chalk.gray('\n👀 Watching for updates... Press Ctrl+C to stop'));
    }, 2000);

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      clearInterval(interval);
      this.log('\n👋 Stopped watching jobs');
      process.exit(0);
    });
  }
}