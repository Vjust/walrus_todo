/**
 * Job Queue Management - Pure functional approach
 * 
 * This module provides pure functions for managing background jobs
 * using Redux-like reducers and immutable state patterns.
 */

import { BackgroundJob } from '../PerformanceMonitor';

// Types
export interface JobQueueState {
  jobs: Map<string, BackgroundJob>;
  maxConcurrentJobs: number;
  commandProfiles: Map<string, CommandProfile>;
}

export interface CommandProfile {
  command: string;
  expectedDuration: number;
  resourceIntensive: boolean;
  autoBackground: boolean;
  maxConcurrency: number;
  priority: 'low' | 'medium' | 'high';
  dependencies?: string[];
  timeoutMs?: number;
}

// Actions
export type JobAction =
  | { type: 'CREATE_JOB'; payload: { command: string; args: string[]; flags: Record<string, any> } }
  | { type: 'START_JOB'; payload: { jobId: string; pid?: number } }
  | { type: 'UPDATE_JOB'; payload: { jobId: string; updates: Partial<BackgroundJob> } }
  | { type: 'COMPLETE_JOB'; payload: { jobId: string; result?: any } }
  | { type: 'FAIL_JOB'; payload: { jobId: string; error: string } }
  | { type: 'CANCEL_JOB'; payload: { jobId: string } }
  | { type: 'UPDATE_PROGRESS'; payload: { jobId: string; progress: number } }
  | { type: 'SET_MAX_CONCURRENT'; payload: number }
  | { type: 'CLEANUP_OLD_JOBS'; payload: { maxAge: number } };

// Pure reducer function
export function jobQueueReducer(state: JobQueueState, action: JobAction): JobQueueState {
  switch (action.type) {
    case 'CREATE_JOB': {
      const { command, args, flags } = action.payload;
      const job = createJob(command, args, flags);
      const newJobs = new Map(state.jobs);
      newJobs.set(job.id, job);
      return { ...state, jobs: newJobs };
    }

    case 'START_JOB': {
      const { jobId, pid } = action.payload;
      const job = state.jobs.get(jobId);
      if (!job) return state;
      
      const updatedJob: BackgroundJob = {
        ...job,
        status: 'running',
        pid,
        startTime: Date.now(),
      };
      
      const newJobs = new Map(state.jobs);
      newJobs.set(jobId, updatedJob);
      return { ...state, jobs: newJobs };
    }

    case 'UPDATE_JOB': {
      const { jobId, updates } = action.payload;
      const job = state.jobs.get(jobId);
      if (!job) return state;
      
      const updatedJob = { ...job, ...updates };
      const newJobs = new Map(state.jobs);
      newJobs.set(jobId, updatedJob);
      return { ...state, jobs: newJobs };
    }

    case 'COMPLETE_JOB': {
      const { jobId, result } = action.payload;
      const job = state.jobs.get(jobId);
      if (!job) return state;
      
      const updatedJob: BackgroundJob = {
        ...job,
        status: 'completed',
        endTime: Date.now(),
        progress: 100,
        metadata: { ...job.metadata, result },
      };
      
      const newJobs = new Map(state.jobs);
      newJobs.set(jobId, updatedJob);
      return { ...state, jobs: newJobs };
    }

    case 'FAIL_JOB': {
      const { jobId, error } = action.payload;
      const job = state.jobs.get(jobId);
      if (!job) return state;
      
      const updatedJob: BackgroundJob = {
        ...job,
        status: 'failed',
        endTime: Date.now(),
        errorMessage: error,
      };
      
      const newJobs = new Map(state.jobs);
      newJobs.set(jobId, updatedJob);
      return { ...state, jobs: newJobs };
    }

    case 'CANCEL_JOB': {
      const { jobId } = action.payload;
      const job = state.jobs.get(jobId);
      if (!job) return state;
      
      const updatedJob: BackgroundJob = {
        ...job,
        status: 'cancelled',
        endTime: Date.now(),
      };
      
      const newJobs = new Map(state.jobs);
      newJobs.set(jobId, updatedJob);
      return { ...state, jobs: newJobs };
    }

    case 'UPDATE_PROGRESS': {
      const { jobId, progress } = action.payload;
      const job = state.jobs.get(jobId);
      if (!job) return state;
      
      const updatedJob = { ...job, progress };
      const newJobs = new Map(state.jobs);
      newJobs.set(jobId, updatedJob);
      return { ...state, jobs: newJobs };
    }

    case 'SET_MAX_CONCURRENT': {
      return { ...state, maxConcurrentJobs: action.payload };
    }

    case 'CLEANUP_OLD_JOBS': {
      const { maxAge } = action.payload;
      const cutoffTime = Date.now() - maxAge;
      const newJobs = new Map<string, BackgroundJob>();
      
      state.jobs.forEach((job, id) => {
        if (job.startTime > cutoffTime || 
            (job.status === 'running' || job.status === 'pending')) {
          newJobs.set(id, job);
        }
      });
      
      return { ...state, jobs: newJobs };
    }

    default:
      return state;
  }
}

// Pure helper functions
export function createJob(
  command: string,
  args: string[],
  flags: Record<string, any>
): BackgroundJob {
  const id = generateJobId();
  const logFile = `.waltodo-cache/jobs/${id}.log`;
  const outputFile = `.waltodo-cache/jobs/${id}.out`;

  return {
    id,
    command,
    args,
    flags,
    status: 'pending',
    startTime: Date.now(),
    progress: 0,
    logFile,
    outputFile,
    metadata: {},
  };
}

export function generateJobId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `job_${timestamp}_${random}`;
}

// Selectors (pure functions to query state)
export function getJob(state: JobQueueState, jobId: string): BackgroundJob | undefined {
  return state.jobs.get(jobId);
}

export function getAllJobs(state: JobQueueState): BackgroundJob[] {
  return Array.from(state.jobs.values());
}

export function getActiveJobs(state: JobQueueState): BackgroundJob[] {
  return Array.from(state.jobs.values()).filter(
    job => job.status === 'running' || job.status === 'pending'
  );
}

export function getJobsByCommand(state: JobQueueState, command: string): BackgroundJob[] {
  return Array.from(state.jobs.values()).filter(job => job.command === command);
}

export function canStartNewJob(state: JobQueueState, command: string): boolean {
  const profile = state.commandProfiles.get(command);
  if (!profile) return true;

  const activeJobs = getActiveJobs(state);
  
  // Check global concurrency
  if (activeJobs.length >= state.maxConcurrentJobs) {
    return false;
  }

  // Check command-specific concurrency
  const commandJobs = activeJobs.filter(job => job.command === command);
  if (commandJobs.length >= profile.maxConcurrency) {
    return false;
  }

  // Check dependencies
  if (profile.dependencies) {
    const hasRunningDependencies = profile.dependencies.some(dep =>
      activeJobs.some(job => job.command === dep)
    );
    
    if (hasRunningDependencies) {
      return false;
    }
  }

  return true;
}

// Event sourcing helpers
export interface JobEvent {
  type: string;
  jobId: string;
  timestamp: number;
  data?: any;
}

export function createJobEvent(type: string, jobId: string, data?: any): JobEvent {
  return {
    type,
    jobId,
    timestamp: Date.now(),
    data,
  };
}

// Command profile initialization
export function getDefaultCommandProfiles(): CommandProfile[] {
  return [
    {
      command: 'store',
      expectedDuration: 10000,
      resourceIntensive: true,
      autoBackground: true,
      maxConcurrency: 3,
      priority: 'medium',
      timeoutMs: 300000,
    },
    {
      command: 'store-list',
      expectedDuration: 15000,
      resourceIntensive: true,
      autoBackground: true,
      maxConcurrency: 2,
      priority: 'medium',
      timeoutMs: 600000,
    },
    {
      command: 'store-file',
      expectedDuration: 8000,
      resourceIntensive: true,
      autoBackground: true,
      maxConcurrency: 3,
      priority: 'medium',
      timeoutMs: 180000,
    },
    {
      command: 'deploy',
      expectedDuration: 30000,
      resourceIntensive: true,
      autoBackground: true,
      maxConcurrency: 1,
      priority: 'high',
      timeoutMs: 900000,
    },
    {
      command: 'sync',
      expectedDuration: 12000,
      resourceIntensive: false,
      autoBackground: true,
      maxConcurrency: 2,
      priority: 'medium',
      timeoutMs: 300000,
    },
    {
      command: 'ai',
      expectedDuration: 5000,
      resourceIntensive: false,
      autoBackground: false,
      maxConcurrency: 5,
      priority: 'low',
      timeoutMs: 60000,
    },
    {
      command: 'image',
      expectedDuration: 15000,
      resourceIntensive: true,
      autoBackground: true,
      maxConcurrency: 2,
      priority: 'medium',
      dependencies: ['store'],
      timeoutMs: 300000,
    },
    {
      command: 'create-nft',
      expectedDuration: 20000,
      resourceIntensive: true,
      autoBackground: true,
      maxConcurrency: 2,
      priority: 'high',
      dependencies: ['image', 'deploy'],
      timeoutMs: 600000,
    },
  ];
}

export function createInitialState(): JobQueueState {
  const profiles = getDefaultCommandProfiles();
  const commandProfiles = new Map<string, CommandProfile>();
  
  profiles.forEach(profile => {
    commandProfiles.set(profile.command, profile);
  });

  return {
    jobs: new Map(),
    maxConcurrentJobs: 10,
    commandProfiles,
  };
}