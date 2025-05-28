import { ValidationRule, ValidationContext, Validator } from './Validator';

/**
 * Required value validation
 * Ensures a value is not undefined, null, or empty string
 */
export function required<T>(): ValidationRule<T> {
  return {
    validate: (value: T) => {
      if (value === undefined || value === null) return false;
      if (typeof value === 'string' && value.trim() === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    },
    message: (_, context) => `${context?.fieldName || 'Value'} is required`,
  };
}

/**
 * String minimum length validation
 * @param min Minimum length
 */
export function minLength(min: number): ValidationRule<string> {
  return {
    validate: (value: string) => {
      if (value === undefined || value === null) return true; // Skip if not provided (use with required)
      return value.length >= min;
    },
    message: (_, context) =>
      `${context?.fieldName || 'String'} must be at least ${min} characters`,
  };
}

/**
 * String maximum length validation
 * @param max Maximum length
 */
export function maxLength(max: number): ValidationRule<string> {
  return {
    validate: (value: string) => {
      if (value === undefined || value === null) return true;
      return value.length <= max;
    },
    message: (_, context) =>
      `${context?.fieldName || 'String'} must be at most ${max} characters`,
  };
}

/**
 * Number range validation
 * @param min Minimum value
 * @param max Maximum value
 */
export function numberRange(min: number, max: number): ValidationRule<number> {
  return {
    validate: (value: number) => {
      if (value === undefined || value === null) return true;
      return value >= min && value <= max;
    },
    message: (_, context) =>
      `${context?.fieldName || 'Number'} must be between ${min} and ${max}`,
  };
}

/**
 * Pattern validation
 * @param regex Regular expression to match
 * @param description Description of the pattern for error message
 */
export function pattern(
  regex: RegExp,
  description?: string
): ValidationRule<string> {
  return {
    validate: (value: string) => {
      if (value === undefined || value === null) return true;
      return regex.test(value);
    },
    message: (_, context) => {
      const fieldName = context?.fieldName || 'Value';
      if (description) {
        return `${fieldName} must be ${description}`;
      }
      return `${fieldName} does not match required pattern`;
    },
  };
}

/**
 * Email validation
 */
export function email(): ValidationRule<string> {
  // RFC 5322 compliant regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return pattern(emailRegex, 'a valid email address');
}

/**
 * URL validation
 */
export function url(): ValidationRule<string> {
  const urlRegex =
    /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;
  return pattern(urlRegex, 'a valid URL');
}

/**
 * Sui address validation
 */
export function suiAddress(): ValidationRule<string> {
  const suiAddressRegex = /^0x[a-fA-F0-9]{40,64}$/;
  return pattern(
    suiAddressRegex,
    'a valid Sui address (0x followed by 40-64 hex characters)'
  );
}

/**
 * Custom validation
 * @param validateFn Validation function
 * @param message Error message or function
 */
export function custom<T>(
  validateFn: (value: T, context?: ValidationContext) => boolean,
  message: string | ((value: T, context?: ValidationContext) => string)
): ValidationRule<T> {
  return {
    validate: validateFn,
    message,
  };
}

/**
 * Array minimum length validation
 * @param min Minimum length
 */
export function minItems<T>(min: number): ValidationRule<T[]> {
  return {
    validate: (value: T[]) => {
      if (value === undefined || value === null) return true;
      return Array.isArray(value) && value.length >= min;
    },
    message: (_, context) =>
      `${context?.fieldName || 'Array'} must contain at least ${min} items`,
  };
}

/**
 * Array maximum length validation
 * @param max Maximum length
 */
export function maxItems<T>(max: number): ValidationRule<T[]> {
  return {
    validate: (value: T[]) => {
      if (value === undefined || value === null) return true;
      return Array.isArray(value) && value.length <= max;
    },
    message: (_, context) =>
      `${context?.fieldName || 'Array'} must contain at most ${max} items`,
  };
}

/**
 * Enum validation
 * @param allowedValues Array of allowed values
 */
export function oneOf<T>(allowedValues: T[]): ValidationRule<T> {
  return {
    validate: (value: T) => {
      if (value === undefined || value === null) return true;
      return allowedValues.includes(value);
    },
    message: (_, context) => {
      const fieldName = context?.fieldName || 'Value';
      const valuesString = allowedValues
        .map(v => (typeof v === 'string' ? `'${v}'` : String(v)))
        .join(', ');
      return `${fieldName} must be one of: ${valuesString}`;
    },
  };
}

/**
 * Object validation
 * @param shape Object shape to validate
 */
export function object<T extends Record<string, unknown>>(
  shape: Record<keyof T, Validator<T[keyof T]>>
): ValidationRule<T> {
  return {
    validate: (value: T, context?: ValidationContext) => {
      if (value === undefined || value === null) return true;
      if (typeof value !== 'object' || Array.isArray(value)) return false;

      try {
        for (const [key, validator] of Object.entries(shape)) {
          if (key in value) {
            const newContext = {
              ...context,
              fieldName: key,
              parentValue: value,
              path: [...(context?.path || []), key],
            };
            validator.validate(value[key], newContext);
          }
        }
        return true;
      } catch (_error) {
        return false;
      }
    },
    message: (_, context) =>
      `${context?.fieldName || 'Object'} has invalid structure`,
  };
}

/**
 * Safe string validation
 * Ensures string doesn't contain dangerous characters
 */
export function safeString(): ValidationRule<string> {
  const unsafePattern = /[<>;&`'$()]/;
  return {
    validate: (value: string) => {
      if (value === undefined || value === null) return true;
      return !unsafePattern.test(value);
    },
    message: (_, context) =>
      `${context?.fieldName || 'String'} contains unsafe characters`,
  };
}
