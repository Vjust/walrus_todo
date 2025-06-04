/**
 * Jest configuration for Walrus Sites deployment tests
 * 
 * Optimized for testing deployment scenarios with appropriate timeouts,
 * mocking, and coverage reporting.
 */

module.exports = {
  displayName: 'Walrus Deployment Tests',
  testMatch: [
    '<rootDir>/tests/deployment/**/*.test.ts'
  ],
  
  // TypeScript support
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Module resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Setup and teardown
  setupFilesAfterEnv: [
    '<rootDir>/tests/deployment/setup.ts'
  ],
  globalSetup: '<rootDir>/tests/deployment/global-setup.ts',
  globalTeardown: '<rootDir>/tests/deployment/global-teardown.ts',
  
  // Timeouts for deployment operations
  testTimeout: 30000, // 30 seconds for integration tests
  
  // Coverage configuration
  collectCoverageFrom: [
    'waltodo-frontend/scripts/**/*.{js,ts}',
    'waltodo-frontend/walrus-site-waltodo/scripts/**/*.{js,ts,sh}',
    'tests/helpers/deployment-*.ts',
    'tests/mocks/deployment-*.ts'
  ],
  coverageDirectory: '<rootDir>/tests/deployment/coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Mock configuration
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Transform configuration
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        compilerOptions: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          skipLibCheck: true
        }
      }
    }]
  },
  
  // Module file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json'
  ],
  
  // Test environment variables
  testEnvironmentOptions: {
    url: 'http://localhost:3000'
  },
  
  // Reporters
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './tests/deployment/reports',
      filename: 'deployment-test-report.html',
      expand: true,
      hideIcon: false,
      pageTitle: 'Walrus Sites Deployment Tests'
    }],
    ['jest-junit', {
      outputDirectory: './tests/deployment/reports',
      outputName: 'deployment-junit.xml',
      suiteName: 'Walrus Deployment Tests'
    }]
  ],
  
  // Verbose output for deployment tests
  verbose: true,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Watch mode configuration
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  
  // Performance monitoring
  logHeapUsage: false,
  detectOpenHandles: true,
  forceExit: true,
  
  // Snapshot serializers
  snapshotSerializers: [
    'jest-serializer-path'
  ]
};