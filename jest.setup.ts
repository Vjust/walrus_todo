import { expect, describe, it, test, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// AggregateError polyfill for ES2020 targets
interface GlobalWithAggregateError {
  AggregateError?: typeof AggregateError;
}

if (typeof (global as GlobalWithAggregateError).AggregateError === 'undefined') {
  (global as GlobalWithAggregateError).AggregateError = class AggregateErrorPolyfill extends Error {
    errors: Error[];
    
    constructor(errors: Iterable<Error>, message?: string) {
      super(message);
      this.name = 'AggregateError';
      this.errors = Array.from(errors);
    }
  } as typeof AggregateError;
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