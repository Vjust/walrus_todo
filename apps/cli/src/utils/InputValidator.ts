// CLIError imported but not used
import { ValidationError } from '../types/errors';

/**
 * Types of validation rules
 */
export type ValidationRule<T> = {
  test: (value: T) => boolean;
  message: string;
  code: string;
  field?: string;
};

/**
 * Interface for validation schema
 */
export interface ValidationSchema {
  [key: string]: ValidationRule<unknown>[];
}

/**
 * Enhanced validation options
 */
export interface ValidationOptions {
  throwOnFirstError?: boolean;
  collectAllErrors?: boolean;
  customErrorClass?: typeof Error;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
    value?: unknown;
  }>;
}

/**
 * Enhanced input validation class
 */
export class InputValidator {
  /**
   * Enhanced validation with better error handling
   * @param value The value to validate
   * @param rules Array of validation rules
   * @param fieldName Optional field name for error messages
   * @param options Validation options
   * @returns Validation result or throws error
   */
  static validate<T>(
    value: T,
    rules: ValidationRule<T>[],
    fieldName: string = 'input',
    options: ValidationOptions = {}
  ): ValidationResult {
    const {
      throwOnFirstError = true,
      collectAllErrors = false,
      customErrorClass = ValidationError,
    } = options;

    const errors: ValidationResult["errors"] = [];

    for (const rule of rules) {
      if (!rule.test(value)) {
        const errorField = rule.field || fieldName;
        const errorMessage = fieldName
          ? `${fieldName}: ${rule.message}`
          : rule.message;

        const error = {
          field: errorField,
          message: errorMessage,
          code: rule.code,
          value,
        };

        errors.push(error);

        if (throwOnFirstError && !collectAllErrors) {
          throw new customErrorClass(errorMessage, {
            field: errorField,
            value,
            constraint: rule.code,
            recoverable: false,
          });
        }
      }
    }

    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
    };

    if (!result.valid && throwOnFirstError) {
      const combinedMessage = errors.map(e => e.message).join(', ');
      throw new customErrorClass(combinedMessage, {
        field: fieldName,
        value,
        constraint: 'MULTIPLE_VIOLATIONS',
        recoverable: false,
      });
    }

    return result;
  }

  /**
   * Enhanced object validation with better error collection
   * @param data Object to validate
   * @param schema Validation schema
   * @param options Validation options (defaults: throwOnFirstError=false, collectAllErrors=true)
   * @returns Validation result with valid boolean and errors array
   * @throws ValidationError if throwOnFirstError is true and validation fails
   *
   * @example
   * const result = InputValidator.validateObject(userData, {
   *   email: [CommonValidationRules.email],
   *   age: [InputValidator.inRange(18, 100, 'Age must be between 18-100', 'INVALID_AGE')]
   * });
   */
  static validateObject<T extends Record<string, unknown>>(
    data: T,
    schema: ValidationSchema,
    options: ValidationOptions = {
      throwOnFirstError: false,
      collectAllErrors: true,
    }
  ): ValidationResult {
    // collectAllErrors would be used for error accumulation
    // const { collectAllErrors = true } = options;
    const allErrors: ValidationResult["errors"] = [];

    for (const [field, rules] of Object.entries(schema)) {
      if (field in data) {
        const result = this.validate(
          (data as Record<string, unknown>)[field],
          rules,
          field,
          {
            ...options,
            throwOnFirstError: false,
            collectAllErrors: true,
          }
        );

        if (!result.valid) {
          allErrors.push(...result.errors);
        }
      }
    }

    const result: ValidationResult = {
      valid: allErrors.length === 0,
      errors: allErrors,
    };

    if (!result.valid && options.throwOnFirstError) {
      const errorMessage = allErrors
        .map(e => `${e.field}: ${e.message}`)
        .join('\n');
      throw new ValidationError(errorMessage, {
        constraint: 'OBJECT_VALIDATION_FAILED',
        recoverable: false,
      });
    }

    return result;
  }

  /**
   * Generic required field validation
   * @param value Value to check
   * @returns true if value is present
   */
  static required<T>(value: T): boolean {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  }

  /**
   * Create a required field validation rule
   * @param fieldName Name of the field
   * @returns Validation rule for required field
   */
  static requiredRule<T = unknown>(fieldName: string): ValidationRule<T> {
    return {
      test: value => this.required(value),
      message: `${fieldName} is required`,
      code: 'REQUIRED_FIELD',
    };
  }

  /**
   * Validate a string against a regex
   * @param regex Regular expression to test
   * @param message Error message if validation fails
   * @param code Error code if validation fails
   * @returns Validation rule
   */
  static matchesPattern(
    regex: RegExp,
    message: string,
    code: string
  ): ValidationRule<string> {
    return {
      test: value => regex.test(value),
      message,
      code,
    };
  }

  /**
   * Validate a value is within a minimum and maximum
   * @param min Minimum value
   * @param max Maximum value
   * @param message Error message if validation fails
   * @param code Error code if validation fails
   * @returns Validation rule
   */
  static inRange(
    min: number,
    max: number,
    message: string,
    code: string
  ): ValidationRule<number> {
    return {
      test: value => value >= min && value <= max,
      message,
      code,
    };
  }

  /**
   * Validate an array's length
   * @param minLength Minimum array length
   * @param maxLength Maximum array length
   * @param message Error message if validation fails
   * @param code Error code if validation fails
   * @returns Validation rule
   */
  static arrayLength<T>(
    minLength: number,
    maxLength: number,
    message: string,
    code: string
  ): ValidationRule<T[]> {
    return {
      test: value =>
        Array.isArray(value) &&
        value.length >= minLength &&
        value.length <= maxLength,
      message,
      code,
    };
  }

  /**
   * Validate a value is one of the allowed values
   * @param allowedValues Array of allowed values
   * @param message Error message if validation fails
   * @param code Error code if validation fails
   * @returns Validation rule
   */
  static oneOf<T>(
    allowedValues: T[],
    message: string,
    code: string
  ): ValidationRule<T> {
    return {
      test: value => allowedValues.includes(value),
      message,
      code,
    };
  }

  /**
   * Sanitize a string to prevent injection attacks
   * Escapes HTML tags and shell metacharacters
   * @param input String to sanitize
   * @returns Sanitized string
   */
  static sanitizeString(input: string): string {
    if (!input) return '';

    // Escape HTML entities first
    let sanitized = input
      .replace(/&/g, '&amp;') // & -> &amp;
      .replace(/</g, '&lt;') // < -> &lt;
      .replace(/>/g, '&gt;') // > -> &gt;
      .replace(/"/g, '&quot;') // " -> &quot;
      .replace(/'/g, '&#x27;'); // ' -> &#x27;

    // Escape shell metacharacters comprehensively
    // This includes all shell special characters that could be used for injection
    // Now also includes backticks, dollar signs, and other shell expansion characters
    const shellMetaChars = /([\\$'"`;|&<>(){}[\]!#*?~^])/g;
    sanitized = sanitized.replace(shellMetaChars, '\\$1');

    // Remove null bytes and other control characters
    sanitized = sanitized.replace(
      new RegExp(
        '[' +
          String.fromCharCode(1) +
          '-' +
          String.fromCharCode(31) +
          String.fromCharCode(127) +
          ']',
        'g'
      ),
      ''
    );

    // Normalize whitespace but preserve intentional spacing
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
  }

  /**
   * Create a composite validation rule that combines multiple rules
   * @param rules Rules to combine
   * @returns Combined validation rule
   */
  static combineRules<T>(...rules: ValidationRule<T>[]): ValidationRule<T> {
    return {
      test: value => rules.every(rule => rule.test(value)),
      message: 'Value must satisfy all constraints',
      code: 'COMPOSITE_VALIDATION_FAILED',
    };
  }

  /**
   * Create conditional validation rule
   * @param condition Condition to check
   * @param rule Rule to apply if condition is true
   * @returns Conditional validation rule
   */
  static conditionalRule<T>(
    condition: (value: T) => boolean,
    rule: ValidationRule<T>
  ): ValidationRule<T> {
    return {
      test: value => !condition(value) || rule.test(value),
      message: rule.message,
      code: rule.code,
    };
  }

  /**
   * Validate command flags with pre-execution checks
   * @param flags Command flags
   * @param requiredFlags Required flags
   * @param mutuallyExclusive Mutually exclusive flag groups
   * @throws ValidationError if validation fails
   */
  static validateCommandFlags(
    flags: Record<string, unknown>,
    requiredFlags: string[] = [],
    mutuallyExclusive: string[][] = []
  ): void {
    // Check required flags - properly handle false values
    const missingFlags = requiredFlags.filter(
      flag => (flags as Record<string, unknown>)[flag] === undefined
    );
    if (missingFlags.length > 0) {
      throw new ValidationError(
        `Missing required flags: ${missingFlags.join(', ')}`,
        {
          constraint: 'MISSING_REQUIRED_FLAGS',
          recoverable: false,
        }
      );
    }

    // Check mutually exclusive flags - only consider defined values
    for (const group of mutuallyExclusive) {
      const presentFlags = group.filter(
        flag => (flags as Record<string, unknown>)[flag] !== undefined
      );
      if (presentFlags.length > 1) {
        throw new ValidationError(
          `Cannot use these flags together: ${presentFlags.join(', ')}`,
          {
            constraint: 'MUTUALLY_EXCLUSIVE_FLAGS',
            recoverable: false,
          }
        );
      }
    }
  }

  /**
   * Create a custom validation rule
   * @param testFn Test function
   * @param message Error message
   * @param code Error code
   * @returns Custom validation rule
   */
  static custom<T>(
    testFn: (value: T) => boolean,
    message: string,
    code: string = 'CUSTOM_VALIDATION_FAILED'
  ): ValidationRule<T> {
    return {
      test: testFn,
      message,
      code,
    };
  }

  /**
   * Validate environment variables
   * @param required Required environment variables
   * @param optional Optional environment variables with defaults
   * @returns Object with environment variable values
   */
  static validateEnvironment(
    required: string[],
    optional: Record<string, string> = {}
  ): Record<string, string> {
    const env: Record<string, string> = {};
    const missing: string[] = [];

    // Check required vars
    for (const varName of required) {
      if (!(process.env as Record<string, string | undefined>)[varName]) {
        missing.push(varName);
      } else {
        env[varName] = (process.env as Record<string, string>)[varName];
      }
    }

    if (missing.length > 0) {
      throw new ValidationError(
        `Missing required environment variables: ${missing.join(', ')}`,
        {
          constraint: 'MISSING_ENV_VARS',
          recoverable: false,
        }
      );
    }

    // Set optional vars with defaults
    for (const [varName, defaultValue] of Object.entries(optional)) {
      env[varName] =
        (process.env as Record<string, string | undefined>)[varName] ||
        defaultValue;
    }

    return env;
  }
}

// Common validation rules
export const CommonValidationRules = {
  // Date validation (YYYY-MM-DD)
  dateFormat: InputValidator.matchesPattern(
    /^\d{4}-\d{2}-\d{2}$/,
    'Invalid date format. Use YYYY-MM-DD',
    'INVALID_DATE_FORMAT'
  ),

  // Email validation
  email: InputValidator.matchesPattern(
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    'Invalid email address',
    'INVALID_EMAIL'
  ),

  // Wallet address validation
  walletAddress: InputValidator.matchesPattern(
    /^0x[a-fA-F0-9]{40,}$/,
    'Invalid wallet address format. Must be a valid hex address starting with 0x',
    'INVALID_WALLET_ADDRESS'
  ),

  // Priority validation
  priority: InputValidator.oneOf(
    ['high', 'medium', 'low'],
    'Priority must be high, medium, or low',
    'INVALID_PRIORITY'
  ),

  // Network validation
  network: InputValidator.oneOf(
    ['mainnet', 'testnet', 'devnet', 'local'],
    'Network must be mainnet, testnet, devnet, or local',
    'INVALID_NETWORK'
  ),

  // Storage location validation
  storageLocation: InputValidator.oneOf(
    ['local', 'blockchain', 'both'],
    'Storage location must be local, blockchain, or both',
    'INVALID_STORAGE_LOCATION'
  ),
};
