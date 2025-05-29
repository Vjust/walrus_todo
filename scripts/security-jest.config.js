/**
 * Minimal Jest Configuration for Security Tests
 * 
 * This configuration is designed to run security tests with minimal dependencies
 * and without the complex import chains that cause issues in the main Jest config.
 */

module.exports = {
  // Basic Jest setup
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Only run security tests
  testMatch: [
    '**/scripts/security-tests/**/*.test.js',
    '**/scripts/security-tests/**/*.test.ts'
  ],
  
  // Ignore problematic directories
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/waltodo-frontend/',
    '/apps/cli/src/__tests__/',
    '/tests/unit/',
    '/tests/integration/',
    '/tests/e2e/',
    '/tests/security/' // Ignore the complex security tests
  ],
  
  // Transform configuration - minimal
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.js$': 'babel-jest'
  },
  
  // Don't transform node_modules to avoid compatibility issues
  transformIgnorePatterns: [
    '/node_modules/(?!(@mysten|@walrus)/)'
  ],
  
  // Setup files - none to avoid complexity
  setupFilesAfterEnv: [],
  
  // Coverage settings
  collectCoverageFrom: [
    'scripts/security-tests/**/*.{js,ts}',
    '!scripts/security-tests/**/*.test.{js,ts}',
    '!scripts/security-tests/**/index.{js,ts}'
  ],
  
  // Test execution settings
  testTimeout: 10000,
  verbose: true,
  silent: false,
  
  // Memory management
  maxWorkers: 1,
  workerIdleMemoryLimit: '512MB',
  
  // Error handling
  errorOnDeprecated: false,
  bail: false,
  
  // Module resolution - keep simple
  moduleFileExtensions: ['ts', 'js', 'json'],
  
  // Global settings
  globals: {
    'ts-jest': {
      useESM: false,
      tsconfig: {
        compilerOptions: {
          strict: false,
          noImplicitAny: false,
          skipLibCheck: true,
          allowJs: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          moduleResolution: 'node'
        }
      }
    }
  },
  
  // Environment variables
  setupFilesAfterEnv: ['<rootDir>/security-test-env.js'],
  
  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Reporter configuration
  reporters: ['default']
};