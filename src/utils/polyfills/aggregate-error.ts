// Polyfill for AggregateError if it doesn't exist globally
declare global {
  interface AggregateError extends Error {
    errors: any[];
  }
  
  interface AggregateErrorConstructor {
    new (errors: any[], message?: string): AggregateError;
    (errors: any[], message?: string): AggregateError;
    prototype: AggregateError;
  }
  
  var AggregateError: AggregateErrorConstructor;
}

// Check if AggregateError already exists globally
if (typeof globalThis.AggregateError === 'undefined') {
  // Define our own AggregateError implementation
  class AggregateErrorPolyfill extends Error {
    errors: any[];
    
    constructor(errors: any[], message?: string) {
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
  (globalThis as any).AggregateError = AggregateErrorPolyfill;
}

export {};