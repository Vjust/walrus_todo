module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.e2e.test.ts'],
  testTimeout: 30000, // 30 seconds for e2e tests
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowJs: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../../src/$1'
  },
  collectCoverageFrom: [
    '../../src/**/*.{js,ts}',
    '!../../src/types/**',
    '!../../src/**/*.d.ts',
    '!../../src/**/__mocks__/**'
  ],
  verbose: true
};