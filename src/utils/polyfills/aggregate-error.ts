// Polyfill for AggregateError if it doesn't exist globally

// Check if AggregateError already exists globally
if (typeof (globalThis as any).AggregateError === 'undefined') {
  // Define our own AggregateError implementation
  class AggregateErrorPolyfill extends Error {
    errors: unknown[];

    constructor(errors: unknown[], message?: string) {
      super(message);
      this.name = 'AggregateError';
      this.errors = Array.isArray(errors) ? errors : Array.from(errors as Iterable<unknown>);

      // Maintain proper stack trace for where our error was thrown
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, AggregateErrorPolyfill);
      }
    }
  }

  // Assign to globalThis with proper typing
  const globalThisWithAggregateError = globalThis as typeof globalThis & {
    AggregateError?: typeof AggregateErrorPolyfill;
  };
  globalThisWithAggregateError.AggregateError = AggregateErrorPolyfill;

  // Also make it available globally for different environments
  if (typeof global !== 'undefined') {
    (global as typeof global & { AggregateError?: typeof AggregateErrorPolyfill }).AggregateError = AggregateErrorPolyfill;
  }

  // For browser environments
  if (typeof window !== 'undefined') {
    (window as typeof window & { AggregateError?: typeof AggregateErrorPolyfill }).AggregateError = AggregateErrorPolyfill;
  }
}

export {};