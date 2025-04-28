module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@mysten/sui$': '<rootDir>/src/__mocks__/@mysten/sui.ts',
    '^@mysten/walrus$': '<rootDir>/src/__mocks__/@mysten/walrus.ts'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    'setup.ts',
    'testUtils.ts',
    'helpers/'
  ]
}; 