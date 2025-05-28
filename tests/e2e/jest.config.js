module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.e2e.test.ts'],
  testTimeout: 30000, // 30 seconds for e2e tests
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          allowJs: true,
          allowSyntheticDefaultImports: true,
        },
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
};
