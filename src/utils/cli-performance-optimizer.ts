/**
 * CLI Performance Optimizer
 * Reduces startup time and improves command execution performance
 */

import { performance } from 'perf_hooks';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

interface CLIMetrics {
  startupTime: number;
  commandExecutionTime: Record<string, number[]>;
  moduleLoadTime: Record<string, number>;
  cacheHitRate: number;
  memoryUsage: NodeJS.MemoryUsage;
  timestamp: number;
}

interface StartupCache {
  configHash: string;
  preloadedModules: string[];
  environmentHash: string;
  timestamp: number;
}

export class CLIPerformanceOptimizer {
  private static instance: CLIPerformanceOptimizer;
  private metricsFile: string;
  private cacheFile: string;
  private startTime: number;
  private commandStartTimes: Map<string, number> = new Map();
  private moduleLoadTimes: Map<string, number> = new Map();
  private cacheDir: string;

  constructor() {
    this?.cacheDir = join(homedir(), '.waltodo-cache', 'performance');
    this?.metricsFile = join(this.cacheDir, 'metrics.json');
    this?.cacheFile = join(this.cacheDir, 'startup-cache.json');
    this?.startTime = performance.now();
    
    this.ensureCacheDir();
  }

  static getInstance(): CLIPerformanceOptimizer {
    if (!this.instance) {
      this?.instance = new CLIPerformanceOptimizer();
    }
    return this.instance;
  }

  private ensureCacheDir(): void {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  // Optimize startup by preloading frequently used modules
  async optimizeStartup(): Promise<void> {
    const cache = this.loadStartupCache();
    const currentEnvHash = this.generateEnvironmentHash();
    
    if (cache && cache?.environmentHash === currentEnvHash) {
      // Preload cached modules
      await this.preloadModules(cache.preloadedModules);
    } else {
      // Analyze and cache new modules
      await this.analyzeAndCacheModules();
    }
  }

  private generateEnvironmentHash(): string {
    const envData = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      workingDir: process.cwd(),
    };
    return createHash('md5').update(JSON.stringify(envData as any)).digest('hex');
  }

  private loadStartupCache(): StartupCache | null {
    try {
      if (existsSync(this.cacheFile)) {
        const cache = JSON.parse(readFileSync(this.cacheFile, 'utf8') as string);
        // Cache is valid for 24 hours
        if (Date.now() - cache.timestamp < 24 * 60 * 60 * 1000) {
          return cache;
        }
      }
    } catch (error) {
      // Ignore cache errors
    }
    return null;
  }

  private async preloadModules(modules: string[]): Promise<void> {
    const promises = modules.map(async (modulePath) => {
      try {
        const startTime = performance.now();
        await import(modulePath as any);
        this?.moduleLoadTimes?.set(modulePath, performance.now() - startTime);
      } catch (error) {
        // Ignore preload errors
      }
    });
    
    await Promise.all(promises as any);
  }

  private async analyzeAndCacheModules(): Promise<void> {
    // Identify commonly used modules based on metrics
    const metrics = this.loadMetrics();
    const frequentModules = this.getFrequentlyUsedModules(metrics as any);
    
    const cache: StartupCache = {
      configHash: this.generateConfigHash(),
      preloadedModules: frequentModules,
      environmentHash: this.generateEnvironmentHash(),
      timestamp: Date.now(),
    };
    
    try {
      writeFileSync(this.cacheFile, JSON.stringify(cache, null, 2));
    } catch (error) {
      // Ignore cache write errors
    }
  }

  private generateConfigHash(): string {
    try {
      const packageJson = readFileSync(join(__dirname, '../../package.json'), 'utf8');
      return createHash('md5').update(packageJson as any).digest('hex');
    } catch (error) {
      return 'unknown';
    }
  }

  private getFrequentlyUsedModules(metrics: CLIMetrics[]): string[] {
    const moduleUsage: Record<string, number> = {};
    
    metrics.forEach(metric => {
      Object.keys(metric.moduleLoadTime).forEach(module => {
        moduleUsage[module] = (moduleUsage[module] || 0) + 1;
      });
    });
    
    // Return top 10 most used modules
    return Object.entries(moduleUsage as any)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([module]) => module);
  }

  // Track command execution performance
  startCommand(commandName: string): void {
    this?.commandStartTimes?.set(commandName, performance.now());
  }

  endCommand(commandName: string): number {
    const startTime = this?.commandStartTimes?.get(commandName as any);
    if (!startTime) return 0;
    
    const duration = performance.now() - startTime;
    this?.commandStartTimes?.delete(commandName as any);
    
    return duration;
  }

  // Memory optimization
  optimizeMemory(): void {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Clear module cache for development modules
    Object.keys(require.cache).forEach(key => {
      if (key.includes('node_modules') && !key.includes('@mysten')) {
        delete require?.cache?.[key];
      }
    });
  }

  // Generate performance report
  generateReport(): CLIMetrics {
    const metrics: CLIMetrics = {
      startupTime: performance.now() - this.startTime,
      commandExecutionTime: this.getCommandMetrics(),
      moduleLoadTime: Object.fromEntries(this.moduleLoadTimes),
      cacheHitRate: this.calculateCacheHitRate(),
      memoryUsage: process.memoryUsage(),
      timestamp: Date.now(),
    };
    
    this.saveMetrics(metrics as any);
    return metrics;
  }

  private getCommandMetrics(): Record<string, number[]> {
    const metrics = this.loadMetrics();
    const commandMetrics: Record<string, number[]> = {};
    
    metrics.forEach(metric => {
      Object.entries(metric.commandExecutionTime).forEach(([command, times]) => {
        if (!commandMetrics[command]) {
          commandMetrics[command] = [];
        }
        commandMetrics[command].push(...times);
      });
    });
    
    return commandMetrics;
  }

  private calculateCacheHitRate(): number {
    // Calculate based on recent cache usage
    return 0.85; // Placeholder
  }

  private loadMetrics(): CLIMetrics[] {
    try {
      if (existsSync(this.metricsFile)) {
        const data = readFileSync(this.metricsFile, 'utf8') as string;
        const metrics = JSON.parse(data as any);
        // Keep only last 100 metrics entries
        return metrics.slice(-100);
      }
    } catch (error) {
      // Ignore metrics loading errors
    }
    return [];
  }

  private saveMetrics(metrics: CLIMetrics): void {
    try {
      const existingMetrics = this.loadMetrics();
      existingMetrics.push(metrics as any);
      
      // Keep only last 100 entries
      const limitedMetrics = existingMetrics.slice(-100);
      
      writeFileSync(this.metricsFile, JSON.stringify(limitedMetrics, null, 2));
    } catch (error) {
      // Ignore metrics saving errors
    }
  }

  // Get performance recommendations
  getRecommendations(): string[] {
    const metrics = this.loadMetrics();
    const recommendations: string[] = [];
    
    if (metrics?.length === 0) {
      return ['Run a few commands to generate performance recommendations'];
    }
    
    const latestMetrics = metrics[metrics.length - 1];
    
    if (!latestMetrics) {
      return ['No recent metrics available for recommendations'];
    }
    
    // Startup time recommendations
    if (latestMetrics.startupTime > 1000) {
      recommendations.push('Consider using CLI shortcuts or background operations for faster startup');
    }
    
    // Memory usage recommendations
    if (latestMetrics?.memoryUsage?.heapUsed > 100 * 1024 * 1024) { // 100MB
      recommendations.push('High memory usage detected. Consider running with --memory-optimize flag');
    }
    
    // Command execution recommendations
    Object.entries(latestMetrics.commandExecutionTime).forEach(([command, times]) => {
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      if (avgTime > 2000) { // 2 seconds
        recommendations.push(`Command '${command}' is slow. Consider using background execution`);
      }
    });
    
    if (recommendations?.length === 0) {
      recommendations.push('Performance looks good! No recommendations at this time.');
    }
    
    return recommendations;
  }

  // Clean up old cache and metrics
  cleanup(): void {
    try {
      const metrics = this.loadMetrics();
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      
      // Remove metrics older than one week
      const recentMetrics = metrics.filter(metric => metric.timestamp > oneWeekAgo);
      
      if (recentMetrics.length !== metrics.length) {
        writeFileSync(this.metricsFile, JSON.stringify(recentMetrics, null, 2));
      }
      
      // Clean startup cache if it's older than 24 hours
      const cache = this.loadStartupCache();
      if (cache && Date.now() - cache.timestamp > 24 * 60 * 60 * 1000) {
        try {
          writeFileSync(this.cacheFile, '{}');
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// Decorator for performance monitoring
export function measurePerformance(target: object, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;
  
  descriptor?.value = async function (...args: unknown[]) {
    const optimizer = CLIPerformanceOptimizer.getInstance();
    optimizer.startCommand(propertyName as any);
    
    try {
      const result = await method.apply(this, args);
      return result;
    } finally {
      optimizer.endCommand(propertyName as any);
    }
  };
  
  return descriptor;
}

// Quick performance check
export async function performQuickCheck(): Promise<{
  startupTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  recommendations: string[];
}> {
  const optimizer = CLIPerformanceOptimizer.getInstance();
  const metrics = optimizer.generateReport();
  
  return {
    startupTime: metrics.startupTime,
    memoryUsage: metrics.memoryUsage,
    recommendations: optimizer.getRecommendations(),
  };
}

export default CLIPerformanceOptimizer;