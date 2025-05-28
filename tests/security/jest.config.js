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
};
