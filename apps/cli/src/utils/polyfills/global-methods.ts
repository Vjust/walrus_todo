// Polyfills for global methods that might be missing in older Node.js versions

// Object.hasOwn (Node.js 16.9.0+) - Safer alternative to hasOwnProperty
if (typeof Object.hasOwn === 'undefined') {
  Object.hasOwn = function(obj: object, property: string | number | symbol): boolean {
    return Object.prototype.hasOwnProperty.call(obj, property);
  };
}

// structuredClone (Node.js 17.0.0+) - Deep cloning
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = function<T>(value: T): T {
    // Simple implementation for basic cases
    // This is not a complete implementation but covers most use cases
    if (value === null || typeof value !== 'object') {
      return value;
    }
    
    if (value instanceof Date) {
      return new Date(value.getTime()) as unknown as T;
    }
    
    if (value instanceof Array) {
      return value.map(item => globalThis.structuredClone(item)) as unknown as T;
    }
    
    if (typeof value === 'object') {
      const cloned = {} as T;
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          (cloned as any)[key] = globalThis.structuredClone((value as any)[key]);
        }
      }
      return cloned;
    }
    
    return value;
  };
}

// AbortSignal.timeout (Node.js 16.14.0+)
if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'undefined') {
  AbortSignal.timeout = function(milliseconds: number): AbortSignal {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), milliseconds);
    return controller.signal;
  };
}

// AbortSignal.abort (Node.js 15.12.0+)
if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.abort === 'undefined') {
  AbortSignal.abort = function(reason?: any): AbortSignal {
    const controller = new AbortController();
    controller.abort(reason);
    return controller.signal;
  };
}

// Error.cause support (Node.js 16.9.0+)
// This is handled at runtime when creating errors, not as a polyfill

export {};