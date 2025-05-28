import { Logger } from './Logger';
import * as fs from 'fs';
import * as path from 'path';

export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  metadata?: Record<string, any>;
  memoryUsage?: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
}

export interface PerformanceReport {
  totalOperations: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  memoryStats: {
    avgHeapUsed: number;
    avgHeapTotal: number;
    peakHeapUsed: number;
  };
  operationBreakdown: Record<string, {
    count: number;
    avgDuration: number;
    successRate: number;
  }>;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private activeOperations = new Map<string, { start: number; cpuStart?: NodeJS.CpuUsage }>();
  private logger: Logger;
  private metricsFile: string;
  private maxMetrics = 10000; // Prevent memory overflow

  constructor(metricsDir = '.waltodo-cache/performance') {
    this.logger = new Logger('PerformanceMonitor');
    this.metricsFile = path.join(process.cwd(), metricsDir, 'metrics.json');
    this.ensureMetricsDir();
    this.loadExistingMetrics();
  }

  private ensureMetricsDir(): void {
    const dir = path.dirname(this.metricsFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadExistingMetrics(): void {
    try {
      if (fs.existsSync(this.metricsFile)) {
        const data = fs.readFileSync(this.metricsFile, 'utf-8');
        this.metrics = JSON.parse(data);
        // Keep only recent metrics to prevent memory issues
        if (this.metrics.length > this.maxMetrics) {
          this.metrics = this.metrics.slice(-this.maxMetrics);
        }
      }
    } catch (error) {
      this.logger.warn('Failed to load existing metrics:', error);
      this.metrics = [];
    }
  }

  startOperation(operationId: string, operation: string): void {
    const start = performance.now();
    const cpuStart = process.cpuUsage();
    
    this.activeOperations.set(operationId, {
      start,
      cpuStart
    });

    this.logger.debug(`Started tracking: ${operation} (${operationId})`);
  }

  endOperation(operationId: string, operation: string, success = true, metadata?: Record<string, any>): PerformanceMetric {
    const activeOp = this.activeOperations.get(operationId);
    if (!activeOp) {
      throw new Error(`No active operation found for ID: ${operationId}`);
    }

    const duration = performance.now() - activeOp.start;
    const memoryUsage = process.memoryUsage();
    const cpuUsage = activeOp.cpuStart ? process.cpuUsage(activeOp.cpuStart) : undefined;

    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: Date.now(),
      success,
      metadata,
      memoryUsage,
      cpuUsage
    };

    this.metrics.push(metric);
    this.activeOperations.delete(operationId);

    // Keep metrics under limit
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    this.logger.debug(`Completed tracking: ${operation} (${duration.toFixed(2)}ms)`);
    
    // Auto-save periodically
    if (this.metrics.length % 10 === 0) {
      this.saveMetrics();
    }

    return metric;
  }

  async measureOperation<T>(operation: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const operationId = `${operation}-${Date.now()}-${Math.random()}`;
    this.startOperation(operationId, operation);
    
    try {
      const result = await fn();
      this.endOperation(operationId, operation, true, metadata);
      return result;
    } catch (error) {
      this.endOperation(operationId, operation, false, { 
        ...metadata, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  measureSync<T>(operation: string, fn: () => T, metadata?: Record<string, any>): T {
    const operationId = `${operation}-${Date.now()}-${Math.random()}`;
    this.startOperation(operationId, operation);
    
    try {
      const result = fn();
      this.endOperation(operationId, operation, true, metadata);
      return result;
    } catch (error) {
      this.endOperation(operationId, operation, false, { 
        ...metadata, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  generateReport(timeRangeMs?: number): PerformanceReport {
    const now = Date.now();
    const relevantMetrics = timeRangeMs 
      ? this.metrics.filter(m => now - m.timestamp <= timeRangeMs)
      : this.metrics;

    if (relevantMetrics.length === 0) {
      return {
        totalOperations: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        successRate: 0,
        memoryStats: {
          avgHeapUsed: 0,
          avgHeapTotal: 0,
          peakHeapUsed: 0
        },
        operationBreakdown: {}
      };
    }

    const durations = relevantMetrics.map(m => m.duration);
    const successfulOps = relevantMetrics.filter(m => m.success);
    const memoryMetrics = relevantMetrics.filter(m => m.memoryUsage);

    // Calculate operation breakdown
    const operationBreakdown: Record<string, { count: number; avgDuration: number; successRate: number }> = {};
    
    for (const metric of relevantMetrics) {
      if (!operationBreakdown[metric.operation]) {
        operationBreakdown[metric.operation] = { count: 0, avgDuration: 0, successRate: 0 };
      }
      operationBreakdown[metric.operation].count++;
    }

    for (const [operation, stats] of Object.entries(operationBreakdown)) {
      const opMetrics = relevantMetrics.filter(m => m.operation === operation);
      stats.avgDuration = opMetrics.reduce((sum, m) => sum + m.duration, 0) / opMetrics.length;
      stats.successRate = opMetrics.filter(m => m.success).length / opMetrics.length;
    }

    return {
      totalOperations: relevantMetrics.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      successRate: successfulOps.length / relevantMetrics.length,
      memoryStats: {
        avgHeapUsed: memoryMetrics.reduce((sum, m) => sum + m.memoryUsage!.heapUsed, 0) / memoryMetrics.length,
        avgHeapTotal: memoryMetrics.reduce((sum, m) => sum + m.memoryUsage!.heapTotal, 0) / memoryMetrics.length,
        peakHeapUsed: Math.max(...memoryMetrics.map(m => m.memoryUsage!.heapUsed))
      },
      operationBreakdown
    };
  }

  getSlowOperations(thresholdMs = 1000): PerformanceMetric[] {
    return this.metrics
      .filter(m => m.duration > thresholdMs)
      .sort((a, b) => b.duration - a.duration);
  }

  getFailedOperations(): PerformanceMetric[] {
    return this.metrics.filter(m => !m.success);
  }

  saveMetrics(): void {
    try {
      fs.writeFileSync(this.metricsFile, JSON.stringify(this.metrics, null, 2));
      this.logger.debug(`Saved ${this.metrics.length} metrics to ${this.metricsFile}`);
    } catch (error) {
      this.logger.error('Failed to save metrics:', error);
    }
  }

  clearMetrics(): void {
    this.metrics = [];
    if (fs.existsSync(this.metricsFile)) {
      fs.unlinkSync(this.metricsFile);
    }
    this.logger.info('Performance metrics cleared');
  }

  exportReport(format: 'json' | 'csv' = 'json', timeRangeMs?: number): string {
    const report = this.generateReport(timeRangeMs);
    
    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    } else {
      // CSV format
      const headers = ['Operation', 'Count', 'Avg Duration (ms)', 'Success Rate'];
      const rows = Object.entries(report.operationBreakdown).map(([op, stats]) => [
        op,
        stats.count.toString(),
        stats.avgDuration.toFixed(2),
        (stats.successRate * 100).toFixed(2) + '%'
      ]);
      
      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }
  }
}

// Background job management interfaces and classes
export interface BackgroundJob {
  id: string;
  command: string;
  args: string[];
  flags: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime?: number;
  progress: number;
  totalItems?: number;
  processedItems?: number;
  errorMessage?: string;
  outputFile?: string;
  logFile?: string;
  metadata?: Record<string, any>;
  pid?: number;
}

export class JobManager {
  private jobsFile: string;
  private activeJobs: Map<string, BackgroundJob> = new Map();
  private jobsDir: string;
  private logger: Logger;

  constructor(configDir?: string) {
    const baseDir = configDir || path.join(process.cwd(), '.waltodo-cache');
    this.jobsDir = path.join(baseDir, 'jobs');
    this.jobsFile = path.join(this.jobsDir, 'jobs.json');
    this.logger = new Logger('JobManager');
    this.ensureJobsDir();
    this.loadJobs();
  }

  private ensureJobsDir(): void {
    if (!fs.existsSync(this.jobsDir)) {
      fs.mkdirSync(this.jobsDir, { recursive: true });
    }
  }

  private loadJobs(): void {
    try {
      if (fs.existsSync(this.jobsFile)) {
        const data = fs.readFileSync(this.jobsFile, 'utf8');
        const jobs: BackgroundJob[] = JSON.parse(data);
        jobs.forEach(job => {
          this.activeJobs.set(job.id, job);
        });
        this.logger.debug(`Loaded ${jobs.length} jobs from storage`);
      }
    } catch (error) {
      this.logger.warn('Failed to load jobs:', error);
    }
  }

  private saveJobs(): void {
    try {
      const jobs = Array.from(this.activeJobs.values());
      fs.writeFileSync(this.jobsFile, JSON.stringify(jobs, null, 2));
      this.logger.debug(`Saved ${jobs.length} jobs to storage`);
    } catch (error) {
      this.logger.error('Failed to save jobs:', error);
    }
  }

  public createJob(command: string, args: string[], flags: Record<string, any>): BackgroundJob {
    const id = this.generateJobId();
    const logFile = path.join(this.jobsDir, `${id}.log`);
    const outputFile = path.join(this.jobsDir, `${id}.out`);

    const job: BackgroundJob = {
      id,
      command,
      args,
      flags,
      status: 'pending',
      startTime: Date.now(),
      progress: 0,
      logFile,
      outputFile,
      metadata: {}
    };

    this.activeJobs.set(id, job);
    this.saveJobs();
    this.logger.info(`Created background job: ${id} for command: ${command}`);
    
    return job;
  }

  public updateJob(jobId: string, updates: Partial<BackgroundJob>): void {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      this.logger.warn(`Job not found for update: ${jobId}`);
      return;
    }

    Object.assign(job, updates);
    this.activeJobs.set(jobId, job);
    this.saveJobs();
  }

  public updateProgress(jobId: string, progress: number, processedItems?: number, totalItems?: number): void {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    job.progress = Math.min(100, Math.max(0, progress));
    if (processedItems !== undefined) job.processedItems = processedItems;
    if (totalItems !== undefined) job.totalItems = totalItems;

    this.updateJob(jobId, job);
  }

  public startJob(jobId: string, pid?: number): void {
    this.updateJob(jobId, {
      status: 'running',
      startTime: Date.now(),
      pid
    });
  }

  public completeJob(jobId: string, metadata?: Record<string, any>): void {
    this.updateJob(jobId, {
      status: 'completed',
      endTime: Date.now(),
      progress: 100,
      metadata: { ...this.getJob(jobId)?.metadata, ...metadata }
    });
    this.logger.info(`Job completed: ${jobId}`);
  }

  public failJob(jobId: string, errorMessage: string): void {
    this.updateJob(jobId, {
      status: 'failed',
      endTime: Date.now(),
      errorMessage
    });
    this.logger.error(`Job failed: ${jobId} - ${errorMessage}`);
  }

  public cancelJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'failed') {
      return false;
    }

    this.updateJob(jobId, {
      status: 'cancelled',
      endTime: Date.now()
    });
    
    this.logger.info(`Job cancelled: ${jobId}`);
    return true;
  }

  public getJob(jobId: string): BackgroundJob | undefined {
    return this.activeJobs.get(jobId);
  }

  public getAllJobs(): BackgroundJob[] {
    return Array.from(this.activeJobs.values()).sort((a, b) => b.startTime - a.startTime);
  }

  public getActiveJobs(): BackgroundJob[] {
    return this.getAllJobs().filter(job => 
      job.status === 'pending' || job.status === 'running'
    );
  }

  public getCompletedJobs(): BackgroundJob[] {
    return this.getAllJobs().filter(job => 
      job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled'
    );
  }

  public cleanupOldJobs(maxAge: number = 7 * 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAge;
    const jobsToRemove: string[] = [];

    this.activeJobs.forEach((job, id) => {
      if ((job.endTime || job.startTime) < cutoff && 
          (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled')) {
        jobsToRemove.push(id);
        
        // Clean up log files
        if (job.logFile && fs.existsSync(job.logFile)) {
          try { fs.unlinkSync(job.logFile); } catch {}
        }
        if (job.outputFile && fs.existsSync(job.outputFile)) {
          try { fs.unlinkSync(job.outputFile); } catch {}
        }
      }
    });

    jobsToRemove.forEach(id => this.activeJobs.delete(id));
    
    if (jobsToRemove.length > 0) {
      this.saveJobs();
      this.logger.info(`Cleaned up ${jobsToRemove.length} old jobs`);
    }

    return jobsToRemove.length;
  }

  public writeJobLog(jobId: string, message: string): void {
    const job = this.getJob(jobId);
    if (!job || !job.logFile) return;

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    try {
      fs.appendFileSync(job.logFile, logEntry);
    } catch (error) {
      this.logger.warn(`Failed to write job log: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public readJobLog(jobId: string): string | null {
    const job = this.getJob(jobId);
    if (!job || !job.logFile || !fs.existsSync(job.logFile)) {
      return null;
    }

    try {
      return fs.readFileSync(job.logFile, 'utf8');
    } catch (error) {
      return null;
    }
  }

  private generateJobId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `job_${timestamp}_${random}`;
  }

  public formatJobForDisplay(job: BackgroundJob): string {
    const duration = job.endTime ? job.endTime - job.startTime : Date.now() - job.startTime;
    const durationStr = this.formatDuration(duration);
    const statusIcon = this.getStatusIcon(job.status);
    const progressBar = this.createProgressBar(job.progress);

    let output = `${statusIcon} ${job.id} - ${job.command} ${job.args.join(' ')}\n`;
    output += `   Progress: ${progressBar} ${job.progress}%\n`;
    output += `   Duration: ${durationStr}`;
    
    if (job.processedItems && job.totalItems) {
      output += ` | Items: ${job.processedItems}/${job.totalItems}`;
    }
    
    if (job.errorMessage) {
      output += `\n   Error: ${job.errorMessage}`;
    }

    return output;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
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
    return `[${'\u2588'.repeat(filled)}${' '.repeat(empty)}]`;
  }
}

// Singleton instances
export const performanceMonitor = new PerformanceMonitor();
export const jobManager = new JobManager();