import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../src/utils/Logger';

const logger = new Logger('monitoring');

export interface TestResult {
  name: string;
  duration: number;
  status: 'pass' | 'fail' | 'skip';
  error?: Error;
  timestamp: Date;
  category: string;
  metadata?: Record<string, any>;
}

export interface NetworkMetrics {
  latency: number;
  throughput: number;
  successRate: number;
  errorRate: number;
  timestamp: Date;
}

export interface ResourceUsage {
  cpu: number;
  memory: number;
  networkIO: number;
  diskIO: number;
  timestamp: Date;
}

export interface TestMetrics {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  averageDuration: number;
  totalDuration: number;
  successRate: number;
  categories: Record<
    string,
    {
      total: number;
      passed: number;
      failed: number;
      skipped: number;
    }
  >;
}

export class TestMonitor extends EventEmitter {
  private results: TestResult[] = [];
  private networkMetrics: NetworkMetrics[] = [];
  private resourceUsage: ResourceUsage[] = [];
  private startTime: Date;
  private outputDir: string;

  constructor(outputDir: string = './test-results') {
    super();
    this.startTime = new Date();
    this.outputDir = outputDir;
    this.ensureOutputDir();
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  recordTestResult(result: TestResult): void {
    this.results.push(result);
    this.emit('test:complete', result);

    if (result.status === 'fail') {
      this.emit('test:fail', result);
    }
  }

  recordNetworkMetrics(metrics: NetworkMetrics): void {
    this.networkMetrics.push(metrics);
    this.emit('metrics:network', metrics);
  }

  recordResourceUsage(usage: ResourceUsage): void {
    this.resourceUsage.push(usage);
    this.emit('metrics:resource', usage);
  }

  getTestMetrics(): TestMetrics {
    const categories: Record<string, any> = {};

    this.results.forEach(result => {
      if (!categories[result.category]) {
        categories[result.category] = {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
        };
      }

      categories[result.category].total++;
      categories[result.category][
        result.status === 'pass'
          ? 'passed'
          : result.status === 'fail'
            ? 'failed'
            : 'skipped'
      ]++;
    });

    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    const passedTests = this.results.filter(r => r.status === 'pass').length;
    const failedTests = this.results.filter(r => r.status === 'fail').length;
    const skippedTests = this.results.filter(r => r.status === 'skip').length;

    return {
      totalTests: this.results.length,
      passedTests,
      failedTests,
      skippedTests,
      averageDuration:
        this.results.length > 0 ? totalDuration / this.results.length : 0,
      totalDuration,
      successRate:
        this.results.length > 0 ? passedTests / this.results.length : 0,
      categories,
    };
  }

  generateReport(): void {
    const metrics = this.getTestMetrics();
    const endTime = new Date();

    const report = {
      summary: {
        startTime: this.startTime,
        endTime,
        duration: endTime.getTime() - this.startTime.getTime(),
        ...metrics,
      },
      testResults: this.results,
      networkMetrics: this.aggregateNetworkMetrics(),
      resourceUsage: this.aggregateResourceUsage(),
      failedTests: this.results
        .filter(r => r.status === 'fail')
        .map(r => ({
          name: r.name,
          category: r.category,
          error: r.error?.message || 'Unknown error',
          stack: r.error?.stack,
        })),
    };

    const reportPath = path.join(
      this.outputDir,
      `test-report-${Date.now()}.json`
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    this.generateHTMLReport(report);
    logger.info(`Test report generated: ${reportPath}`);
  }

  private aggregateNetworkMetrics(): any {
    if (this.networkMetrics.length === 0) return null;

    const avgLatency =
      this.networkMetrics.reduce((sum, m) => sum + m.latency, 0) /
      this.networkMetrics.length;
    const avgThroughput =
      this.networkMetrics.reduce((sum, m) => sum + m.throughput, 0) /
      this.networkMetrics.length;
    const avgSuccessRate =
      this.networkMetrics.reduce((sum, m) => sum + m.successRate, 0) /
      this.networkMetrics.length;
    const avgErrorRate =
      this.networkMetrics.reduce((sum, m) => sum + m.errorRate, 0) /
      this.networkMetrics.length;

    return {
      averageLatency: avgLatency,
      averageThroughput: avgThroughput,
      averageSuccessRate: avgSuccessRate,
      averageErrorRate: avgErrorRate,
      samples: this.networkMetrics.length,
    };
  }

  private aggregateResourceUsage(): any {
    if (this.resourceUsage.length === 0) return null;

    const avgCpu =
      this.resourceUsage.reduce((sum, u) => sum + u.cpu, 0) /
      this.resourceUsage.length;
    const avgMemory =
      this.resourceUsage.reduce((sum, u) => sum + u.memory, 0) /
      this.resourceUsage.length;
    const avgNetworkIO =
      this.resourceUsage.reduce((sum, u) => sum + u.networkIO, 0) /
      this.resourceUsage.length;
    const avgDiskIO =
      this.resourceUsage.reduce((sum, u) => sum + u.diskIO, 0) /
      this.resourceUsage.length;

    return {
      averageCpu: avgCpu,
      averageMemory: avgMemory,
      averageNetworkIO: avgNetworkIO,
      averageDiskIO: avgDiskIO,
      samples: this.resourceUsage.length,
    };
  }

  private generateHTMLReport(report: any): void {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Report - ${new Date().toLocaleString()}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { background: #f0f0f0; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
    .metric { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .success { color: #28a745; }
    .failure { color: #dc3545; }
    .warning { color: #ffc107; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: bold; }
    tr:hover { background: #f8f9fa; }
    .chart { margin: 20px 0; }
  </style>
</head>
<body>
  <h1>Test Report</h1>
  
  <div class="summary">
    <h2>Summary</h2>
    <div class="metrics">
      <div class="metric">
        <h3>Total Tests</h3>
        <p>${report.summary.totalTests}</p>
      </div>
      <div class="metric">
        <h3>Passed</h3>
        <p class="success">${report.summary.passedTests}</p>
      </div>
      <div class="metric">
        <h3>Failed</h3>
        <p class="failure">${report.summary.failedTests}</p>
      </div>
      <div class="metric">
        <h3>Success Rate</h3>
        <p class="${report.summary.successRate >= 0.9 ? 'success' : 'warning'}">
          ${(report.summary.successRate * 100).toFixed(1)}%
        </p>
      </div>
      <div class="metric">
        <h3>Duration</h3>
        <p>${(report.summary.duration / 1000).toFixed(2)}s</p>
      </div>
    </div>
  </div>

  <h2>Failed Tests</h2>
  ${
    report.failedTests.length === 0
      ? '<p class="success">No failed tests!</p>'
      : `
    <table>
      <thead>
        <tr>
          <th>Test Name</th>
          <th>Category</th>
          <th>Error</th>
        </tr>
      </thead>
      <tbody>
        ${report.failedTests
          .map(
            (test: any) => `
          <tr>
            <td>${test.name}</td>
            <td>${test.category}</td>
            <td class="failure">${test.error}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `
  }

  <h2>Category Breakdown</h2>
  <table>
    <thead>
      <tr>
        <th>Category</th>
        <th>Total</th>
        <th>Passed</th>
        <th>Failed</th>
        <th>Success Rate</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(report.summary.categories)
        .map(
          ([category, stats]: [string, any]) => `
        <tr>
          <td>${category}</td>
          <td>${stats.total}</td>
          <td class="success">${stats.passed}</td>
          <td class="failure">${stats.failed}</td>
          <td class="${stats.passed / stats.total >= 0.9 ? 'success' : 'warning'}">
            ${((stats.passed / stats.total) * 100).toFixed(1)}%
          </td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  ${
    report.networkMetrics
      ? `
    <h2>Network Performance</h2>
    <div class="metrics">
      <div class="metric">
        <h3>Avg Latency</h3>
        <p>${report.networkMetrics.averageLatency.toFixed(2)}ms</p>
      </div>
      <div class="metric">
        <h3>Avg Throughput</h3>
        <p>${report.networkMetrics.averageThroughput.toFixed(2)} ops/s</p>
      </div>
      <div class="metric">
        <h3>Success Rate</h3>
        <p class="${report.networkMetrics.averageSuccessRate >= 0.95 ? 'success' : 'warning'}">
          ${(report.networkMetrics.averageSuccessRate * 100).toFixed(1)}%
        </p>
      </div>
    </div>
  `
      : ''
  }

  <script>
    // Add interactive features if needed
    logger.info('Test report loaded:', ${JSON.stringify(report.summary)});
  </script>
</body>
</html>
    `;

    const htmlPath = path.join(
      this.outputDir,
      `test-report-${Date.now()}.html`
    );
    fs.writeFileSync(htmlPath, html);
  }

  reset(): void {
    this.results = [];
    this.networkMetrics = [];
    this.resourceUsage = [];
    this.startTime = new Date();
  }
}

// Monitoring utilities
export class PerformanceMonitor {
  private measurements: Map<string, number[]> = new Map();

  startMeasurement(label: string): () => void {
    const startTime = Date.now();

    return () => {
      const duration = Date.now() - startTime;

      if (!this.measurements.has(label)) {
        this.measurements.set(label, []);
      }

      this.measurements.get(label)!.push(duration);
    };
  }

  getStats(
    label: string
  ): { avg: number; min: number; max: number; count: number } | null {
    const measurements = this.measurements.get(label);
    if (!measurements || measurements.length === 0) return null;

    return {
      avg: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      count: measurements.length,
    };
  }

  clear(): void {
    this.measurements.clear();
  }
}

// Test lifecycle hooks
export const testHooks = {
  beforeEach: (monitor: TestMonitor, testName: string, category: string) => {
    const startTime = Date.now();

    return {
      end: (status: 'pass' | 'fail' | 'skip', error?: Error) => {
        monitor.recordTestResult({
          name: testName,
          duration: Date.now() - startTime,
          status,
          error,
          timestamp: new Date(),
          category,
        });
      },
    };
  },

  afterAll: (monitor: TestMonitor) => {
    monitor.generateReport();
  },
};

// Network monitoring utilities
export async function measureNetworkOperation<T>(
  operation: () => Promise<T>,
  monitor: TestMonitor
): Promise<T> {
  const startTime = Date.now();
  let result: T;
  let error: Error | undefined;

  try {
    result = await operation();
  } catch (e) {
    error = e as Error;
    throw e;
  } finally {
    const latency = Date.now() - startTime;

    monitor.recordNetworkMetrics({
      latency,
      throughput: 1000 / latency, // operations per second
      successRate: error ? 0 : 1,
      errorRate: error ? 1 : 0,
      timestamp: new Date(),
    });
  }

  return result!;
}

// Resource monitoring utilities
export function monitorResourceUsage(
  monitor: TestMonitor,
  intervalMs: number = 1000
): () => void {
  const interval = setInterval(() => {
    // Simplified resource monitoring - in real implementation would use actual system metrics
    monitor.recordResourceUsage({
      cpu: Math.random() * 100,
      memory: Math.random() * 1000,
      networkIO: Math.random() * 100,
      diskIO: Math.random() * 50,
      timestamp: new Date(),
    });
  }, intervalMs);

  return () => clearInterval(interval);
}
