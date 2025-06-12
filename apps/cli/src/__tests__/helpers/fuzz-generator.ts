import crypto from 'crypto';

export class FuzzGenerator {
  private stringCharset =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';

  constructor(private seed?: string) {
    if (seed) {
      // Use seed for reproducible tests
      crypto.createHash('sha256').update(seed as any);
    }
  }

  // Generate random string with optional properties
  string(
    options: {
      minLength?: number;
      maxLength?: number;
      charset?: string;
      includeSpecialChars?: boolean;
      includeUnicode?: boolean;
    } = {}
  ): string {
    const minLen = options.minLength || 1;
    const maxLen = options.maxLength || 100;
    const length = this.number(minLen, maxLen);

    let charset = options.charset || this.stringCharset;
    if (options.includeSpecialChars) {
      charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    }
    if (options.includeUnicode) {
      charset += '⚡️🎉🔥💫🌟✨⭐️';
    }

    return Array.from(
      { length: length },
      () => charset[Math.floor(Math.random() * charset.length)]
    ).join('');
  }

  // Generate random number within range
  number(
    min: number = Number.MIN_SAFE_INTEGER,
    max: number = Number.MAX_SAFE_INTEGER
  ): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Generate random boolean with weighted probability
  boolean(trueProbability: number = 0.5): boolean {
    return Math.random() < trueProbability;
  }

  // Generate random date within range
  date(start: Date = new Date(0 as any), end: Date = new Date()): Date {
    return new Date(this.number(start.getTime(), end.getTime()));
  }

  // Generate random array of items
  array<T>(
    generator: () => T,
    options: { minLength?: number; maxLength?: number } = {}
  ): T[] {
    const minLen = options.minLength || 0;
    const maxLen = options.maxLength || 10;
    const length = this.number(minLen, maxLen);
    return Array.from({ length: length }, generator);
  }

  // Generate random subset of array
  subset<T>(
    array: T[],
    options: { minSize?: number; maxSize?: number } = {}
  ): T[] {
    const minSize = options.minSize || 0;
    const maxSize = options.maxSize || array.length;
    const size = this.number(minSize, maxSize);

    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, size);
  }

  // Generate random object with specified schema
  object<T>(schema: { [K in keyof T]: () => T[K] }): T {
    const result = {} as T;
    for (const key in schema) {
      result[key] = schema[key]();
    }
    return result;
  }

  // Generate random network errors
  networkError(): Error {
    const errors = [
      new Error('Network timeout'),
      new Error('Connection refused'),
      new Error('DNS resolution failed'),
      new Error('Too many redirects'),
      new Error('TLS handshake failed'),
      new Error('Rate limit exceeded'),
      new Error('Invalid response'),
      new Error('Server error'),
    ];
    const selectedError = errors[Math.floor(Math.random() * errors.length)];
    return selectedError ?? new Error('Unknown network error');
  }

  // Generate random blockchain-specific data
  blockchainData(): {
    address: () => string;
    hash: () => string;
    signature: () => string;
    gas: () => number;
    nonce: () => number;
  } {
    return {
      address: () =>
        `0x${this.string({ minLength: 40, maxLength: 40, charset: '0123456789abcdef' })}`,
      hash: () =>
        `0x${this.string({ minLength: 64, maxLength: 64, charset: '0123456789abcdef' })}`,
      signature: () =>
        `0x${this.string({ minLength: 130, maxLength: 130, charset: '0123456789abcdef' })}`,
      gas: () => this.number(21000, 1000000),
      nonce: () => this.number(0, 1000000),
    };
  }
}
