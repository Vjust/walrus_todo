/**
 * Global type declarations for the test environment
 * Ensures all necessary types are available globally
 */

declare global {
  // Ensure Record type is available globally
  interface RecordConstructor {
    <K extends keyof any, T>(obj?: any): Record<K, T>;
  }
  
  var Record: RecordConstructor;

  // Ensure other built-in types are available
  interface ObjectConstructor {
    keys<T>(obj: T): Array<keyof T>;
    values<T>(obj: { [s: string]: T } | ArrayLike<T>): T[];
    entries<T>(obj: { [s: string]: T } | ArrayLike<T>): Array<[string, T]>;
    assign<T, U>(target: T, source: U): T & U;
    assign<T, U, V>(target: T, source1: U, source2: V): T & U & V;
    assign<T, U, V, W>(target: T, source1: U, source2: V, source3: W): T & U & V & W;
    assign(target: object, ...sources: any[]): any;
  }

  // Ensure console types are available
  interface Console {
    log(...data: any[]): void;
    error(...data: any[]): void;
    warn(...data: any[]): void;
    info(...data: any[]): void;
    debug(...data: any[]): void;
  }

  var console: Console;

  // Global test utilities
  interface TestGlobal {
    sanitizeOutput(output: string): string;
  }

  var global: typeof globalThis & TestGlobal;

  // Node.js process types
  interface ProcessEnv {
    [key: string]: string | undefined;
    NODE_ENV?: 'development' | 'production' | 'test';
    XAI_API_KEY?: string;
    OPENAI_API_KEY?: string;
    CI?: string;
    LOG_MEMORY?: string;
  }

  interface Process {
    env: ProcessEnv;
    exit(code?: number): never;
    memoryUsage(): {
      rss: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
    on(event: string, listener: (...args: any[]) => void): Process;
  }

  var process: Process;

  // Buffer global
  interface BufferConstructor {
    from(data: any, encoding?: BufferEncoding): Buffer;
    alloc(size: number, fill?: any, encoding?: BufferEncoding): Buffer;
    allocUnsafe(size: number): Buffer;
    concat(list: Uint8Array[], totalLength?: number): Buffer;
  }

  var Buffer: BufferConstructor;

  // Text encoding/decoding
  interface TextEncoder {
    encode(input?: string): Uint8Array;
  }

  interface TextDecoder {
    decode(input?: BufferSource): string;
  }

  var TextEncoder: {
    new (): TextEncoder;
  };

  var TextDecoder: {
    new (label?: string, options?: any): TextDecoder;
  };

  // URL global
  interface URLConstructor {
    new (url: string, base?: string | URL): URL;
  }

  var URL: URLConstructor;

  // AbortController
  interface AbortSignal extends EventTarget {
    readonly aborted: boolean;
    addEventListener(type: string, listener: any): void;
    removeEventListener(type: string, listener: any): void;
  }

  interface AbortController {
    readonly signal: AbortSignal;
    abort(): void;
  }

  var AbortController: {
    new (): AbortController;
  };

  // Garbage collection
  function gc(): void;

  // Crypto global for Node.js
  interface CryptoModule {
    createHash(algorithm: string): any;
    createHmac(algorithm: string, key: any): any;
    randomBytes(size: number): Buffer;
    createCipheriv(algorithm: string, key: any, iv: any): any;
    createDecipheriv(algorithm: string, key: any, iv: any): any;
  }
}

// Module augmentation for better Jest integration
declare module '@jest/globals' {
  export const jest: typeof global.jest;
  export const expect: typeof global.expect;
  export const describe: typeof global.describe;
  export const test: typeof global.test;
  export const it: typeof global.it;
  export const beforeEach: typeof global.beforeEach;
  export const afterEach: typeof global.afterEach;
  export const beforeAll: typeof global.beforeAll;
  export const afterAll: typeof global.afterAll;
}

export {};