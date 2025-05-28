#!/usr/bin/env ts-node

/**
 * Comprehensive Performance Benchmark for BackgroundCommandOrchestrator
 * 
 * This script tests and measures the performance impact of the BackgroundCommandOrchestrator
 * on CLI command execution, including lazy initialization, resource monitoring, and job management.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, SpawnOptions } from 'child_process';
import { performance } from 'perf_hooks';
import chalk from 'chalk';

interface BenchmarkResult {
  testName: string;
  orchestratorEnabled: boolean;
  executionTime: number;
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  cpuUsage?: {
    user: number;
    system: number;
  };
  success: boolean;
  errorMessage?: string;
  additionalMetrics?: Record<string, any>;
}

interface PerformanceReport {
  testSuite: string;
  timestamp: Date;
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    totalMemory: number;
    freeMemory: number;
  };
  results: BenchmarkResult[];
  analysis: {
    averageOverhead: number;
    memoryOverhead: number;
    recommendedThreshold: number;
    optimizationRecommendations: string[];
  };
}

class PerformanceBenchmark {
  private waltodoPath: string;
  private tempDir: string;
  private testResults: BenchmarkResult[] = [];

  constructor() {
    this.waltodoPath = this.findWaltodoExecutable();
    this.tempDir = path.join(os.tmpdir(), 'waltodo-benchmark', Date.now().toString());
    this.ensureTempDir();
  }

  private findWaltodoExecutable(): string {
    const possiblePaths = [
      path.join(process.cwd(), 'bin', 'run'),
      path.join(process.cwd(), 'bin', 'run.js'),
      path.join(process.cwd(), 'apps', 'cli', 'bin', 'run'),
      'waltodo',
      'npx waltodo'
    ];

    for (const execPath of possiblePaths) {
      if (fs.existsSync(execPath)) {
        console.log(chalk.green(`Found executable: ${execPath}`));
        return execPath;
      }
    }

    // Default to node with run script
    const fallback = path.join(process.cwd(), 'bin', 'run');
    console.log(chalk.yellow(`Using fallback executable: node ${fallback}`));
    return fallback;
  }

  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  private async measureCommand(
    command: string,
    args: string[],
    options: {
      orchestratorEnabled: boolean;
      testName: string;
      timeout?: number;
    }
  ): Promise<BenchmarkResult> {
    const { orchestratorEnabled, testName, timeout = 30000 } = options;

    const env = {
      ...process.env,
      WALTODO_SKIP_ORCHESTRATOR: orchestratorEnabled ? 'false' : 'true',
      WALRUS_TODO_CONFIG_DIR: this.tempDir,
      NODE_ENV: 'test'
    };

    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    const startCpu = process.cpuUsage();

    let success = false;
    let errorMessage: string | undefined;
    let additionalMetrics: Record<string, any> = {};

    try {
      const result = await this.executeCommand(command, args, { env, timeout });
      success = result.code === 0;
      if (!success) {
        errorMessage = result.stderr || `Exit code: ${result.code}`;
      }
      additionalMetrics = {
        exitCode: result.code,
        stdoutLength: result.stdout.length,
        stderrLength: result.stderr.length
      };
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    const endCpu = process.cpuUsage(startCpu);

    return {
      testName,
      orchestratorEnabled,
      executionTime: endTime - startTime,
      memoryUsage: {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external
      },
      cpuUsage: {
        user: endCpu.user / 1000, // Convert to milliseconds
        system: endCpu.system / 1000
      },
      success,
      errorMessage,
      additionalMetrics
    };
  }

  private executeCommand(
    command: string,
    args: string[],
    options: SpawnOptions & { timeout?: number }
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const { timeout = 30000, ...spawnOptions } = options;
      
      // Determine if we're using node or direct executable
      let execCommand: string;
      let execArgs: string[];
      
      if (this.waltodoPath.endsWith('run') || this.waltodoPath.endsWith('run.js')) {
        execCommand = 'node';
        execArgs = [this.waltodoPath, command, ...args];
      } else {
        execCommand = this.waltodoPath;
        execArgs = [command, ...args];
      }

      const child = spawn(execCommand, execArgs, {
        ...spawnOptions,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      child.on('exit', (code) => {
        clearTimeout(timer);
        resolve({ code: code || 0, stdout, stderr });
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  private async runBasicCommandTests(): Promise<void> {
    console.log(chalk.blue('\n🧪 Running basic command tests...'));

    const basicCommands = [
      { cmd: 'add', args: ['Test todo item'], name: 'add-command' },
      { cmd: 'list', args: [], name: 'list-command' },
      { cmd: 'help', args: [], name: 'help-command' },
      { cmd: 'config', args: ['--show'], name: 'config-command' }
    ];

    for (const { cmd, args, name } of basicCommands) {
      console.log(chalk.gray(`  Testing: ${cmd} ${args.join(' ')}`));
      
      // Test with orchestrator enabled
      const withOrchestrator = await this.measureCommand(cmd, args, {
        orchestratorEnabled: true,
        testName: `${name}-with-orchestrator`
      });
      this.testResults.push(withOrchestrator);

      // Test with orchestrator disabled
      const withoutOrchestrator = await this.measureCommand(cmd, args, {
        orchestratorEnabled: false,
        testName: `${name}-without-orchestrator`
      });
      this.testResults.push(withoutOrchestrator);

      // Brief pause between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private async runResourceIntensiveTests(): Promise<void> {
    console.log(chalk.blue('\n🔥 Running resource-intensive tests...'));

    const intensiveCommands = [
      { cmd: 'store', args: ['--mock', '--file', '/dev/null'], name: 'store-command' },
      { cmd: 'sync', args: ['--mock'], name: 'sync-command' }
    ];

    for (const { cmd, args, name } of intensiveCommands) {
      console.log(chalk.gray(`  Testing: ${cmd} ${args.join(' ')}`));
      
      // Test with orchestrator enabled
      const withOrchestrator = await this.measureCommand(cmd, args, {
        orchestratorEnabled: true,
        testName: `${name}-with-orchestrator`,
        timeout: 60000
      });
      this.testResults.push(withOrchestrator);

      // Test with orchestrator disabled
      const withoutOrchestrator = await this.measureCommand(cmd, args, {
        orchestratorEnabled: false,
        testName: `${name}-without-orchestrator`,
        timeout: 60000
      });
      this.testResults.push(withoutOrchestrator);

      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  private async testLazyInitialization(): Promise<void> {
    console.log(chalk.blue('\n⚡ Testing lazy initialization pattern...'));

    // Test rapid sequential calls to measure lazy loading overhead
    const rapidCalls = [];
    const testCount = 5;

    for (let i = 0; i < testCount; i++) {
      rapidCalls.push(
        this.measureCommand('help', [], {
          orchestratorEnabled: true,
          testName: `lazy-init-call-${i + 1}`
        })
      );
    }

    const results = await Promise.all(rapidCalls);
    this.testResults.push(...results);

    // Analyze lazy loading pattern
    const firstCallTime = results[0].executionTime;
    const subsequentCalls = results.slice(1);
    const avgSubsequentTime = subsequentCalls.reduce((sum, r) => sum + r.executionTime, 0) / subsequentCalls.length;

    console.log(chalk.green(`  First call: ${firstCallTime.toFixed(2)}ms`));
    console.log(chalk.green(`  Avg subsequent: ${avgSubsequentTime.toFixed(2)}ms`));
    console.log(chalk.green(`  Lazy loading benefit: ${((firstCallTime - avgSubsequentTime) / firstCallTime * 100).toFixed(1)}%`));
  }

  private async testResourceMonitoring(): Promise<void> {
    console.log(chalk.blue('\n📊 Testing resource monitoring overhead...'));

    // Run a longer command to measure resource monitoring impact
    const longRunningTest = await this.measureCommand('help', ['--verbose'], {
      orchestratorEnabled: true,
      testName: 'resource-monitoring-test'
    });

    this.testResults.push(longRunningTest);

    // Test memory monitoring accuracy
    const memoryBaseline = process.memoryUsage();
    console.log(chalk.gray(`  Memory baseline: ${Math.round(memoryBaseline.heapUsed / 1024 / 1024)}MB`));
  }

  private async testJobThrottling(): Promise<void> {
    console.log(chalk.blue('\n🚦 Testing job throttling performance...'));

    // Simulate multiple concurrent job starts
    const concurrentJobs = [];
    const jobCount = 3;

    for (let i = 0; i < jobCount; i++) {
      concurrentJobs.push(
        this.measureCommand('list', [], {
          orchestratorEnabled: true,
          testName: `concurrent-job-${i + 1}`
        })
      );
    }

    const results = await Promise.all(concurrentJobs);
    this.testResults.push(...results);

    const avgExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
    console.log(chalk.green(`  Average execution time with concurrency: ${avgExecutionTime.toFixed(2)}ms`));
  }

  private generateAnalysis(): PerformanceReport['analysis'] {
    // Calculate overhead by comparing enabled vs disabled results
    const pairs = this.groupResultsByTest();
    const overheadMeasurements: number[] = [];
    const memoryOverheadMeasurements: number[] = [];

    for (const [testName, results] of pairs) {
      const withOrchestrator = results.find(r => r.orchestratorEnabled);
      const withoutOrchestrator = results.find(r => !r.orchestratorEnabled);

      if (withOrchestrator && withoutOrchestrator) {
        const overhead = withOrchestrator.executionTime - withoutOrchestrator.executionTime;
        const memoryOverhead = withOrchestrator.memoryUsage.heapUsed - withoutOrchestrator.memoryUsage.heapUsed;
        
        overheadMeasurements.push(overhead);
        memoryOverheadMeasurements.push(memoryOverhead);
      }
    }

    const averageOverhead = overheadMeasurements.reduce((sum, o) => sum + o, 0) / overheadMeasurements.length;
    const memoryOverhead = memoryOverheadMeasurements.reduce((sum, o) => sum + o, 0) / memoryOverheadMeasurements.length;

    // Generate recommendations
    const recommendations: string[] = [];

    if (averageOverhead > 100) {
      recommendations.push('Consider optimizing orchestrator initialization - overhead is >100ms');
    }

    if (memoryOverhead > 10 * 1024 * 1024) { // 10MB
      recommendations.push('Memory overhead is significant (>10MB) - review memory usage patterns');
    }

    if (averageOverhead < 50) {
      recommendations.push('Orchestrator overhead is acceptable (<50ms) - lazy loading is working well');
    }

    if (this.testResults.some(r => !r.success)) {
      recommendations.push('Some tests failed - investigate compatibility issues');
    }

    recommendations.push('Monitor 5-second resource monitoring intervals for production impact');
    recommendations.push('Consider implementing CPU usage monitoring in ResourceUsage interface');

    return {
      averageOverhead,
      memoryOverhead,
      recommendedThreshold: 100, // 100ms threshold
      optimizationRecommendations: recommendations
    };
  }

  private groupResultsByTest(): Map<string, BenchmarkResult[]> {
    const groups = new Map<string, BenchmarkResult[]>();

    for (const result of this.testResults) {
      const baseName = result.testName.replace(/-with(out)?-orchestrator$/, '');
      if (!groups.has(baseName)) {
        groups.set(baseName, []);
      }
      groups.get(baseName)!.push(result);
    }

    return groups;
  }

  private generateReport(): PerformanceReport {
    return {
      testSuite: 'BackgroundCommandOrchestrator Performance Benchmark',
      timestamp: new Date(),
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem()
      },
      results: this.testResults,
      analysis: this.generateAnalysis()
    };
  }

  private async displayResults(): Promise<void> {
    const report = this.generateReport();
    
    console.log(chalk.bold.cyan('\n📊 PERFORMANCE BENCHMARK RESULTS'));
    console.log(chalk.gray('='.repeat(60)));
    
    console.log(chalk.bold('\n🖥️  System Information:'));
    console.log(`  Platform: ${report.system.platform} ${report.system.arch}`);
    console.log(`  Node.js: ${report.system.nodeVersion}`);
    console.log(`  Memory: ${Math.round(report.system.totalMemory / 1024 / 1024 / 1024)}GB total, ${Math.round(report.system.freeMemory / 1024 / 1024 / 1024)}GB free`);

    console.log(chalk.bold('\n📈 Performance Analysis:'));
    console.log(`  Average Overhead: ${chalk.yellow(report.analysis.averageOverhead.toFixed(2))}ms`);
    console.log(`  Memory Overhead: ${chalk.yellow(Math.round(report.analysis.memoryOverhead / 1024))}KB`);
    console.log(`  Recommended Threshold: ${report.analysis.recommendedThreshold}ms`);

    const overheadStatus = report.analysis.averageOverhead < report.analysis.recommendedThreshold 
      ? chalk.green('✅ ACCEPTABLE') 
      : chalk.red('⚠️  HIGH');
    console.log(`  Status: ${overheadStatus}`);

    console.log(chalk.bold('\n📋 Detailed Results:'));
    const groups = this.groupResultsByTest();
    
    for (const [testName, results] of groups) {
      const withOrchestrator = results.find(r => r.orchestratorEnabled);
      const withoutOrchestrator = results.find(r => !r.orchestratorEnabled);

      console.log(chalk.cyan(`\n  ${testName}:`));
      
      if (withOrchestrator) {
        const status = withOrchestrator.success ? chalk.green('✅') : chalk.red('❌');
        console.log(`    With orchestrator: ${status} ${withOrchestrator.executionTime.toFixed(2)}ms`);
        console.log(`      Memory: ${Math.round(withOrchestrator.memoryUsage.heapUsed / 1024)}KB`);
      }
      
      if (withoutOrchestrator) {
        const status = withoutOrchestrator.success ? chalk.green('✅') : chalk.red('❌');
        console.log(`    Without orchestrator: ${status} ${withoutOrchestrator.executionTime.toFixed(2)}ms`);
        console.log(`      Memory: ${Math.round(withoutOrchestrator.memoryUsage.heapUsed / 1024)}KB`);
      }

      if (withOrchestrator && withoutOrchestrator) {
        const overhead = withOrchestrator.executionTime - withoutOrchestrator.executionTime;
        const overheadPercent = (overhead / withoutOrchestrator.executionTime) * 100;
        const color = overhead < 50 ? chalk.green : overhead < 100 ? chalk.yellow : chalk.red;
        console.log(`    Overhead: ${color(overhead.toFixed(2))}ms (${color(overheadPercent.toFixed(1))}%)`);
      }
    }

    console.log(chalk.bold('\n💡 Optimization Recommendations:'));
    report.analysis.optimizationRecommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });

    console.log(chalk.bold('\n🧪 Validation Results:'));
    
    // Test lazy initialization validation
    const lazyInitCalls = this.testResults.filter(r => r.testName.includes('lazy-init'));
    if (lazyInitCalls.length > 1) {
      const firstCall = lazyInitCalls[0];
      const subsequentCalls = lazyInitCalls.slice(1);
      const avgSubsequent = subsequentCalls.reduce((sum, r) => sum + r.executionTime, 0) / subsequentCalls.length;
      
      const lazyBenefit = ((firstCall.executionTime - avgSubsequent) / firstCall.executionTime) * 100;
      console.log(`  Lazy initialization: ${lazyBenefit > 0 ? chalk.green('✅ Working') : chalk.red('❌ Not working')} (${lazyBenefit.toFixed(1)}% improvement)`);
    }

    // Test environment variable bypass
    const skipTests = this.testResults.filter(r => !r.orchestratorEnabled);
    const enabledTests = this.testResults.filter(r => r.orchestratorEnabled);
    
    if (skipTests.length > 0 && enabledTests.length > 0) {
      console.log(`  WALTODO_SKIP_ORCHESTRATOR: ${chalk.green('✅ Working')} (${skipTests.length} tests bypassed)`);
    }

    // Overall orchestrator readiness
    const successRate = (this.testResults.filter(r => r.success).length / this.testResults.length) * 100;
    const readinessStatus = successRate > 90 ? chalk.green('✅ READY') : 
                           successRate > 70 ? chalk.yellow('⚠️  NEEDS ATTENTION') : 
                           chalk.red('❌ NOT READY');
    
    console.log(`  Overall readiness: ${readinessStatus} (${successRate.toFixed(1)}% success rate)`);

    console.log(chalk.gray('\n' + '='.repeat(60)));
  }

  private async saveReport(): Promise<void> {
    const report = this.generateReport();
    const reportPath = path.join(process.cwd(), 'performance-benchmark-report.json');
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(chalk.green(`\n💾 Report saved to: ${reportPath}`));

    // Also save a CSV summary
    const csvPath = path.join(process.cwd(), 'performance-benchmark-summary.csv');
    const csvContent = this.generateCSVSummary();
    fs.writeFileSync(csvPath, csvContent);
    console.log(chalk.green(`📊 CSV summary saved to: ${csvPath}`));
  }

  private generateCSVSummary(): string {
    const headers = [
      'TestName',
      'OrchestratorEnabled',
      'ExecutionTime(ms)',
      'MemoryUsage(KB)',
      'Success',
      'ErrorMessage'
    ];

    const rows = this.testResults.map(result => [
      result.testName,
      result.orchestratorEnabled.toString(),
      result.executionTime.toFixed(2),
      Math.round(result.memoryUsage.heapUsed / 1024).toString(),
      result.success.toString(),
      result.errorMessage || ''
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private cleanup(): void {
    if (fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    }
  }

  public async run(): Promise<void> {
    console.log(chalk.bold.cyan('🚀 Starting BackgroundCommandOrchestrator Performance Benchmark'));
    console.log(chalk.gray(`Using executable: ${this.waltodoPath}`));
    console.log(chalk.gray(`Temp directory: ${this.tempDir}`));

    try {
      await this.runBasicCommandTests();
      await this.testLazyInitialization();
      await this.runResourceIntensiveTests();
      await this.testResourceMonitoring();
      await this.testJobThrottling();

      await this.displayResults();
      await this.saveReport();

    } catch (error) {
      console.error(chalk.red('\n❌ Benchmark failed:'), error);
      process.exit(1);
    } finally {
      this.cleanup();
    }

    console.log(chalk.green('\n✅ Benchmark completed successfully!'));
  }
}

// Run the benchmark if this file is executed directly
if (require.main === module) {
  const benchmark = new PerformanceBenchmark();
  benchmark.run().catch(error => {
    console.error(chalk.red('Benchmark error:'), error);
    process.exit(1);
  });
}

export default PerformanceBenchmark;