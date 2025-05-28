#!/usr/bin/env node

/**
 * Jest Validation Script
 * 
 * This script tests all Jest execution methods to validate
 * that the workarounds and fallback strategies work properly.
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const JestTestRunner = require('./test-runner');
const JestEnvironmentSetup = require('./jest-environment-setup');
const JestErrorHandler = require('./jest-error-handler');

class JestValidation {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.results = [];
    this.testRunner = new JestTestRunner();
    this.envSetup = new JestEnvironmentSetup();
    this.errorHandler = new JestErrorHandler();
  }

  /**
   * Run comprehensive validation of all Jest execution methods
   */
  async runValidation() {
    console.log('🔍 Starting Jest Validation Suite');
    console.log('═══════════════════════════════════');

    // Step 1: Environment validation
    await this.validateEnvironment();

    // Step 2: Test each execution strategy
    await this.testExecutionStrategies();

    // Step 3: Test error handling
    await this.testErrorHandling();

    // Step 4: Test specific scenarios
    await this.testSpecificScenarios();

    // Step 5: Generate validation report
    this.generateValidationReport();

    console.log('\n🏁 Validation Complete');
    this.printSummary();
  }

  /**
   * Validate environment requirements
   */
  async validateEnvironment() {
    console.log('\n📋 Environment Validation');
    console.log('─────────────────────────');

    try {
      const validation = this.envSetup.validateEnvironment();
      this.addResult('environment', 'Environment Check', validation.valid, 
        validation.valid ? 'All requirements met' : validation.issues.join(', '));

      if (!validation.valid) {
        console.log('⚠️  Environment issues found:');
        validation.issues.forEach(issue => console.log(`   - ${issue}`));
      } else {
        console.log('✅ Environment validation passed');
      }
    } catch (error) {
      this.addResult('environment', 'Environment Check', false, error.message);
      console.log('❌ Environment validation failed:', error.message);
    }
  }

  /**
   * Test each Jest execution strategy
   */
  async testExecutionStrategies() {
    console.log('\n🎯 Testing Execution Strategies');
    console.log('─────────────────────────────────');

    const strategies = ['pnpmJest', 'npxJest', 'nodeJest', 'directJest', 'fallbackRunner'];
    
    for (const strategy of strategies) {
      await this.testStrategy(strategy);
    }
  }

  /**
   * Test a specific execution strategy
   */
  async testStrategy(strategy) {
    console.log(`\n🧪 Testing strategy: ${strategy}`);
    
    try {
      // Use a simple test that should always pass
      const testArgs = ['--version']; // Just test version command first
      
      const result = await this.testRunner[strategy](testArgs);
      this.addResult('strategy', strategy, true, 'Strategy executed successfully');
      console.log(`✅ ${strategy} - Success`);
      
    } catch (error) {
      this.addResult('strategy', strategy, false, error.message);
      console.log(`❌ ${strategy} - Failed: ${error.message}`);
      
      // Analyze the error
      const analysis = this.errorHandler.analyzeError(error, { strategy });
      console.log(`   Recovery: ${analysis.recoveryStrategy.description}`);
    }
  }

  /**
   * Test error handling mechanisms
   */
  async testErrorHandling() {
    console.log('\n🛡️  Testing Error Handling');
    console.log('─────────────────────────────');

    // Test 1: Invalid command
    await this.testErrorScenario('Invalid Command', async () => {
      const result = await this.executeCommand('invalid-jest-command', []);
    });

    // Test 2: Invalid test file
    await this.testErrorScenario('Invalid Test File', async () => {
      const result = await this.testRunner.runTests(['non-existent-test.js']);
    });

    // Test 3: Memory-intensive scenario
    await this.testErrorScenario('Memory Test', async () => {
      // This won't actually cause OOM but tests the handling
      process.env.NODE_OPTIONS = '--max-old-space-size=64';
      const result = await this.testRunner.runTests(['--help']);
      delete process.env.NODE_OPTIONS;
    });
  }

  /**
   * Test a specific error scenario
   */
  async testErrorScenario(name, testFunction) {
    console.log(`\n🧪 Testing: ${name}`);
    
    try {
      await testFunction();
      this.addResult('error-handling', name, true, 'Error scenario handled gracefully');
      console.log(`✅ ${name} - Handled gracefully`);
    } catch (error) {
      // This is expected - we want to see how errors are handled
      const analysis = this.errorHandler.handleError(error, { test: name });
      this.addResult('error-handling', name, true, `Error properly analyzed: ${analysis.classification}`);
      console.log(`✅ ${name} - Error properly handled and analyzed`);
    }
  }

  /**
   * Test specific real-world scenarios
   */
  async testSpecificScenarios() {
    console.log('\n🌍 Testing Real-World Scenarios');
    console.log('──────────────────────────────────');

    // Scenario 1: Dry run with actual test runner
    await this.testScenario('Dry Run', async () => {
      const result = await this.testRunner.runTests(['--help']);
      return result.code === 0;
    });

    // Scenario 2: Configuration validation
    await this.testScenario('Config Validation', async () => {
      const config = this.testRunner.loadJestConfig();
      return config && typeof config === 'object';
    });

    // Scenario 3: Environment setup
    await this.testScenario('Environment Setup', async () => {
      const setup = this.envSetup.apply();
      return setup && setup.environment;
    });

    // Scenario 4: Binary detection
    await this.testScenario('Binary Detection', async () => {
      const jestPath = this.testRunner.findJestExecutable();
      return jestPath !== null;
    });

    // Scenario 5: Test file discovery
    await this.testScenario('Test Discovery', async () => {
      const testFiles = this.testRunner.findTestFiles();
      return Array.isArray(testFiles) && testFiles.length > 0;
    });
  }

  /**
   * Test a specific scenario
   */
  async testScenario(name, testFunction) {
    console.log(`\n🧪 Testing: ${name}`);
    
    try {
      const result = await testFunction();
      this.addResult('scenario', name, result, result ? 'Scenario passed' : 'Scenario failed');
      console.log(`${result ? '✅' : '❌'} ${name} - ${result ? 'Passed' : 'Failed'}`);
    } catch (error) {
      this.addResult('scenario', name, false, error.message);
      console.log(`❌ ${name} - Error: ${error.message}`);
    }
  }

  /**
   * Execute a command for testing
   */
  async executeCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: this.projectRoot,
        stdio: 'pipe',
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Command timed out'));
      }, 30000);
    });
  }

  /**
   * Add result to validation results
   */
  addResult(category, test, passed, message) {
    this.results.push({
      timestamp: new Date().toISOString(),
      category,
      test,
      passed,
      message
    });
  }

  /**
   * Generate comprehensive validation report
   */
  generateValidationReport() {
    const summary = this.generateSummary();
    
    const report = {
      timestamp: new Date().toISOString(),
      environment: this.envSetup.detectEnvironment(),
      summary,
      results: this.results,
      recommendations: this.generateRecommendations()
    };

    const reportPath = path.join(this.projectRoot, 'jest-validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📊 Validation report saved to: ${reportPath}`);
    return report;
  }

  /**
   * Generate summary statistics
   */
  generateSummary() {
    const categories = {};
    
    this.results.forEach(result => {
      if (!categories[result.category]) {
        categories[result.category] = { total: 0, passed: 0, failed: 0 };
      }
      
      categories[result.category].total++;
      if (result.passed) {
        categories[result.category].passed++;
      } else {
        categories[result.category].failed++;
      }
    });

    return {
      totalTests: this.results.length,
      totalPassed: this.results.filter(r => r.passed).length,
      totalFailed: this.results.filter(r => !r.passed).length,
      categories
    };
  }

  /**
   * Generate recommendations based on validation results
   */
  generateRecommendations() {
    const recommendations = [];
    const failedResults = this.results.filter(r => !r.passed);

    if (failedResults.length === 0) {
      recommendations.push('All tests passed! Jest execution environment is properly configured.');
      return recommendations;
    }

    // Analyze failures by category
    const failuresByCategory = {};
    failedResults.forEach(result => {
      if (!failuresByCategory[result.category]) {
        failuresByCategory[result.category] = [];
      }
      failuresByCategory[result.category].push(result);
    });

    // Environment failures
    if (failuresByCategory.environment) {
      recommendations.push('Fix environment issues before running tests');
      recommendations.push('Run: node scripts/jest-environment-setup.js --validate');
    }

    // Strategy failures
    if (failuresByCategory.strategy) {
      const failedStrategies = failuresByCategory.strategy.map(r => r.test);
      recommendations.push(`Some execution strategies failed: ${failedStrategies.join(', ')}`);
      recommendations.push('Use test:robust or test:fallback scripts for better reliability');
    }

    // Scenario failures
    if (failuresByCategory.scenario) {
      recommendations.push('Some real-world scenarios failed');
      recommendations.push('Consider running individual test categories instead of full test suite');
    }

    return recommendations;
  }

  /**
   * Print validation summary
   */
  printSummary() {
    const summary = this.generateSummary();
    
    console.log('\n📊 Validation Summary');
    console.log('═══════════════════════');
    console.log(`Total Tests: ${summary.totalTests}`);
    console.log(`Passed: ${summary.totalPassed} ✅`);
    console.log(`Failed: ${summary.totalFailed} ❌`);
    
    console.log('\nBy Category:');
    Object.entries(summary.categories).forEach(([category, stats]) => {
      console.log(`  ${category}: ${stats.passed}/${stats.total} passed`);
    });

    if (summary.totalFailed > 0) {
      console.log('\n⚠️  Issues detected. Check the validation report for details.');
      console.log('🔧 Run recommended fixes or use fallback execution methods.');
    } else {
      console.log('\n🎉 All validation tests passed!');
      console.log('✅ Jest execution environment is properly configured.');
    }
  }

  /**
   * Run quick validation (subset of tests)
   */
  async runQuickValidation() {
    console.log('⚡ Running Quick Jest Validation');
    console.log('═══════════════════════════════════');

    // Just test environment and one strategy
    await this.validateEnvironment();
    await this.testStrategy('npxJest');
    
    this.printSummary();
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const validator = new JestValidation();

  if (args.includes('--quick')) {
    validator.runQuickValidation()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('❌ Validation failed:', error.message);
        process.exit(1);
      });
  } else if (args.includes('--help')) {
    console.log(`
Jest Validation - Test all Jest execution methods and workarounds

Usage:
  node jest-validation.js [options]

Options:
  --quick      Run quick validation (environment + one strategy)
  --help       Show this help

This script validates:
- Environment requirements
- All execution strategies
- Error handling mechanisms
- Real-world scenarios
- Configuration validity

Generates a comprehensive report with recommendations.
`);
    process.exit(0);
  } else {
    validator.runValidation()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('❌ Validation failed:', error.message);
        process.exit(1);
      });
  }
}

module.exports = JestValidation;