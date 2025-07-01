/**
 * Background Command Orchestrator - Functional Composition
 * 
 * This module composes the functional sub-modules to create
 * a complete background command orchestration system.
 */

import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';
import chalk = require('chalk');
import { Logger } from '../Logger';
import { BackgroundJob, JobManager } from '../PerformanceMonitor';

// Import functional modules
import {
  JobQueueState,
  JobAction,
  jobQueueReducer,
  createInitialState as createInitialJobState,
  getJob,
  getAllJobs,
  getActiveJobs,
  canStartNewJob,
  CommandProfile,
} from './job-queue';

import {
  ResourceState,
  ResourceAction,
  resourceReducer,
  createInitialResourceState,
  calculateResourceUsage,
  shouldForceBackground,
  calculateMaxConcurrency,
  adaptiveStrategy,
  ResourceAdvice,
} from './resource-monitor';

import {
  ProcessConfig,
  BackgroundOptions,
  createProcessConfig,
  createProcessSpawner,
  createProcessManager,
  createOutputParser,
  attachProcessHandlers,
  createTimeoutManager,
  ProcessHandlers,
} from './process-spawner';

import {
  ProgressState,
  ProgressAction,
  progressReducer,
  createInitialProgressState,
  createProgressEmitter,
  createProgressEvent,
  createFilePersistence,
  ProgressUpdate,
  formatProgress,
  formatDuration,
  getStatusIcon,
  createProgressBar,
} from './progress-tracker';

// Types
export interface OrchestratorState {
  jobs: JobQueueState;
  resources: ResourceState;
  progress: ProgressState;
}

export interface OrchestratorConfig {
  configDir?: string;
  maxConcurrentJobs?: number;
  resourceStrategy?: 'conservative' | 'aggressive' | 'adaptive';
  progressUpdateInterval?: number;
}

export interface BackgroundOrchestrator {
  shouldRunInBackground: (command: string, args: string[], flags: Record<string, unknown>) => boolean;
  executeInBackground: (
    command: string,
    args: string[],
    flags: Record<string, unknown>,
    options?: BackgroundOptions
  ) => Promise<string>;
  cancelJob: (jobId: string) => boolean;
  getJobStatus: () => BackgroundJob[];
  getJob: (jobId: string) => BackgroundJob | undefined;
  waitForJob: (jobId: string, timeoutMs?: number) => Promise<BackgroundJob>;
  generateStatusReport: () => string;
  shutdown: () => Promise<void>;
  on: (event: string, listener: (...args: any[]) => void) => void;
  off: (event: string, listener: (...args: any[]) => void) => void;
}

// Factory function to create the orchestrator
export function createOrchestrator(config: OrchestratorConfig = {}): BackgroundOrchestrator {
  // Initialize state
  let state: OrchestratorState = {
    jobs: createInitialJobState(),
    resources: createInitialResourceState(),
    progress: createInitialProgressState(),
  };

  // Dependencies
  const logger = new Logger('BackgroundOrchestrator');
  const jobManager = new JobManager(config.configDir);
  const emitter = createProgressEmitter();
  const processManager = createProcessManager();
  const outputParser = createOutputParser();
  const persistence = createFilePersistence(config.configDir || '.waltodo-cache');
  
  // Active processes map
  const activeProcesses = new Map<string, ChildProcess>();
  
  // Intervals for monitoring
  let resourceMonitorInterval: NodeJS.Timer | null = null;
  let cleanupInterval: NodeJS.Timer | null = null;

  // State update function
  function updateState(update: Partial<OrchestratorState>) {
    state = { ...state, ...update };
  }

  // Job dispatch function
  function dispatchJob(action: JobAction) {
    updateState({ jobs: jobQueueReducer(state.jobs, action) });
  }

  // Resource dispatch function
  function dispatchResource(action: ResourceAction) {
    updateState({ resources: resourceReducer(state.resources, action) });
  }

  // Progress dispatch function
  function dispatchProgress(action: ProgressAction) {
    updateState({ progress: progressReducer(state.progress, action) });
  }

  // Initialize monitoring
  function startMonitoring() {
    // Resource monitoring
    resourceMonitorInterval = setInterval(() => {
      const activeJobs = getActiveJobs(state.jobs);
      const usage = calculateResourceUsage(activeJobs.length, getAllJobs(state.jobs).length);
      
      dispatchResource({ type: 'UPDATE_USAGE', payload: usage });
      emitter.emit('resourceUpdate', usage);
      
      // Apply resource strategy
      const advice = adaptiveStrategy.evaluate(state.resources);
      applyResourceAdvice(advice);
    }, 5000);

    // Cleanup old jobs
    cleanupInterval = setInterval(() => {
      dispatchJob({ type: 'CLEANUP_OLD_JOBS', payload: { maxAge: 24 * 60 * 60 * 1000 } });
      jobManager.cleanupOldJobs();
    }, 60 * 60 * 1000); // Every hour
  }

  function applyResourceAdvice(advice: ResourceAdvice) {
    if (advice.adjustConcurrency !== undefined) {
      dispatchJob({ type: 'SET_MAX_CONCURRENT', payload: advice.adjustConcurrency });
      logger.info(advice.message || `Adjusted max concurrent jobs to ${advice.adjustConcurrency}`);
    }
    
    if (advice.killLowPriorityJobs) {
      const activeJobs = getActiveJobs(state.jobs);
      const lowPriorityJobs = activeJobs.filter(job => {
        const profile = state.jobs.commandProfiles.get(job.command);
        return profile?.priority === 'low';
      });
      
      lowPriorityJobs.forEach(job => cancelJobInternal(job.id));
    }
  }

  // Process monitoring setup
  function setupProcessMonitoring(job: BackgroundJob, process: ChildProcess) {
    let outputBuffer = '';
    
    const processOutput = (data: Buffer) => {
      outputBuffer += data.toString();
      const lines = outputBuffer.split('\n');
      outputBuffer = lines.pop() || '';
      
      lines.forEach(line => {
        // Save to log
        jobManager.writeJobLog(job.id, line);
        dispatchProgress({ type: 'ADD_LOG', payload: { jobId: job.id, line } });
        
        // Parse progress
        const progressInfo = outputParser.parseProgress(line);
        if (progressInfo) {
          dispatchJob({
            type: 'UPDATE_PROGRESS',
            payload: { jobId: job.id, progress: progressInfo.progress }
          });
          
          const update: ProgressUpdate = {
            jobId: job.id,
            progress: progressInfo.progress,
            stage: progressInfo.details,
            timestamp: Date.now(),
          };
          
          dispatchProgress({ type: 'ADD_PROGRESS', payload: update });
          emitter.emit('progressUpdate', update);
          
          // Persist event
          persistence.saveEvent(createProgressEvent('progress', job.id, progressInfo));
        }
        
        // Parse stage
        const stage = outputParser.parseStage(line);
        if (stage) {
          dispatchProgress({ type: 'SET_STAGE', payload: { jobId: job.id, stage } });
          dispatchJob({
            type: 'UPDATE_JOB',
            payload: {
              jobId: job.id,
              updates: { metadata: { ...job.metadata, currentStage: stage } }
            }
          });
        }
      });
    };
    
    const handlers: ProcessHandlers = {
      onExit: (code, signal) => {
        activeProcesses.delete(job.id);
        
        if (code === 0) {
          dispatchJob({ type: 'COMPLETE_JOB', payload: { jobId: job.id } });
          jobManager.completeJob(job.id, { exitCode: code });
          emitter.emit('jobCompleted', job);
          logger.info(`Job ${job.id} completed successfully`);
        } else {
          const errorMsg = signal ? `Killed by signal: ${signal}` : `Exit code: ${code}`;
          dispatchJob({ type: 'FAIL_JOB', payload: { jobId: job.id, error: errorMsg } });
          jobManager.failJob(job.id, errorMsg);
          emitter.emit('jobFailed', job, new Error(errorMsg));
          logger.error(`Job ${job.id} failed: ${errorMsg}`);
        }
      },
      
      onError: (error) => {
        activeProcesses.delete(job.id);
        dispatchJob({ type: 'FAIL_JOB', payload: { jobId: job.id, error: error.message } });
        jobManager.failJob(job.id, error.message);
        emitter.emit('jobFailed', job, error);
        logger.error(`Job ${job.id} process error:`, error);
      },
      
      onStdout: processOutput,
      onStderr: processOutput,
    };
    
    attachProcessHandlers(process, handlers);
  }

  // Start background process
  async function startBackgroundProcess(job: BackgroundJob, options: BackgroundOptions): Promise<void> {
    const profile = state.jobs.commandProfiles.get(job.command);
    const timeout = options.timeout || profile?.timeoutMs || 300000;
    
    const config = createProcessConfig(job, options);
    const spawnProcess = createProcessSpawner(config);
    const childProcess = spawnProcess();
    
    activeProcesses.set(job.id, childProcess);
    dispatchJob({ type: 'START_JOB', payload: { jobId: job.id, pid: childProcess.pid } });
    jobManager.startJob(job.id, childProcess.pid);
    
    setupProcessMonitoring(job, childProcess);
    
    // Set up timeout
    const timeoutManager = createTimeoutManager(timeout);
    timeoutManager.start(() => {
      logger.warn(`Job ${job.id} timed out after ${timeout}ms`);
      cancelJobInternal(job.id);
    });
    
    // Cancel timeout on process exit
    childProcess.on('exit', () => timeoutManager.cancel());
    
    // Detach if requested
    if (options.detached !== false) {
      childProcess.unref();
    }
  }

  // Cancel job internal function
  function cancelJobInternal(jobId: string): boolean {
    const process = activeProcesses.get(jobId);
    if (process) {
      const killed = processManager.forceKillProcess(process);
      if (killed) {
        activeProcesses.delete(jobId);
      }
    }
    
    dispatchJob({ type: 'CANCEL_JOB', payload: { jobId } });
    return jobManager.cancelJob(jobId);
  }

  // Initialize monitoring on creation
  startMonitoring();

  // Return the public API
  return {
    shouldRunInBackground(command: string, args: string[], flags: Record<string, unknown>): boolean {
      const profile = state.jobs.commandProfiles.get(command);
      
      // Explicit flags
      if (flags.background || flags.bg) return true;
      if (flags.foreground || flags.fg) return false;
      
      // Auto-detection
      if (profile?.autoBackground) {
        const usage = state.resources.current;
        
        // Check concurrency
        if (usage.activeJobs >= state.jobs.maxConcurrentJobs) {
          logger.warn(`Max concurrent jobs reached (${state.jobs.maxConcurrentJobs}), forcing background`);
          return true;
        }
        
        // Check resources
        if (shouldForceBackground(usage, profile.resourceIntensive)) {
          logger.info(`Resource constraints detected, moving ${command} to background`);
          return true;
        }
        
        return profile.autoBackground;
      }
      
      return false;
    },

    async executeInBackground(
      command: string,
      args: string[],
      flags: Record<string, unknown>,
      options: BackgroundOptions = {}
    ): Promise<string> {
      // Check if can start
      if (!canStartNewJob(state.jobs, command)) {
        throw new Error(
          `Cannot start ${command}: concurrency limit reached or dependencies not met`
        );
      }
      
      // Create job through JobManager for compatibility
      const job = jobManager.createJob(command, args, {
        ...flags,
        ...options,
        backgroundMode: true,
      });
      
      // Add to state
      dispatchJob({
        type: 'CREATE_JOB',
        payload: { command, args, flags: { ...flags, ...options } }
      });
      
      logger.info(`Starting background job: ${job.id} for command: ${command}`);
      
      try {
        await startBackgroundProcess(job, options);
        emitter.emit('jobStarted', job);
        return job.id;
      } catch (error) {
        dispatchJob({
          type: 'FAIL_JOB',
          payload: { jobId: job.id, error: error instanceof Error ? error.message : String(error) }
        });
        jobManager.failJob(job.id, error instanceof Error ? error.message : String(error));
        emitter.emit('jobFailed', job, error);
        throw error;
      }
    },

    cancelJob(jobId: string): boolean {
      return cancelJobInternal(jobId);
    },

    getJobStatus(): BackgroundJob[] {
      return jobManager.getAllJobs();
    },

    getJob(jobId: string): BackgroundJob | undefined {
      return jobManager.getJob(jobId);
    },

    async waitForJob(jobId: string, timeoutMs: number = 300000): Promise<BackgroundJob> {
      return new Promise((resolve, reject) => {
        const checkInterval = 1000;
        const startTime = Date.now();
        
        const check = () => {
          const job = jobManager.getJob(jobId);
          if (!job) {
            reject(new Error(`Job ${jobId} not found`));
            return;
          }
          
          if (job.status === 'completed') {
            resolve(job);
            return;
          }
          
          if (job.status === 'failed' || job.status === 'cancelled') {
            reject(new Error(
              `Job ${jobId} ${job.status}: ${job.errorMessage || 'Unknown error'}`
            ));
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
    },

    generateStatusReport(): string {
      const jobs = jobManager.getAllJobs();
      const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'pending');
      const completedJobs = jobs.filter(j => j.status === 'completed');
      const failedJobs = jobs.filter(j => j.status === 'failed');
      const usage = state.resources.current;
      
      let report = chalk.bold.cyan('🔄 Background Command Orchestrator Status\n');
      report += chalk.gray('─'.repeat(50)) + '\n\n';
      
      // Resource usage
      report += chalk.bold('📊 Resource Usage:\n');
      report += `  Memory: ${(usage.memory * 100).toFixed(1)}%\n`;
      report += `  Active Jobs: ${usage.activeJobs}/${state.jobs.maxConcurrentJobs}\n`;
      report += `  Total Jobs: ${usage.totalJobs}\n\n`;
      
      // Active jobs
      if (activeJobs.length > 0) {
        report += chalk.bold('🔄 Active Jobs:\n');
        activeJobs.forEach(job => {
          const duration = Date.now() - job.startTime;
          const progress = job.progress || 0;
          const progressBar = createProgressBar(progress, 20);
          
          report += `  ${getStatusIcon(job.status)} ${job.id}\n`;
          report += `    Command: ${job.command} ${job.args.join(' ')}\n`;
          report += `    Progress: ${progressBar} ${progress}%\n`;
          report += `    Duration: ${formatDuration(duration)}\n`;
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
            report += `  ✅ ${job.command} (${formatDuration(duration)})\n`;
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
      state.jobs.commandProfiles.forEach((profile, command) => {
        const activeCount = activeJobs.filter(j => j.command === command).length;
        report += `  ${command}: ${activeCount}/${profile.maxConcurrency} active\n`;
      });
      
      return report;
    },

    async shutdown(): Promise<void> {
      logger.info('Shutting down Background Command Orchestrator');
      
      // Stop monitoring
      if (resourceMonitorInterval) {
        clearInterval(resourceMonitorInterval as NodeJS.Timeout);
        resourceMonitorInterval = null;
      }
      
      if (cleanupInterval) {
        clearInterval(cleanupInterval as NodeJS.Timeout);
        cleanupInterval = null;
      }
      
      // Cancel all active jobs
      const activeJobs = getActiveJobs(state.jobs);
      const cancelPromises = activeJobs.map(job => cancelJobInternal(job.id));
      await Promise.all(cancelPromises);
      
      // Clear active processes
      activeProcesses.clear();
      
      // Save state
      await persistence.save(state.progress);
      
      emitter.emit('shutdown');
    },

    on(event: string, listener: (...args: any[]) => void) {
      emitter.on(event, listener);
    },

    off(event: string, listener: (...args: any[]) => void) {
      emitter.off(event, listener);
    },
  };
}

// Singleton management
let _orchestrator: BackgroundOrchestrator | null = null;

export function getBackgroundOrchestrator(): BackgroundOrchestrator {
  if (
    process.env.WALTODO_SKIP_ORCHESTRATOR === 'true' ||
    process.env.WALTODO_NO_BACKGROUND === 'true'
  ) {
    throw new Error('Background orchestrator disabled');
  }
  
  if (!_orchestrator) {
    _orchestrator = createOrchestrator();
    
    // Store reference for test cleanup
    if (process.env.NODE_ENV === 'test') {
      (global).backgroundOrchestrator = _orchestrator;
    }
  }
  
  return _orchestrator;
}

export async function resetBackgroundOrchestrator(): Promise<void> {
  if (_orchestrator) {
    try {
      await _orchestrator.shutdown();
    } catch (error) {
      // Ignore shutdown errors during reset
    }
    _orchestrator = null;
    
    // Clear global reference
    if (process.env.NODE_ENV === 'test') {
      (global).backgroundOrchestrator = null;
    }
  }
}

// Backward compatibility export
export const backgroundOrchestrator = {
  shouldRunInBackground: (command: string, args: string[], flags: Record<string, unknown>) => {
    try {
      return getBackgroundOrchestrator().shouldRunInBackground(command, args, flags);
    } catch {
      return false;
    }
  },
  executeInBackground: (
    command: string,
    args: string[],
    flags: Record<string, unknown>,
    options?: BackgroundOptions
  ) => {
    return getBackgroundOrchestrator().executeInBackground(command, args, flags, options);
  },
  shutdown: () => {
    if (_orchestrator) {
      return _orchestrator.shutdown();
    }
    return Promise.resolve();
  },
};

// Process cleanup
if (process.env.NODE_ENV !== 'test') {
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
}

// Export types and interfaces
export * from './job-queue';
export * from './resource-monitor';
export * from './process-spawner';
export * from './progress-tracker';