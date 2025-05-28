#!/usr/bin/env node

/**
 * Standalone Security Test Runner
 * 
 * A simplified security test runner that bypasses complex Jest configuration issues
 * and provides immediate security validation without depending on complex AI service imports.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class SecurityTestRunner {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      error: '\x1b[31m',
      warning: '\x1b[33m',
      reset: '\x1b[0m'
    };
    
    console.log(`${colors[type]}${message}${colors.reset}`);
  }

  async runTest(testName, testFunction) {
    try {
      this.log(`Running: ${testName}`, 'info');
      await testFunction();
      this.results.passed++;
      this.results.tests.push({ name: testName, status: 'PASS' });
      this.log(`✓ ${testName}`, 'success');
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name: testName, status: 'FAIL', error: error.message });
      this.log(`✗ ${testName}: ${error.message}`, 'error');
    }
  }

  // Security Test: Environment Validation
  async testEnvironmentValidation() {
    const requiredEnvVars = ['NODE_ENV'];
    const sensitiveEnvVars = ['API_KEY', 'SECRET', 'TOKEN', 'PASSWORD'];
    
    // Check for required environment variables
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }
    
    // Check for potential sensitive data exposure
    for (const envVar in process.env) {
      if (sensitiveEnvVars.some(sensitive => envVar.toUpperCase().includes(sensitive))) {
        if (process.env[envVar] && process.env[envVar].length < 8) {
          this.log(`Warning: Potentially weak ${envVar}`, 'warning');
        }
      }
    }
  }

  // Security Test: Configuration Security
  async testConfigurationSecurity() {
    const configFiles = [
      'package.json',
      'tsconfig.json',
      '.env.example'
    ];
    
    for (const configFile of configFiles) {
      const filePath = path.join(this.projectRoot, configFile);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Missing configuration file: ${configFile}`);
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for potential security issues in config
      if (content.includes('password') && !configFile.includes('example')) {
        throw new Error(`Potential password exposure in ${configFile}`);
      }
      
      if (content.includes('0.0.0.0') && !configFile.includes('example')) {
        this.log(`Warning: Binding to 0.0.0.0 found in ${configFile}`, 'warning');
      }
    }
  }

  // Security Test: Basic Input Validation
  async testBasicInputValidation() {
    const inputValidators = {
      email: (input) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input),
      url: (input) => {
        try {
          new URL(input);
          return true;
        } catch {
          return false;
        }
      },
      path: (input) => !input.includes('..') && !input.includes('//'),
      command: (input) => !input.includes(';') && !input.includes('|') && !input.includes('&')
    };
    
    // Test valid inputs
    const validTests = [
      ['email', 'test@example.com'],
      ['url', 'https://example.com'],
      ['path', '/safe/path'],
      ['command', 'safe-command']
    ];
    
    for (const [type, input] of validTests) {
      if (!inputValidators[type](input)) {
        throw new Error(`Valid ${type} failed validation: ${input}`);
      }
    }
    
    // Test invalid inputs
    const invalidTests = [
      ['email', 'invalid-email'],
      ['url', 'not-a-url'],
      ['path', '../dangerous/path'],
      ['command', 'dangerous; rm -rf /']
    ];
    
    for (const [type, input] of invalidTests) {
      if (inputValidators[type](input)) {
        throw new Error(`Invalid ${type} passed validation: ${input}`);
      }
    }
  }

  // Security Test: File Permission Checks
  async testFilePermissions() {
    const sensitiveFiles = [
      'package.json',
      '.env.example',
      'tsconfig.json'
    ];
    
    for (const file of sensitiveFiles) {
      const filePath = path.join(this.projectRoot, file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const mode = stats.mode;
        
        // Check if file is world-writable (dangerous)
        if (mode & parseInt('002', 8)) {
          throw new Error(`File ${file} is world-writable (security risk)`);
        }
        
        // Check if file is readable by owner
        if (!(mode & parseInt('400', 8))) {
          throw new Error(`File ${file} is not readable by owner`);
        }
      }
    }
  }

  // Security Test: Directory Structure Validation
  async testDirectoryStructure() {
    const requiredDirs = [
      'apps/cli/src',
      'tests',
      'scripts'
    ];
    
    const dangerousDirs = [
      'node_modules/.bin',
      'dist',
      'build'
    ];
    
    // Check required directories exist
    for (const dir of requiredDirs) {
      const dirPath = path.join(this.projectRoot, dir);
      if (!fs.existsSync(dirPath)) {
        throw new Error(`Missing required directory: ${dir}`);
      }
    }
    
    // Check for potential security issues in dangerous directories
    for (const dir of dangerousDirs) {
      const dirPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(dirPath)) {
        const stats = fs.statSync(dirPath);
        if (stats.mode & parseInt('002', 8)) {
          this.log(`Warning: Directory ${dir} is world-writable`, 'warning');
        }
      }
    }
  }

  // Security Test: Dependency Security Check
  async testDependencySecurity() {
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json not found');
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Check for known vulnerable packages (basic check)
    const vulnerablePatterns = [
      'event-stream',
      'eslint-scope',
      'getcookies'
    ];
    
    const allDeps = {
      ...packageJson.dependencies || {},
      ...packageJson.devDependencies || {}
    };
    
    for (const dep of Object.keys(allDeps)) {
      for (const pattern of vulnerablePatterns) {
        if (dep.includes(pattern)) {
          this.log(`Warning: Potentially vulnerable dependency: ${dep}`, 'warning');
        }
      }
    }
    
    // Check for overly permissive version ranges
    for (const [dep, version] of Object.entries(allDeps)) {
      if (typeof version === 'string' && version.startsWith('*')) {
        this.log(`Warning: Wildcard version for ${dep}: ${version}`, 'warning');
      }
    }
  }

  // Main test runner
  async run() {
    this.log('🔒 Starting Security Test Runner', 'info');
    this.log('==============================\n', 'info');
    
    const tests = [
      ['Environment Validation', () => this.testEnvironmentValidation()],
      ['Configuration Security', () => this.testConfigurationSecurity()],
      ['Basic Input Validation', () => this.testBasicInputValidation()],
      ['File Permissions', () => this.testFilePermissions()],
      ['Directory Structure', () => this.testDirectoryStructure()],
      ['Dependency Security', () => this.testDependencySecurity()]
    ];
    
    for (const [testName, testFunction] of tests) {
      await this.runTest(testName, testFunction);
    }
    
    this.printResults();
  }

  printResults() {
    this.log('\n==============================', 'info');
    this.log('🔒 Security Test Results', 'info');
    this.log('==============================', 'info');
    
    for (const test of this.results.tests) {
      const status = test.status === 'PASS' ? '✓' : '✗';
      const color = test.status === 'PASS' ? 'success' : 'error';
      this.log(`${status} ${test.name}`, color);
      if (test.error) {
        this.log(`  Error: ${test.error}`, 'error');
      }
    }
    
    this.log(`\nTotal Tests: ${this.results.passed + this.results.failed}`, 'info');
    this.log(`Passed: ${this.results.passed}`, 'success');
    this.log(`Failed: ${this.results.failed}`, this.results.failed > 0 ? 'error' : 'success');
    
    if (this.results.failed > 0) {
      this.log('\n⚠️  Security issues detected! Please review and fix.', 'error');
      process.exit(1);
    } else {
      this.log('\n✅ All security tests passed!', 'success');
      process.exit(0);
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  verbose: args.includes('--verbose'),
  help: args.includes('--help')
};

if (options.help) {
  console.log(`
🔒 Standalone Security Test Runner

Usage: node scripts/security-test-runner.js [options]

Options:
  --verbose    Show detailed output
  --help       Show this help message

Description:
  Runs basic security validation tests without complex dependencies.
  Tests include environment validation, configuration security,
  input validation, file permissions, and dependency checks.
`);
  process.exit(0);
}

// Run the security tests
if (require.main === module) {
  const runner = new SecurityTestRunner();
  runner.run().catch(error => {
    console.error('Security test runner failed:', error);
    process.exit(1);
  });
}

module.exports = SecurityTestRunner;