/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Integration Tests',
  testMatch: [
    '**/tests/integration/**/*.test.ts',
    '**/tests/e2e/**/*.test.ts',
    '**/tests/e2e/**/*.e2e.test.ts',
  ],
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        moduleResolution: 'node',
        resolveJsonModule: true,
      },
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/cli/src/$1',
    '^@api/(.*)$': '<rootDir>/apps/api/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000, // 30 seconds for integration tests
  maxWorkers: 1, // Run integration tests sequentially
  globalSetup: '<rootDir>/tests/e2e/setup/global-setup.ts',
  globalTeardown: '<rootDir>/tests/e2e/setup/global-teardown.ts',
  coverageDirectory: '<rootDir>/coverage/integration',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'apps/api/src/**/*.ts',
    'apps/cli/src/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/__tests__/**',
    '!**/coverage/**',
  ],
  // Ensure proper cleanup between tests
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  // Environment variables for tests
  testEnvironmentOptions: {
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'error', // Reduce log noise during tests
    },
  },
};