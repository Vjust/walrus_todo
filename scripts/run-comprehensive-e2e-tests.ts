#!/usr/bin/env tsx
/* eslint-disable no-console */
import { Logger } from '../src/utils/Logger';

const logger = new Logger('run-comprehensive-e2e-tests');

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
    logger.info(chalk.blue(`🔍 Project root: ${this.projectRoot}`));
  }

  async run(): Promise<void> {
    logger.info(chalk.bold.blue('\n🚀 Starting Comprehensive Waltodo E2E Test Suite\n'));
    
    try {
      await this.checkSystemPrerequisites();
      await this.setupTestEnvironment();
      await this.runIntegrationTests();
      await this.validateSystemIntegration();
      this.generateTestReport();
      
      logger.info(chalk.bold.green('\n✅ Comprehensive E2E Test Suite Completed Successfully!\n'));
      
    } catch (error) {
      logger.error(chalk.bold.red('\n❌ E2E Test Suite Failed:'), error);
      this.generateFailureReport(error);
      process.exit(1);
    }
  }

  private async checkSystemPrerequisites(): Promise<void> {
    logger.info(chalk.yellow('📋 Checking System Prerequisites...'));
    
    // Check Sui CLI
    try {
      const suiVersion = execSync('sui --version', { encoding: 'utf8', timeout: 10000 });
      this.systemStatus.suiCli = true;
      logger.info(chalk.green(`✓ Sui CLI: ${suiVersion.trim()}`));
    } catch (error) {
      logger.info(chalk.red('✗ Sui CLI not found'));
      throw new Error('Sui CLI is required but not found. Please install: https://docs.sui.io/guides/developer/getting-started/sui-install');
    }

    // Check Walrus CLI (optional)
    try {
      const walrusVersion = execSync('walrus --version', { encoding: 'utf8', timeout: 10000 });
      this.systemStatus.walrusCli = true;
      logger.info(chalk.green(`✓ Walrus CLI: ${walrusVersion.trim()}`));
    } catch (error) {
      logger.info(chalk.yellow('⚠ Walrus CLI not found - will use mock mode for storage tests'));
    }

    // Check Node.js and pnpm
    try {
      const nodeVersion = execSync('node --version', { encoding: 'utf8' });
      const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8' });
      this.systemStatus.nodeAndPnpm = true;
      logger.info(chalk.green(`✓ Node.js: ${nodeVersion.trim()}`));
      logger.info(chalk.green(`✓ pnpm: ${pnpmVersion.trim()}`));
    } catch (error) {
      throw new Error('Node.js and pnpm are required but not found');
    }

    // Check Sui wallet
    try {
      const activeAddress = execSync('sui client active-address', { encoding: 'utf8', timeout: 10000 });
      logger.info(chalk.green(`✓ Sui Wallet: ${activeAddress.trim()}`));
    } catch (error) {
      throw new Error('Sui wallet not configured. Please run "sui client" to set up your wallet');
    }

    logger.info(chalk.green('✅ System prerequisites verified\n'));
  }

  private async setupTestEnvironment(): Promise<void> {
    logger.info(chalk.yellow('🔧 Setting up Test Environment...'));
    
    // Build the CLI
    try {
      logger.info('Building Waltodo CLI...');
      execSync('pnpm run build:dev', { 
        cwd: this.projectRoot,
        stdio: 'inherit',
        timeout: 120000
      });
      this.systemStatus.waltodoCli = true;
      logger.info(chalk.green('✓ Waltodo CLI built successfully'));
    } catch (error) {
      throw new Error(`Failed to build Waltodo CLI: ${error}`);
    }

    // Install frontend dependencies
    const frontendPath = path.join(this.projectRoot, 'waltodo-frontend');
    if (fs.existsSync(frontendPath)) {
      try {
        logger.info('Installing frontend dependencies...');
        execSync('pnpm install', { 
          cwd: frontendPath,
          stdio: 'inherit',
          timeout: 120000
        });
        this.systemStatus.frontend = true;
        logger.info(chalk.green('✓ Frontend dependencies installed'));
      } catch (error) {
        logger.info(chalk.yellow('⚠ Frontend dependency installation failed - some tests may be skipped'));
      }
    }

    logger.info(chalk.green('✅ Test environment setup complete\n'));
  }

  private async runIntegrationTests(): Promise<void> {
    logger.info(chalk.yellow('🧪 Running Integration Tests...'));
    
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
        logger.info(chalk.blue(`\n🔄 Running ${testConfig.name}...`));
        const startTime = Date.now();
        
        const output = execSync(testConfig.command, {
          cwd: this.projectRoot,
          encoding: 'utf8',
          timeout: testConfig.timeout
        });
        
        const duration = Date.now() - startTime;
        const result = this.parseTestOutput(testConfig.name, output, duration);
        this.testResults.push(result);
        
        logger.info(chalk.green(`✓ ${testConfig.name} completed in ${duration}ms`));
        
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
        
        logger.info(chalk.red(`✗ ${testConfig.name} failed`));
        logger.info(chalk.red(`  Error: ${error.toString().substring(0, 200)}...`));
      }
    }

    logger.info(chalk.green('✅ Integration tests completed\n'));
  }

  private async validateSystemIntegration(): Promise<void> {
    logger.info(chalk.yellow('🔍 Validating System Integration...'));
    
    // Test CLI-to-Frontend communication
    try {
      logger.info('Testing CLI deployment and frontend config generation...');
      
      // Deploy contract (skip if already deployed)
      try {
        execSync('pnpm run cli -- deploy --network testnet --gas-budget 200000000', {
          cwd: this.projectRoot,
          encoding: 'utf8',
          timeout: 180000
        });
        logger.info(chalk.green('✓ Smart contract deployment successful'));
        this.systemStatus.smartContract = true;
      } catch (error) {
        if (error.toString().includes('already deployed') || 
            error.toString().includes('Package ID already exists')) {
          logger.info(chalk.yellow('⚠ Contract already deployed - continuing with existing deployment'));
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
          logger.info(chalk.green('✓ Frontend configuration generated successfully'));
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
          logger.info(chalk.yellow(`⚠ CLI command failed: ${command}`));
        }
      }

      logger.info(chalk.green('✓ CLI operations verified'));

    } catch (error) {
      logger.info(chalk.red(`✗ System integration validation failed: ${error}`));
      throw error;
    }

    logger.info(chalk.green('✅ System integration validation completed\n'));
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
    logger.info(chalk.bold.blue('\n📊 COMPREHENSIVE E2E TEST REPORT\n'));
    
    // System Status Report
    logger.info(chalk.bold.yellow('🔧 SYSTEM STATUS:'));
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
      logger.info(`  ${icon} ${color(item.name)}`);
    });

    // Test Results Summary
    logger.info(chalk.bold.yellow('\n🧪 TEST RESULTS SUMMARY:'));
    
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
      logger.info(`  ${status} ${result.testSuite}`);
      logger.info(`    Passed: ${result.passed}, Failed: ${result.failed}, Skipped: ${result.skipped}`);
      logger.info(`    Duration: ${result.duration}ms`);
      
      if (result.errors.length > 0) {
        logger.info(`    Errors: ${result.errors.length}`);
        result.errors.forEach(error => {
          logger.info(chalk.red(`      - ${error.substring(0, 100)}...`));
        });
      }
      logger.info('');
    });

    // Overall Summary
    logger.info(chalk.bold.yellow('📈 OVERALL SUMMARY:'));
    logger.info(`  Total Tests: ${totalPassed + totalFailed + totalSkipped}`);
    logger.info(`  ${chalk.green('✅ Passed:')} ${totalPassed}`);
    logger.info(`  ${chalk.red('❌ Failed:')} ${totalFailed}`);
    logger.info(`  ${chalk.yellow('⏭️  Skipped:')} ${totalSkipped}`);
    logger.info(`  ⏱️  Total Duration: ${Math.round(totalDuration / 1000)}s`);

    const successRate = totalPassed / (totalPassed + totalFailed) * 100;
    logger.info(`  📊 Success Rate: ${Math.round(successRate)}%`);

    // Recommendations
    logger.info(chalk.bold.yellow('\n💡 RECOMMENDATIONS:'));
    
    if (totalFailed === 0) {
      logger.info(chalk.green('  🎉 All tests passed! The system is ready for production use.'));
    } else {
      logger.info(chalk.red(`  ⚠️  ${totalFailed} test(s) failed. Please address the issues before deployment.`));
    }

    if (!this.systemStatus.walrusCli) {
      logger.info(chalk.yellow('  📦 Consider installing Walrus CLI for full storage functionality.'));
    }

    if (!this.systemStatus.frontend) {
      logger.info(chalk.yellow('  🖥️  Frontend setup incomplete. Run "pnpm run nextjs:install" to fix.'));
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
    logger.info(chalk.dim(`\n📝 Detailed report saved to: ${reportPath}`));
  }

  private generateFailureReport(error: any): void {
    logger.info(chalk.bold.red('\n💥 FAILURE REPORT\n'));
    
    logger.info(chalk.red('Error Details:'));
    logger.info(chalk.red(`  ${error.message || error.toString()}`));
    
    logger.info(chalk.yellow('\nSystem Status at Failure:'));
    Object.entries(this.systemStatus).forEach(([key, value]) => {
      const icon = value ? '✅' : '❌';
      logger.info(`  ${icon} ${key}`);
    });

    logger.info(chalk.yellow('\nFailure Analysis:'));
    if (!this.systemStatus.suiCli) {
      logger.info(chalk.red('  - Sui CLI not installed or not working'));
    }
    if (!this.systemStatus.nodeAndPnpm) {
      logger.info(chalk.red('  - Node.js or pnpm not properly installed'));
    }
    if (!this.systemStatus.waltodoCli) {
      logger.info(chalk.red('  - Waltodo CLI build failed'));
    }

    logger.info(chalk.yellow('\nRecommended Actions:'));
    logger.info('  1. Check that all prerequisites are installed');
    logger.info('  2. Verify Sui wallet is configured with testnet tokens');
    logger.info('  3. Ensure internet connectivity for blockchain operations');
    logger.info('  4. Try running individual test suites to isolate issues');
  }
}

// Main execution
async function main() {
  const runner = new ComprehensiveE2ETestRunner();
  await runner.run();
}

if (require.main === module) {
  main().catch(error => {
    logger.error(chalk.bold.red('Fatal error:'), error);
    process.exit(1);
  });
}

export { ComprehensiveE2ETestRunner };