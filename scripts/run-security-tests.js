#!/usr/bin/env node

/**
 * Dedicated Security Test Runner
 * 
 * Runs security tests from tests/security/ directory with:
 * - Proper Jest configuration
 * - Coverage reporting
 * - Memory and worker limits for CI/CD
 * - Clear success/failure reporting
 * - Proper error codes for CI/CD systems
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const SECURITY_TEST_DIR = path.join(__dirname, '..', 'tests', 'security');
const SECURITY_JEST_CONFIG = path.join(SECURITY_TEST_DIR, 'jest.config.js');
const ROOT_DIR = path.join(__dirname, '..');

// Color output utilities
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function colorize(color, text) {
  return `${colors[color]}${text}${colors.reset}`;
}

function log(level, message) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  switch (level) {
    case 'info':
      console.log(colorize('cyan', prefix), message);
      break;
    case 'success':
      console.log(colorize('green', prefix), message);
      break;
    case 'warning':
      console.log(colorize('yellow', prefix), message);
      break;
    case 'error':
      console.error(colorize('red', prefix), message);
      break;
    default:
      console.log(prefix, message);
  }
}

function validateEnvironment() {
  log('info', 'Validating security test environment...');
  
  // Check if security test directory exists
  if (!fs.existsSync(SECURITY_TEST_DIR)) {
    log('error', `Security test directory not found: ${SECURITY_TEST_DIR}`);
    return false;
  }
  
  // Check if Jest config exists
  if (!fs.existsSync(SECURITY_JEST_CONFIG)) {
    log('error', `Security Jest config not found: ${SECURITY_JEST_CONFIG}`);
    return false;
  }
  
  // Check for test files
  const testFiles = fs.readdirSync(SECURITY_TEST_DIR)
    .filter(file => file.endsWith('.test.ts'));
  
  if (testFiles.length === 0) {
    log('warning', 'No security test files found');
    return false;
  }
  
  log('info', `Found ${testFiles.length} security test files`);
  return true;
}

function buildJestArgs(options = {}) {
  const {
    coverage = true,
    verbose = true,
    ci = process.env.CI === 'true',
    maxWorkers = ci ? 1 : 2,
    bail = false,
    collectCoverageFrom = [
      'apps/cli/src/services/ai/**/*.ts',
      'apps/cli/src/types/adapters/AI*.ts',
      'apps/cli/src/commands/ai*.ts',
      'apps/cli/src/services/authentication-service.ts',
      'apps/cli/src/services/config-service.ts',
      'apps/cli/src/services/key-management.ts',
      'apps/cli/src/services/permission-service.ts',
      'apps/cli/src/services/secure-storage.ts',
    ]
  } = options;

  const args = [
    // Use security-specific Jest config
    '--config', SECURITY_JEST_CONFIG,
    
    // Test path pattern
    '--testPathPattern=tests/security',
    
    // Worker configuration for CI/CD
    '--maxWorkers', String(maxWorkers),
    '--workerIdleMemoryLimit=256MB',
    
    // Memory management
    '--forceExit',
    '--detectOpenHandles',
    '--logHeapUsage',
    
    // Output configuration
    verbose ? '--verbose' : '--silent',
    '--no-cache',
    
    // CI-specific settings
    ...(ci ? [
      '--ci',
      '--watchman=false',
      '--no-coverage',  // Disable coverage in CI by default to reduce memory
    ] : []),
    
    // Coverage settings (only if not CI or explicitly requested)
    ...(coverage && !ci ? [
      '--coverage',
      '--coverageReporters=text-summary',
      '--coverageReporters=lcov',
      '--coverageDirectory=coverage/security',
      ...collectCoverageFrom.flatMap(pattern => ['--collectCoverageFrom', pattern]),
    ] : []),
    
    // Bail on failure if specified
    ...(bail ? ['--bail'] : []),
    
    // Environment variables
    '--testTimeout=30000',
    '--setupFilesAfterEnv=<rootDir>/setup.js',
  ];

  return args;
}

function runSecurityTests(options = {}) {
  return new Promise((resolve, reject) => {
    log('info', 'Starting security test execution...');
    
    const jestArgs = buildJestArgs(options);
    
    log('info', `Jest command: npx jest ${jestArgs.join(' ')}`);
    
    const jestProcess = spawn('npx', ['jest', ...jestArgs], {
      cwd: ROOT_DIR,
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        JEST_PROJECT: 'security-tests',
        // Reduce memory usage
        NODE_OPTIONS: '--max-old-space-size=2048',
      }
    });

    let stdout = '';
    let stderr = '';
    
    jestProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output);
    });
    
    jestProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output);
    });
    
    jestProcess.on('close', (code) => {
      const result = {
        exitCode: code,
        stdout,
        stderr,
        success: code === 0
      };
      
      if (code === 0) {
        log('success', 'Security tests completed successfully');
        resolve(result);
      } else {
        log('error', `Security tests failed with exit code ${code}`);
        reject(result);
      }
    });
    
    jestProcess.on('error', (error) => {
      log('error', `Failed to start Jest process: ${error.message}`);
      reject({
        exitCode: 1,
        stdout: '',
        stderr: error.message,
        success: false,
        error
      });
    });
  });
}

function parseCommandLineArgs() {
  const args = process.argv.slice(2);
  const options = {
    coverage: true,
    verbose: true,
    ci: process.env.CI === 'true',
    bail: false,
    maxWorkers: process.env.CI === 'true' ? 1 : 2,
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--no-coverage':
        options.coverage = false;
        break;
      case '--coverage':
        options.coverage = true;
        break;
      case '--silent':
        options.verbose = false;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--bail':
        options.bail = true;
        break;
      case '--ci':
        options.ci = true;
        break;
      case '--maxWorkers':
        if (i + 1 < args.length) {
          options.maxWorkers = parseInt(args[i + 1]) || options.maxWorkers;
          i++; // Skip next argument
        }
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('--')) {
          log('warning', `Unknown option: ${arg}`);
        }
        break;
    }
  }
  
  return options;
}

function printUsage() {
  console.log(`
${colorize('bright', 'Security Test Runner')}

${colorize('cyan', 'Usage:')}
  node scripts/run-security-tests.js [options]

${colorize('cyan', 'Options:')}
  --coverage          Enable coverage reporting (default: true)
  --no-coverage       Disable coverage reporting
  --verbose           Enable verbose output (default: true)
  --silent           Disable verbose output
  --bail             Stop on first test failure
  --ci               Run in CI mode (reduced memory, no coverage)
  --maxWorkers <n>   Set maximum number of worker processes
  --help, -h         Show this help message

${colorize('cyan', 'Examples:')}
  # Run with default settings
  node scripts/run-security-tests.js

  # Run without coverage for faster execution
  node scripts/run-security-tests.js --no-coverage

  # Run in CI mode
  node scripts/run-security-tests.js --ci

  # Run with custom worker count
  node scripts/run-security-tests.js --maxWorkers 1
`);
}

function generateTestReport(result) {
  const reportPath = path.join(ROOT_DIR, 'security-test-report.json');
  
  const report = {
    timestamp: new Date().toISOString(),
    success: result.success,
    exitCode: result.exitCode,
    environment: {
      ci: process.env.CI === 'true',
      nodeVersion: process.version,
      platform: process.platform,
    },
    summary: extractTestSummary(result.stdout),
  };
  
  try {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log('info', `Test report saved to ${reportPath}`);
  } catch (error) {
    log('warning', `Failed to save test report: ${error.message}`);
  }
}

function extractTestSummary(stdout) {
  // Extract Jest test summary from stdout
  const summary = {
    tests: null,
    suites: null,
    passed: null,
    failed: null,
    coverage: null,
  };
  
  try {
    // Look for Jest summary patterns
    const testMatch = stdout.match(/Tests:\s*(\d+)\s*passed(?:,\s*(\d+)\s*failed)?/);
    if (testMatch) {
      summary.passed = parseInt(testMatch[1]);
      summary.failed = testMatch[2] ? parseInt(testMatch[2]) : 0;
      summary.tests = summary.passed + summary.failed;
    }
    
    const suiteMatch = stdout.match(/Test Suites:\s*(\d+)\s*passed(?:,\s*(\d+)\s*failed)?/);
    if (suiteMatch) {
      const suitePassed = parseInt(suiteMatch[1]);
      const suiteFailed = suiteMatch[2] ? parseInt(suiteMatch[2]) : 0;
      summary.suites = suitePassed + suiteFailed;
    }
    
    // Extract coverage if present
    const coverageMatch = stdout.match(/All files[|\s]*(\d+\.?\d*)/);
    if (coverageMatch) {
      summary.coverage = parseFloat(coverageMatch[1]);
    }
  } catch (error) {
    log('warning', `Failed to parse test summary: ${error.message}`);
  }
  
  return summary;
}

async function main() {
  console.log(colorize('bright', '🔒 Security Test Runner'));
  console.log(colorize('blue', '=====================================\n'));
  
  try {
    // Validate environment
    if (!validateEnvironment()) {
      log('error', 'Environment validation failed');
      process.exit(1);
    }
    
    // Parse command line arguments
    const options = parseCommandLineArgs();
    
    log('info', `Running with options: ${JSON.stringify(options, null, 2)}`);
    
    // Run security tests
    const result = await runSecurityTests(options);
    
    // Generate test report
    generateTestReport(result);
    
    // Print final summary
    console.log('\n' + colorize('bright', '📊 Test Execution Summary'));
    console.log(colorize('blue', '============================'));
    
    const summary = extractTestSummary(result.stdout);
    if (summary.tests !== null) {
      console.log(colorize('cyan', `Tests: ${summary.tests} total, ${summary.passed} passed, ${summary.failed} failed`));
    }
    if (summary.suites !== null) {
      console.log(colorize('cyan', `Test Suites: ${summary.suites} total`));
    }
    if (summary.coverage !== null) {
      console.log(colorize('cyan', `Coverage: ${summary.coverage}%`));
    }
    
    console.log(colorize('green', '\n✅ Security tests completed successfully'));
    process.exit(0);
    
  } catch (error) {
    console.log('\n' + colorize('bright', '❌ Test Execution Failed'));
    console.log(colorize('blue', '=========================='));
    
    if (error.exitCode !== undefined) {
      console.log(colorize('red', `Exit Code: ${error.exitCode}`));
      
      const summary = extractTestSummary(error.stdout || '');
      if (summary.tests !== null) {
        console.log(colorize('yellow', `Tests: ${summary.tests} total, ${summary.passed} passed, ${summary.failed} failed`));
      }
    }
    
    if (error.error) {
      console.log(colorize('red', `Error: ${error.error.message}`));
    }
    
    log('error', 'Security tests failed');
    process.exit(error.exitCode || 1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  log('warning', 'Received SIGINT, exiting...');
  process.exit(130);
});

process.on('SIGTERM', () => {
  log('warning', 'Received SIGTERM, exiting...');
  process.exit(143);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log('error', `Uncaught exception: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log('error', `Unhandled rejection at promise: ${reason}`);
  console.error(reason);
  process.exit(1);
});

// Run main function
if (require.main === module) {
  main().catch((error) => {
    log('error', `Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = {
  runSecurityTests,
  validateEnvironment,
  buildJestArgs,
  generateTestReport,
  extractTestSummary,
};