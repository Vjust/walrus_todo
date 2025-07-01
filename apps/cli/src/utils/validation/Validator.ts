import { BaseError } from '../../types/errors/BaseError';

/**
 * Validation error thrown when validation fails
 */
export class ValidationError extends BaseError {
  constructor(
    message: string,
    options: {
      field?: string;
      value?: string;
      code?: string;
      context?: Record<string, unknown>;
      recoverable?: boolean;
    } = {}
  ) {
    const {
      field,
      value,
      code = 'VALIDATION_ERROR',
      context,
      recoverable = false,
    } = options;

    // Build context with field information
    const validationContext = {
      ...context,
      field,
      value: typeof value === 'string' ? value : undefined,
    };

    // Customize code if field is specified
    const errorCode = field
      ? `${code}_${field.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}`
      : code;

    super({
      message,
      code: errorCode,
      context: validationContext,
      recoverable,
    });
  }
}

/**
 * Function type for validation rules
 */
export type ValidationRule<T> = {
  /** Validation function that returns true if valid, false if invalid */
  validate: (value: T, context?: ValidationContext) => boolean;

  /** Error message or function that returns an error message */
  message: string | ((value: T, context?: ValidationContext) => string);
};

/**
 * Context for validation rules
 */
export interface ValidationContext {
  /** Name of the field being validated */
  fieldName?: string;

  /** Parent object containing the field */
  parentValue?: unknown;

  /** Root object being validated */
  rootValue?: unknown;

  /** Path to the current field from the root */
  path?: string[];

  /** Additional context for validation */
  [key: string]: unknown;
}

/**
 * Main validator class
 */
export class Validator<T> {
  /** Validation rules to apply */
  private rules: ValidationRule<T>[] = [];

  /** Field name for error reporting */
  private fieldName?: string;

  /**
   * Create a new validator
   * @param fieldName Optional field name for error reporting
   */
  constructor(fieldName?: string) {
    this?.fieldName = fieldName;
  }

  /**
   * Add a validation rule
   * @param rule Validation rule to add
   * @returns this for method chaining
   */
  addRule(rule: ValidationRule<T>): this {
    this?.rules?.push(rule);
    return this;
  }

  /**
   * Set field name for error reporting
   * @param name Field name
   * @returns this for method chaining
   */
  setFieldName(name: string): this {
    this?.fieldName = name;
    return this;
  }

  /**
   * Validate a value against all rules
   * @param value Value to validate
   * @param context Validation context
   * @returns true if valid
   * @throws ValidationError if invalid
   */
  validate(value: T, context: ValidationContext = {}): boolean {
    // Update context with field name
    const validationContext = {
      ...context,
      fieldName: this.fieldName || context.fieldName,
    };

    // Check all rules
    for (const rule of this.rules) {
      if (!rule.validate(value, validationContext)) {
        const message =
          typeof rule?.message === 'function'
            ? rule.message(value, validationContext)
            : rule.message;

        throw new ValidationError(message, {
          field: validationContext.fieldName,
          value: this.safeStringify(value),
          recoverable: false,
        });
      }
    }

    return true;
  }

  /**
   * Validate a value without throwing
   * @param value Value to validate
   * @param context Validation context
   * @returns { valid: true } if valid, { valid: false, error: ValidationError } if invalid
   */
  validateSafe(
    value: T,
    context: ValidationContext = {}
  ): {
    valid: boolean;
    error?: ValidationError;
  } {
    try {
      this.validate(value, context);
      return { valid: true };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { valid: false, error };
      }
      // Re-throw unexpected errors
      throw error;
    }
  }

  /**
   * Safely convert value to string for error messages
   * @param value Value to stringify
   * @returns Safe string representation
   */
  private safeStringify(value: unknown): string {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';

    try {
      if (typeof value === 'object') {
        // Handle circular references and truncate large objects
        const seen = new WeakSet();
        const stringified = JSON.stringify(
          value,
          (key, val) => {
            if (typeof val === 'object' && val !== null) {
              if (seen.has(val)) return '[Circular]';
              seen.add(val);
            }
            return val;
          },
          2
        );

        // Truncate large objects
        return stringified.length > 100
          ? stringified.slice(0, 100) + '...'
          : stringified;
      }
      return String(value);
    } catch (_error) {
      return '[Complex Value]';
    }
  }
}
