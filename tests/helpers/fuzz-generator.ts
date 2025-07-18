import * as crypto from 'crypto';
import { createLimitedArray } from '../../apps/cli/src/__tests__/helpers/memory-utils';

export class FuzzGenerator {
  private stringCharset =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';

  constructor(private seed?: string) {
    if (seed) {
      // Use seed for reproducible tests
      crypto.createHash('sha256').update(seed);
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
      validTag?: boolean; // For tag validation
    } = {}
  ): string {
    const minLen = options.minLength || 1;
    const maxLen = Math.min(options.maxLength || 100, 10000); // Cap at 10k chars
    const length = this.number(minLen, maxLen);

    let charset = options.charset || this.stringCharset;

    if (options.validTag) {
      // Tags cannot contain <>"'& characters
      charset =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-.';
    } else {
      if (options.includeSpecialChars) {
        charset += '!@#$%^*()_+-=[]{}|;:,.';
      }
      if (options.includeUnicode) {
        charset += '⚡️🎉🔥💫🌟✨⭐️';
      }
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
  date(
    start: Date = new Date(2020, 0, 1),
    end: Date = new Date(2025, 11, 31)
  ): Date {
    return new Date(this.number(start.getTime(), end.getTime()));
  }

  // Generate valid ISO 8601 datetime string
  isoDateTime(start?: Date, end?: Date): string {
    const date = this.date(start, end);
    return date.toISOString();
  }

  // Generate valid ISO 8601 date string (YYYY-MM-DD)
  isoDate(start?: Date, end?: Date): string {
    const date = this.date(start, end);
    return date.toISOString().split('T')[0];
  }

  // Generate valid tag (no invalid characters, max 50 chars)
  validTag(): string {
    return this.string({
      minLength: 1,
      maxLength: 50,
      validTag: true,
    });
  }

  // Generate valid todo title (1-256 chars, not just whitespace)
  validTitle(): string {
    const title = this.string({
      minLength: 1,
      maxLength: 200,
      includeUnicode: true,
    });
    // Ensure it's not just whitespace
    return title.trim() || 'Default Title';
  }

  // Generate valid description (max 2048 chars)
  validDescription(): string {
    return this.string({
      minLength: 0,
      maxLength: 1000,
      includeSpecialChars: true,
    });
  }

  // Generate random array of items with memory limits
  array<T>(
    generator: () => T,
    options: { minLength?: number; maxLength?: number } = {}
  ): T[] {
    const minLen = options.minLength || 0;
    const maxLen = Math.min(options.maxLength || 10, 1000); // Cap at 1000 items
    const length = this.number(minLen, maxLen);
    return createLimitedArray(generator, length, 1000);
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

  // Generate random buffer with specified size
  buffer(options: { minLength?: number; maxLength?: number } = {}): Buffer {
    const minLen = options.minLength || 1;
    const maxLen = Math.min(options.maxLength || 1024, 65536); // Cap at 64KB
    const length = this.number(minLen, maxLen);

    const data = new Uint8Array(length);
    crypto.getRandomValues(data);
    return Buffer.from(data);
  }

  // Generate random object with specified schema
  object<T>(schema: { [K in keyof T]: () => T[K] }): T {
    const result = {} as T;
    for (const key in schema) {
      result[key] = schema[key]();
    }
    return result;
  }

  // Generate random email addresses
  email(): string {
    const domains = ['example.com', 'test.org', 'demo.net', 'sample.edu'];
    const usernames = ['user', 'test', 'demo', 'sample', 'admin'];
    const username = usernames[Math.floor(Math.random() * usernames.length)];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const suffix = this.number(1, 999);
    return `${username}${suffix}@${domain}`;
  }

  // Generate random URLs
  url(): string {
    const protocols = ['https://', 'http://'];
    const domains = ['example.com', 'test.org', 'demo.net', 'sample.edu'];
    const paths = ['/api/v1', '/data', '/files', '/images', '/docs'];

    const protocol = protocols[Math.floor(Math.random() * protocols.length)];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const path = paths[Math.floor(Math.random() * paths.length)];
    const resource = this.string({
      minLength: 5,
      maxLength: 20,
      charset: 'abcdefghijklmnopqrstuvwxyz0123456789',
    });

    return `${protocol}${domain}${path}/${resource}`;
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
    return errors[Math.floor(Math.random() * errors.length)];
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
