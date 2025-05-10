import { InputValidator, ValidationRule } from './InputValidator';
import { CommandSanitizer } from './CommandSanitizer';
import { CLIError } from '../types/error';

/**
 * Validation helper for interactive prompts
 * This class provides utilities for validating and sanitizing input from interactive prompts
 */
export class PromptValidator {
  /**
   * Create an inquirer validator function from validation rules
   * @param rules Array of validation rules
   * @param sanitize Whether to sanitize the input before validation
   * @returns Validator function for inquirer prompts
   */
  static createInquirerValidator<T = string>(
    rules: ValidationRule<T>[],
    sanitize: boolean = true
  ): (input: T) => boolean | string {
    return (input: T): boolean | string => {
      try {
        // Sanitize if needed and if it's a string
        let sanitizedInput = input;
        if (sanitize && typeof input === 'string') {
          sanitizedInput = CommandSanitizer.sanitizeString(input) as unknown as T;
        }
        
        // Validate the input
        InputValidator.validate(sanitizedInput, rules);
        return true;
      } catch (error) {
        // Return error message for inquirer
        if (error instanceof CLIError) {
          return error.message;
        }
        return error instanceof Error ? error.message : String(error);
      }
    };
  }

  /**
   * Create a validator function for date inputs
   * @returns Validator function for date inputs
   */
  static dateValidator(): (input: string) => boolean | string {
    return this.createInquirerValidator([{
      test: (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
      message: 'Invalid date format. Use YYYY-MM-DD',
      code: 'INVALID_DATE_FORMAT'
    }]);
  }

  /**
   * Create a validator function for wallet address inputs
   * @returns Validator function for wallet address inputs
   */
  static walletAddressValidator(): (input: string) => boolean | string {
    return this.createInquirerValidator([{
      test: (value) => /^0x[a-fA-F0-9]{40,}$/.test(value),
      message: 'Invalid wallet address format. Must be a valid hex address starting with 0x',
      code: 'INVALID_WALLET_ADDRESS'
    }]);
  }

  /**
   * Create a validator function for priority inputs
   * @returns Validator function for priority inputs
   */
  static priorityValidator(): (input: string) => boolean | string {
    return this.createInquirerValidator([{
      test: (value) => ['high', 'medium', 'low'].includes(value.toLowerCase()),
      message: 'Priority must be high, medium, or low',
      code: 'INVALID_PRIORITY'
    }]);
  }

  /**
   * Create a validator function for list name inputs
   * @returns Validator function for list name inputs
   */
  static listNameValidator(): (input: string) => boolean | string {
    return this.createInquirerValidator([
      {
        test: (value) => value.trim().length > 0,
        message: 'List name cannot be empty',
        code: 'EMPTY_LIST_NAME'
      },
      {
        test: (value) => /^[a-zA-Z0-9_-]+$/.test(value),
        message: 'List name can only contain letters, numbers, underscores, and hyphens',
        code: 'INVALID_LIST_NAME'
      }
    ]);
  }

  /**
   * Create a validator function for URL inputs
   * @returns Validator function for URL inputs
   */
  static urlValidator(): (input: string) => boolean | string {
    return this.createInquirerValidator([{
      test: (value) => {
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      },
      message: 'Invalid URL format',
      code: 'INVALID_URL'
    }]);
  }

  /**
   * Create a validator function for API key inputs
   * @returns Validator function for API key inputs
   */
  static apiKeyValidator(): (input: string) => boolean | string {
    return this.createInquirerValidator([{
      test: (value) => value.length >= 16,
      message: 'API key must be at least 16 characters',
      code: 'INVALID_API_KEY'
    }]);
  }

  /**
   * Create a validator function for numeric inputs
   * @param min Minimum allowed value
   * @param max Maximum allowed value
   * @returns Validator function for numeric inputs
   */
  static numericValidator(
    min?: number,
    max?: number
  ): (input: string) => boolean | string {
    return this.createInquirerValidator([
      {
        test: (value) => !isNaN(Number(value)),
        message: 'Input must be a number',
        code: 'INVALID_NUMBER'
      },
      ...(min !== undefined ? [{
        test: (value) => Number(value) >= min,
        message: `Value must be at least ${min}`,
        code: 'BELOW_MINIMUM'
      }] : []),
      ...(max !== undefined ? [{
        test: (value) => Number(value) <= max,
        message: `Value must be at most ${max}`,
        code: 'ABOVE_MAXIMUM'
      }] : [])
    ]);
  }

  /**
   * Create a validator function for required inputs
   * @param errorMessage Custom error message
   * @returns Validator function for required inputs
   */
  static requiredValidator(
    errorMessage: string = 'This field is required'
  ): (input: string) => boolean | string {
    return this.createInquirerValidator([{
      test: (value) => value.trim().length > 0,
      message: errorMessage,
      code: 'REQUIRED_FIELD'
    }]);
  }

  /**
   * Create a validator function with a custom validation function
   * @param validateFn Custom validation function
   * @param errorMessage Error message
   * @param errorCode Error code
   * @returns Validator function for custom validation
   */
  static customValidator(
    validateFn: (input: string) => boolean,
    errorMessage: string,
    errorCode: string
  ): (input: string) => boolean | string {
    return this.createInquirerValidator([{
      test: validateFn,
      message: errorMessage,
      code: errorCode
    }]);
  }
}