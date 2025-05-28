import {
  expect,
  describe,
  it,
  test,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TextDecoder, TextEncoder } from 'util';

// Import AggregateError polyfill - try both locations
try {
  require('./src/utils/polyfills/aggregate-error');
} catch {
  try {
    require('./apps/cli/src/utils/polyfills/aggregate-error');
  } catch {
    // Fallback if polyfill doesn't exist
    console.warn('AggregateError polyfill not found, using native implementation');
  }
}

// Setup global polyfills
if (!global.TextDecoder) {
  (global as typeof globalThis).TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}
if (!global.TextEncoder) {
  (global as typeof globalThis).TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
}

// Make Jest globals available
(global as unknown as Record<string, unknown>).jest = jest;
(global as unknown as Record<string, unknown>).expect = expect;
(global as unknown as Record<string, unknown>).describe = describe;
(global as unknown as Record<string, unknown>).it = it;
(global as unknown as Record<string, unknown>).test = test;
(global as unknown as Record<string, unknown>).beforeAll = beforeAll;
(global as unknown as Record<string, unknown>).afterAll = afterAll;
(global as unknown as Record<string, unknown>).beforeEach = beforeEach;
(global as unknown as Record<string, unknown>).afterEach = afterEach;

// Global Node.js module mocks
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('{}'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmdirSync: jest.fn(),
  readdirSync: jest.fn().mockReturnValue([]),
  statSync: jest.fn().mockReturnValue({ isDirectory: () => false, isFile: () => true }),
  lstatSync: jest.fn().mockReturnValue({ isDirectory: () => false, isFile: () => true }),
  promises: {
    readFile: jest.fn().mockResolvedValue('{}'),
    writeFile: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    rmdir: jest.fn().mockResolvedValue(undefined),
    readdir: jest.fn().mockResolvedValue([]),
    stat: jest.fn().mockResolvedValue({ isDirectory: () => false, isFile: () => true }),
    lstat: jest.fn().mockResolvedValue({ isDirectory: () => false, isFile: () => true }),
  },
}));

jest.mock('child_process', () => ({
  exec: jest.fn(),
  execSync: jest.fn().mockReturnValue(''),
  spawn: jest.fn().mockReturnValue({
    stdout: { on: jest.fn(), pipe: jest.fn() },
    stderr: { on: jest.fn(), pipe: jest.fn() },
    on: jest.fn(),
    kill: jest.fn(),
  }),
  fork: jest.fn(),
}));

jest.mock('path', () => ({
  ...jest.requireActual('path'),
  resolve: jest.fn().mockImplementation((...args) => args.join('/')),
  join: jest.fn().mockImplementation((...args) => args.join('/')),
}));

jest.mock('os', () => ({
  homedir: jest.fn().mockReturnValue('/home/test'),
  tmpdir: jest.fn().mockReturnValue('/tmp'),
  platform: jest.fn().mockReturnValue('linux'),
  arch: jest.fn().mockReturnValue('x64'),
}));

// Global Sui/Walrus mocks
jest.mock('@mysten/sui/client', () => ({
  SuiClient: jest.fn().mockImplementation(() => ({
    getObject: jest.fn().mockResolvedValue({ data: null }),
    multiGetObjects: jest.fn().mockResolvedValue([]),
    executeTransactionBlock: jest.fn().mockResolvedValue({
      digest: 'mock-digest',
      effects: { status: { status: 'success' } },
    }),
    signAndExecuteTransaction: jest.fn().mockResolvedValue({
      digest: 'mock-digest',
      effects: { status: { status: 'success' } },
    }),
    dryRunTransactionBlock: jest.fn().mockResolvedValue({
      effects: { status: { status: 'success' } },
    }),
  })),
  getFullnodeUrl: jest.fn().mockReturnValue('https://mock-sui-endpoint'),
}));

jest.mock('@mysten/sui/transactions', () => ({
  Transaction: jest.fn().mockImplementation(() => ({
    moveCall: jest.fn(),
    transferObjects: jest.fn(),
    serialize: jest.fn().mockReturnValue(new Uint8Array()),
  })),
  TransactionBlock: jest.fn().mockImplementation(() => ({
    moveCall: jest.fn(),
    transferObjects: jest.fn(),
    serialize: jest.fn().mockReturnValue(new Uint8Array()),
  })),
}));

jest.mock('@mysten/sui/keypairs/ed25519', () => ({
  Ed25519Keypair: jest.fn().mockImplementation(() => ({
    getPublicKey: jest.fn().mockReturnValue({
      toSuiAddress: jest.fn().mockReturnValue('0x123'),
    }),
    signTransactionBlock: jest.fn().mockResolvedValue({
      signature: 'mock-signature',
      transactionBlockBytes: new Uint8Array(),
    }),
  })),
}));

jest.mock('@mysten/sui/cryptography', () => ({
  Ed25519PublicKey: jest.fn(),
  Secp256k1PublicKey: jest.fn(),
  verifySignature: jest.fn().mockReturnValue(true),
}));

// Global timeout and cleanup
jest.setTimeout(10000);

// Reset all mocks before each test
if (typeof beforeEach === 'function') {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    process.env.NODE_ENV = 'test';
    process.env.WALRUS_USE_MOCK = 'true';
  });
}

// Global error suppression for expected test errors
const originalConsoleError = console.error;
if (typeof beforeAll === 'function') {
  beforeAll(() => {
    console.error = (...args: unknown[]) => {
      const message = args.join(' ');
      // Suppress known test-related errors
      if (
        message.includes('Warning:') ||
        message.includes('deprecated') ||
        message.includes('experimental')
      ) {
        return;
      }
      originalConsoleError(...args);
    };
  });
}

if (typeof afterAll === 'function') {
  afterAll(() => {
    console.error = originalConsoleError;
  });
}
