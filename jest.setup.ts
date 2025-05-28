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

// Environment setup
process.env.NODE_ENV = 'test';
// Use real implementations - no mocks needed

// Global timeout and cleanup
jest.setTimeout(10000);

// Reset environment variables before each test
if (typeof beforeEach === 'function') {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });
}