#!/usr/bin/env node

/**
 * Jest Environment Setup and Configuration
 * 
 * This script ensures proper Node.js environment variables and settings
 * for Jest execution across different platforms and environments.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

class JestEnvironmentSetup {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.environment = this.detectEnvironment();
  }

  /**
   * Detect current environment characteristics
   */
  detectEnvironment() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      nodeVersionMajor: parseInt(process.version.match(/v(\d+)/)[1]),
      isCI: Boolean(process.env.CI),
      isDocker: Boolean(process.env.DOCKER_ENV),
      isGitHub: Boolean(process.env.GITHUB_ACTIONS),
      isGitLab: Boolean(process.env.GITLAB_CI),
      isJenkins: Boolean(process.env.JENKINS_URL),
      shell: process.env.SHELL || 'unknown',
      memoryMB: Math.round(os.totalmem() / 1024 / 1024),
      cpuCount: os.cpus().length
    };
  }

  /**
   * Configure optimal Node.js options for Jest
   */
  configureNodeOptions() {
    const options = [];

    // Memory settings based on environment
    if (this.environment.isCI) {
      // More conservative memory usage in CI
      options.push('--max-old-space-size=6144');
      options.push('--max-semi-space-size=128');
    } else {
      // More aggressive memory usage locally
      const maxMemory = Math.min(8192, Math.floor(this.environment.memoryMB * 0.75));
      options.push(`--max-old-space-size=${maxMemory}`);
      options.push('--max-semi-space-size=256');
    }

    // Garbage collection optimizations
    options.push('--expose-gc');
    options.push('--optimize-for-size');

    // Module loading optimizations
    options.push('--experimental-vm-modules');
    
    // Suppress deprecation warnings that can clutter test output
    options.push('--no-warnings');
    options.push('--no-deprecation');

    // V8 optimizations for test execution
    if (this.environment.nodeVersionMajor >= 18) {
      options.push('--enable-source-maps');
      options.push('--stack-trace-limit=50');
    }

    // Platform-specific optimizations
    if (this.environment.platform === 'win32') {
      options.push('--max-http-header-size=16384');
    }

    return options.join(' ');
  }

  /**
   * Set up Jest-specific environment variables
   */
  setupJestEnvironment() {
    const jestEnv = {
      // Core Jest configuration
      NODE_ENV: 'test',
      JEST_WORKER_ID: process.env.JEST_WORKER_ID || '1',
      
      // Prevent Jest from running in band on CI unless explicitly requested
      JEST_MAX_WORKERS: this.environment.isCI ? 
        Math.max(1, Math.floor(this.environment.cpuCount / 2)).toString() : 
        this.environment.cpuCount.toString(),

      // Timezone consistency
      TZ: 'UTC',

      // Debugging options
      NODE_OPTIONS: this.configureNodeOptions(),

      // Memory leak detection
      FORCE_COLOR: '0', // Disable colors in CI to reduce memory overhead
      
      // Performance optimizations
      UV_THREADPOOL_SIZE: Math.min(128, this.environment.cpuCount * 4).toString(),
      
      // File system optimizations
      NODE_PRESERVE_SYMLINKS: '1',
      
      // Error handling
      NODE_DISABLE_COLORS: this.environment.isCI ? '1' : '0',
      
      // Jest-specific optimizations
      JEST_SILENT: this.environment.isCI ? 'true' : 'false'
    };

    // Platform-specific environment variables
    if (this.environment.platform === 'win32') {
      jestEnv.PATHEXT = '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC';
    }

    // CI-specific optimizations
    if (this.environment.isCI) {
      jestEnv.CI = 'true';
      jestEnv.JEST_SILENT = 'true';
      jestEnv.NODE_NO_WARNINGS = '1';
    }

    return jestEnv;
  }

  /**
   * Create Jest configuration override for environment-specific settings
   */
  createJestConfigOverride() {
    const baseConfig = this.loadJestConfig();
    
    const envConfig = {
      // Environment-specific settings
      maxWorkers: this.environment.isCI ? 
        Math.max(1, Math.floor(this.environment.cpuCount / 2)) : 
        this.environment.cpuCount,
      
      // Timeout settings based on environment
      testTimeout: this.environment.isCI ? 60000 : 30000,
      
      // Memory management
      logHeapUsage: !this.environment.isCI,
      detectLeaks: !this.environment.isCI,
      
      // CI-specific optimizations
      verbose: !this.environment.isCI,
      silent: this.environment.isCI,
      
      // Error handling
      bail: this.environment.isCI ? 1 : 0,
      
      // Coverage settings
      coveragePathIgnorePatterns: [
        ...((baseConfig.coveragePathIgnorePatterns || [])),
        '/node_modules/',
        '/dist/',
        '/build/',
        '/.next/',
        '/coverage/',
        this.environment.isCI ? '/apps/cli/src/__tests__/' : ''
      ].filter(Boolean),

      // Module resolution optimizations
      modulePathIgnorePatterns: [
        ...((baseConfig.modulePathIgnorePatterns || [])),
        '<rootDir>/dist/',
        '<rootDir>/build/',
        '<rootDir>/node_modules/.cache/'
      ],

      // Setup files
      setupFilesAfterEnv: [
        ...((baseConfig.setupFilesAfterEnv || [])),
        '<rootDir>/jest.setup.js'
      ]
    };

    return { ...baseConfig, ...envConfig };
  }

  /**
   * Load existing Jest configuration
   */
  loadJestConfig() {
    const configPath = path.join(this.projectRoot, 'jest.config.js');
    if (fs.existsSync(configPath)) {
      try {
        delete require.cache[require.resolve(configPath)];
        return require(configPath);
      } catch (error) {
        console.warn('⚠️ Could not load Jest config:', error.message);
      }
    }
    return {};
  }

  /**
   * Apply environment configuration
   */
  apply() {
    const jestEnv = this.setupJestEnvironment();
    
    // Apply environment variables
    Object.entries(jestEnv).forEach(([key, value]) => {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });

    console.log('🔧 Jest environment configured:');
    console.log(`   Platform: ${this.environment.platform} (${this.environment.arch})`);
    console.log(`   Node.js: ${this.environment.nodeVersion}`);
    console.log(`   Memory: ${this.environment.memoryMB}MB available`);
    console.log(`   CPU cores: ${this.environment.cpuCount}`);
    console.log(`   CI mode: ${this.environment.isCI ? 'Yes' : 'No'}`);
    console.log(`   Max workers: ${jestEnv.JEST_MAX_WORKERS}`);
    console.log(`   Node options: ${jestEnv.NODE_OPTIONS}`);

    return {
      environment: this.environment,
      jestEnv,
      jestConfig: this.createJestConfigOverride()
    };
  }

  /**
   * Generate environment report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      environment: this.environment,
      nodeOptions: this.configureNodeOptions(),
      jestEnvironment: this.setupJestEnvironment(),
      jestConfig: this.createJestConfigOverride(),
      recommendations: this.generateRecommendations()
    };

    const reportPath = path.join(this.projectRoot, 'jest-environment-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📊 Environment report saved to: ${reportPath}`);
    return report;
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    if (this.environment.memoryMB < 4096) {
      recommendations.push('Consider increasing available memory for better test performance');
    }

    if (this.environment.cpuCount < 4) {
      recommendations.push('Consider running tests with fewer workers on low-CPU systems');
    }

    if (this.environment.nodeVersionMajor < 18) {
      recommendations.push('Consider upgrading to Node.js 18+ for better Jest performance');
    }

    if (this.environment.isCI && this.environment.memoryMB > 8192) {
      recommendations.push('Consider increasing max-old-space-size for CI with high memory');
    }

    if (!this.environment.isCI && !process.env.NODE_OPTIONS) {
      recommendations.push('Consider setting NODE_OPTIONS for optimal local development');
    }

    return recommendations;
  }

  /**
   * Validate environment requirements
   */
  validateEnvironment() {
    const issues = [];

    if (this.environment.nodeVersionMajor < 16) {
      issues.push('Node.js version is too old (minimum: 16.x)');
    }

    if (this.environment.memoryMB < 2048) {
      issues.push('Available memory is low (recommended: 4GB+)');
    }

    if (!fs.existsSync(path.join(this.projectRoot, 'node_modules'))) {
      issues.push('node_modules directory not found - run npm/pnpm install');
    }

    const jestBinary = path.join(this.projectRoot, 'node_modules', '.bin', 'jest');
    if (!fs.existsSync(jestBinary)) {
      issues.push('Jest binary not found in node_modules/.bin/');
    }

    return {
      valid: issues.length === 0,
      issues,
      environment: this.environment
    };
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const setup = new JestEnvironmentSetup();

  if (args.includes('--report')) {
    setup.generateReport();
    process.exit(0);
  }

  if (args.includes('--validate')) {
    const validation = setup.validateEnvironment();
    console.log('🔍 Environment validation:');
    
    if (validation.valid) {
      console.log('✅ Environment is valid for Jest execution');
    } else {
      console.log('❌ Environment issues found:');
      validation.issues.forEach(issue => console.log(`   - ${issue}`));
    }
    
    process.exit(validation.valid ? 0 : 1);
  }

  if (args.includes('--help')) {
    console.log(`
Jest Environment Setup - Configure optimal environment for Jest execution

Usage:
  node jest-environment-setup.js [options]

Options:
  --report     Generate detailed environment report
  --validate   Validate environment requirements
  --help       Show this help

The setup script automatically configures:
- Node.js memory settings
- Jest worker configuration
- CI/local environment optimizations
- Platform-specific settings
- Performance optimizations
`);
    process.exit(0);
  }

  // Apply configuration
  const config = setup.apply();
  console.log('✅ Jest environment setup complete');
}

module.exports = JestEnvironmentSetup;