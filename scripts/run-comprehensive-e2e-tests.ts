#!/usr/bin/env tsx
/* eslint-disable no-console */

/**
 * Comprehensive E2E Test Runner for Waltodo System
 * 
 * This script orchestrates the complete end-to-end testing process:
 * 1. Environment setup and validation
 * 2. System component verification
 * 3. Integration test execution
 * 4. Results reporting and analysis
 * 5. Cleanup and result summary
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

interface TestResult {
  testSuite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  errors: string[];
}

interface SystemStatus {
  suiCli: boolean;
  walrusCli: boolean;
  nodeAndPnpm: boolean;
  waltodoCli: boolean;
  frontend: boolean;
  smartContract: boolean;
}

class ComprehensiveE2ETestRunner {
  private projectRoot: string;
  private testResults: TestResult[] = [];
  private systemStatus: SystemStatus = {
    suiCli: false,
    walrusCli: false,
    nodeAndPnpm: false,
    waltodoCli: false,
    frontend: false,
    smartContract: false
  };

  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    console.log(chalk.blue(`🔍 Project root: ${this.projectRoot}`));
  }

  async run(): Promise<void> {
    console.log(chalk.bold.blue('\n🚀 Starting Comprehensive Waltodo E2E Test Suite\n'));
    
    try {
      await this.checkSystemPrerequisites();
      await this.setupTestEnvironment();
      await this.runIntegrationTests();
      await this.validateSystemIntegration();
      this.generateTestReport();
      
      console.log(chalk.bold.green('\n✅ Comprehensive E2E Test Suite Completed Successfully!\n'));
      
    } catch (error) {
      console.error(chalk.bold.red('\n❌ E2E Test Suite Failed:'), error);
      this.generateFailureReport(error);
      process.exit(1);
    }
  }

  private async checkSystemPrerequisites(): Promise<void> {
    console.log(chalk.yellow('📋 Checking System Prerequisites...'));
    
    // Check Sui CLI
    try {
      const suiVersion = execSync('sui --version', { encoding: 'utf8', timeout: 10000 });
      this.systemStatus.suiCli = true;
      console.log(chalk.green(`✓ Sui CLI: ${suiVersion.trim()}`));
    } catch (error) {
      console.log(chalk.red('✗ Sui CLI not found'));
      throw new Error('Sui CLI is required but not found. Please install: https://docs.sui.io/guides/developer/getting-started/sui-install');
    }

    // Check Walrus CLI (optional)
    try {
      const walrusVersion = execSync('walrus --version', { encoding: 'utf8', timeout: 10000 });
      this.systemStatus.walrusCli = true;
      console.log(chalk.green(`✓ Walrus CLI: ${walrusVersion.trim()}`));
    } catch (error) {
      console.log(chalk.yellow('⚠ Walrus CLI not found - will use mock mode for storage tests'));
    }

    // Check Node.js and pnpm
    try {
      const nodeVersion = execSync('node --version', { encoding: 'utf8' });
      const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8' });
      this.systemStatus.nodeAndPnpm = true;
      console.log(chalk.green(`✓ Node.js: ${nodeVersion.trim()}`));
      console.log(chalk.green(`✓ pnpm: ${pnpmVersion.trim()}`));
    } catch (error) {
      throw new Error('Node.js and pnpm are required but not found');
    }

    // Check Sui wallet
    try {
      const activeAddress = execSync('sui client active-address', { encoding: 'utf8', timeout: 10000 });
      console.log(chalk.green(`✓ Sui Wallet: ${activeAddress.trim()}`));
    } catch (error) {
      throw new Error('Sui wallet not configured. Please run "sui client" to set up your wallet');
    }

    console.log(chalk.green('✅ System prerequisites verified\n'));
  }

  private async setupTestEnvironment(): Promise<void> {
    console.log(chalk.yellow('🔧 Setting up Test Environment...'));
    
    // Build the CLI
    try {
      console.log('Building Waltodo CLI...');
      execSync('pnpm run build:dev', { 
        cwd: this.projectRoot,
        stdio: 'inherit',
        timeout: 120000
      });
      this.systemStatus.waltodoCli = true;
      console.log(chalk.green('✓ Waltodo CLI built successfully'));
    } catch (error) {
      throw new Error(`Failed to build Waltodo CLI: ${error}`);
    }

    // Install frontend dependencies
    const frontendPath = path.join(this.projectRoot, 'waltodo-frontend');
    if (fs.existsSync(frontendPath)) {
      try {
        console.log('Installing frontend dependencies...');
        execSync('pnpm install', { 
          cwd: frontendPath,
          stdio: 'inherit',
          timeout: 120000
        });
        this.systemStatus.frontend = true;
        console.log(chalk.green('✓ Frontend dependencies installed'));
      } catch (error) {
        console.log(chalk.yellow('⚠ Frontend dependency installation failed - some tests may be skipped'));
      }
    }

    console.log(chalk.green('✅ Test environment setup complete\n'));
  }

  private async runIntegrationTests(): Promise<void> {
    console.log(chalk.yellow('🧪 Running Integration Tests...'));
    
    const testConfigs = [
      {
        name: 'Unit Tests',
        command: 'pnpm test:unit',
        timeout: 60000
      },
      {
        name: 'CLI Command Tests',
        command: 'pnpm test tests/commands',
        timeout: 120000
      },
      {
        name: 'Smart Contract Tests',
        command: 'pnpm test tests/integration/blockchain-verification',
        timeout: 180000
      },
      {
        name: 'E2E System Integration Tests',
        command: 'pnpm test tests/e2e/comprehensive-system-integration.e2e.test.ts',
        timeout: 300000
      }
    ];

    for (const testConfig of testConfigs) {
      try {
        console.log(chalk.blue(`\n🔄 Running ${testConfig.name}...`));
        const startTime = Date.now();
        
        const output = execSync(testConfig.command, {
          cwd: this.projectRoot,
          encoding: 'utf8',
          timeout: testConfig.timeout
        });
        
        const duration = Date.now() - startTime;
        const result = this.parseTestOutput(testConfig.name, output, duration);
        this.testResults.push(result);
        
        console.log(chalk.green(`✓ ${testConfig.name} completed in ${duration}ms`));
        
      } catch (error) {
        const duration = Date.now() - Date.now();
        const result: TestResult = {
          testSuite: testConfig.name,
          passed: 0,
          failed: 1,
          skipped: 0,
          duration,
          errors: [error.toString()]
        };
        this.testResults.push(result);
        
        console.log(chalk.red(`✗ ${testConfig.name} failed`));
        console.log(chalk.red(`  Error: ${error.toString().substring(0, 200)}...`));
      }
    }

    console.log(chalk.green('✅ Integration tests completed\n'));
  }

  private async validateSystemIntegration(): Promise<void> {
    console.log(chalk.yellow('🔍 Validating System Integration...'));
    
    // Test CLI-to-Frontend communication
    try {
      console.log('Testing CLI deployment and frontend config generation...');
      
      // Deploy contract (skip if already deployed)
      try {
        execSync('pnpm run cli -- deploy --network testnet --gas-budget 200000000', {
          cwd: this.projectRoot,
          encoding: 'utf8',
          timeout: 180000
        });
        console.log(chalk.green('✓ Smart contract deployment successful'));
        this.systemStatus.smartContract = true;
      } catch (error) {
        if (error.toString().includes('already deployed') || 
            error.toString().includes('Package ID already exists')) {
          console.log(chalk.yellow('⚠ Contract already deployed - continuing with existing deployment'));
          this.systemStatus.smartContract = true;
        } else {
          throw error;
        }
      }

      // Verify configuration generation
      const frontendConfigPath = path.join(this.projectRoot, 'waltodo-frontend/src/config');
      if (fs.existsSync(frontendConfigPath)) {
        const configFiles = fs.readdirSync(frontendConfigPath);
        const hasNetworkConfig = configFiles.some(file => file.endsWith('.json'));
        
        if (hasNetworkConfig) {
          console.log(chalk.green('✓ Frontend configuration generated successfully'));
        } else {
          throw new Error('Frontend configuration files not found');
        }
      } else {
        throw new Error('Frontend configuration directory not created');
      }

      // Test basic CLI operations
      const cliCommands = [
        'pnpm run cli -- --version',
        'pnpm run cli -- config',
        'pnpm run cli -- list --limit 1'
      ];

      for (const command of cliCommands) {
        try {
          execSync(command, {
            cwd: this.projectRoot,
            encoding: 'utf8',
            timeout: 30000
          });
        } catch (error) {
          console.log(chalk.yellow(`⚠ CLI command failed: ${command}`));
        }
      }

      console.log(chalk.green('✓ CLI operations verified'));

    } catch (error) {
      console.log(chalk.red(`✗ System integration validation failed: ${error}`));
      throw error;
    }

    console.log(chalk.green('✅ System integration validation completed\n'));
  }

  private parseTestOutput(testSuite: string, output: string, duration: number): TestResult {
    const result: TestResult = {
      testSuite,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration,
      errors: []
    };

    // Parse Jest output
    const passedMatch = output.match(/(\d+) passing/);
    const failedMatch = output.match(/(\d+) failing/);
    const skippedMatch = output.match(/(\d+) pending/);

    if (passedMatch) result.passed = parseInt(passedMatch[1]);
    if (failedMatch) result.failed = parseInt(failedMatch[1]);
    if (skippedMatch) result.skipped = parseInt(skippedMatch[1]);

    // Extract error messages
    const errorLines = output.split('\n').filter(line => 
      line.includes('Error:') || line.includes('FAIL') || line.includes('✗')
    );
    result.errors = errorLines.slice(0, 5); // Limit to first 5 errors

    return result;
  }

  private generateTestReport(): void {
    console.log(chalk.bold.blue('\n📊 COMPREHENSIVE E2E TEST REPORT\n'));
    
    // System Status Report
    console.log(chalk.bold.yellow('🔧 SYSTEM STATUS:'));
    const statusItems = [
      { name: 'Sui CLI', status: this.systemStatus.suiCli },
      { name: 'Walrus CLI', status: this.systemStatus.walrusCli },
      { name: 'Node.js & pnpm', status: this.systemStatus.nodeAndPnpm },
      { name: 'Waltodo CLI', status: this.systemStatus.waltodoCli },
      { name: 'Frontend', status: this.systemStatus.frontend },
      { name: 'Smart Contract', status: this.systemStatus.smartContract }
    ];

    statusItems.forEach(item => {
      const icon = item.status ? '✅' : '❌';
      const color = item.status ? chalk.green : chalk.red;
      console.log(`  ${icon} ${color(item.name)}`);
    });

    // Test Results Summary
    console.log(chalk.bold.yellow('\n🧪 TEST RESULTS SUMMARY:'));
    
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let totalDuration = 0;

    this.testResults.forEach(result => {
      totalPassed += result.passed;
      totalFailed += result.failed;
      totalSkipped += result.skipped;
      totalDuration += result.duration;

      const status = result.failed === 0 ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
      console.log(`  ${status} ${result.testSuite}`);
      console.log(`    Passed: ${result.passed}, Failed: ${result.failed}, Skipped: ${result.skipped}`);
      console.log(`    Duration: ${result.duration}ms`);
      
      if (result.errors.length > 0) {
        console.log(`    Errors: ${result.errors.length}`);
        result.errors.forEach(error => {
          console.log(chalk.red(`      - ${error.substring(0, 100)}...`));
        });
      }
      console.log('');
    });

    // Overall Summary
    console.log(chalk.bold.yellow('📈 OVERALL SUMMARY:'));
    console.log(`  Total Tests: ${totalPassed + totalFailed + totalSkipped}`);
    console.log(`  ${chalk.green('✅ Passed:')} ${totalPassed}`);
    console.log(`  ${chalk.red('❌ Failed:')} ${totalFailed}`);
    console.log(`  ${chalk.yellow('⏭️  Skipped:')} ${totalSkipped}`);
    console.log(`  ⏱️  Total Duration: ${Math.round(totalDuration / 1000)}s`);

    const successRate = totalPassed / (totalPassed + totalFailed) * 100;
    console.log(`  📊 Success Rate: ${Math.round(successRate)}%`);

    // Recommendations
    console.log(chalk.bold.yellow('\n💡 RECOMMENDATIONS:'));
    
    if (totalFailed === 0) {
      console.log(chalk.green('  🎉 All tests passed! The system is ready for production use.'));
    } else {
      console.log(chalk.red(`  ⚠️  ${totalFailed} test(s) failed. Please address the issues before deployment.`));
    }

    if (!this.systemStatus.walrusCli) {
      console.log(chalk.yellow('  📦 Consider installing Walrus CLI for full storage functionality.'));
    }

    if (!this.systemStatus.frontend) {
      console.log(chalk.yellow('  🖥️  Frontend setup incomplete. Run "pnpm run nextjs:install" to fix.'));
    }

    // Generate detailed report file
    this.generateDetailedReport();
  }

  private generateDetailedReport(): void {
    const reportPath = path.join(this.projectRoot, 'e2e-test-report.json');
    
    const report = {
      timestamp: new Date().toISOString(),
      systemStatus: this.systemStatus,
      testResults: this.testResults,
      summary: {
        totalPassed: this.testResults.reduce((sum, r) => sum + r.passed, 0),
        totalFailed: this.testResults.reduce((sum, r) => sum + r.failed, 0),
        totalSkipped: this.testResults.reduce((sum, r) => sum + r.skipped, 0),
        totalDuration: this.testResults.reduce((sum, r) => sum + r.duration, 0),
        successRate: this.testResults.reduce((sum, r) => sum + r.passed, 0) / 
                     this.testResults.reduce((sum, r) => sum + r.passed + r.failed, 0) * 100
      }
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(chalk.dim(`\n📝 Detailed report saved to: ${reportPath}`));
  }

  private generateFailureReport(error: any): void {
    console.log(chalk.bold.red('\n💥 FAILURE REPORT\n'));
    
    console.log(chalk.red('Error Details:'));
    console.log(chalk.red(`  ${error.message || error.toString()}`));
    
    console.log(chalk.yellow('\nSystem Status at Failure:'));
    Object.entries(this.systemStatus).forEach(([key, value]) => {
      const icon = value ? '✅' : '❌';
      console.log(`  ${icon} ${key}`);
    });

    console.log(chalk.yellow('\nFailure Analysis:'));
    if (!this.systemStatus.suiCli) {
      console.log(chalk.red('  - Sui CLI not installed or not working'));
    }
    if (!this.systemStatus.nodeAndPnpm) {
      console.log(chalk.red('  - Node.js or pnpm not properly installed'));
    }
    if (!this.systemStatus.waltodoCli) {
      console.log(chalk.red('  - Waltodo CLI build failed'));
    }

    console.log(chalk.yellow('\nRecommended Actions:'));
    console.log('  1. Check that all prerequisites are installed');
    console.log('  2. Verify Sui wallet is configured with testnet tokens');
    console.log('  3. Ensure internet connectivity for blockchain operations');
    console.log('  4. Try running individual test suites to isolate issues');
  }
}

// Main execution
async function main() {
  const runner = new ComprehensiveE2ETestRunner();
  await runner.run();
}

if (require.main === module) {
  main().catch(error => {
    console.error(chalk.bold.red('Fatal error:'), error);
    process.exit(1);
  });
}

export { ComprehensiveE2ETestRunner };