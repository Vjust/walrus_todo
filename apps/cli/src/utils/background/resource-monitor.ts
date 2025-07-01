/**
 * Resource Monitoring - Pure functional approach
 * 
 * This module provides pure functions for tracking system resources
 * and making decisions based on resource availability.
 */

import * as os from 'os';

// Types
export interface ResourceUsage {
  memory: number;      // Percentage (0-1)
  cpu: number;         // Percentage (0-1)
  activeJobs: number;
  totalJobs: number;
  timestamp: number;
}

export interface ResourceThresholds {
  maxMemoryUsage: number;    // 0-1
  maxCpuUsage: number;       // 0-1
  criticalMemory: number;    // 0-1
  criticalCpu: number;       // 0-1
}

export interface ResourceState {
  current: ResourceUsage;
  history: ResourceUsage[];
  thresholds: ResourceThresholds;
  maxHistorySize: number;
}

// Actions
export type ResourceAction =
  | { type: 'UPDATE_USAGE'; payload: ResourceUsage }
  | { type: 'SET_THRESHOLDS'; payload: Partial<ResourceThresholds> }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'SET_MAX_HISTORY'; payload: number };

// Pure reducer function
export function resourceReducer(state: ResourceState, action: ResourceAction): ResourceState {
  switch (action.type) {
    case 'UPDATE_USAGE': {
      const newHistory = [...state.history, action.payload];
      
      // Keep history within size limit
      if (newHistory.length > state.maxHistorySize) {
        newHistory.shift();
      }
      
      return {
        ...state,
        current: action.payload,
        history: newHistory,
      };
    }

    case 'SET_THRESHOLDS': {
      return {
        ...state,
        thresholds: { ...state.thresholds, ...action.payload },
      };
    }

    case 'CLEAR_HISTORY': {
      return {
        ...state,
        history: [],
      };
    }

    case 'SET_MAX_HISTORY': {
      const newMaxSize = action.payload;
      const newHistory = state.history.slice(-newMaxSize);
      
      return {
        ...state,
        maxHistorySize: newMaxSize,
        history: newHistory,
      };
    }

    default:
      return state;
  }
}

// Pure helper functions
export function calculateResourceUsage(activeJobs: number, totalJobs: number): ResourceUsage {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  return {
    memory: usedMem / totalMem,
    cpu: getCpuUsage(),  // This would need to be calculated over time
    activeJobs,
    totalJobs,
    timestamp: Date.now(),
  };
}

// Note: CPU usage calculation requires sampling over time
// This is a simplified version
export function getCpuUsage(): number {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += (cpu.times)[type];
    }
    totalIdle += cpu.times.idle;
  });

  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  const usage = 1 - (idle / total);
  
  return Math.max(0, Math.min(1, usage));
}

// Selectors
export function isMemoryHigh(state: ResourceState): boolean {
  return state.current.memory > state.thresholds.maxMemoryUsage;
}

export function isMemoryCritical(state: ResourceState): boolean {
  return state.current.memory > state.thresholds.criticalMemory;
}

export function isCpuHigh(state: ResourceState): boolean {
  return state.current.cpu > state.thresholds.maxCpuUsage;
}

export function isCpuCritical(state: ResourceState): boolean {
  return state.current.cpu > state.thresholds.criticalCpu;
}

export function shouldReduceConcurrency(state: ResourceState): boolean {
  return isMemoryCritical(state) || isCpuCritical(state);
}

export function canIncreaseConcurrency(state: ResourceState): boolean {
  return state.current.memory < 0.5 && state.current.cpu < 0.5;
}

export function getAverageUsage(state: ResourceState, windowMs: number = 60000): ResourceUsage | null {
  const cutoff = Date.now() - windowMs;
  const recentHistory = state.history.filter(usage => usage.timestamp > cutoff);
  
  if (recentHistory.length === 0) {
    return null;
  }
  
  const avgMemory = recentHistory.reduce((sum, u) => sum + u.memory, 0) / recentHistory.length;
  const avgCpu = recentHistory.reduce((sum, u) => sum + u.cpu, 0) / recentHistory.length;
  const avgActiveJobs = recentHistory.reduce((sum, u) => sum + u.activeJobs, 0) / recentHistory.length;
  
  return {
    memory: avgMemory,
    cpu: avgCpu,
    activeJobs: Math.round(avgActiveJobs),
    totalJobs: state.current.totalJobs,
    timestamp: Date.now(),
  };
}

export function getTrend(state: ResourceState, metric: 'memory' | 'cpu', windowMs: number = 300000): 'increasing' | 'decreasing' | 'stable' {
  const cutoff = Date.now() - windowMs;
  const recentHistory = state.history.filter(usage => usage.timestamp > cutoff);
  
  if (recentHistory.length < 3) {
    return 'stable';
  }
  
  // Calculate linear regression slope
  const values = recentHistory.map(u => u[metric]);
  const n = values.length;
  
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  if (Math.abs(slope) < 0.001) {
    return 'stable';
  }
  
  return slope > 0 ? 'increasing' : 'decreasing';
}

// Resource-based decision functions
export function calculateMaxConcurrency(usage: ResourceUsage, baseMax: number = 10): number {
  if (usage.memory > 0.9) {
    return Math.max(2, Math.floor(baseMax * 0.2));
  }
  
  if (usage.memory > 0.8) {
    return Math.max(3, Math.floor(baseMax * 0.4));
  }
  
  if (usage.memory > 0.6) {
    return Math.max(5, Math.floor(baseMax * 0.7));
  }
  
  return baseMax;
}

export function shouldForceBackground(
  usage: ResourceUsage,
  resourceIntensive: boolean
): boolean {
  // Force background for resource-intensive tasks when memory is high
  if (resourceIntensive && usage.memory > 0.8) {
    return true;
  }
  
  // Force background when CPU is critical
  if (usage.cpu > 0.9) {
    return true;
  }
  
  return false;
}

// Initial state factory
export function createInitialResourceState(): ResourceState {
  return {
    current: {
      memory: 0,
      cpu: 0,
      activeJobs: 0,
      totalJobs: 0,
      timestamp: Date.now(),
    },
    history: [],
    thresholds: {
      maxMemoryUsage: 0.8,
      maxCpuUsage: 0.8,
      criticalMemory: 0.9,
      criticalCpu: 0.95,
    },
    maxHistorySize: 1000,  // Keep last 1000 measurements
  };
}

// Resource monitoring strategies
export interface ResourceStrategy {
  name: string;
  evaluate: (state: ResourceState) => ResourceAdvice;
}

export interface ResourceAdvice {
  adjustConcurrency?: number;
  forcePause?: boolean;
  killLowPriorityJobs?: boolean;
  preventNewJobs?: boolean;
  message?: string;
}

export const conservativeStrategy: ResourceStrategy = {
  name: 'conservative',
  evaluate: (state) => {
    if (isMemoryCritical(state)) {
      return {
        adjustConcurrency: 1,
        preventNewJobs: true,
        killLowPriorityJobs: true,
        message: 'Critical memory usage - reducing to minimum operations',
      };
    }
    
    if (isMemoryHigh(state)) {
      return {
        adjustConcurrency: calculateMaxConcurrency(state.current),
        preventNewJobs: false,
        message: 'High memory usage - reducing concurrency',
      };
    }
    
    return {};
  },
};

export const aggressiveStrategy: ResourceStrategy = {
  name: 'aggressive',
  evaluate: (state) => {
    // Only react to critical situations
    if (state.current.memory > 0.95) {
      return {
        forcePause: true,
        preventNewJobs: true,
        message: 'Emergency pause - system at capacity',
      };
    }
    
    return {};
  },
};

export const adaptiveStrategy: ResourceStrategy = {
  name: 'adaptive',
  evaluate: (state) => {
    const memoryTrend = getTrend(state, 'memory', 60000);
    const cpuTrend = getTrend(state, 'cpu', 60000);
    
    if (memoryTrend === 'increasing' && state.current.memory > 0.7) {
      return {
        adjustConcurrency: calculateMaxConcurrency(state.current) - 1,
        message: 'Memory usage trending up - proactively reducing load',
      };
    }
    
    if (memoryTrend === 'decreasing' && state.current.memory < 0.5) {
      const currentMax = calculateMaxConcurrency(state.current);
      return {
        adjustConcurrency: Math.min(currentMax + 1, 10),
        message: 'Resources available - increasing concurrency',
      };
    }
    
    return conservativeStrategy.evaluate(state);
  },
};