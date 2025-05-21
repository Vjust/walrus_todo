import { jest, expect, describe, it, test, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// AggregateError polyfill for ES2020 targets
if (typeof AggregateError === 'undefined') {
  (global as unknown as { AggregateError: typeof Error }).AggregateError = class AggregateError extends Error {
    errors: Error[];
    
    constructor(errors: Iterable<Error>, message?: string) {
      super(message);
      this.name = 'AggregateError';
      this.errors = Array.from(errors);
    }
  };
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