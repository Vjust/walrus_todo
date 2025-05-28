/**
 * Simplified Jest configuration for basic testing
 * Use this when the main config has issues
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/tests/unit/simple.test.ts',
    '**/tests/unit/basic.test.ts',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/waltodo-frontend/',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/simple-setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'es2020',
        lib: ['es2020'],
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false,
        noImplicitAny: false,
      },
      useESM: false,
      isolatedModules: false,
    }],
  },
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  verbose: true,
  maxWorkers: 1,
  testTimeout: 30000,
  cache: false,
};