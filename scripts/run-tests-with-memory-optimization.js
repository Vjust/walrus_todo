#!/usr/bin/env node

/**
 * Memory-Optimized Test Runner
 * Runs Jest tests with optimized memory settings based on test type
 */

const { spawn } = require('child_process');
const path = require('path');

// Memory configurations for different test types
const MEMORY_CONFIGS = {
  unit: {
    maxOldSpaceSize: 2048,
    maxWorkers: '50%',
    description: 'Unit tests with moderate memory usage'
  },
  integration: {
    maxOldSpaceSize: 3072,
    maxWorkers: '25%',
    description: 'Integration tests with higher memory requirements'
  },
  e2e: {
    maxOldSpaceSize: 4096,
    maxWorkers: 1,
    runInBand: true,
    description: 'E2E tests with maximum memory allocation'
  },
  stress: {
    maxOldSpaceSize: 6144,
    maxWorkers: 1,
    runInBand: true,
    description: 'Stress tests with maximum memory allocation'
  },
  security: {
    maxOldSpaceSize: 2048,
    maxWorkers: '50%',
    description: 'Security tests with moderate memory usage'
  }
};

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    testType: 'unit',
    pattern: '',
    coverage: false,
    watch: false,
    verbose: false,
    force: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--type' && i + 1 < args.length) {
      config.testType = args[++i];
    } else if (arg === '--pattern' && i + 1 < args.length) {
      config.pattern = args[++i];
    } else if (arg === '--coverage') {
      config.coverage = true;
    } else if (arg === '--watch') {
      config.watch = true;
    } else if (arg === '--verbose') {
      config.verbose = true;
    } else if (arg === '--force-gc') {
      config.force = true;
    } else if (arg === '--help') {
      showHelp();
      process.exit(0);
    }
  }
  
  return config;
}

function showHelp() {
  console.log(`
Memory-Optimized Test Runner

Usage: node run-tests-with-memory-optimization.js [options]

Options:
  --type <type>        Test type: unit, integration, e2e, stress, security (default: unit)
  --pattern <pattern>  Test file pattern to match
  --coverage          Enable coverage reporting
  --watch             Enable watch mode
  --verbose           Enable verbose logging
  --force-gc          Enable forced garbage collection
  --help              Show this help message

Available Test Types:
${Object.entries(MEMORY_CONFIGS).map(([type, config]) => 
  `  ${type.padEnd(12)} - ${config.description} (${config.maxOldSpaceSize}MB)`
).join('\n')}

Examples:
  # Run unit tests with memory optimization
  node run-tests-with-memory-optimization.js --type unit

  # Run integration tests with coverage
  node run-tests-with-memory-optimization.js --type integration --coverage

  # Run specific test pattern
  node run-tests-with-memory-optimization.js --pattern "ai-service" --type unit
`);
}

function buildJestCommand(config) {
  const memoryConfig = MEMORY_CONFIGS[config.testType];
  
  if (!memoryConfig) {
    console.error(`Unknown test type: ${config.testType}`);
    console.error(`Available types: ${Object.keys(MEMORY_CONFIGS).join(', ')}`);
    process.exit(1);
  }
  
  const nodeArgs = [
    `--max-old-space-size=${memoryConfig.maxOldSpaceSize}`
  ];
  
  if (config.force) {
    nodeArgs.push('--expose-gc');
  }
  
  const jestArgs = [
    'jest',
    '--no-typecheck'
  ];
  
  // Add Jest configuration based on test type
  if (config.testType === 'e2e') {
    jestArgs.push('--config=tests/e2e/jest.config.js');
  } else if (config.testType === 'security') {
    jestArgs.push('--config=tests/security/jest.config.js');
  }
  
  // Add test pattern if specified
  if (config.pattern) {
    if (config.testType === 'unit') {
      jestArgs.push(`tests/unit`);
      jestArgs.push('--testNamePattern', config.pattern);
    } else if (config.testType === 'integration') {
      jestArgs.push(`tests/integration`);
      jestArgs.push('--testNamePattern', config.pattern);
    } else {
      jestArgs.push('--testNamePattern', config.pattern);
    }
  } else {
    // Add specific test directory if no pattern
    if (config.testType === 'unit') {
      jestArgs.push('tests/unit');
    } else if (config.testType === 'integration') {
      jestArgs.push('tests/integration');
    } else if (config.testType === 'stress') {
      jestArgs.push('tests/stress');
    }
  }
  
  // Add other options
  if (config.coverage) {
    jestArgs.push('--coverage');
  }
  
  if (config.watch) {
    jestArgs.push('--watch');
  }
  
  if (config.verbose) {
    jestArgs.push('--verbose');
  }
  
  // Add memory-specific Jest options
  if (memoryConfig.runInBand) {
    jestArgs.push('--runInBand');
  } else if (memoryConfig.maxWorkers) {
    jestArgs.push('--maxWorkers', String(memoryConfig.maxWorkers));
  }
  
  return { nodeArgs, jestArgs, memoryConfig };
}

function runTests(config) {
  const { nodeArgs, jestArgs, memoryConfig } = buildJestCommand(config);
  
  console.log(`🧪 Running ${config.testType} tests with memory optimization`);
  console.log(`📊 Memory allocation: ${memoryConfig.maxOldSpaceSize}MB`);
  console.log(`👥 Workers: ${memoryConfig.maxWorkers || 'auto'}`);
  console.log(`🎯 Pattern: ${config.pattern || 'all tests'}`);
  console.log('');
  
  const args = [...nodeArgs, ...jestArgs];
  
  if (config.verbose) {
    console.log(`Command: npx ${jestArgs.join(' ')}`);
    console.log(`NODE_OPTIONS: ${nodeArgs.join(' ')}`);
    console.log('');
  }
  
  const child = spawn('npx', jestArgs, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      NODE_OPTIONS: nodeArgs.join(' ')
    }
  });
  
  child.on('exit', (code) => {
    if (code === 0) {
      console.log(`\n✅ ${config.testType} tests completed successfully`);
    } else {
      console.log(`\n❌ ${config.testType} tests failed with exit code ${code}`);
    }
    process.exit(code);
  });
  
  child.on('error', (error) => {
    console.error('❌ Failed to start test process:', error.message);
    process.exit(1);
  });
}

// Main execution
const config = parseArgs();
runTests(config);