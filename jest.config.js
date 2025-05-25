/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  transform: {
    // Enhanced TypeScript transform with support for ESM imports
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.json',
        isolatedModules: false, // Needed for proper type checking
        diagnostics: {
          // Report errors that would normally be ignored in transpileOnly mode
          warnOnly: true,
          ignoreCodes: [
            151001, // ESLint reported an error
            2322, // Type mismatch
            2339, // Property doesn't exist
            6133, // Unused variable
          ],
        },
      },
    ],
    // Enhanced JavaScript transform
    '^.+\\.(js|jsx|mjs)$': [
      'babel-jest',
      {
        presets: [
          [
            '@babel/preset-env',
            {
              targets: { node: 'current' },
              modules: 'commonjs', // Explicit modules format for compatibility
            },
          ],
        ],
        plugins: [
          // Support dynamic imports
          '@babel/plugin-syntax-dynamic-import',
          // Support top-level await
          '@babel/plugin-syntax-top-level-await',
        ],
      },
    ],
  },
  // Configure TypeScript ESM handling
  extensionsToTreatAsEsm: ['.ts', '.tsx', '.mts'],
  moduleNameMapper: {
    // Fix ESM module path patterns
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Add support for polyfills
    '^src/utils/polyfills/(.*)$': '<rootDir>/src/utils/polyfills/$1',
    // Handle absolute imports
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node', 'mts'],
  // Setup files run before each test file
  setupFiles: [
    // Explicitly load polyfills before tests
    '<rootDir>/src/utils/polyfills/aggregate-error.ts',
  ],
  // Setup files run after the test framework is installed
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    '/node_modules/(?!(@oclif|fancy-test|@mysten|@langchain|ora|cli-progress)/.*)',
  ],
  modulePaths: ['<rootDir>/src'],
  maxWorkers: 1,
  testTimeout: 10000,
  // Conditionally enable coverage collection for CI environments
  collectCoverage: process.env.CI === 'true' || false,
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/index.{js,ts}',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
};
