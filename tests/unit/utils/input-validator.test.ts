import {
  InputValidator,
  CommonValidationRules,
  ValidationRule,
} from '../../../src/utils/InputValidator';
import { ValidationError } from '../../../src/types/errors/consolidated';

describe('InputValidator', () => {
  describe('validate', () => {
    it('should validate with passing rules', () => {
      const result = InputValidator.validate('test@example.com', [
        CommonValidationRules.email,
      ]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate with failing rules', () => {
      const result = InputValidator.validate(
        'invalid-email',
        [CommonValidationRules.email],
        'email',
        {
          throwOnFirstError: false,
        }
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_EMAIL');
    });

    it('should throw on first error by default', () => {
      expect(() => {
        InputValidator.validate('invalid-email', [CommonValidationRules.email]);
      }).toThrow(ValidationError);
    });

    it('should collect all errors when specified', () => {
      const rules: ValidationRule<string>[] = [
        CommonValidationRules.email,
        {
          test: value => value.length > 10,
          message: 'Must be longer than 10 characters',
          code: 'TOO_SHORT',
        },
      ];

      const result = InputValidator.validate('short', rules, 'input', {
        throwOnFirstError: false,
        collectAllErrors: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it('should throw with combined error message when multiple errors exist', () => {
      const rules: ValidationRule<string>[] = [
        CommonValidationRules.email,
        {
          test: value => value.length > 10,
          message: 'Must be longer than 10 characters',
          code: 'TOO_SHORT',
        },
      ];

      expect(() => {
        InputValidator.validate('short', rules, 'input', {
          throwOnFirstError: true,
          collectAllErrors: true,
        });
      }).toThrow(
        /input: Invalid email address, input: Must be longer than 10 characters/
      );
    });

    it('should use custom error class', () => {
      class CustomError extends Error {}

      expect(() => {
        InputValidator.validate(
          'invalid',
          [CommonValidationRules.email],
          'input',
          {
            customErrorClass: CustomError as typeof Error,
          }
        );
      }).toThrow(CustomError);
    });
  });

  describe('validateObject', () => {
    const schema = {
      email: [CommonValidationRules.email],
      age: [
        InputValidator.inRange(
          18,
          100,
          'Age must be between 18-100',
          'INVALID_AGE'
        ),
      ],
      priority: [CommonValidationRules.priority],
    };

    it('should validate valid object', () => {
      const data = {
        email: 'test@example.com',
        age: 25,
        priority: 'high',
      };

      const result = InputValidator.validateObject(data, schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate invalid object', () => {
      const data = {
        email: 'invalid',
        age: 150,
        priority: 'urgent',
      };

      const result = InputValidator.validateObject(data, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });

    it('should throw on first error when specified', () => {
      const data = {
        email: 'invalid',
        age: 25,
        priority: 'high',
      };

      expect(() => {
        InputValidator.validateObject(data, schema, {
          throwOnFirstError: true,
        });
      }).toThrow(ValidationError);
    });

    it('should handle missing optional fields', () => {
      const data = {
        email: 'test@example.com',
        age: 25,
      };

      const result = InputValidator.validateObject(data, schema);
      expect(result.valid).toBe(true);
    });
  });

  describe('required', () => {
    it('should return true for non-null values', () => {
      expect(InputValidator.required('text')).toBe(true);
      expect(InputValidator.required(123)).toBe(true);
      expect(InputValidator.required([])).toBe(true);
      expect(InputValidator.required({})).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(InputValidator.required(null)).toBe(false);
      expect(InputValidator.required(undefined)).toBe(false);
    });

    it('should return false for empty strings', () => {
      expect(InputValidator.required('')).toBe(false);
      expect(InputValidator.required('   ')).toBe(false);
    });
  });

  describe('requiredRule', () => {
    it('should create required field rule', () => {
      const rule = InputValidator.requiredRule('username');
      expect(rule.code).toBe('REQUIRED_FIELD');
      expect(rule.message).toBe('username is required');
      expect(rule.test('')).toBe(false);
      expect(rule.test('valid')).toBe(true);
    });
  });

  describe('matchesPattern', () => {
    it('should validate pattern matching', () => {
      const rule = InputValidator.matchesPattern(
        /^\d+$/,
        'Must be numeric',
        'NUMERIC_ONLY'
      );
      expect(rule.test('123')).toBe(true);
      expect(rule.test('abc')).toBe(false);
    });
  });

  describe('inRange', () => {
    it('should validate numeric range', () => {
      const rule = InputValidator.inRange(
        10,
        20,
        'Must be 10-20',
        'OUT_OF_RANGE'
      );
      expect(rule.test(15)).toBe(true);
      expect(rule.test(10)).toBe(true);
      expect(rule.test(20)).toBe(true);
      expect(rule.test(5)).toBe(false);
      expect(rule.test(25)).toBe(false);
    });
  });

  describe('arrayLength', () => {
    it('should validate array length', () => {
      const rule = InputValidator.arrayLength(
        2,
        5,
        'Must have 2-5 items',
        'INVALID_LENGTH'
      );
      expect(rule.test([1, 2])).toBe(true);
      expect(rule.test([1, 2, 3, 4, 5])).toBe(true);
      expect(rule.test([1])).toBe(false);
      expect(rule.test([1, 2, 3, 4, 5, 6])).toBe(false);
    });

    it('should return false for non-arrays', () => {
      const rule = InputValidator.arrayLength(
        2,
        5,
        'Must have 2-5 items',
        'INVALID_LENGTH'
      );
      expect(rule.test('not an array' as unknown as unknown[])).toBe(false);
    });
  });

  describe('oneOf', () => {
    it('should validate allowed values', () => {
      const rule = InputValidator.oneOf(
        ['red', 'green', 'blue'],
        'Invalid color',
        'INVALID_COLOR'
      );
      expect(rule.test('red')).toBe(true);
      expect(rule.test('yellow')).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      expect(
        InputValidator.sanitizeString('<script>alert("XSS")</script>')
      ).toBe('\\alert\\(\\"XSS\\"\\)\\');
    });

    it('should escape shell metacharacters', () => {
      // Test various shell metacharacters
      expect(InputValidator.sanitizeString('$HOME')).toBe('\\$HOME');
      expect(InputValidator.sanitizeString('rm -rf /')).toBe(
        'rm\\ \\-rf\\ \\/'
      );
      expect(InputValidator.sanitizeString('echo "test"')).toBe(
        'echo\\ \\\\"test\\\\"'
      );
      expect(InputValidator.sanitizeString('cmd1 | cmd2')).toBe(
        'cmd1\\ \\|\\ cmd2'
      );
      expect(InputValidator.sanitizeString('ls > file')).toBe(
        'ls\\ \\>\\ file'
      );
      expect(InputValidator.sanitizeString('cat < input')).toBe(
        'cat\\ \\<\\ input'
      );
      expect(InputValidator.sanitizeString('cmd1 & cmd2')).toBe(
        'cmd1\\ \\&\\ cmd2'
      );
      expect(InputValidator.sanitizeString('cmd1; cmd2')).toBe(
        'cmd1\\;\\ cmd2'
      );
      expect(InputValidator.sanitizeString('`command`')).toBe('\\`command\\`');
      expect(InputValidator.sanitizeString('$(command)')).toBe(
        '\\$\\(command\\)'
      );
      expect(InputValidator.sanitizeString('file[1]')).toBe('file\\[1\\]');
      expect(InputValidator.sanitizeString('*.txt')).toBe('\\*\\.txt');
      expect(InputValidator.sanitizeString('file?')).toBe('file\\?');
      expect(InputValidator.sanitizeString('#comment')).toBe('\\#comment');
      expect(InputValidator.sanitizeString('test!')).toBe('test\\!');
      expect(InputValidator.sanitizeString('~user')).toBe('\\~user');
    });

    it('should remove control characters', () => {
      expect(
        InputValidator.sanitizeString('text\x00with\x1Fcontrol\x7Fchars')
      ).toBe('textwithcontrolchars');
    });

    it('should normalize whitespace', () => {
      expect(InputValidator.sanitizeString('  multiple   spaces  ')).toBe(
        'multiple spaces'
      );
    });

    it('should handle empty input', () => {
      expect(InputValidator.sanitizeString('')).toBe('');
      expect(InputValidator.sanitizeString(null as unknown as string)).toBe('');
    });
  });

  describe('combineRules', () => {
    it('should combine multiple rules', () => {
      const rule = InputValidator.combineRules(CommonValidationRules.email, {
        test: value => value.length > 10,
        message: 'Must be longer than 10',
        code: 'TOO_SHORT',
      });

      expect(rule.test('test@example.com')).toBe(true);
      expect(rule.test('a@b.c')).toBe(false); // valid email but too short
      expect(rule.test('not-an-email-but-long-enough')).toBe(false); // long enough but invalid email
    });
  });

  describe('conditionalRule', () => {
    it('should apply rule conditionally', () => {
      const rule = InputValidator.conditionalRule(
        (value: string) => value.startsWith('email:'),
        CommonValidationRules.email
      );

      expect(rule.test('email:test@example.com')).toBe(false); // starts with email: but includes prefix
      expect(rule.test('test@example.com')).toBe(true); // doesn't start with email:, no validation
      expect(rule.test('email:invalid')).toBe(false); // starts with email: but invalid
    });
  });

  describe('validateCommandFlags', () => {
    it('should validate required flags', () => {
      const flags = { input: 'file.txt', output: 'result.txt' };
      // Should not throw
      expect(() => {
        InputValidator.validateCommandFlags(flags, ['input', 'output']);
      }).not.toThrow();
    });

    it('should handle false values for required flags', () => {
      const flags = { verbose: false, input: 'test.txt' };
      // Should not throw - false is a valid value
      expect(() => {
        InputValidator.validateCommandFlags(flags, ['verbose', 'input']);
      }).not.toThrow();
    });

    it('should throw for missing required flags', () => {
      const flags = { input: 'file.txt' };
      expect(() => {
        InputValidator.validateCommandFlags(flags, ['input', 'output']);
      }).toThrow('Missing required flags: output');
    });

    it('should validate mutually exclusive flags', () => {
      const flags = { verbose: true, quiet: true };
      expect(() => {
        InputValidator.validateCommandFlags(flags, [], [['verbose', 'quiet']]);
      }).toThrow('Cannot use these flags together: verbose, quiet');
    });

    it('should allow non-conflicting flags', () => {
      const flags = { verbose: true };
      // Should not throw
      expect(() => {
        InputValidator.validateCommandFlags(flags, [], [['verbose', 'quiet']]);
      }).not.toThrow();
    });

    it('should handle undefined flags in mutually exclusive groups', () => {
      const flags = { verbose: true, debug: undefined };
      // Should not throw - undefined values are not considered present
      expect(() => {
        InputValidator.validateCommandFlags(flags, [], [['verbose', 'debug']]);
      }).not.toThrow();
    });
  });

  describe('custom', () => {
    it('should create custom validation rule', () => {
      const rule = InputValidator.custom(
        (value: number) => value % 2 === 0,
        'Must be even',
        'NOT_EVEN'
      );

      expect(rule.test(4)).toBe(true);
      expect(rule.test(3)).toBe(false);
      expect(rule.code).toBe('NOT_EVEN');
    });

    it('should use default code for custom rules', () => {
      const rule = InputValidator.custom(
        (value: number) => value > 0,
        'Must be positive'
      );

      expect(rule.code).toBe('CUSTOM_VALIDATION_FAILED');
    });
  });

  describe('validateEnvironment', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should validate required environment variables', () => {
      process.env.API_KEY = 'test-key';
      process.env.API_URL = 'https://api.example.com';

      const result = InputValidator.validateEnvironment(['API_KEY', 'API_URL']);
      expect(result.API_KEY).toBe('test-key');
      expect(result.API_URL).toBe('https://api.example.com');
    });

    it('should throw for missing required variables', () => {
      process.env.API_KEY = 'test-key';

      expect(() => {
        InputValidator.validateEnvironment(['API_KEY', 'API_URL']);
      }).toThrow('Missing required environment variables: API_URL');
    });

    it('should handle optional variables with defaults', () => {
      process.env.API_KEY = 'test-key';

      const result = InputValidator.validateEnvironment(['API_KEY'], {
        DEBUG: 'false',
        TIMEOUT: '5000',
      });

      expect(result.API_KEY).toBe('test-key');
      expect(result.DEBUG).toBe('false');
      expect(result.TIMEOUT).toBe('5000');
    });

    it('should use environment values over defaults for optional variables', () => {
      process.env.API_KEY = 'test-key';
      process.env.DEBUG = 'true';

      const result = InputValidator.validateEnvironment(['API_KEY'], {
        DEBUG: 'false',
        TIMEOUT: '5000',
      });

      expect(result.DEBUG).toBe('true');
      expect(result.TIMEOUT).toBe('5000');
    });
  });

  describe('CommonValidationRules', () => {
    describe('dateFormat', () => {
      it('should validate date format', () => {
        expect(CommonValidationRules.dateFormat.test('2023-12-31')).toBe(true);
        expect(CommonValidationRules.dateFormat.test('12/31/2023')).toBe(false);
        expect(CommonValidationRules.dateFormat.test('2023-1-1')).toBe(false);
      });
    });

    describe('email', () => {
      it('should validate email addresses', () => {
        expect(CommonValidationRules.email.test('test@example.com')).toBe(true);
        expect(
          CommonValidationRules.email.test('user.name+tag@domain.co.uk')
        ).toBe(true);
        expect(CommonValidationRules.email.test('invalid.email')).toBe(false);
        expect(CommonValidationRules.email.test('@example.com')).toBe(false);
        expect(CommonValidationRules.email.test('test@')).toBe(false);
      });
    });

    describe('walletAddress', () => {
      it('should validate wallet addresses', () => {
        expect(
          CommonValidationRules.walletAddress.test('0x' + 'a'.repeat(40))
        ).toBe(true);
        expect(
          CommonValidationRules.walletAddress.test(
            '0xABCDEF1234567890' + 'a'.repeat(24)
          )
        ).toBe(true);
        expect(
          CommonValidationRules.walletAddress.test('invalid-address')
        ).toBe(false);
        expect(
          CommonValidationRules.walletAddress.test('0x' + 'g'.repeat(40))
        ).toBe(false); // invalid hex
        expect(
          CommonValidationRules.walletAddress.test('0x' + 'a'.repeat(39))
        ).toBe(false); // too short
      });
    });

    describe('priority', () => {
      it('should validate priority values', () => {
        expect(CommonValidationRules.priority.test('high')).toBe(true);
        expect(CommonValidationRules.priority.test('medium')).toBe(true);
        expect(CommonValidationRules.priority.test('low')).toBe(true);
        expect(CommonValidationRules.priority.test('urgent')).toBe(false);
        expect(CommonValidationRules.priority.test('')).toBe(false);
      });
    });

    describe('network', () => {
      it('should validate network values', () => {
        expect(CommonValidationRules.network.test('mainnet')).toBe(true);
        expect(CommonValidationRules.network.test('testnet')).toBe(true);
        expect(CommonValidationRules.network.test('devnet')).toBe(true);
        expect(CommonValidationRules.network.test('local')).toBe(true);
        expect(CommonValidationRules.network.test('production')).toBe(false);
      });
    });

    describe('storageLocation', () => {
      it('should validate storage location values', () => {
        expect(CommonValidationRules.storageLocation.test('local')).toBe(true);
        expect(CommonValidationRules.storageLocation.test('blockchain')).toBe(
          true
        );
        expect(CommonValidationRules.storageLocation.test('both')).toBe(true);
        expect(CommonValidationRules.storageLocation.test('cloud')).toBe(false);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle null and undefined edge cases', () => {
      const result = InputValidator.validate(null, [], 'field', {
        throwOnFirstError: false,
      });
      expect(result.valid).toBe(true);
    });

    it('should handle empty rules array', () => {
      const result = InputValidator.validate('value', []);
      expect(result.valid).toBe(true);
    });

    it('should handle complex nested validation', () => {
      const nestedRule: ValidationRule<unknown> = {
        test: value => {
          if (typeof value !== 'object') return false;
          return value.nested && value.nested.field === 'valid';
        },
        message: 'Invalid nested structure',
        code: 'INVALID_NESTED',
      };

      const validObject = { nested: { field: 'valid' } };
      const invalidObject = { nested: { field: 'invalid' } };

      expect(
        InputValidator.validate(validObject, [nestedRule], 'object', {
          throwOnFirstError: false,
        }).valid
      ).toBe(true);
      expect(
        InputValidator.validate(invalidObject, [nestedRule], 'object', {
          throwOnFirstError: false,
        }).valid
      ).toBe(false);
    });

    it('should handle very long strings in sanitization', () => {
      const longString = 'a'.repeat(10000) + '<script>alert()</script>';
      const result = InputValidator.sanitizeString(longString);
      expect(result).not.toContain('<script>');
      expect(result.length).toBeGreaterThan(9000); // Should mostly preserve the string
    });
  });
});
