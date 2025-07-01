/**
 * Progress Tracking - Pure functional approach
 * 
 * This module provides pure functions for managing job progress
 * using event sourcing and immutable state patterns.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

// Types
export interface ProgressUpdate {
  jobId: string;
  progress: number;
  stage: string;
  details?: unknown;
  timestamp: number;
}

export interface ProgressState {
  updates: Map<string, ProgressUpdate[]>;
  currentStages: Map<string, string>;
  logs: Map<string, string[]>;
  maxUpdatesPerJob: number;
  maxLogLinesPerJob: number;
}

export interface ProgressEvent {
  type: 'progress' | 'stage' | 'log' | 'complete' | 'error';
  jobId: string;
  timestamp: number;
  data: any;
}

// Actions
export type ProgressAction =
  | { type: 'ADD_PROGRESS'; payload: ProgressUpdate }
  | { type: 'SET_STAGE'; payload: { jobId: string; stage: string } }
  | { type: 'ADD_LOG'; payload: { jobId: string; line: string } }
  | { type: 'CLEAR_JOB'; payload: string }
  | { type: 'CLEAR_ALL' };

// Pure reducer function
export function progressReducer(state: ProgressState, action: ProgressAction): ProgressState {
  switch (action.type) {
    case 'ADD_PROGRESS': {
      const { jobId } = action.payload;
      const updates = state.updates.get(jobId) || [];
      const newUpdates = [...updates, action.payload];
      
      // Limit updates per job
      if (newUpdates.length > state.maxUpdatesPerJob) {
        newUpdates.shift();
      }
      
      const newUpdatesMap = new Map(state.updates);
      newUpdatesMap.set(jobId, newUpdates);
      
      return {
        ...state,
        updates: newUpdatesMap,
      };
    }

    case 'SET_STAGE': {
      const { jobId, stage } = action.payload;
      const newStages = new Map(state.currentStages);
      newStages.set(jobId, stage);
      
      return {
        ...state,
        currentStages: newStages,
      };
    }

    case 'ADD_LOG': {
      const { jobId, line } = action.payload;
      const logs = state.logs.get(jobId) || [];
      const newLogs = [...logs, line];
      
      // Limit log lines per job
      if (newLogs.length > state.maxLogLinesPerJob) {
        newLogs.shift();
      }
      
      const newLogsMap = new Map(state.logs);
      newLogsMap.set(jobId, newLogs);
      
      return {
        ...state,
        logs: newLogsMap,
      };
    }

    case 'CLEAR_JOB': {
      const jobId = action.payload;
      const newUpdates = new Map(state.updates);
      const newStages = new Map(state.currentStages);
      const newLogs = new Map(state.logs);
      
      newUpdates.delete(jobId);
      newStages.delete(jobId);
      newLogs.delete(jobId);
      
      return {
        ...state,
        updates: newUpdates,
        currentStages: newStages,
        logs: newLogs,
      };
    }

    case 'CLEAR_ALL': {
      return createInitialProgressState();
    }

    default:
      return state;
  }
}

// Selectors
export function getJobProgress(state: ProgressState, jobId: string): number {
  const updates = state.updates.get(jobId);
  if (!updates || updates.length === 0) {
    return 0;
  }
  
  return updates[updates.length - 1].progress;
}

export function getJobStage(state: ProgressState, jobId: string): string | undefined {
  return state.currentStages.get(jobId);
}

export function getJobLogs(state: ProgressState, jobId: string): string[] {
  return state.logs.get(jobId) || [];
}

export function getLatestUpdate(state: ProgressState, jobId: string): ProgressUpdate | undefined {
  const updates = state.updates.get(jobId);
  return updates?.[updates.length - 1];
}

export function getProgressHistory(state: ProgressState, jobId: string): ProgressUpdate[] {
  return state.updates.get(jobId) || [];
}

// Progress calculation helpers
export function calculateAverageSpeed(updates: ProgressUpdate[]): number {
  if (updates.length < 2) {
    return 0;
  }
  
  const first = updates[0];
  const last = updates[updates.length - 1];
  const timeDiff = last.timestamp - first.timestamp;
  const progressDiff = last.progress - first.progress;
  
  if (timeDiff === 0) {
    return 0;
  }
  
  return progressDiff / (timeDiff / 1000); // Progress per second
}

export function estimateTimeRemaining(
  currentProgress: number,
  averageSpeed: number
): number | null {
  if (averageSpeed <= 0 || currentProgress >= 100) {
    return null;
  }
  
  const remainingProgress = 100 - currentProgress;
  return (remainingProgress / averageSpeed) * 1000; // Milliseconds
}

// Progress visualization
export function createProgressBar(progress: number, width: number = 20): string {
  const filled = Math.floor((progress / 100) * width);
  const empty = width - filled;
  const block = '█';
  const space = ' ';
  
  return `[${block.repeat(filled)}${space.repeat(empty)}]`;
}

export function formatProgress(update: ProgressUpdate): string {
  const progressBar = createProgressBar(update.progress);
  return `${progressBar} ${update.progress}% - ${update.stage}`;
}

// Event sourcing helpers
export function createProgressEvent(
  type: ProgressEvent['type'],
  jobId: string,
  data: any
): ProgressEvent {
  return {
    type,
    jobId,
    timestamp: Date.now(),
    data,
  };
}

export function replayProgressEvents(events: ProgressEvent[]): ProgressState {
  let state = createInitialProgressState();
  
  for (const event of events) {
    state = applyProgressEvent(state, event);
  }
  
  return state;
}

export function applyProgressEvent(state: ProgressState, event: ProgressEvent): ProgressState {
  switch (event.type) {
    case 'progress':
      return progressReducer(state, {
        type: 'ADD_PROGRESS',
        payload: {
          jobId: event.jobId,
          progress: event.data.progress,
          stage: event.data.stage || state.currentStages.get(event.jobId) || 'Running',
          details: event.data.details,
          timestamp: event.timestamp,
        },
      });
      
    case 'stage':
      return progressReducer(state, {
        type: 'SET_STAGE',
        payload: { jobId: event.jobId, stage: event.data.stage },
      });
      
    case 'log':
      return progressReducer(state, {
        type: 'ADD_LOG',
        payload: { jobId: event.jobId, line: event.data.line },
      });
      
    case 'complete':
      return progressReducer(state, {
        type: 'ADD_PROGRESS',
        payload: {
          jobId: event.jobId,
          progress: 100,
          stage: 'Completed',
          timestamp: event.timestamp,
        },
      });
      
    case 'error':
      return progressReducer(state, {
        type: 'SET_STAGE',
        payload: { jobId: event.jobId, stage: `Error: ${event.data.error}` },
      });
      
    default:
      return state;
  }
}

// Progress persistence
export interface ProgressPersistence {
  save: (state: ProgressState) => Promise<void>;
  load: () => Promise<ProgressState>;
  saveEvent: (event: ProgressEvent) => Promise<void>;
  loadEvents: (jobId?: string) => Promise<ProgressEvent[]>;
}

export function createFilePersistence(basePath: string): ProgressPersistence {
  const stateFile = path.join(basePath, 'progress-state.json');
  const eventsDir = path.join(basePath, 'events');
  
  // Ensure directories exist
  if (!fs.existsSync(eventsDir)) {
    fs.mkdirSync(eventsDir, { recursive: true });
  }
  
  return {
    save: async (state) => {
      const serializable = {
        updates: Array.from(state.updates.entries()),
        currentStages: Array.from(state.currentStages.entries()),
        logs: Array.from(state.logs.entries()),
        maxUpdatesPerJob: state.maxUpdatesPerJob,
        maxLogLinesPerJob: state.maxLogLinesPerJob,
      };
      
      await fs.promises.writeFile(stateFile, JSON.stringify(serializable, null, 2));
    },
    
    load: async () => {
      try {
        const data = await fs.promises.readFile(stateFile, 'utf-8');
        const parsed = JSON.parse(data);
        
        return {
          updates: new Map(parsed.updates),
          currentStages: new Map(parsed.currentStages),
          logs: new Map(parsed.logs),
          maxUpdatesPerJob: parsed.maxUpdatesPerJob,
          maxLogLinesPerJob: parsed.maxLogLinesPerJob,
        };
      } catch {
        return createInitialProgressState();
      }
    },
    
    saveEvent: async (event) => {
      const eventFile = path.join(eventsDir, `${event.jobId}.jsonl`);
      const line = JSON.stringify(event) + '\n';
      await fs.promises.appendFile(eventFile, line);
    },
    
    loadEvents: async (jobId) => {
      const events: ProgressEvent[] = [];
      
      if (jobId) {
        const eventFile = path.join(eventsDir, `${jobId}.jsonl`);
        if (fs.existsSync(eventFile)) {
          const content = await fs.promises.readFile(eventFile, 'utf-8');
          const lines = content.split('\n').filter(line => line.trim());
          events.push(...lines.map(line => JSON.parse(line)));
        }
      } else {
        // Load all events
        const files = await fs.promises.readdir(eventsDir);
        for (const file of files) {
          if (file.endsWith('.jsonl')) {
            const content = await fs.promises.readFile(path.join(eventsDir, file), 'utf-8');
            const lines = content.split('\n').filter(line => line.trim());
            events.push(...lines.map(line => JSON.parse(line)));
          }
        }
      }
      
      return events.sort((a, b) => a.timestamp - b.timestamp);
    },
  };
}

// Progress event emitter factory
export function createProgressEmitter(): EventEmitter {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(100); // Support many concurrent jobs
  return emitter;
}

// Initial state factory
export function createInitialProgressState(): ProgressState {
  return {
    updates: new Map(),
    currentStages: new Map(),
    logs: new Map(),
    maxUpdatesPerJob: 1000,
    maxLogLinesPerJob: 500,
  };
}

// Progress formatting utilities
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

export function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    pending: '⏳',
    running: '🔄',
    completed: '✅',
    failed: '❌',
    cancelled: '⚪',
  };
  
  return icons[status] || '❓';
}