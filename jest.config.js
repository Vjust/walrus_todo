/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: 'tsconfig.json'
    }],
    '^.+\\.(js|jsx|mjs)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', {
          targets: { node: 'current' },
          modules: false
        }]
      ]
    }]
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx', '.mts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '@mysten/sui/(.*)': '<rootDir>/src/__mocks__/@mysten/sui/$1',
    '@mysten/walrus': '<rootDir>/src/__mocks__/@mysten/walrus',
    'chalk': '<rootDir>/src/__mocks__/chalk.ts',
    '^@oclif/test$': '<rootDir>/node_modules/@oclif/test/lib/index.js',
    '^fancy-test$': '<rootDir>/node_modules/fancy-test/lib/index.js',
    '^sinon$': '<rootDir>/node_modules/sinon/pkg/sinon.js'
  },
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node', 'mts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    '/node_modules/(?!(@oclif|fancy-test|@mysten)/.*)'
  ],
  maxWorkers: 1,
  testTimeout: 10000,
  collectCoverage: false,
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/']
}