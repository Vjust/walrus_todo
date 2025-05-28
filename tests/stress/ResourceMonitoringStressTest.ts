#!/usr/bin/env ts-node

import { BackgroundCommandOrchestrator, ResourceUsage } from '../../apps/cli/src/utils/BackgroundCommandOrchestrator';
import { PerformanceMonitor } from '../../apps/cli/src/utils/PerformanceMonitor';
import { ResourceManager } from '../../apps/cli/src/utils/ResourceManager';
import { Logger } from '../../apps/cli/src/utils/Logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Extended Resource Monitoring Stress Test
 * 
 * This script runs extended stress tests on the resource monitoring system:
 * - 30+ minute continuous operation
 * - High load scenarios
 * - Memory leak detection
 * - Resource cleanup validation
 */

interface ResourceSnapshot {
  timestamp: number;
  systemMemory: {
    total: number;
    free: number;
    used: number;
    percentage: number;
  };
  processMemory: NodeJS.MemoryUsage;
  orchestratorUsage: ResourceUsage;
  jobCount: {
    active: number;
    completed: number;
    failed: number;
    total: number;
  };
  performanceMetrics: {
    avgDuration: number;
    successRate: number;
    totalOperations: number;
  };
}

interface StressTestResults {
  duration: number;
  snapshots: ResourceSnapshot[];
  memoryLeakDetected: boolean;
  maxMemoryUsage: number;
  avgMemoryUsage: number;
  resourceCleanupSuccess: boolean;
  errors: string[];
  summary: {
    totalJobs: number;
    successfulJobs: number;
    failedJobs: number;
    peakConcurrency: number;
    resourceStability: 'STABLE' | 'UNSTABLE' | 'CRITICAL';
  };
}

class ResourceMonitoringStressTest {
  private orchestrator: BackgroundCommandOrchestrator;
  private performanceMonitor: PerformanceMonitor;
  private resourceManager: ResourceManager;
  private logger: Logger;
  private testDir: string;
  private snapshots: ResourceSnapshot[] = [];
  private errors: string[] = [];
  private startTime: number = 0;
  private isRunning: boolean = false;

  constructor() {
    this.testDir = path.join(os.tmpdir(), 'waltodo-stress-test', Date.now().toString());
    this.logger = new Logger('ResourceStressTest');
    this.setupTestEnvironment();
  }

  private setupTestEnvironment(): void {
    // Create test directory
    if (!fs.existsSync(this.testDir)) {
      fs.mkdirSync(this.testDir, { recursive: true });
    }

    // Initialize components
    this.orchestrator = new BackgroundCommandOrchestrator(this.testDir);
    this.performanceMonitor = new PerformanceMonitor(path.join(this.testDir, 'performance'));
    this.resourceManager = ResourceManager.getInstance({ autoDispose: false });

    // Setup monitoring
    this.setupMonitoring();
  }

  private setupMonitoring(): void {
    // Resource update monitoring
    this.orchestrator.on('resourceUpdate', (usage: ResourceUsage) => {
      if (this.isRunning) {
        this.takeSnapshot(usage);
      }
    });

    // Error monitoring
    this.orchestrator.on('jobFailed', (job, error) => {
      this.errors.push(`Job ${job.id} failed: ${error.message}`);
    });

    // Process monitoring
    process.on('warning', (warning) => {
      this.errors.push(`Process warning: ${warning.message}`);
    });
  }

  private takeSnapshot(orchestratorUsage: ResourceUsage): void {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;

      const jobs = this.orchestrator.getJobStatus();
      const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'pending');
      const completedJobs = jobs.filter(j => j.status === 'completed');
      const failedJobs = jobs.filter(j => j.status === 'failed');

      const report = this.performanceMonitor.generateReport();

      const snapshot: ResourceSnapshot = {
        timestamp: Date.now(),
        systemMemory: {
          total: totalMem,
          free: freeMem,
          used: usedMem,
          percentage: usedMem / totalMem
        },
        processMemory: process.memoryUsage(),
        orchestratorUsage,
        jobCount: {
          active: activeJobs.length,
          completed: completedJobs.length,
          failed: failedJobs.length,
          total: jobs.length
        },
        performanceMetrics: {
          avgDuration: report.avgDuration,
          successRate: report.successRate,
          totalOperations: report.totalOperations
        }
      };

      this.snapshots.push(snapshot);

      // Log every 5 minutes
      if (this.snapshots.length % 60 === 0) { // Assuming 5-second intervals
        this.logger.info(`Stress test progress: ${Math.floor((Date.now() - this.startTime) / 60000)}min, ` +
          `Memory: ${(snapshot.systemMemory.percentage * 100).toFixed(1)}%, ` +
          `Active jobs: ${snapshot.jobCount.active}, ` +
          `Total jobs: ${snapshot.jobCount.total}`);
      }
    } catch (error) {
      this.errors.push(`Failed to take snapshot: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Run continuous operation stress test
   */
  async runContinuousOperationTest(durationMinutes: number = 30): Promise<StressTestResults> {
    this.logger.info(`Starting continuous operation stress test for ${durationMinutes} minutes`);
    
    this.startTime = Date.now();
    this.isRunning = true;
    this.snapshots = [];
    this.errors = [];

    const endTime = this.startTime + (durationMinutes * 60 * 1000);

    try {
      // Start background job creation
      const jobCreationInterval = setInterval(async () => {
        if (Date.now() >= endTime) {
          clearInterval(jobCreationInterval);
          return;
        }

        try {
          // Create different types of jobs
          const jobTypes = ['store', 'sync', 'ai', 'image'];
          const randomType = jobTypes[Math.floor(Math.random() * jobTypes.length)];
          
          await this.orchestrator.executeInBackground(randomType, [`test-file-${Date.now()}.txt`], {});
        } catch (error) {
          // Expected for concurrency limits
          if (!(error as Error).message.includes('concurrency limit')) {
            this.errors.push(`Job creation failed: ${(error as Error).message}`);
          }
        }
      }, 2000); // Create job every 2 seconds

      // Wait for test duration
      while (Date.now() < endTime) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Force garbage collection periodically
        if (global.gc && Date.now() % 30000 < 1000) {
          global.gc();
        }
      }

      this.isRunning = false;
      clearInterval(jobCreationInterval);

      // Wait for remaining jobs to complete
      this.logger.info('Waiting for remaining jobs to complete...');
      await this.waitForJobCompletion(30000); // 30 second timeout

    } finally {
      await this.cleanup();
    }

    return this.generateResults();
  }

  /**
   * Run high load stress test
   */
  async runHighLoadTest(): Promise<StressTestResults> {
    this.logger.info('Starting high load stress test');
    
    this.startTime = Date.now();
    this.isRunning = true;
    this.snapshots = [];
    this.errors = [];

    try {
      // Phase 1: Rapid job creation
      this.logger.info('Phase 1: Rapid job creation');
      const rapidJobs = [];
      for (let i = 0; i < 100; i++) {
        try {
          const jobId = await this.orchestrator.executeInBackground('store', [`rapid-${i}.txt`], {});
          rapidJobs.push(jobId);
        } catch (error) {
          if (!(error as Error).message.includes('concurrency limit')) {
            this.errors.push(`Rapid job creation failed: ${(error as Error).message}`);
          }
        }
        
        // Small delay to prevent overwhelming
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Phase 2: Monitor for 10 minutes under load
      this.logger.info('Phase 2: Monitoring under load');
      const loadEndTime = Date.now() + (10 * 60 * 1000);
      
      const loadInterval = setInterval(async () => {
        if (Date.now() >= loadEndTime) {
          clearInterval(loadInterval);
          return;
        }

        // Create continuous load
        for (let i = 0; i < 5; i++) {
          try {
            await this.orchestrator.executeInBackground('sync', [], {});
          } catch (error) {
            // Expected for concurrency limits
          }
        }
      }, 5000);

      while (Date.now() < loadEndTime) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      clearInterval(loadInterval);

      // Phase 3: Cleanup and monitoring
      this.logger.info('Phase 3: Cleanup phase');
      await this.waitForJobCompletion(60000); // 1 minute timeout

    } finally {
      this.isRunning = false;
      await this.cleanup();
    }

    return this.generateResults();
  }

  /**
   * Run memory leak detection test
   */
  async runMemoryLeakTest(): Promise<StressTestResults> {
    this.logger.info('Starting memory leak detection test');
    
    this.startTime = Date.now();
    this.isRunning = true;
    this.snapshots = [];
    this.errors = [];

    try {
      // Run multiple cycles of job creation and completion
      for (let cycle = 0; cycle < 20; cycle++) {
        this.logger.info(`Memory leak test cycle ${cycle + 1}/20`);
        
        // Create batch of jobs
        const batchJobs = [];
        for (let i = 0; i < 20; i++) {
          try {
            const jobId = await this.orchestrator.executeInBackground('store', [`leak-test-${cycle}-${i}.txt`], {});
            batchJobs.push(jobId);
          } catch (error) {
            // Expected for concurrency limits
          }
        }

        // Wait for batch completion
        await Promise.all(batchJobs.map(jobId => 
          this.orchestrator.waitForJob(jobId, 10000).catch(() => {})
        ));

        // Force garbage collection
        if (global.gc) {
          global.gc();
        }

        // Take memory snapshot
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } finally {
      this.isRunning = false;
      await this.cleanup();
    }

    return this.generateResults();
  }

  private async waitForJobCompletion(timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const activeJobs = this.orchestrator.getJobStatus().filter(j => 
        j.status === 'running' || j.status === 'pending'
      );
      
      if (activeJobs.length === 0) {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private async cleanup(): Promise<void> {
    try {
      await this.orchestrator.shutdown();
      await this.resourceManager.disposeAll({ continueOnError: true });
    } catch (error) {
      this.errors.push(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private generateResults(): StressTestResults {
    const duration = Date.now() - this.startTime;
    
    // Analyze memory usage
    const memoryUsages = this.snapshots.map(s => s.systemMemory.percentage);
    const maxMemoryUsage = Math.max(...memoryUsages);
    const avgMemoryUsage = memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length;
    
    // Detect memory leaks (increasing trend)
    const memoryLeakDetected = this.detectMemoryLeak();
    
    // Calculate job statistics
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    const totalJobs = lastSnapshot?.jobCount.total || 0;
    const successfulJobs = lastSnapshot?.jobCount.completed || 0;
    const failedJobs = lastSnapshot?.jobCount.failed || 0;
    const peakConcurrency = Math.max(...this.snapshots.map(s => s.jobCount.active));
    
    // Determine resource stability
    const resourceStability = this.assessResourceStability();

    return {
      duration,
      snapshots: this.snapshots,
      memoryLeakDetected,
      maxMemoryUsage,
      avgMemoryUsage,
      resourceCleanupSuccess: this.errors.filter(e => e.includes('Cleanup failed')).length === 0,
      errors: this.errors,
      summary: {
        totalJobs,
        successfulJobs,
        failedJobs,
        peakConcurrency,
        resourceStability
      }
    };
  }

  private detectMemoryLeak(): boolean {
    if (this.snapshots.length < 10) return false;
    
    // Take samples from beginning and end
    const earlySnapshots = this.snapshots.slice(0, 5);
    const lateSnapshots = this.snapshots.slice(-5);
    
    const earlyAvg = earlySnapshots.reduce((sum, s) => sum + s.processMemory.heapUsed, 0) / earlySnapshots.length;
    const lateAvg = lateSnapshots.reduce((sum, s) => sum + s.processMemory.heapUsed, 0) / lateSnapshots.length;
    
    // Consider it a leak if memory increased by more than 50% and > 50MB
    const increase = lateAvg - earlyAvg;
    const percentIncrease = increase / earlyAvg;
    
    return percentIncrease > 0.5 && increase > 50 * 1024 * 1024;
  }

  private assessResourceStability(): 'STABLE' | 'UNSTABLE' | 'CRITICAL' {
    if (this.snapshots.length === 0) return 'CRITICAL';
    
    const memoryUsages = this.snapshots.map(s => s.systemMemory.percentage);
    const maxMemory = Math.max(...memoryUsages);
    const variance = this.calculateVariance(memoryUsages);
    
    if (maxMemory > 0.9 || variance > 0.1) return 'CRITICAL';
    if (maxMemory > 0.8 || variance > 0.05) return 'UNSTABLE';
    return 'STABLE';
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Generate detailed report
   */
  generateReport(results: StressTestResults): string {
    const report = [];
    
    report.push('='.repeat(60));
    report.push('RESOURCE MONITORING STRESS TEST REPORT');
    report.push('='.repeat(60));
    report.push('');
    
    // Summary
    report.push('SUMMARY:');
    report.push(`  Duration: ${Math.floor(results.duration / 60000)}m ${Math.floor((results.duration % 60000) / 1000)}s`);
    report.push(`  Total Jobs: ${results.summary.totalJobs}`);
    report.push(`  Successful Jobs: ${results.summary.successfulJobs}`);
    report.push(`  Failed Jobs: ${results.summary.failedJobs}`);
    report.push(`  Peak Concurrency: ${results.summary.peakConcurrency}`);
    report.push(`  Resource Stability: ${results.summary.resourceStability}`);
    report.push('');
    
    // Memory Analysis
    report.push('MEMORY ANALYSIS:');
    report.push(`  Memory Leak Detected: ${results.memoryLeakDetected ? 'YES' : 'NO'}`);
    report.push(`  Max Memory Usage: ${(results.maxMemoryUsage * 100).toFixed(1)}%`);
    report.push(`  Avg Memory Usage: ${(results.avgMemoryUsage * 100).toFixed(1)}%`);
    report.push(`  Resource Cleanup Success: ${results.resourceCleanupSuccess ? 'YES' : 'NO'}`);
    report.push('');
    
    // Errors
    if (results.errors.length > 0) {
      report.push('ERRORS:');
      results.errors.slice(0, 10).forEach(error => {
        report.push(`  ${error}`);
      });
      if (results.errors.length > 10) {
        report.push(`  ... and ${results.errors.length - 10} more errors`);
      }
      report.push('');
    }
    
    // Performance Timeline
    if (results.snapshots.length > 0) {
      report.push('PERFORMANCE TIMELINE (last 10 snapshots):');
      const lastSnapshots = results.snapshots.slice(-10);
      report.push('  Time     | Memory | Active | Total | Errors');
      report.push('  ---------|--------|--------|-------|-------');
      lastSnapshots.forEach(snapshot => {
        const time = new Date(snapshot.timestamp).toLocaleTimeString();
        const memory = (snapshot.systemMemory.percentage * 100).toFixed(1);
        report.push(`  ${time} | ${memory.padStart(5)}% | ${snapshot.jobCount.active.toString().padStart(6)} | ${snapshot.jobCount.total.toString().padStart(5)} | ${results.errors.length.toString().padStart(5)}`);
      });
    }
    
    return report.join('\n');
  }

  /**
   * Save results to file
   */
  saveResults(results: StressTestResults, filename?: string): string {
    const reportFile = filename || path.join(this.testDir, `stress-test-${Date.now()}.json`);
    const reportText = path.join(this.testDir, `stress-test-${Date.now()}.txt`);
    
    // Save JSON results
    fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
    
    // Save text report
    fs.writeFileSync(reportText, this.generateReport(results));
    
    this.logger.info(`Results saved to: ${reportFile}`);
    this.logger.info(`Report saved to: ${reportText}`);
    
    return reportFile;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'continuous';
  const duration = parseInt(args[1]) || 30;

  const tester = new ResourceMonitoringStressTest();
  let results: StressTestResults;

  try {
    switch (testType) {
      case 'continuous':
        results = await tester.runContinuousOperationTest(duration);
        break;
      case 'load':
        results = await tester.runHighLoadTest();
        break;
      case 'memory':
        results = await tester.runMemoryLeakTest();
        break;
      default:
        console.error('Unknown test type. Use: continuous, load, or memory');
        process.exit(1);
    }

    console.log(tester.generateReport(results));
    const resultsFile = tester.saveResults(results);
    
    // Exit with error code if critical issues found
    if (results.summary.resourceStability === 'CRITICAL' || results.memoryLeakDetected) {
      process.exit(1);
    }

  } catch (error) {
    console.error('Stress test failed:', error);
    process.exit(1);
  }
}

// Export for testing
export { ResourceMonitoringStressTest, StressTestResults, ResourceSnapshot };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}