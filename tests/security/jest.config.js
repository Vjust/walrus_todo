module.exports = {
  displayName: 'Security Audit Tests',
  testMatch: ['<rootDir>/*.test.ts'],
  rootDir: __dirname,
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  collectCoverage: false, // Disabled due to babel-plugin-istanbul/test-exclude/glob version incompatibility
  // collectCoverageFrom: [
  //   '<rootDir>/../../apps/cli/src/services/ai/**/*.ts',
  //   '<rootDir>/../../apps/cli/src/types/adapters/AI*.ts',
  //   '<rootDir>/../../apps/cli/src/commands/ai*.ts',
  // ],
  // coverageThreshold: {
  //   global: {
  //     branches: 80,
  //     functions: 80,
  //     lines: 80,
  //     statements: 80,
  //   },
  // },
  setupFilesAfterEnv: ['<rootDir>/setup.js'],

  // Module name mapping for monorepo structure and mocks
  moduleNameMapper: {
    // AI Service mocks (MUST come first, before general mapping)
    '^../../apps/cli/src/services/ai/aiService$':
      '<rootDir>/../../tests/mocks/aiService.js',
    '^../../apps/cli/src/services/ai/AIProviderFactory$':
      '<rootDir>/../../tests/mocks/AIProviderFactory.js',
    '^../../apps/cli/src/services/ai/AIVerificationService$':
      '<rootDir>/../../tests/mocks/AIVerificationService.js',
    '^../../apps/cli/src/services/ai/BlockchainAIVerificationService$':
      '<rootDir>/../../tests/mocks/BlockchainAIVerificationService.js',
    '^../../apps/cli/src/services/ai/SecureCredentialManager$':
      '<rootDir>/../../tests/mocks/SecureCredentialManager.js',
    '^../../apps/cli/src/services/ai/SecureCredentialService$':
      '<rootDir>/../../tests/mocks/SecureCredentialManager.js',
    '^../../apps/cli/src/services/ai/AIPermissionManager$':
      '<rootDir>/../../tests/mocks/AIPermissionManager.js',
    '^../../apps/cli/src/services/ai/BlockchainVerifier$':
      '<rootDir>/../../tests/mocks/BlockchainAIVerificationService.js',
    '^../../apps/cli/src/utils/Logger$':
      '<rootDir>/../../tests/mocks/Logger.js',
    '^../../apps/cli/src/services/ai/AuditLogger$':
      '<rootDir>/../../tests/mocks/AuditLogger.js',
    '^../../apps/cli/src/constants$':
      '<rootDir>/../../tests/mocks/constants.js',
      
    // Relative import mapping for security tests (after specific mocks)
    '^../../apps/cli/src/(.*)$': '<rootDir>/../../apps/cli/src/$1',

    // Monorepo path aliases for apps/cli structure
    '^@/(.*)$': '<rootDir>/../../apps/cli/src/$1',
    '^@tests/(.*)$': '<rootDir>/../../apps/cli/src/__tests__/$1',
    '^@types/(.*)$': '<rootDir>/../../apps/cli/src/types/$1',
    '^@utils/(.*)$': '<rootDir>/../../apps/cli/src/utils/$1',
    '^@services/(.*)$': '<rootDir>/../../apps/cli/src/services/$1',
    '^@commands/(.*)$': '<rootDir>/../../apps/cli/src/commands/$1',
    '^@adapters/(.*)$': '<rootDir>/../../apps/cli/src/types/adapters/$1',
    '^@errors/(.*)$': '<rootDir>/../../apps/cli/src/types/errors/$1',

    // Langchain mocks
    '^@langchain/core/prompts': '<rootDir>/../../tests/mocks/langchain-mock.js',
    '^@langchain/xai': '<rootDir>/../../tests/mocks/langchain-mock.js',
    '^@langchain/(.*)$': '<rootDir>/../../tests/mocks/langchain-mock.js',

    // p-retry compatibility
    '^p-retry$': '<rootDir>/../../node_modules/p-retry/index.js',
    // Mock WASM modules that cause loading issues in tests
    '^@mysten/walrus-wasm$': '<rootDir>/../../tests/mocks/walrus-wasm-mock.js',
    '^@mysten/walrus-wasm/(.*)$': '<rootDir>/../../tests/mocks/walrus-wasm-mock.js',
    '^@mysten/walrus$': '<rootDir>/../../tests/mocks/walrus-client-mock.js',
    '^@mysten/walrus/(.*)$': '<rootDir>/../../tests/mocks/walrus-client-mock.js',
  },

  // Memory Management Configuration for Security Tests
  maxWorkers: '50%', // Limit workers for security tests
  workerIdleMemoryLimit: '512MB', // Conservative memory limit

  // Test Isolation and Cleanup
  forceExit: true,
  detectOpenHandles: true,
  logHeapUsage: true,

  // TypeScript optimization - aligned with main config
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          target: 'es2020',
          lib: ['es2020'],
          skipLibCheck: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          moduleResolution: 'node',
          strict: false, // Disable strict mode to avoid class inheritance issues
          noImplicitAny: false,
        },
        // Memory optimization for TypeScript compilation
        useESM: false,
        isolatedModules: false, // Allow global types
        // Disable coverage instrumentation to avoid babel-plugin-istanbul/glob incompatibility
        collectCoverage: false,
      },
    ],
    // Remove babel-jest to avoid babel-plugin-istanbul issues
    // '^.+\\.(js|jsx)$': 'babel-jest',
  },

  // Cache configuration
  cache: false,
  // cacheDirectory: '<rootDir>/../../node_modules/.cache/jest-security',

  // Global teardown for cleanup
  globalTeardown: '<rootDir>/../../scripts/jest-global-teardown.js',

  // Module resolution and compatibility
  extensionsToTreatAsEsm: [],
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/waltodo-frontend/',
    '<rootDir>/../../dist/',
  ],
  // Prevent module naming collisions in monorepo
  modulePathIgnorePatterns: ['<rootDir>/../../dist/', '<rootDir>/../../build/'],
  // Fix haste module naming collisions
  haste: {
    enableSymlinks: false,
  },

  // Error handling
  errorOnDeprecated: false,

  // Resolver configuration
  resolver: undefined,

  // Jest transformIgnorePatterns for node_modules - aligned with main config
  transformIgnorePatterns: [
    'node_modules/(?!(p-retry|@mysten|delay|p-map|p-limit|p-queue|p-timeout|@langchain/.*|langchain|langsmith|@walrus|retry|uuid|nanoid|jose|ky|got|chalk|path-scurry))',
  ],
  
  // Coverage exclusions to prevent babel-plugin-istanbul issues
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/__tests__/',
    '/test/',
    '\\.d\\.ts$',
    'types/errors/consolidated/.*\\.d\\.ts$',
    'apps/cli/src/services/ai/credentials/EnhancedCredentialManager\\.ts$',
    // Exclude adapter files that cause babel-plugin-istanbul issues
    'apps/cli/src/types/adapters/AIModelAdapter\\.ts$',
    'glob/**',
    'test-exclude/**',
  ],

  // Module mocking
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
