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
  ],
  collectCoverageFrom: [
    'apps/cli/src/**/*.ts',
    '!apps/cli/src/**/*.d.ts',
    '!apps/cli/src/__tests__/**',
    '!apps/cli/src/examples/**',
    '!apps/cli/src/move/**',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  // ESM Module Handling
  transformIgnorePatterns: [
    'node_modules/(?!(p-retry|@mysten|delay|p-map|p-limit|p-queue|p-timeout|@langchain|langchain|langsmith|@walrus|retry)/)' 
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
        moduleResolution: 'node',
      },
      // Memory optimization for TypeScript compilation
      useESM: false,
    }],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/cli/src/$1',
    '^p-retry$': '<rootDir>/node_modules/p-retry/index.js',
  },
  testTimeout: 30000,
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
  
  // Memory Management Configuration
  maxWorkers: process.env.CI ? 1 : '50%', // Use single worker in CI, 50% locally
  workerIdleMemoryLimit: '512MB', // Conservative worker memory limit
  
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