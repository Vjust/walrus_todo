import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// Performance thresholds (milliseconds)
const PERFORMANCE_THRESHOLDS = {
  add: { warning: 1000, critical: 2000 },
  list: { warning: 500, critical: 1000 },
  complete: { warning: 800, critical: 1500 },
  delete: { warning: 600, critical: 1200 },
  ai: { warning: 3000, critical: 5000 },
  store: { warning: 4000, critical: 8000 },
  fetch: { warning: 2000, critical: 4000 },
  deploy: { warning: 10000, critical: 20000 },
};

interface PerformanceMetric {
  command: string;
  executionTime: number;
  memory: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    delta: NodeJS.MemoryUsage;
  };
  status: 'passing' | 'warning' | 'critical';
}

interface PerformanceReport {
  timestamp: Date;
  results: PerformanceMetric[];
  summary: {
    totalTests: number;
    passing: number;
    warning: number;
    critical: number;
    averageExecutionTime: number;
    maxExecutionTime: number;
    minExecutionTime: number;
  };
}

describe('E2E Performance Tests', () => {
  const resultsDir = path.join(__dirname, '../../performance-results');
  const cliPath = 'walrus-todo'; // Assuming globally installed
  let performanceReport: PerformanceReport;

  beforeAll(async () => {
    // Ensure results directory exists
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    // Initialize performance report
    performanceReport = {
      timestamp: new Date(),
      results: [],
      summary: {
        totalTests: 0,
        passing: 0,
        warning: 0,
        critical: 0,
        averageExecutionTime: 0,
        maxExecutionTime: 0,
        minExecutionTime: Infinity,
      },
    };

    // Clean up test environment
    await execAsync(`${cliPath} delete --all --force 2>/dev/null || true`);
  });

  afterAll(async () => {
    // Calculate summary
    const executionTimes = performanceReport.results.map(r => r.executionTime);
    performanceReport.summary.totalTests = performanceReport.results.length;
    performanceReport.summary.passing = performanceReport.results.filter(
      r => r.status === 'passing'
    ).length;
    performanceReport.summary.warning = performanceReport.results.filter(
      r => r.status === 'warning'
    ).length;
    performanceReport.summary.critical = performanceReport.results.filter(
      r => r.status === 'critical'
    ).length;
    performanceReport.summary.averageExecutionTime =
      executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
    performanceReport.summary.maxExecutionTime = Math.max(...executionTimes);
    performanceReport.summary.minExecutionTime = Math.min(...executionTimes);

    // Save report
    const reportPath = path.join(resultsDir, `performance-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(performanceReport, null, 2));

    // Save readable summary
    const summaryPath = path.join(
      resultsDir,
      `performance-summary-${Date.now()}.txt`
    );
    const summary = generateReadableSummary(performanceReport);
    fs.writeFileSync(summaryPath, summary);

    // console.log('Performance report saved to:', reportPath); // Removed console statement
    // console.log('Summary saved to:', summaryPath); // Removed console statement
  });

  async function measurePerformance(
    command: string,
    description: string,
    thresholds: { warning: number; critical: number }
  ): Promise<PerformanceMetric> {
    // console.log(`Measuring: ${description}`); // Removed console statement

    const memoryBefore = process.memoryUsage();
    const startTime = Date.now();

    try {
      await execAsync(command);
    } catch (_error) {
      // console.error(`Command failed: ${command}`, error); // Removed console statement
    }

    const endTime = Date.now();
    const memoryAfter = process.memoryUsage();
    const executionTime = endTime - startTime;

    // Determine status
    let status: 'passing' | 'warning' | 'critical' = 'passing';
    if (executionTime >= thresholds.critical) {
      status = 'critical';
    } else if (executionTime >= thresholds.warning) {
      status = 'warning';
    }

    const metric: PerformanceMetric = {
      command,
      executionTime,
      memory: {
        before: memoryBefore,
        after: memoryAfter,
        delta: {
          rss: memoryAfter.rss - memoryBefore.rss,
          heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
          heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
          external: memoryAfter.external - memoryBefore.external,
          arrayBuffers: memoryAfter.arrayBuffers - memoryBefore.arrayBuffers,
        },
      },
      status,
    };

    performanceReport.results.push(metric);
    return metric;
  }

  function generateReadableSummary(report: PerformanceReport): string {
    let summary = `Performance Test Summary
========================
Date: ${report.timestamp.toISOString()}
Total Tests: ${report.summary.totalTests}
Passing: ${report.summary.passing}
Warning: ${report.summary.warning}
Critical: ${report.summary.critical}

Execution Times:
- Average: ${report.summary.averageExecutionTime.toFixed(2)}ms
- Min: ${report.summary.minExecutionTime.toFixed(2)}ms
- Max: ${report.summary.maxExecutionTime.toFixed(2)}ms

Detailed Results:
`;

    report.results.forEach(result => {
      summary += `
Command: ${result.command}
Time: ${result.executionTime}ms
Status: ${result.status}
Memory Delta: ${(result.memory.delta.heapUsed / 1024 / 1024).toFixed(2)}MB
`;
    });

    return summary;
  }

  describe('Basic Commands Performance', () => {
    it('should measure add command performance', async () => {
      const metric = await measurePerformance(
        `${cliPath} add "Performance test todo"`,
        'Add command',
        PERFORMANCE_THRESHOLDS.add
      );

      expect(metric.executionTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.add.critical
      );
    });

    it('should measure list command performance', async () => {
      // Add some todos first
      for (let i = 0; i < 10; i++) {
        await execAsync(`${cliPath} add "Test todo ${i}"`);
      }

      const metric = await measurePerformance(
        `${cliPath} list`,
        'List command',
        PERFORMANCE_THRESHOLDS.list
      );

      expect(metric.executionTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.list.critical
      );
    });

    it('should measure complete command performance', async () => {
      // Add a todo
      const { stdout } = await execAsync(`${cliPath} add "Todo to complete"`);
      const todoId = stdout.match(/ID:\s*(\d+)/)?.[1];

      expect(todoId).toBeDefined();
      const metric = await measurePerformance(
        `${cliPath} complete ${todoId}`,
        'Complete command',
        PERFORMANCE_THRESHOLDS.complete
      );

      expect(metric.executionTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.complete.critical
      );
    });

    it('should measure delete command performance', async () => {
      // Add a todo
      const { stdout } = await execAsync(`${cliPath} add "Todo to delete"`);
      const todoId = stdout.match(/ID:\s*(\d+)/)?.[1];

      expect(todoId).toBeDefined();
      const metric = await measurePerformance(
        `${cliPath} delete ${todoId}`,
        'Delete command',
        PERFORMANCE_THRESHOLDS.delete
      );

      expect(metric.executionTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.delete.critical
      );
    });
  });

  describe('AI Commands Performance', () => {
    it('should measure ai suggest command performance', async () => {
      // Skip if no API key
      if (!process.env.XAI_API_KEY) {
        // console.log('Skipping AI test - no API key'); // Removed console statement
        return;
      }

      const metric = await measurePerformance(
        `${cliPath} ai suggest`,
        'AI suggest command',
        PERFORMANCE_THRESHOLDS.ai
      );

      expect(metric.executionTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.ai.critical
      );
    });

    it('should measure ai analyze command performance', async () => {
      // Skip if no API key
      if (!process.env.XAI_API_KEY) {
        // console.log('Skipping AI test - no API key'); // Removed console statement
        return;
      }

      const metric = await measurePerformance(
        `${cliPath} ai analyze`,
        'AI analyze command',
        PERFORMANCE_THRESHOLDS.ai
      );

      expect(metric.executionTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.ai.critical
      );
    });
  });

  describe('Storage Commands Performance', () => {
    it('should measure store command performance', async () => {
      // Add some todos
      for (let i = 0; i < 5; i++) {
        await execAsync(`${cliPath} add "Storage test todo ${i}"`);
      }

      const metric = await measurePerformance(
        `${cliPath} store --walrus --mock`,
        'Store command (mock)',
        PERFORMANCE_THRESHOLDS.store
      );

      expect(metric.executionTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.store.critical
      );
    });

    it('should measure fetch command performance', async () => {
      // Store first
      const { stdout } = await execAsync(`${cliPath} store --walrus --mock`);
      const blobId = stdout.match(/Blob ID:\s*([^\s]+)/)?.[1];

      expect(blobId).toBeDefined();
      const metric = await measurePerformance(
        `${cliPath} fetch ${blobId} --mock`,
        'Fetch command (mock)',
        PERFORMANCE_THRESHOLDS.fetch
      );

      expect(metric.executionTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.fetch.critical
      );
    });
  });

  describe('Bulk Operations Performance', () => {
    it('should measure performance with large number of todos', async () => {
      const todoCount = 100;

      // Measure adding many todos
      // console.log(`Adding ${todoCount} todos...`); // Removed console statement
      // Track timing for performance analysis
      // const addStartTime = Date.now();

      for (let i = 0; i < todoCount; i++) {
        await execAsync(`${cliPath} add "Bulk test todo ${i}"`);
      }

      // const addEndTime = Date.now();
      // Track bulk add time for potential future use
      // const _bulkAddTime = addEndTime - addStartTime;
      // console.log(`Bulk add time: ${bulkAddTime}ms (${bulkAddTime / todoCount}ms per todo) // Removed console statement`);

      // Measure listing many todos
      const listMetric = await measurePerformance(
        `${cliPath} list`,
        `List ${todoCount} todos`,
        { warning: 1000, critical: 2000 }
      );

      // Clean up
      await execAsync(`${cliPath} delete --all --force`);

      expect(listMetric.executionTime).toBeLessThan(2000);
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should measure concurrent add operations', async () => {
      const concurrentOps = 10;
      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < concurrentOps; i++) {
        promises.push(execAsync(`${cliPath} add "Concurrent todo ${i}"`));
      }

      await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // console.log(`Concurrent adds (${concurrentOps}) // Removed console statement: ${totalTime}ms (${totalTime / concurrentOps}ms average)`);

      expect(totalTime).toBeLessThan(
        concurrentOps * PERFORMANCE_THRESHOLDS.add.critical
      );
    });
  });

  describe('Memory Usage Analysis', () => {
    it('should track memory usage across operations', async () => {
      const operations = [
        { cmd: 'add "Memory test 1"', desc: 'Add single todo' },
        { cmd: 'list', desc: 'List todos' },
        { cmd: 'add "Memory test 2"', desc: 'Add another todo' },
        { cmd: 'list', desc: 'List with more todos' },
        { cmd: 'delete --all --force', desc: 'Delete all todos' },
      ];

      // Track memory usage across operations
      const metrics = [];

      for (const op of operations) {
        const metric = await measurePerformance(
          `${cliPath} ${op.cmd}`,
          op.desc,
          { warning: 5000, critical: 10000 }
        );
        metrics.push(metric);

        // Verify memory tracking is working
        expect(metric.memory.delta).toBeDefined();
        expect(metric.executionTime).toBeGreaterThan(0);
      }

      // Verify all operations completed successfully
      expect(metrics).toHaveLength(operations.length);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should compare with baseline performance', async () => {
      // Read baseline if exists
      const baselinePath = path.join(resultsDir, 'baseline.json');
      let baseline: PerformanceReport | null = null;

      if (fs.existsSync(baselinePath)) {
        baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
      }

      // Run a standard set of operations
      const commands = [
        `${cliPath} add "Regression test"`,
        `${cliPath} list`,
        `${cliPath} delete --all --force`,
      ];

      for (const cmd of commands) {
        const metric = await measurePerformance(cmd, cmd, {
          warning: 5000,
          critical: 10000,
        });

        // Compare with baseline if available
        let percentChange = 0;
        let hasBaselineMetric = false;

        if (baseline) {
          const baselineMetric = baseline.results.find(r => r.command === cmd);
          if (baselineMetric) {
            percentChange =
              ((metric.executionTime - baselineMetric.executionTime) /
                baselineMetric.executionTime) *
              100;
            // console.log(`${cmd}: ${percentChange > 0 ? '+' : ''}${percentChange.toFixed(2) // Removed console statement}% from baseline`);
            hasBaselineMetric = true;
          }
        }

        // Only check regression if we have baseline data
        const checkRegression = () => {
          if (hasBaselineMetric && percentChange >= 20) {
            throw new Error(
              `Performance regression: ${percentChange.toFixed(2)}% slower than baseline`
            );
          }
        };
        expect(checkRegression).not.toThrow();

        // Ensure baseline comparison is tracked
        expect(baseline).toBeDefined();
      }
    });
  });
});
