/**
 * Process Spawning - Pure functional approach
 * 
 * This module provides pure functions for creating and managing child processes.
 * Process creation is handled through factory functions that return process configurations.
 */

import { spawn, ChildProcess, execSync, SpawnOptions } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { BackgroundJob } from '../PerformanceMonitor';

// Types
export interface ProcessConfig {
  executable: string;
  args: string[];
  options: SpawnOptions;
  env: Record<string, string>;
  timeout?: number;
}

export interface ProcessResult {
  pid?: number;
  exitCode?: number;
  signal?: string;
  error?: Error;
  stdout?: string;
  stderr?: string;
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

// Pure functions for process configuration
export function createProcessConfig(
  job: BackgroundJob,
  options: BackgroundOptions = {}
): ProcessConfig {
  const executable = findExecutable();
  const args = buildCommandArgs(job, options);
  const env = buildEnvironment(job.id);
  
  const spawnOptions: SpawnOptions = {
    detached: options.detached !== false,
    stdio: options.silent ? 'ignore' : ['ignore', 'pipe', 'pipe'],
    env,
  };
  
  return {
    executable,
    args,
    options: spawnOptions,
    env,
    timeout: options.timeout,
  };
}

export function buildCommandArgs(
  job: BackgroundJob,
  options: BackgroundOptions
): string[] {
  const execArgs = [
    ...job.args,
    ...flattenFlags(job.flags),
    '--quiet',        // Reduce output in background
    '--output=json',  // Structured output for parsing
  ];
  
  return [job.command, ...execArgs];
}

export function flattenFlags(flags: Record<string, any>): string[] {
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

export function buildEnvironment(jobId: string): Record<string, string> {
  return {
    ...process.env,
    WALRUS_BACKGROUND_JOB: jobId,
    WALRUS_PARENT_PID: process.pid?.toString() || '',
  };
}

// Executable discovery functions
export function findExecutable(): string {
  const possiblePaths = getExecutablePaths();
  
  for (const execPath of possiblePaths) {
    if (isExecutableAvailable(execPath)) {
      return execPath;
    }
  }
  
  // Check if waltodo is in PATH
  if (isCommandInPath('waltodo')) {
    return 'waltodo';
  }
  
  // Last resort - use the built CLI directly
  const builtCliPath = path.join(process.cwd(), 'apps', 'cli', 'dist', 'index.js');
  if (fs.existsSync(builtCliPath)) {
    return `node ${builtCliPath}`;
  }
  
  return 'waltodo'; // Final fallback
}

export function getExecutablePaths(): string[] {
  return [
    path.join(process.cwd(), 'bin', 'run'),
    path.join(process.cwd(), 'bin', 'run.js'),
    path.join(process.cwd(), 'bin', 'run-enhanced.js'),
    'waltodo',
    'npx waltodo',
  ];
}

export function isExecutableAvailable(execPath: string): boolean {
  try {
    return fs.existsSync(execPath);
  } catch {
    return false;
  }
}

export function isCommandInPath(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Process spawning factory
export function createProcessSpawner(
  config: ProcessConfig
): () => ChildProcess {
  return () => {
    return spawn(config.executable, config.args, config.options);
  };
}

// Process management functions
export function createProcessManager() {
  // Active processes are managed externally via Map
  // This returns functions to interact with processes
  
  return {
    killProcess: (process: ChildProcess, signal: NodeJS.Signals = 'SIGTERM') => {
      try {
        process.kill(signal);
        return true;
      } catch {
        return false;
      }
    },
    
    forceKillProcess: (process: ChildProcess) => {
      try {
        process.kill('SIGTERM');
        
        // Schedule force kill if not terminated
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }, 5000);
        
        return true;
      } catch {
        return false;
      }
    },
    
    isProcessAlive: (process: ChildProcess): boolean => {
      return !process.killed && process.exitCode === null;
    },
  };
}

// Process output parsing
export interface OutputParser {
  parseProgress: (line: string) => { progress: number; details: string } | null;
  parseStage: (line: string) => string | null;
  parseError: (line: string) => string | null;
}

export function createOutputParser(): OutputParser {
  const progressRegex = /PROGRESS:(\d+):(.*)/;
  const stageRegex = /STAGE:(.*)/;
  const errorRegex = /ERROR:(.*)/;
  
  return {
    parseProgress: (line: string) => {
      const match = line.match(progressRegex);
      if (match) {
        return {
          progress: parseInt(match[1]),
          details: match[2],
        };
      }
      return null;
    },
    
    parseStage: (line: string) => {
      const match = line.match(stageRegex);
      return match ? match[1] : null;
    },
    
    parseError: (line: string) => {
      const match = line.match(errorRegex);
      return match ? match[1] : null;
    },
  };
}

// Process event handlers factory
export interface ProcessHandlers {
  onExit: (code: number | null, signal: NodeJS.Signals | null) => void;
  onError: (error: Error) => void;
  onStdout: (data: Buffer) => void;
  onStderr: (data: Buffer) => void;
}

export function attachProcessHandlers(
  process: ChildProcess,
  handlers: ProcessHandlers
): void {
  process.on('exit', handlers.onExit);
  process.on('error', handlers.onError);
  
  if (process.stdout) {
    process.stdout.on('data', handlers.onStdout);
  }
  
  if (process.stderr) {
    process.stderr.on('data', handlers.onStderr);
  }
}

// Timeout management
export function createTimeoutManager(timeoutMs: number) {
  let timeoutHandle: NodeJS.Timeout | null = null;
  
  return {
    start: (onTimeout: () => void) => {
      timeoutHandle = setTimeout(onTimeout, timeoutMs);
    },
    
    cancel: () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    },
    
    isActive: () => timeoutHandle !== null,
  };
}

// Process priority handling (platform-specific)
export function setProcessPriority(
  pid: number,
  priority: 'low' | 'medium' | 'high'
): boolean {
  try {
    // On Unix-like systems, use nice values
    const niceValue = priority === 'low' ? 19 : priority === 'medium' ? 10 : 0;
    
    if (process.platform !== 'win32') {
      execSync(`renice -n ${niceValue} -p ${pid}`, { stdio: 'ignore' });
      return true;
    }
    
    // Windows priority handling would go here
    return false;
  } catch {
    return false;
  }
}

// Resource limits (platform-specific)
export function applyResourceLimits(
  pid: number,
  limits: { maxMemory?: number; maxCpu?: number }
): boolean {
  // This is platform-specific and would require native modules
  // or OS-specific commands to implement properly
  // For now, return false to indicate not implemented
  return false;
}

// Process lifecycle management
export interface ProcessLifecycle {
  process: ChildProcess;
  startTime: number;
  endTime?: number;
  exitCode?: number;
  signal?: string;
  error?: Error;
}

export function createProcessLifecycle(process: ChildProcess): ProcessLifecycle {
  return {
    process,
    startTime: Date.now(),
  };
}

export function updateProcessLifecycle(
  lifecycle: ProcessLifecycle,
  update: Partial<ProcessLifecycle>
): ProcessLifecycle {
  return { ...lifecycle, ...update };
}

// Retry logic
export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier?: number;
}

export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig
): number {
  const multiplier = config.backoffMultiplier || 1.5;
  return config.retryDelay * Math.pow(multiplier, attempt - 1);
}

export function shouldRetry(
  exitCode: number | null,
  signal: string | null,
  attempt: number,
  maxRetries: number
): boolean {
  // Don't retry if max attempts reached
  if (attempt >= maxRetries) {
    return false;
  }
  
  // Don't retry on successful exit
  if (exitCode === 0) {
    return false;
  }
  
  // Don't retry on manual cancellation
  if (signal === 'SIGTERM' || signal === 'SIGKILL') {
    return false;
  }
  
  // Retry on other failures
  return true;
}