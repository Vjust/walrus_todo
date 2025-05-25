// Polyfill for AggregateError if it doesn't exist globally
declare global {
  interface AggregateError extends Error {
    errors: unknown[];
  }

  interface AggregateErrorConstructor {
    new (errors: unknown[], message?: string): AggregateError;
    (errors: unknown[], message?: string): AggregateError;
    prototype: AggregateError;
  }

  const AggregateError: AggregateErrorConstructor;
}

// Check if AggregateError already exists globally
if (typeof globalThis.AggregateError === 'undefined') {
  // Define our own AggregateError implementation
  class AggregateErrorPolyfill extends Error {
    errors: unknown[];

    constructor(errors: unknown[], message?: string) {
      super(message);
      this.name = 'AggregateError';
      this.errors = errors;

      // Maintain proper stack trace for where our error was thrown
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, AggregateErrorPolyfill);
      }
    }
  }

  // Assign to globalThis
  (globalThis as unknown as { AggregateError: typeof AggregateErrorPolyfill }).AggregateError = AggregateErrorPolyfill;
}

export {};
