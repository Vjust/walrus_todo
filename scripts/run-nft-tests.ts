#!/usr/bin/env ts-node

/**
 * NFT Workflow Test Runner
 * 
 * This script orchestrates the execution of all NFT workflow tests,
 * providing a comprehensive test suite for the entire NFT creation
 * and management workflow.
 */

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  output: string;
  coverage?: number;
}

interface TestSuite {
  name: string;
  file: string;
  type: 'unit' | 'integration' | 'e2e';
  timeout: number;
  env?: Record<string, string>;
}

class NFTTestRunner {
  private testSuites: TestSuite[] = [
    {
      name: 'Core NFT Logic Tests',
      file: 'tests/comprehensive-nft-workflow.test.ts',
      type: 'unit',
      timeout: 30000
    },
    {
      name: 'UI Automation Tests',
      file: 'tests/puppeteer-nft-ui.test.ts',
      type: 'e2e',
      timeout: 60000,
      env: { HEADLESS: 'true' }
    },
    {
      name: 'Blockchain Integration Tests',
      file: 'tests/playwright-blockchain-interactions.test.ts',
      type: 'integration',
      timeout: 90000,
      env: { NETWORK: 'testnet' }
    }
  ];

  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor() {
    this.startTime = Date.now();
  }

  async run(): Promise<void> {
    console.log('🚀 Starting NFT Workflow Test Suite\n');

    // Pre-flight checks
    await this.preflightChecks();

    // Run tests sequentially to avoid conflicts
    for (const suite of this.testSuites) {
      await this.runTestSuite(suite);
    }

    // Generate report
    await this.generateReport();
  }

  private async preflightChecks(): Promise<void> {
    console.log('🔍 Running pre-flight checks...');

    // Check if test files exist
    for (const suite of this.testSuites) {
      const filePath = path.join(process.cwd(), suite.file);
      try {
        await fs.access(filePath);
        console.log(`✅ Found test file: ${suite.file}`);
      } catch {
        console.error(`❌ Missing test file: ${suite.file}`);
        process.exit(1);
      }
    }

    // Check dependencies
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    try {
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent) as { devDependencies?: Record<string, string>; dependencies?: Record<string, string> };
      const requiredDeps = ['jest', '@playwright/test', 'puppeteer'];
      
      for (const dep of requiredDeps) {
        if (!packageJson.devDependencies?.[dep] && !packageJson.dependencies?.[dep]) {
          console.warn(`⚠️  Missing dependency: ${dep}`);
        } else {
          console.log(`✅ Found dependency: ${dep}`);
        }
      }
    } catch (error) {
      console.error('❌ Could not read package.json');
      process.exit(1);
    }

    // Check build status
    try {
      await fs.access(path.join(process.cwd(), 'dist'));
      console.log('✅ Build directory exists');
    } catch {
      console.warn('⚠️  No dist directory found - running build...');
      await this.runCommand('npm', ['run', 'build:dev']);
    }

    console.log('✅ Pre-flight checks completed\n');
  }

  private async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(`🧪 Running ${suite.name}...`);
    const startTime = Date.now();

    try {
      const output = await this.runJestTest(suite);
      const duration = Date.now() - startTime;

      // Parse Jest output for results
      const result: TestResult = {
        name: suite.name,
        status: output.includes('FAIL') ? 'failed' : 'passed',
        duration,
        output,
        coverage: this.extractCoverage(output)
      };

      this.results.push(result);

      if (result.status === 'passed') {
        console.log(`✅ ${suite.name} passed (${duration}ms)`);
      } else {
        console.log(`❌ ${suite.name} failed (${duration}ms)`);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      const result: TestResult = {
        name: suite.name,
        status: 'failed',
        duration,
        output: error instanceof Error ? error.message : String(error)
      };

      this.results.push(result);
      console.log(`❌ ${suite.name} failed with error (${duration}ms)`);
    }

    console.log(''); // Empty line for readability
  }

  private async runJestTest(suite: TestSuite): Promise<string> {
    const args = [
      '--testPathPattern=' + suite.file,
      '--no-typecheck',
      '--verbose',
      '--testTimeout=' + suite.timeout
    ];

    // Add coverage for unit tests
    if (suite.type === 'unit') {
      args.push('--coverage');
    }

    const env: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([_, value]) => value !== undefined)
      ) as Record<string, string>,
      ...suite.env
    };

    return this.runCommand('npx', ['jest', ...args], { env });
  }

  private runCommand(
    command: string, 
    args: string[], 
    options: { env?: Record<string, string> } = {}
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';
      
      const child: ChildProcess = spawn(command, args, {
        env: { ...process.env, ...options.env },
        shell: true
      });

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          const text = data.toString();
          output += text;
          process.stdout.write(text); // Real-time output
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          const text = data.toString();
          output += text;
          process.stderr.write(text);
        });
      }

      child.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed with exit code ${code}\nOutput: ${output}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  private extractCoverage(output: string): number | undefined {
    const coverageMatch = output.match(/All files\s+\|\s+(\d+\.?\d*)/);
    return coverageMatch?.[1] ? parseFloat(coverageMatch[1]) : undefined;
  }

  private async generateReport(): Promise<void> {
    const totalDuration = Date.now() - this.startTime;
    const passedTests = this.results.filter(r => r.status === 'passed').length;
    const failedTests = this.results.filter(r => r.status === 'failed').length;
    const totalTests = this.results.length;

    console.log('\n' + '='.repeat(60));
    console.log('📊 NFT Workflow Test Report');
    console.log('='.repeat(60));
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`Tests Run: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (this.results.some(r => r.coverage)) {
      const avgCoverage = this.results
        .filter(r => r.coverage)
        .reduce((sum, r) => sum + (r.coverage || 0), 0) / 
        this.results.filter(r => r.coverage).length;
      console.log(`Average Coverage: ${avgCoverage.toFixed(1)}%`);
    }

    console.log('\n📝 Detailed Results:');
    for (const result of this.results) {
      const status = result.status === 'passed' ? '✅' : '❌';
      const duration = `${result.duration}ms`;
      const coverage = result.coverage ? ` (${result.coverage}% coverage)` : '';
      console.log(`${status} ${result.name} - ${duration}${coverage}`);
    }

    // Generate JSON report
    const reportData = {
      timestamp: new Date().toISOString(),
      totalDuration,
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        successRate: (passedTests / totalTests) * 100
      },
      results: this.results
    };

    const reportPath = path.join(process.cwd(), 'test-reports', 'nft-workflow-report.json');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    // Exit with appropriate code
    if (failedTests > 0) {
      console.log('\n❌ Some tests failed. Please check the logs above for details.');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed successfully!');
      process.exit(0);
    }
  }
}

// CLI Interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
NFT Workflow Test Runner

Usage: npm run test:nft-workflow [options]

Options:
  --help, -h     Show this help message
  --verbose, -v  Enable verbose output
  --coverage     Generate coverage reports
  --suite <name> Run specific test suite only

Available test suites:
  - core         Core NFT logic tests
  - ui           UI automation tests  
  - blockchain   Blockchain integration tests

Examples:
  npm run test:nft-workflow
  npm run test:nft-workflow --suite core
  npm run test:nft-workflow --coverage
`);
    process.exit(0);
  }

  const runner = new NFTTestRunner();
  
  // Handle specific suite selection
  const suiteIndex = args.indexOf('--suite');
  if (suiteIndex !== -1 && args[suiteIndex + 1]) {
    const suiteName = args[suiteIndex + 1];
    const suiteMap: Record<string, string> = {
      'core': 'comprehensive-nft-workflow.test.ts',
      'ui': 'puppeteer-nft-ui.test.ts',
      'blockchain': 'playwright-blockchain-interactions.test.ts'
    };

    const suiteFile = suiteMap[suiteName];
    if (suiteFile) {
      console.log(`Running specific suite: ${suiteName}\n`);
      // Filter test suites to only the requested one
      (runner as any).testSuites = (runner as any).testSuites.filter(
        (suite: TestSuite) => suite.file.includes(suiteFile)
      );
    } else {
      console.error(`Unknown test suite: ${suiteName}`);
      console.error('Available suites: core, ui, blockchain');
      process.exit(1);
    }
  }

  try {
    await runner.run();
  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n⚠️  Test execution interrupted by user');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export type { TestResult, TestSuite };
export { NFTTestRunner };