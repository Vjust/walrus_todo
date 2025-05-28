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
      },
    }],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/cli/src/$1',
  },
  testTimeout: 30000,
  clearMocks: true,
  restoreMocks: true,
  verbose: true,
};