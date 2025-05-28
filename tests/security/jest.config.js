module.exports = {
  displayName: 'Security Audit Tests',
  testMatch: ['<rootDir>/tests/security/**/*.test.ts'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/apps/cli/src/services/ai/**/*.ts',
    '<rootDir>/apps/cli/src/types/adapters/AI*.ts',
    '<rootDir>/apps/cli/src/commands/ai*.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/security/setup.js'],
  
  // Memory Management Configuration for Security Tests
  maxWorkers: '50%', // Limit workers for security tests
  workerIdleMemoryLimit: '512MB', // Conservative memory limit
  
  // Test Isolation and Cleanup
  forceExit: true,
  detectOpenHandles: true,
  logHeapUsage: true,
  
  // TypeScript optimization
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'es2020',
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
      // Memory optimization for TypeScript compilation
      isolatedModules: true,
      useESM: false,
    }],
  },
  
  // Cache configuration
  cache: true,
  cacheDirectory: '<rootDir>/../../node_modules/.cache/jest-security',
  
  // Global teardown for cleanup
  globalTeardown: '<rootDir>/../../scripts/jest-global-teardown.js',
};
