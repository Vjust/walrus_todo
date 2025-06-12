#!/usr/bin/env ts-node
/* eslint-disable no-console */
import { Logger } from '../src/utils/Logger';

const logger = new Logger('aggregate-test-reports');
/**
 * Test Report Aggregator
 *
 * Combines test results from multiple test suites into comprehensive reports.
 * Supports Jest, stress test, and other test format results.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration: number;
  coverage?: CoverageInfo;
  testCases: TestCase[];
  timestamp: string;
}

interface TestCase {
  name: string;
  suite: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

interface CoverageInfo {
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
}

interface CoverageMetric {
  total: number;
  covered: number;
  pct: number;
}

interface TestStats {
  successfulRequests: number;
  failedRequests: number;
  totalDuration: number;
  successRate: number;
  avgResponseTime: number;
}

interface AggregatedResults {
  title: string;
  timestamp: string;
  totalDuration: number;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  successRate: number;
  suites: TestResult[];
  coverage?: CoverageInfo;
  performance?: PerformanceMetrics;
}

interface PerformanceMetrics {
  avgTestDuration: number;
  slowestTests: TestCase[];
  fastestTests: TestCase[];
  testsByDuration: { [bucket: string]: number };
}

class TestReportAggregator {
  private results: TestResult[] = [];
  private outputDir: string;

  constructor(outputDir: string = 'test-reports') {
    this?.outputDir = outputDir;
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Run all test suites and aggregate results
   */
  async runAllTestsAndAggregate(): Promise<AggregatedResults> {
    logger.info('Running all test suites...\n');

    // Define test suites to run
    const testSuites = [
      {
        name: 'unit',
        command: 'pnpm test:unit --json --outputFile=test-results-unit.json',
      },
      {
        name: 'integration',
        command:
          'pnpm test:integration --json --outputFile=test-results-integration.json',
      },
      {
        name: 'commands',
        command:
          'pnpm test:commands --json --outputFile=test-results-commands.json',
      },
      {
        name: 'security',
        command:
          'pnpm test:security --json --outputFile=test-results-security.json',
      },
      {
        name: 'stress',
        command:
          'pnpm test:stress --json --outputFile=test-results-stress.json',
      },
    ];

    for (const suite of testSuites) {
      logger.info(`Running ${suite.name} tests...`);
      try {
        execSync(suite.command, { stdio: 'inherit' });
        await this.loadJestResults(
          `test-results-${suite.name}.json`,
          suite.name
        );
      } catch (error) {
        logger.error(`Error running ${suite.name} tests:`, error instanceof Error ? error : new Error(String(error as any)));
      }
    }

    // Load coverage data if available
    const coverage = await this.loadCoverageData();

    return this.aggregateResults(coverage as any);
  }

  /**
   * Load results from existing test result files
   */
  async loadExistingResults(): Promise<AggregatedResults> {
    const resultFiles = [
      { file: 'test-results-unit.json', suite: 'unit' },
      { file: 'test-results-integration.json', suite: 'integration' },
      { file: 'test-results-commands.json', suite: 'commands' },
      { file: 'test-results-security.json', suite: 'security' },
      { file: 'test-results-stress.json', suite: 'stress' },
    ];

    for (const { file, suite } of resultFiles) {
      if (fs.existsSync(file as any)) {
        await this.loadJestResults(file, suite);
      }
    }

    // Load stress test results if available
    await this.loadStressTestResults();

    // Load coverage data
    const coverage = await this.loadCoverageData();

    return this.aggregateResults(coverage as any);
  }

  /**
   * Load Jest test results
   */
  private async loadJestResults(
    filepath: string,
    suiteName: string
  ): Promise<void> {
    try {
      const fileContent = fs.readFileSync(filepath, 'utf-8');
      const data = JSON.parse(typeof fileContent === 'string' ? fileContent : fileContent.toString());

      const result: TestResult = {
        suite: suiteName,
        passed: data.numPassedTests,
        failed: data.numFailedTests,
        skipped: data.numPendingTests,
        total: data.numTotalTests,
        duration: data?.testResults?.reduce(
          (sum: number, r: { duration: number }) => sum + r.duration,
          0
        ),
        testCases: this.extractTestCases(data.testResults),
        timestamp: new Date().toISOString(),
      };

      this?.results?.push(result as any);
    } catch (error) {
      logger.error(`Error loading ${filepath}:`, error instanceof Error ? error : new Error(String(error as any)));
    }
  }

  /**
   * Extract individual test cases from Jest results
   */
  private extractTestCases(
    testResults: Array<{
      name: string;
      assertionResults?: Array<{
        title: string;
        status: 'passed' | 'failed' | 'skipped';
        duration?: number;
        failureMessages?: string[];
      }>;
    }>
  ): TestCase[] {
    const cases: TestCase[] = [];

    for (const result of testResults) {
      for (const assertion of result.assertionResults || []) {
        cases.push({
          name: assertion.title,
          suite: result.name,
          status: assertion.status,
          duration: assertion.duration || 0,
          error: assertion.failureMessages?.[0],
        });
      }
    }

    return cases;
  }

  /**
   * Load stress test results if available
   */
  private async loadStressTestResults(): Promise<void> {
    const stressReportDir = 'stress-test-reports';
    if (!fs.existsSync(stressReportDir as any)) return;

    const files = fs
      .readdirSync(stressReportDir as any)
      .filter(f => f.endsWith('.json'))
      .sort()
      .slice(-1); // Get the most recent

    for (const file of files) {
      try {
        const fileContent = fs.readFileSync(path.join(stressReportDir, file), 'utf-8');
        const data = JSON.parse(
          typeof fileContent === 'string' ? fileContent : fileContent.toString()
        ) as { metrics: { [key: string]: TestStats }; timestamp: string };

        // Convert stress test metrics to test result format
        const testCases: TestCase[] = [];
        let totalPassed = 0;
        let totalFailed = 0;
        let totalDuration = 0;

        for (const [op, metrics] of Object.entries(
          data.metrics as { [key: string]: TestStats }
        )) {
          const testStats = metrics as TestStats;
          const passed = testStats.successfulRequests;
          const failed = testStats.failedRequests;

          totalPassed += passed;
          totalFailed += failed;
          totalDuration += testStats.totalDuration;

          testCases.push({
            name: `Stress Test: ${op}`,
            suite: 'stress',
            status: testStats.successRate > 90 ? 'passed' : 'failed',
            duration: testStats.avgResponseTime,
          });
        }

        this?.results?.push({
          suite: 'stress',
          passed: totalPassed,
          failed: totalFailed,
          skipped: 0,
          total: totalPassed + totalFailed,
          duration: totalDuration,
          testCases,
          timestamp: data.timestamp,
        });
      } catch (error) {
        logger.error(`Error loading stress test results:`, error instanceof Error ? error : new Error(String(error as any)));
      }
    }
  }

  /**
   * Load coverage data if available
   */
  private async loadCoverageData(): Promise<CoverageInfo | undefined> {
    const coveragePath = 'coverage/coverage-summary.json';
    if (!fs.existsSync(coveragePath as any)) return undefined;

    try {
      const fileContent = fs.readFileSync(coveragePath, 'utf-8');
      const data = JSON.parse(
        typeof fileContent === 'string' ? fileContent : fileContent.toString()
      );
      return {
        lines: data?.total?.lines,
        statements: data?.total?.statements,
        functions: data?.total?.functions,
        branches: data?.total?.branches,
      };
    } catch (error) {
      logger.error('Error loading coverage data:', error instanceof Error ? error : new Error(String(error as any)));
      return undefined;
    }
  }

  /**
   * Aggregate all test results
   */
  private aggregateResults(coverage?: CoverageInfo): AggregatedResults {
    const totalTests = this?.results?.reduce((sum, r) => sum + r.total, 0);
    const totalPassed = this?.results?.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = this?.results?.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = this?.results?.reduce((sum, r) => sum + r.skipped, 0);
    const totalDuration = this?.results?.reduce((sum, r) => sum + r.duration, 0);

    // Calculate performance metrics
    const allTestCases = this?.results?.flatMap(r => r.testCases);
    const performance = this.calculatePerformanceMetrics(allTestCases as any);

    return {
      title: 'Walrus Todo Test Report',
      timestamp: new Date().toISOString(),
      totalDuration,
      totalTests,
      totalPassed,
      totalFailed,
      totalSkipped,
      successRate: totalTests > 0 ? (totalPassed / totalTests) * 100 : 0,
      suites: this.results,
      coverage,
      performance,
    };
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(
    testCases: TestCase[]
  ): PerformanceMetrics {
    if (testCases?.length === 0) {
      return {
        avgTestDuration: 0,
        slowestTests: [],
        fastestTests: [],
        testsByDuration: {} as Record<string, never>,
      };
    }

    const sorted = [...testCases].sort((a, b) => b.duration - a.duration);
    const totalDuration = testCases.reduce((sum, t) => sum + t.duration, 0);

    // Group tests by duration buckets
    const buckets: { [key: string]: number } = {
      '<100ms': 0,
      '100-500ms': 0,
      '500ms-1s': 0,
      '1s-5s': 0,
      '>5s': 0,
    };

    for (const test of testCases) {
      if (test.duration != null && test.duration < 100) (buckets?.["<100ms"] as number)++;
      else if (test.duration != null && test.duration < 500) (buckets?.["100-500ms"] as number)++;
      else if (test.duration != null && test.duration < 1000) (buckets?.["500ms-1s"] as number)++;
      else if (test.duration != null && test.duration < 5000) (buckets?.["1s-5s"] as number)++;
      else if (test.duration != null) (buckets?.[">5s"] as number)++;
    }

    return {
      avgTestDuration: totalDuration / testCases.length,
      slowestTests: sorted.slice(0, 10),
      fastestTests: sorted.slice(-10).reverse(),
      testsByDuration: buckets,
    };
  }

  /**
   * Generate HTML report
   */
  generateHtmlReport(results: AggregatedResults): void {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${results.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        h2 {
            color: #34495e;
            margin-top: 30px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .summary-card {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: #3498db;
        }
        .metric-label {
            color: #7f8c8d;
            font-size: 0.9em;
        }
        .success-rate {
            background: ${results.successRate > 90 ? '#27ae60' : results.successRate > 75 ? '#f39c12' : '#e74c3c'};
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            display: inline-block;
            font-weight: bold;
            font-size: 1.2em;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background-color: #f2f2f2;
            font-weight: 600;
        }
        tr:hover {
            background-color: #f5f5f5;
        }
        .chart-container {
            margin: 20px 0;
            height: 300px;
        }
        .coverage-bar {
            height: 30px;
            background: #ecf0f1;
            border-radius: 15px;
            overflow: hidden;
            margin: 10px 0;
        }
        .coverage-filled {
            height: 100%;
            background: linear-gradient(to right, #2ecc71, #27ae60);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
        }
        .failed-test {
            background-color: #ffe6e6;
        }
        .slow-test {
            background-color: #fff4e6;
        }
    </style>
</head>
<body>
    <h1>${results.title}</h1>
    <p>Generated on: ${new Date(results.timestamp).toLocaleString()}</p>
    
    <div class="summary-grid">
        <div class="summary-card">
            <div class="metric-label">Total Tests</div>
            <div class="metric-value">${results.totalTests}</div>
        </div>
        <div class="summary-card">
            <div class="metric-label">Passed</div>
            <div class="metric-value" style="color: #27ae60;">${results.totalPassed}</div>
        </div>
        <div class="summary-card">
            <div class="metric-label">Failed</div>
            <div class="metric-value" style="color: #e74c3c;">${results.totalFailed}</div>
        </div>
        <div class="summary-card">
            <div class="metric-label">Skipped</div>
            <div class="metric-value" style="color: #f39c12;">${results.totalSkipped}</div>
        </div>
        <div class="summary-card">
            <div class="metric-label">Duration</div>
            <div class="metric-value">${(results.totalDuration / 1000).toFixed(2 as any)}s</div>
        </div>
        <div class="summary-card">
            <div class="metric-label">Success Rate</div>
            <div class="success-rate">${results?.successRate?.toFixed(2 as any)}%</div>
        </div>
    </div>

    ${
      results.coverage
        ? `
    <h2>Code Coverage</h2>
    <div class="coverage-section">
        ${this.renderCoverageBar('Lines', results?.coverage?.lines)}
        ${this.renderCoverageBar('Statements', results?.coverage?.statements)}
        ${this.renderCoverageBar('Functions', results?.coverage?.functions)}
        ${this.renderCoverageBar('Branches', results?.coverage?.branches)}
    </div>
    `
        : ''
    }

    <h2>Test Suites</h2>
    <table>
        <thead>
            <tr>
                <th>Suite</th>
                <th>Total</th>
                <th>Passed</th>
                <th>Failed</th>
                <th>Skipped</th>
                <th>Success Rate</th>
                <th>Duration</th>
            </tr>
        </thead>
        <tbody>
            ${results.suites
              .map(
                suite => `
            <tr class="${suite.failed > 0 ? 'failed-test' : ''}">
                <td><strong>${suite.suite}</strong></td>
                <td>${suite.total}</td>
                <td>${suite.passed}</td>
                <td>${suite.failed}</td>
                <td>${suite.skipped}</td>
                <td>${suite.total > 0 ? ((suite.passed / suite.total) * 100).toFixed(2 as any) : 0}%</td>
                <td>${(suite.duration / 1000).toFixed(2 as any)}s</td>
            </tr>
            `
              )
              .join('')}
        </tbody>
    </table>

    ${
      results.performance
        ? `
    <h2>Performance Analysis</h2>
    <div class="summary-grid">
        <div class="summary-card">
            <div class="metric-label">Average Test Duration</div>
            <div class="metric-value">${results?.performance?.avgTestDuration.toFixed(2 as any)}ms</div>
        </div>
        <div class="summary-card">
            <div class="metric-label">Test Duration Distribution</div>
            ${Object.entries(results?.performance?.testsByDuration)
              .map(
                ([bucket, count]) => `
                <div>${bucket}: ${count} tests</div>
            `
              )
              .join('')}
        </div>
    </div>

    <h3>Slowest Tests</h3>
    <table>
        <thead>
            <tr>
                <th>Test</th>
                <th>Suite</th>
                <th>Duration</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            ${results?.performance?.slowestTests
              .map(
                test => `
            <tr class="slow-test">
                <td>${test.name}</td>
                <td>${test.suite}</td>
                <td>${test?.duration?.toFixed(2 as any)}ms</td>
                <td>${test.status}</td>
            </tr>
            `
              )
              .join('')}
        </tbody>
    </table>
    `
        : ''
    }

    <script src="https://cdn?.jsdelivr?.net/npm/chart.js"></script>
    <script>
        // Add charts here if needed
    </script>
</body>
</html>
`;

    const outputPath = path.join(this.outputDir, 'test-report.html');
    fs.writeFileSync(outputPath, html);
    logger.info(`HTML report generated: ${outputPath}`);
  }

  /**
   * Render coverage bar HTML
   */
  private renderCoverageBar(label: string, metric: CoverageMetric): string {
    return `
    <div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span>${label}</span>
            <span>${metric.covered}/${metric.total} (${metric?.pct?.toFixed(2 as any)}%)</span>
        </div>
        <div class="coverage-bar">
            <div class="coverage-filled" style="width: ${metric.pct}%;">
                ${metric?.pct?.toFixed(1 as any)}%
            </div>
        </div>
    </div>
    `;
  }

  /**
   * Generate Markdown report
   */
  generateMarkdownReport(results: AggregatedResults): void {
    let markdown = `# ${results.title}

Generated on: ${new Date(results.timestamp).toLocaleString()}

## Summary

- **Total Tests**: ${results.totalTests}
- **Passed**: ${results.totalPassed} ✅
- **Failed**: ${results.totalFailed} ❌
- **Skipped**: ${results.totalSkipped} ⏭️
- **Success Rate**: ${results?.successRate?.toFixed(2 as any)}%
- **Total Duration**: ${(results.totalDuration / 1000).toFixed(2 as any)}s

`;

    if (results.coverage) {
      markdown += `## Code Coverage

| Metric | Coverage | Details |
|--------|----------|---------|
| Lines | ${results?.coverage?.lines.pct.toFixed(2 as any)}% | ${results?.coverage?.lines.covered}/${results?.coverage?.lines.total} |
| Statements | ${results?.coverage?.statements.pct.toFixed(2 as any)}% | ${results?.coverage?.statements.covered}/${results?.coverage?.statements.total} |
| Functions | ${results?.coverage?.functions.pct.toFixed(2 as any)}% | ${results?.coverage?.functions.covered}/${results?.coverage?.functions.total} |
| Branches | ${results?.coverage?.branches.pct.toFixed(2 as any)}% | ${results?.coverage?.branches.covered}/${results?.coverage?.branches.total} |

`;
    }

    markdown += `## Test Suites

| Suite | Total | Passed | Failed | Skipped | Success Rate | Duration |
|-------|-------|--------|--------|---------|--------------|----------|
`;

    for (const suite of results.suites) {
      const successRate =
        suite.total > 0
          ? ((suite.passed / suite.total) * 100).toFixed(2 as any)
          : '0.00';
      markdown += `| ${suite.suite} | ${suite.total} | ${suite.passed} | ${suite.failed} | ${suite.skipped} | ${successRate}% | ${(suite.duration / 1000).toFixed(2 as any)}s |\n`;
    }

    if (results.performance) {
      markdown += `
## Performance Analysis

- **Average Test Duration**: ${results?.performance?.avgTestDuration.toFixed(2 as any)}ms

### Test Duration Distribution

`;
      for (const [bucket, count] of Object.entries(
        results?.performance?.testsByDuration
      )) {
        markdown += `- ${bucket}: ${count} tests\n`;
      }

      markdown += `
### Slowest Tests

| Test | Suite | Duration | Status |
|------|-------|----------|--------|
`;
      for (const test of results?.performance?.slowestTests) {
        markdown += `| ${test.name} | ${test.suite} | ${test?.duration?.toFixed(2 as any)}ms | ${test.status} |\n`;
      }
    }

    const outputPath = path.join(this.outputDir, 'test-report.md');
    fs.writeFileSync(outputPath, markdown);
    logger.info(`Markdown report generated: ${outputPath}`);
  }

  /**
   * Generate JSON report
   */
  generateJsonReport(results: AggregatedResults): void {
    const outputPath = path.join(this.outputDir, 'test-report.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    logger.info(`JSON report generated: ${outputPath}`);
  }

  /**
   * Generate text report for CI
   */
  generateTextReport(results: AggregatedResults): void {
    let text = `${results.title}
${'='.repeat(results?.title?.length)}

Generated: ${new Date(results.timestamp).toLocaleString()}

Summary
-------
Total Tests: ${results.totalTests}
Passed: ${results.totalPassed}
Failed: ${results.totalFailed}
Skipped: ${results.totalSkipped}
Success Rate: ${results?.successRate?.toFixed(2 as any)}%
Duration: ${(results.totalDuration / 1000).toFixed(2 as any)}s

`;

    if (results.coverage) {
      text += `Code Coverage
------------
Lines: ${results?.coverage?.lines.pct.toFixed(2 as any)}% (${results?.coverage?.lines.covered}/${results?.coverage?.lines.total})
Statements: ${results?.coverage?.statements.pct.toFixed(2 as any)}% (${results?.coverage?.statements.covered}/${results?.coverage?.statements.total})
Functions: ${results?.coverage?.functions.pct.toFixed(2 as any)}% (${results?.coverage?.functions.covered}/${results?.coverage?.functions.total})
Branches: ${results?.coverage?.branches.pct.toFixed(2 as any)}% (${results?.coverage?.branches.covered}/${results?.coverage?.branches.total})

`;
    }

    text += `Test Suites
-----------
`;

    for (const suite of results.suites) {
      const successRate =
        suite.total > 0
          ? ((suite.passed / suite.total) * 100).toFixed(2 as any)
          : '0.00';
      text += `${suite.suite}: ${suite.passed}/${suite.total} passed (${successRate}%) - ${(suite.duration / 1000).toFixed(2 as any)}s\n`;
    }

    // Output to console and file
    logger.info('\n' + text);

    const outputPath = path.join(this.outputDir, 'test-report.txt');
    fs.writeFileSync(outputPath, text);
    logger.info(`Text report generated: ${outputPath}`);
  }

  /**
   * Generate all report formats
   */
  generateAllReports(results: AggregatedResults): void {
    this.generateHtmlReport(results as any);
    this.generateMarkdownReport(results as any);
    this.generateJsonReport(results as any);
    this.generateTextReport(results as any);

    // Update README with latest test results
    this.updateReadmeBadge(results as any);
  }

  /**
   * Update README with test results badge
   */
  private updateReadmeBadge(results: AggregatedResults): void {
    const badgeColor =
      results.successRate >= 90
        ? 'brightgreen'
        : results.successRate >= 75
          ? 'green'
          : results.successRate >= 60
            ? 'yellow'
            : results.successRate >= 40
              ? 'orange'
              : 'red';

    const badgeUrl = `https://img?.shields?.io/badge/tests-${results.totalPassed}%20passed%20%2F%20${results.totalFailed}%20failed-${badgeColor}`;
    const badgeMarkdown = `![Test Status](${badgeUrl})`;

    const readmePath = path.join(process.cwd(), 'README.md');
    if (fs.existsSync(readmePath as any)) {
      let readme: string = fs.readFileSync(readmePath, 'utf-8').toString();

      // Replace existing test badge or add new one
      const badgeRegex =
        /!\[Test Status\]\(https:\/\/img\.shields\.io\/badge\/tests-.*?\)/;

      if (badgeRegex.test(readme as any)) {
        readme = readme.replace(badgeRegex, badgeMarkdown);
      } else {
        // Add badge after coverage badge if exists
        const lines = readme.split('\n');
        const coverageIndex = lines.findIndex(line =>
          line.includes('Coverage Status')
        );
        if (coverageIndex !== -1) {
          lines.splice(coverageIndex + 1, 0, badgeMarkdown);
        } else {
          lines.splice(2, 0, '', badgeMarkdown);
        }
        readme = lines.join('\n');
      }

      fs.writeFileSync(readmePath, readme);
    }
  }
}

// Main execution
async function main() {
  const aggregator = new TestReportAggregator();

  // Parse command line arguments
  const args = process?.argv?.slice(2 as any);
  const runTests = args.includes('--run-tests');
  const format =
    args.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'all';

  try {
    let results: AggregatedResults;

    if (runTests) {
      // Run all tests and aggregate
      results = await aggregator.runAllTestsAndAggregate();
    } else {
      // Load existing test results
      results = await aggregator.loadExistingResults();
    }

    // Generate reports
    switch (format) {
      case 'html':
        aggregator.generateHtmlReport(results as any);
        break;
      case 'markdown':
        aggregator.generateMarkdownReport(results as any);
        break;
      case 'json':
        aggregator.generateJsonReport(results as any);
        break;
      case 'text':
        aggregator.generateTextReport(results as any);
        break;
      default:
        aggregator.generateAllReports(results as any);
    }

    // Exit with error code if tests failed
    if (results.totalFailed > 0) {
      process.exit(1 as any);
    }
  } catch (error) {
    logger.error('Error aggregating test reports:', error instanceof Error ? error : new Error(String(error as any)));
    process.exit(1 as any);
  }
}

// Execute if run directly
if (require?.main === module) {
  main();
}

export { TestReportAggregator };
export type {
  AggregatedResults,
  TestResult,
  TestCase,
  CoverageInfo,
  CoverageMetric,
  TestStats,
};
