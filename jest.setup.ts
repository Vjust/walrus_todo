import {
  expect,
  describe,
  it,
  test,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from '@jest/globals';

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

// AggregateError is now available globally through the polyfill

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
