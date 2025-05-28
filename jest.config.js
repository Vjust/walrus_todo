module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/apps/cli/src/__tests__/**/*.test.ts',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/waltodo-frontend/',
    '<rootDir>/dist/',
  ],
  // Fix haste module naming collisions
  haste: {
    enableSymlinks: false,
  },
  collectCoverageFrom: [
    'apps/cli/src/**/*.ts',
    '!apps/cli/src/**/*.d.ts',
    '!apps/cli/src/__tests__/**',
    '!apps/cli/src/examples/**',
    '!apps/cli/src/move/**',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  // ESM Module Handling - consolidated transformIgnorePatterns
  transformIgnorePatterns: [
    'node_modules/(?!(p-retry|@mysten|delay|p-map|p-limit|p-queue|p-timeout|@langchain\/.*|langchain|langsmith|@walrus|retry|uuid|nanoid|jose|ky|got|chalk)/)' 
  ],
  
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'es2020',
        lib: ['es2020'],
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        moduleResolution: 'node', // Fixed: changed from node10 to node
      },
      // Memory optimization for TypeScript compilation
      useESM: false,
    }],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  // Complete path aliases mapping from tsconfig.json
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/cli/src/$1',
    '^@tests/(.*)$': '<rootDir>/apps/cli/src/__tests__/$1',
    '^@types/(.*)$': '<rootDir>/apps/cli/src/types/$1',
    '^@utils/(.*)$': '<rootDir>/apps/cli/src/utils/$1',
    '^@services/(.*)$': '<rootDir>/apps/cli/src/services/$1',
    '^@commands/(.*)$': '<rootDir>/apps/cli/src/commands/$1',
    '^@adapters/(.*)$': '<rootDir>/apps/cli/src/types/adapters/$1',
    '^@errors/(.*)$': '<rootDir>/apps/cli/src/types/errors/$1',
    '^@waltodo/config-loader/(.*)$': '<rootDir>/packages/config-loader/src/$1',
    '^@waltodo/sui-client/(.*)$': '<rootDir>/packages/sui-client/src/$1',
    '^@waltodo/walrus-client/(.*)$': '<rootDir>/packages/walrus-client/src/$1',
    '^p-retry$': '<rootDir>/node_modules/p-retry/index.js',
    // Map problematic @langchain modules to empty mocks for tests
    '^@langchain/core/(.*)$': '<rootDir>/tests/mocks/langchain-mock.js',
    '^@langchain/(.*)$': '<rootDir>/tests/mocks/langchain-mock.js',
  },
  // Test timeout configuration (fuzz and stress tests use longer timeouts via environment)
  testTimeout: process.env.JEST_PROJECT === 'fuzz-tests' ? 60000 :
               process.env.JEST_PROJECT === 'stress-tests' ? 120000 : 30000,
  
  // Fuzz test configuration - projects for different test types
  projects: [
    {
      displayName: 'unit-integration',
      testMatch: [
        '**/tests/unit/**/*.test.ts',
        '**/tests/integration/**/*.test.ts',
        '**/apps/cli/src/__tests__/**/*.test.ts',
      ],
      testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/build/',
        '/waltodo-frontend/',
        '/tests/fuzz/',
        '/tests/stress/',
      ],
    },
    {
      displayName: 'fuzz-tests',
      testMatch: ['**/tests/fuzz/**/*.test.ts'],
      // Fuzz test specific configuration passed via environment
      globalSetup: '<rootDir>/tests/fuzz/setup-fuzz-environment.js',
    },
    {
      displayName: 'stress-tests', 
      testMatch: ['**/tests/stress/**/*.test.ts'],
      // Stress test specific configuration
      globalSetup: '<rootDir>/tests/stress/setup-stress-environment.js',
    },
  ],
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  resetModules: true,
  verbose: true,
  
  // Timer configuration
  fakeTimers: {
    enableGlobally: false, // Let tests control fake timers explicitly
    doNotFake: ['setImmediate'], // Keep setImmediate real for async operations
  },
  
  // Memory Management Configuration with fuzz test optimization
  maxWorkers: process.env.JEST_PROJECT === 'fuzz-tests' ? 2 : 
              process.env.JEST_PROJECT === 'stress-tests' ? 1 : 
              process.env.CI ? 1 : '50%', // Adaptive worker allocation
  workerIdleMemoryLimit: process.env.JEST_PROJECT === 'fuzz-tests' ? '256MB' : '512MB', // Conservative worker memory limit
  
  // Test Isolation and Cleanup
  forceExit: true, // Force Jest to exit after all tests complete
  detectOpenHandles: true, // Detect handles that prevent Jest from exiting
  logHeapUsage: true, // Log heap usage after each test suite
  
  // Coverage optimizations to reduce memory usage
  coverageReporters: ['text-summary', 'lcov'], // Reduce reporters to essential ones
  collectCoverage: false, // Disable coverage by default (enable via CLI flag)
  
  // Cache configuration for better memory management
  cache: true,
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
  
  // Test execution optimizations
  bail: 0, // Continue running tests even if some fail
  // runInBand: false, // Removed - causing validation warnings
  
  // Memory monitoring
  testResultsProcessor: '<rootDir>/scripts/memory-test-processor.js',
  
  // Global teardown for cleanup
  globalTeardown: '<rootDir>/scripts/jest-global-teardown.js',
  
};