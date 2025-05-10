import { CLIError } from '../types/error';

/**
 * Types of validation rules
 */
export type ValidationRule<T> = {
  test: (value: T) => boolean;
  message: string;
  code: string;
};

/**
 * Interface for validation schema
 */
export interface ValidationSchema {
  [key: string]: ValidationRule<any>[];
}

/**
 * Class for input validation
 */
export class InputValidator {
  /**
   * Validate a single value against a set of rules
   * @param value The value to validate
   * @param rules Array of validation rules
   * @param fieldName Optional field name for error messages
   * @throws {CLIError} if validation fails
   */
  static validate<T>(
    value: T,
    rules: ValidationRule<T>[],
    fieldName: string = 'input'
  ): void {
    for (const rule of rules) {
      if (!rule.test(value)) {
        const message = fieldName ? `${fieldName}: ${rule.message}` : rule.message;
        throw new CLIError(message, rule.code);
      }
    }
  }

  /**
   * Validate an object against a validation schema
   * @param data Object to validate
   * @param schema Validation schema
   * @throws {CLIError} if validation fails
   */
  static validateObject<T extends Record<string, any>>(
    data: T,
    schema: ValidationSchema
  ): void {
    for (const [field, rules] of Object.entries(schema)) {
      if (field in data) {
        this.validate(data[field], rules, field);
      }
    }
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
  static requiredRule(fieldName: string): ValidationRule<any> {
    return {
      test: (value) => this.required(value),
      message: `${fieldName} is required`,
      code: 'REQUIRED_FIELD'
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
      test: (value) => regex.test(value),
      message,
      code
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
      test: (value) => value >= min && value <= max,
      message,
      code
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
      test: (value) => 
        Array.isArray(value) && value.length >= minLength && value.length <= maxLength,
      message,
      code
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
      test: (value) => allowedValues.includes(value),
      message,
      code
    };
  }

  /**
   * Sanitize a string to prevent injection attacks
   * @param input String to sanitize
   * @returns Sanitized string
   */
  static sanitizeString(input: string): string {
    if (!input) return '';
    // Remove HTML/script tags, prevent command injection, etc.
    return input
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[\\$'"]/g, '\\$&') // Escape shell metacharacters
      .trim();
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
  )
};