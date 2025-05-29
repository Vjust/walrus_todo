// Polyfill for AggregateError if it doesn't exist globally

// Check if AggregateError already exists globally
const globalWithAggregateError = globalThis as unknown as {
  AggregateError?: unknown;
};
if (typeof globalWithAggregateError.AggregateError === 'undefined') {
  // Define our own AggregateError implementation
  class AggregateErrorPolyfill extends Error {
    errors: unknown[];

    constructor(errors: unknown[], message?: string) {
      super(message);
      this.name = 'AggregateError';
      this.errors = Array.isArray(errors)
        ? errors
        : Array.from(errors as unknown as Iterable<unknown>);

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
    const globalWithAggregateError = global as unknown as {
      AggregateError?: typeof AggregateErrorPolyfill;
    };
    globalWithAggregateError.AggregateError = AggregateErrorPolyfill;
  }

  // For browser environments
  if (typeof window !== 'undefined') {
    const windowWithAggregateError = window as unknown as {
      AggregateError?: typeof AggregateErrorPolyfill;
    };
    windowWithAggregateError.AggregateError = AggregateErrorPolyfill;
  }
}

export {};
