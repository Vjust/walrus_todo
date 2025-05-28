import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { JobManager, BackgroundJob, performanceMonitor } from './PerformanceMonitor';
import { Logger } from './Logger';
import chalk = require('chalk');
import { EventEmitter } from 'events';

export interface CommandProfile {
  command: string;
  expectedDuration: number; // milliseconds
  resourceIntensive: boolean;
  autoBackground: boolean;
  maxConcurrency: number;
  priority: 'low' | 'medium' | 'high';
  dependencies?: string[];
  timeoutMs?: number;
}

export interface BackgroundOptions {
  detached?: boolean;
  silent?: boolean;
  logOutput?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  priority?: 'low' | 'medium' | 'high';
  resourceLimits?: {
    maxMemory?: number;
    maxCpu?: number;
  };
}

export interface ProgressUpdate {
  jobId: string;
  progress: number;
  stage: string;
  details?: any;
  timestamp: number;
}

export interface ResourceUsage {
  memory: number;
  cpu: number;
  activeJobs: number;
  totalJobs: number;
}

/**
 * Universal background command orchestrator that enables all CLI commands
 * to run in background mode with unified progress tracking and resource management
 */
export class BackgroundCommandOrchestrator extends EventEmitter {
  private jobManager: JobManager;
  private logger: Logger;
  private commandProfiles: Map<string, CommandProfile> = new Map();
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private resourceMonitor: NodeJS.Timer | null = null;
  private maxConcurrentJobs = 10;
  private cleanupInterval: NodeJS.Timer | null = null;
  private progressUpdateInterval = 1000; // 1 second
  
  constructor(configDir?: string) {
    super();
    this.jobManager = new JobManager(configDir);
    this.logger = new Logger('BackgroundOrchestrator');
    this.initializeCommandProfiles();
    this.startResourceMonitoring();
    this.startCleanupScheduler();
  }

  /**
   * Initialize command profiles for auto-detection of long-running operations
   */
  private initializeCommandProfiles(): void {
    const profiles: CommandProfile[] = [
      {
        command: 'store',
        expectedDuration: 10000,
        resourceIntensive: true,
        autoBackground: true,
        maxConcurrency: 3,
        priority: 'medium',
        timeoutMs: 300000
      },
      {
        command: 'store-list',
        expectedDuration: 15000,
        resourceIntensive: true,
        autoBackground: true,
        maxConcurrency: 2,
        priority: 'medium',
        timeoutMs: 600000
      },
      {
        command: 'store-file',
        expectedDuration: 8000,
        resourceIntensive: true,
        autoBackground: true,
        maxConcurrency: 3,
        priority: 'medium',
        timeoutMs: 180000
      },
      {
        command: 'deploy',
        expectedDuration: 30000,
        resourceIntensive: true,
        autoBackground: true,
        maxConcurrency: 1,
        priority: 'high',
        timeoutMs: 900000
      },
      {
        command: 'sync',
        expectedDuration: 12000,
        resourceIntensive: false,
        autoBackground: true,
        maxConcurrency: 2,
        priority: 'medium',
        timeoutMs: 300000
      },
      {
        command: 'ai',
        expectedDuration: 5000,
        resourceIntensive: false,
        autoBackground: false,
        maxConcurrency: 5,
        priority: 'low',
        timeoutMs: 60000
      },
      {
        command: 'image',
        expectedDuration: 15000,
        resourceIntensive: true,
        autoBackground: true,
        maxConcurrency: 2,
        priority: 'medium',
        dependencies: ['store'],
        timeoutMs: 300000
      },
      {
        command: 'create-nft',
        expectedDuration: 20000,
        resourceIntensive: true,
        autoBackground: true,
        maxConcurrency: 2,
        priority: 'high',
        dependencies: ['image', 'deploy'],
        timeoutMs: 600000
      }
    ];

    profiles.forEach(profile => {
      this.commandProfiles.set(profile.command, profile);
    });

    this.logger.info(`Initialized ${profiles.length} command profiles`);
  }

  /**
   * Determine if a command should run in background based on various factors
   */
  public shouldRunInBackground(command: string, args: string[], flags: Record<string, any>): boolean {
    const profile = this.commandProfiles.get(command);
    
    // Explicit background flag
    if (flags.background || flags.bg) return true;
    if (flags.foreground || flags.fg) return false;
    
    // Auto-detection based on command profile
    if (profile?.autoBackground) {
      // Check if system resources allow
      const usage = this.getCurrentResourceUsage();
      if (usage.activeJobs >= this.maxConcurrentJobs) {
        this.logger.warn(`Max concurrent jobs reached (${this.maxConcurrentJobs}), forcing background`);
        return true;
      }
      
      // Check if command is resource intensive and system is under load
      if (profile.resourceIntensive && usage.memory > 0.8) {
        this.logger.info(`High memory usage detected, moving ${command} to background`);
        return true;
      }
      
      return profile.autoBackground;
    }
    
    // Default to foreground for unknown commands
    return false;
  }

  /**
   * Execute a command in background with full orchestration
   */
  public async executeInBackground(
    command: string,
    args: string[],
    flags: Record<string, any>,
    options: BackgroundOptions = {}
  ): Promise<string> {
    const profile = this.commandProfiles.get(command);
    
    // Check concurrency limits
    if (profile && !this.canStartNewJob(command)) {
      throw new Error(`Cannot start ${command}: concurrency limit reached or dependencies not met`);
    }

    // Create background job
    const job = this.jobManager.createJob(command, args, {
      ...flags,
      ...options,
      backgroundMode: true
    });

    this.logger.info(`Starting background job: ${job.id} for command: ${command}`);
    
    try {
      // Start the background process
      await this.startBackgroundProcess(job, options);
      
      this.emit('jobStarted', job);
      return job.id;
    } catch (error) {
      this.jobManager.failJob(job.id, error instanceof Error ? error.message : String(error));
      this.emit('jobFailed', job, error);
      throw error;
    }
  }

  /**
   * Start the actual background process
   */
  private async startBackgroundProcess(job: BackgroundJob, options: BackgroundOptions): Promise<void> {
    const profile = this.commandProfiles.get(job.command);
    const timeout = options.timeout || profile?.timeoutMs || 300000;
    
    // Build command arguments
    const execArgs = [
      ...job.args,
      ...this.flattenFlags(job.flags),
      '--quiet', // Reduce output in background
      '--output=json' // Structured output for parsing
    ];

    // Determine the executable
    const executable = this.getExecutablePath();
    const fullArgs = [job.command, ...execArgs];

    this.logger.debug(`Executing: ${executable} ${fullArgs.join(' ')}`);

    // Spawn the process
    const childProcess = spawn(executable, fullArgs, {
      detached: options.detached !== false,
      stdio: options.silent ? 'ignore' : ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        WALRUS_BACKGROUND_JOB: job.id,
        WALRUS_PARENT_PID: process.pid.toString()
      }
    });

    this.activeProcesses.set(job.id, childProcess);
    this.jobManager.startJob(job.id, childProcess.pid);

    // Set up progress monitoring
    this.setupProgressMonitoring(job, childProcess);
    
    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      this.logger.warn(`Job ${job.id} timed out after ${timeout}ms`);
      this.cancelJob(job.id);
    }, timeout);

    // Handle process completion
    childProcess.on('exit', (code, signal) => {
      clearTimeout(timeoutHandle);
      this.activeProcesses.delete(job.id);
      
      if (code === 0) {
        this.jobManager.completeJob(job.id, { exitCode: code });
        this.emit('jobCompleted', job);
        this.logger.info(`Job ${job.id} completed successfully`);
      } else {
        const errorMsg = signal ? `Killed by signal: ${signal}` : `Exit code: ${code}`;
        this.jobManager.failJob(job.id, errorMsg);
        this.emit('jobFailed', job, new Error(errorMsg));
        this.logger.error(`Job ${job.id} failed: ${errorMsg}`);
      }
    });

    childProcess.on('error', (error) => {
      clearTimeout(timeoutHandle);
      this.activeProcesses.delete(job.id);
      this.jobManager.failJob(job.id, error.message);
      this.emit('jobFailed', job, error);
      this.logger.error(`Job ${job.id} process error:`, error);
    });

    // Detach the process if requested
    if (options.detached !== false) {
      childProcess.unref();
    }
  }

  /**
   * Set up progress monitoring for a background job
   */
  private setupProgressMonitoring(job: BackgroundJob, process: ChildProcess): void {
    if (!process.stdout && !process.stderr) return;
    
    let outputBuffer = '';
    let progressRegex = /PROGRESS:(\d+):(.*)/;
    let stageRegex = /STAGE:(.*)/;
    
    const processOutput = (data: Buffer) => {
      outputBuffer += data.toString();
      const lines = outputBuffer.split('\n');
      outputBuffer = lines.pop() || '';
      
      lines.forEach(line => {
        // Write to job log
        this.jobManager.writeJobLog(job.id, line);
        
        // Parse progress updates
        const progressMatch = line.match(progressRegex);
        if (progressMatch) {
          const progress = parseInt(progressMatch[1]);
          const details = progressMatch[2];
          this.jobManager.updateProgress(job.id, progress);
          
          const update: ProgressUpdate = {
            jobId: job.id,
            progress,
            stage: details,
            timestamp: Date.now()
          };
          
          this.emit('progressUpdate', update);
        }
        
        // Parse stage updates
        const stageMatch = line.match(stageRegex);
        if (stageMatch) {
          const stage = stageMatch[1];
          this.jobManager.updateJob(job.id, {
            metadata: {
              ...job.metadata,
              currentStage: stage
            }
          });
        }
      });
    };
    
    if (process.stdout) {
      process.stdout.on('data', processOutput);
    }
    
    if (process.stderr) {
      process.stderr.on('data', processOutput);
    }
  }

  /**
   * Check if a new job can be started based on concurrency and dependencies
   */
  private canStartNewJob(command: string): boolean {
    const profile = this.commandProfiles.get(command);
    if (!profile) return true;
    
    // Check global concurrency
    const activeJobs = this.jobManager.getActiveJobs();
    if (activeJobs.length >= this.maxConcurrentJobs) {
      return false;
    }
    
    // Check command-specific concurrency
    const commandJobs = activeJobs.filter(job => job.command === command);
    if (commandJobs.length >= profile.maxConcurrency) {
      return false;
    }
    
    // Check dependencies
    if (profile.dependencies) {
      const hasRunningDependencies = profile.dependencies.some(dep => {
        return activeJobs.some(job => job.command === dep);
      });
      
      if (hasRunningDependencies) {
        this.logger.debug(`Cannot start ${command}: dependencies still running`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Cancel a background job
   */
  public cancelJob(jobId: string): boolean {
    const process = this.activeProcesses.get(jobId);
    if (process) {
      try {
        process.kill('SIGTERM');
        
        // Force kill if not terminated in 5 seconds
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }, 5000);
        
        this.activeProcesses.delete(jobId);
        return this.jobManager.cancelJob(jobId);
      } catch (error) {
        this.logger.error(`Failed to cancel job ${jobId}:`, error);
        return false;
      }
    }
    
    return this.jobManager.cancelJob(jobId);
  }

  /**
   * Get the status of all background jobs
   */
  public getJobStatus(): BackgroundJob[] {
    return this.jobManager.getAllJobs();
  }

  /**
   * Get the status of a specific job
   */
  public getJob(jobId: string): BackgroundJob | undefined {
    return this.jobManager.getJob(jobId);
  }

  /**
   * Wait for a job to complete
   */
  public async waitForJob(jobId: string, timeoutMs: number = 300000): Promise<BackgroundJob> {
    return new Promise((resolve, reject) => {
      const checkInterval = 1000;
      const startTime = Date.now();
      
      const check = () => {
        const job = this.jobManager.getJob(jobId);
        if (!job) {
          reject(new Error(`Job ${jobId} not found`));
          return;
        }
        
        if (job.status === 'completed') {
          resolve(job);
          return;
        }
        
        if (job.status === 'failed' || job.status === 'cancelled') {
          reject(new Error(`Job ${jobId} ${job.status}: ${job.errorMessage || 'Unknown error'}`));
          return;
        }
        
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error(`Timeout waiting for job ${jobId}`));
          return;
        }
        
        setTimeout(check, checkInterval);
      };
      
      check();
    });
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    this.resourceMonitor = setInterval(() => {
      const usage = this.getCurrentResourceUsage();
      
      this.emit('resourceUpdate', usage);
      
      // Auto-adjust concurrency based on resource usage
      if (usage.memory > 0.9 && this.maxConcurrentJobs > 2) {
        this.maxConcurrentJobs = Math.max(2, this.maxConcurrentJobs - 1);
        this.logger.warn(`High memory usage, reducing max concurrent jobs to ${this.maxConcurrentJobs}`);
      } else if (usage.memory < 0.5 && usage.cpu < 0.5 && this.maxConcurrentJobs < 10) {
        this.maxConcurrentJobs = Math.min(10, this.maxConcurrentJobs + 1);
        this.logger.info(`Low resource usage, increasing max concurrent jobs to ${this.maxConcurrentJobs}`);
      }
    }, 5000);
  }

  /**
   * Get current resource usage
   */
  private getCurrentResourceUsage(): ResourceUsage {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    const activeJobs = this.jobManager.getActiveJobs().length;
    const totalJobs = this.jobManager.getAllJobs().length;
    
    return {
      memory: usedMem / totalMem,
      cpu: 0, // TODO: Implement CPU usage monitoring
      activeJobs,
      totalJobs
    };
  }

  /**
   * Start cleanup scheduler for old jobs and logs
   */
  private startCleanupScheduler(): void {
    this.cleanupInterval = setInterval(() => {
      this.jobManager.cleanupOldJobs();
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Get the path to the CLI executable
   */
  private getExecutablePath(): string {
    // Try to find the waltodo executable
    const possiblePaths = [
      path.join(process.cwd(), 'bin', 'run'),
      path.join(process.cwd(), 'bin', 'run.js'),
      'waltodo',
      'npx waltodo'
    ];
    
    for (const execPath of possiblePaths) {
      if (fs.existsSync(execPath)) {
        return execPath;
      }
    }
    
    // Default to node with the run script
    return 'node';
  }

  /**
   * Convert flags object to command line arguments
   */
  private flattenFlags(flags: Record<string, any>): string[] {
    const args: string[] = [];
    
    Object.entries(flags).forEach(([key, value]) => {
      if (key === 'backgroundMode') return; // Internal flag
      
      if (typeof value === 'boolean') {
        if (value) {
          args.push(`--${key}`);
        }
      } else if (value !== undefined && value !== null) {
        args.push(`--${key}=${value}`);
      }
    });
    
    return args;
  }

  /**
   * Generate a comprehensive status report
   */
  public generateStatusReport(): string {
    const jobs = this.jobManager.getAllJobs();
    const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'pending');
    const completedJobs = jobs.filter(j => j.status === 'completed');
    const failedJobs = jobs.filter(j => j.status === 'failed');
    const usage = this.getCurrentResourceUsage();
    
    let report = chalk.bold.cyan('🔄 Background Command Orchestrator Status\n');
    report += chalk.gray('─'.repeat(50)) + '\n\n';
    
    // Resource usage
    report += chalk.bold('📊 Resource Usage:\n');
    report += `  Memory: ${(usage.memory * 100).toFixed(1)}%\n`;
    report += `  Active Jobs: ${usage.activeJobs}/${this.maxConcurrentJobs}\n`;
    report += `  Total Jobs: ${usage.totalJobs}\n\n`;
    
    // Active jobs
    if (activeJobs.length > 0) {
      report += chalk.bold('🔄 Active Jobs:\n');
      activeJobs.forEach(job => {
        const duration = Date.now() - job.startTime;
        const progress = job.progress || 0;
        const progressBar = this.createProgressBar(progress);
        
        report += `  ${this.getStatusIcon(job.status)} ${job.id}\n`;
        report += `    Command: ${job.command} ${job.args.join(' ')}\n`;
        report += `    Progress: ${progressBar} ${progress}%\n`;
        report += `    Duration: ${this.formatDuration(duration)}\n`;
        if (job.metadata?.currentStage) {
          report += `    Stage: ${job.metadata.currentStage}\n`;
        }
        report += '\n';
      });
    } else {
      report += chalk.gray('💤 No active jobs\n\n');
    }
    
    // Recent completions
    if (completedJobs.length > 0) {
      const recentCompleted = completedJobs
        .filter(j => j.endTime && Date.now() - j.endTime < 24 * 60 * 60 * 1000)
        .slice(0, 5);
      
      if (recentCompleted.length > 0) {
        report += chalk.bold('✅ Recent Completions:\n');
        recentCompleted.forEach(job => {
          const duration = job.endTime! - job.startTime;
          report += `  ✅ ${job.command} (${this.formatDuration(duration)})\n`;
        });
        report += '\n';
      }
    }
    
    // Failed jobs
    if (failedJobs.length > 0) {
      const recentFailed = failedJobs
        .filter(j => j.endTime && Date.now() - j.endTime < 24 * 60 * 60 * 1000)
        .slice(0, 3);
      
      if (recentFailed.length > 0) {
        report += chalk.bold('❌ Recent Failures:\n');
        recentFailed.forEach(job => {
          report += `  ❌ ${job.command}: ${job.errorMessage || 'Unknown error'}\n`;
        });
        report += '\n';
      }
    }
    
    // Command profiles
    report += chalk.bold('⚙️ Command Profiles:\n');
    this.commandProfiles.forEach((profile, command) => {
      const activeCount = activeJobs.filter(j => j.command === command).length;
      report += `  ${command}: ${activeCount}/${profile.maxConcurrency} active\n`;
    });
    
    return report;
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

  private createProgressBar(progress: number, width: number = 20): string {
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;
    return `[${chalk.green('█'.repeat(filled))}${' '.repeat(empty)}]`;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  }

  /**
   * Shutdown the orchestrator and cleanup resources
   */
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Background Command Orchestrator');
    
    // Stop monitoring
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor as NodeJS.Timeout);
      this.resourceMonitor = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval as NodeJS.Timeout);
      this.cleanupInterval = null;
    }
    
    // Cancel all active jobs
    const activeJobs = this.jobManager.getActiveJobs();
    const cancelPromises = activeJobs.map(job => this.cancelJob(job.id));
    await Promise.all(cancelPromises);
    
    // Clear active processes
    this.activeProcesses.clear();
    
    this.emit('shutdown');
  }
}

// Singleton instance
export const backgroundOrchestrator = new BackgroundCommandOrchestrator();

// Process cleanup
process.on('SIGINT', () => {
  backgroundOrchestrator.shutdown().then(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  backgroundOrchestrator.shutdown().then(() => {
    process.exit(0);
  });
});