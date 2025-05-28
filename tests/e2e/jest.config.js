module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.e2e.test.ts'],
  testTimeout: 30000, // 30 seconds for e2e tests
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  // ESM Module Handling for E2E tests
  transformIgnorePatterns: [
    'node_modules/(?!(p-retry|@mysten|delay|p-map|p-limit|p-queue|p-timeout|@langchain\/.*|langchain|langsmith|@walrus|retry|uuid|nanoid|jose|ky|got|chalk|glob|path-scurry)/)' 
  ],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          allowJs: true,
          allowSyntheticDefaultImports: true,
        },
        // Memory optimization for TypeScript compilation
        isolatedModules: true,
        useESM: false,
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../../apps/cli/src/$1',
  },
  collectCoverageFrom: [
    '../../apps/cli/src/**/*.{js,ts}',
    '!../../apps/cli/src/types/**',
    '!../../apps/cli/src/**/*.d.ts',
    '!../../apps/cli/src/**/__mocks__/**',
  ],
  verbose: true,

  // Memory Management Configuration for E2E Tests
  maxWorkers: 1, // E2E tests should run sequentially to avoid resource conflicts
  workerIdleMemoryLimit: '1GB', // Higher limit for E2E tests

  // Test Isolation and Cleanup
  forceExit: true,
  detectOpenHandles: true,
  logHeapUsage: true,

  // Cache configuration
  cache: true,
  cacheDirectory: '<rootDir>/../../node_modules/.cache/jest-e2e',

  // Sequential execution for E2E stability
  runInBand: true, // Force sequential execution for E2E tests

  // Global teardown for cleanup
  globalTeardown: '<rootDir>/../../scripts/jest-global-teardown.js',
};
