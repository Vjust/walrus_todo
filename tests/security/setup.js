// Jest setup file for security audit tests

// Set up environment variables for testing
// Mock logger to avoid circular dependencies
const logger = {
  error: (...args) => console.error('[SECURITY-TEST]', ...args),
  warn: (...args) => console.warn('[SECURITY-TEST]', ...args),
  info: (...args) => console.info('[SECURITY-TEST]', ...args),
  debug: (...args) => console.debug('[SECURITY-TEST]', ...args),
};

// Global type declarations for test environment
if (typeof global.Record === 'undefined') {
  global.Record = globalThis.Record;
}
process.env.NODE_ENV = 'test';
process.env.XAI_API_KEY = 'test-api-key';

// Set a fixed timestamp for consistent test results
const fixedDate = new Date('2023-09-15T12:00:00Z');
const OriginalDate = Date;
global.Date = class extends OriginalDate {
  constructor(...args) {
    if (args.length === 0) {
      super(fixedDate.getTime());
    } else {
      super(...args);
    }
  }

  static now() {
    return fixedDate.getTime();
  }

  static parse(...args) {
    return OriginalDate.parse(...args);
  }

  static UTC(...args) {
    return OriginalDate.UTC(...args);
  }
};

// Additional setup for security tests
jest.setTimeout(30000); // Increase timeout for security tests

// Mock @langchain modules are handled by moduleNameMapper in jest.config.js
// No need for manual mocking here as it causes circular references

// Add global security testing helpers
global.sanitizeOutput = output => {
  // Simple sanitizer to remove sensitive patterns
  const patterns = [
    /api[-_]?key[-_=:]["']?[\w\d]+["']?/gi,
    /password[-_=:]["']?[\w\d]+["']?/gi,
    /secret[-_=:]["']?[\w\d]+["']?/gi,
    /bearer[-_=:]["']?[\w\d]+["']?/gi,
    /authorization[-_=:]["']?[\w\d]+["']?/gi,
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /\b(?:\d[ -]*?){13,16}\b/, // Credit card
  ];

  let sanitized = output;
  patterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });

  return sanitized;
};

// Set up a global error handler to catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error(
    'Unhandled Rejection at:',
    promise,
    'reason:',
    global.sanitizeOutput(String(reason))
  );
  // Don't actually exit the process during tests
});

// Define custom matchers for security tests
expect.extend({
  toBeSecurelyHashed(received, algorithm = 'sha256') {
    // Check if a string looks like it's been securely hashed
    const hashPatterns = {
      sha256: /^[a-f0-9]{64}$/i,
      sha512: /^[a-f0-9]{128}$/i,
      md5: /^[a-f0-9]{32}$/i,
    };

    const pattern = hashPatterns[algorithm] || hashPatterns.sha256;
    const pass = pattern.test(received);

    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid ${algorithm} hash`,
      pass,
    };
  },

  notToContainSensitiveData(received) {
    // Check if a string contains common patterns of sensitive data
    const sensitivePatterns = [
      /api[-_]?key[-_=:]/i,
      /password[-_=:]/i,
      /secret[-_=:]/i,
      /bearer /i,
      /authorization: /i,
      /access[-_]token/i,
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b(?:\d[ -]*?){13,16}\b/, // Credit card
    ];

    const matches = sensitivePatterns
      .map(pattern => (pattern.test(received) ? pattern.toString() : null))
      .filter(Boolean);

    const pass = matches.length === 0;

    return {
      message: () =>
        `expected string not to contain sensitive data but found: ${matches.join(', ')}`,
      pass,
    };
  },
});
