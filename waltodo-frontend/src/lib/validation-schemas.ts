'use client';

import { z } from 'zod';

// Re-export rate limit configs for compatibility
export { RATE_LIMIT_CONFIGS } from './rate-limiter';

// Configuration for validation rules
export const VALIDATION_RULES = {
  TITLE: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100,
  },
  DESCRIPTION: {
    MAX_LENGTH: 1000,
  },
  TAGS: {
    MAX_COUNT: 10,
    MAX_TAG_LENGTH: 30,
  },
  IMAGE: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  },
  SEARCH: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100,
  },
  CONFIG: {
    URL_MAX_LENGTH: 500,
    API_KEY_MAX_LENGTH: 200,
  },
} as const;

// Base schema definitions
export const prioritySchema = z.enum(['low', 'medium', 'high']);
export const categorySchema = z.enum(['personal', 'work', 'shopping', 'health', 'finance', 'other']);

// Todo creation schema
export const createTodoSchema = z.object({
  title: z
    .string()
    .trim()
    .min(VALIDATION_RULES.TITLE.MIN_LENGTH, 'Title is required')
    .max(VALIDATION_RULES.TITLE.MAX_LENGTH, `Title must be ${VALIDATION_RULES.TITLE.MAX_LENGTH} characters or less`)
    .refine((title) => title.length > 0, 'Title cannot be empty'),
  
  description: z
    .string()
    .max(VALIDATION_RULES.DESCRIPTION.MAX_LENGTH, `Description must be ${VALIDATION_RULES.DESCRIPTION.MAX_LENGTH} characters or less`)
    .optional()
    .transform((desc) => desc?.trim() || undefined),
  
  priority: prioritySchema.default('medium'),
  
  category: categorySchema.default('personal'),
  
  tags: z
    .string()
    .optional()
    .transform((tagsString) => {
      if (!tagsString?.trim()) return [];
      return tagsString
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean)
        .slice(0, VALIDATION_RULES.TAGS.MAX_COUNT); // Limit number of tags
    })
    .refine((tags) => {
      return tags.every(tag => tag.length <= VALIDATION_RULES.TAGS.MAX_TAG_LENGTH);
    }, `Each tag must be ${VALIDATION_RULES.TAGS.MAX_TAG_LENGTH} characters or less`),
  
  dueDate: z
    .string()
    .optional()
    .refine((date) => {
      if (!date) return true;
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime()) && parsedDate >= new Date(new Date().toDateString());
    }, 'Due date must be today or in the future'),
  
  isPrivate: z.boolean().default(false),
  
  expirationDays: z
    .number()
    .min(1, 'Expiration must be at least 1 day')
    .max(3650, 'Expiration cannot exceed 10 years')
    .default(365),
});

// Todo NFT creation schema (extends basic todo)
export const createTodoNFTSchema = createTodoSchema.extend({
  imageFile: z
    .instanceof(File)
    .optional()
    .refine((file) => {
      if (!file) return true;
      return file.size <= VALIDATION_RULES.IMAGE.MAX_SIZE;
    }, `Image size must be less than ${VALIDATION_RULES.IMAGE.MAX_SIZE / (1024 * 1024)}MB`)
    .refine((file) => {
      if (!file) return true;
      return VALIDATION_RULES.IMAGE.ALLOWED_TYPES.includes(file.type);
    }, 'Image must be JPEG, PNG, GIF, or WebP'),
  
  listName: z
    .string()
    .min(1, 'List name is required')
    .max(50, 'List name must be 50 characters or less'),
});

// Search schema
export const searchSchema = z.object({
  query: z
    .string()
    .trim()
    .min(VALIDATION_RULES.SEARCH.MIN_LENGTH, 'Search query must be at least 1 character')
    .max(VALIDATION_RULES.SEARCH.MAX_LENGTH, `Search query must be ${VALIDATION_RULES.SEARCH.MAX_LENGTH} characters or less`)
    .refine((query) => {
      // Prevent potential XSS patterns in search
      const dangerousPatterns = /<script|javascript:|data:|vbscript:|on\w+=/i;
      return !dangerousPatterns.test(query);
    }, 'Invalid search query'),
  
  filters: z.object({
    priority: prioritySchema.optional(),
    category: categorySchema.optional(),
    completed: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
});

// Configuration schema
export const configSchema = z.object({
  apiUrl: z
    .string()
    .url('Invalid API URL')
    .max(VALIDATION_RULES.CONFIG.URL_MAX_LENGTH, 'API URL too long')
    .optional(),
  
  walrusConfig: z.object({
    publisherUrl: z
      .string()
      .url('Invalid Walrus publisher URL')
      .max(VALIDATION_RULES.CONFIG.URL_MAX_LENGTH, 'Publisher URL too long'),
    
    aggregatorUrl: z
      .string()
      .url('Invalid Walrus aggregator URL')
      .max(VALIDATION_RULES.CONFIG.URL_MAX_LENGTH, 'Aggregator URL too long'),
  }).optional(),
  
  suiConfig: z.object({
    network: z.enum(['mainnet', 'testnet', 'devnet']),
    rpcUrl: z
      .string()
      .url('Invalid RPC URL')
      .max(VALIDATION_RULES.CONFIG.URL_MAX_LENGTH, 'RPC URL too long'),
  }).optional(),
  
  enableAnalytics: z.boolean().default(false),
  enableNotifications: z.boolean().default(true),
});

// File upload schema
export const fileUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size <= VALIDATION_RULES.IMAGE.MAX_SIZE, 
      `File size must be less than ${VALIDATION_RULES.IMAGE.MAX_SIZE / (1024 * 1024)}MB`)
    .refine((file) => VALIDATION_RULES.IMAGE.ALLOWED_TYPES.includes(file.type),
      'File must be an image (JPEG, PNG, GIF, or WebP)'),
});

// User input sanitization schema
export const userInputSchema = z.object({
  content: z
    .string()
    .max(10000, 'Content too long')
    .refine((content) => {
      // Check for potential script injections
      const dangerousPatterns = /<script|javascript:|data:|vbscript:|on\w+=/i;
      return !dangerousPatterns.test(content);
    }, 'Content contains potentially dangerous code'),
});

// Validation error formatting
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

// Helper function to format Zod errors
export function formatValidationErrors(error: z.ZodError): ValidationError[] {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

// Safe validation wrapper
export function validateSafely<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  try {
    const result = schema.safeParse(data);
    
    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    } else {
      return {
        success: false,
        errors: formatValidationErrors(result.error),
      };
    }
  } catch (error) {
    return {
      success: false,
      errors: [{
        field: 'unknown',
        message: 'Validation failed unexpectedly',
        code: 'validation_error',
      }],
    };
  }
}

// Specific validation functions
export function validateTodo(data: unknown): ValidationResult<z.infer<typeof createTodoSchema>> {
  return validateSafely(createTodoSchema, data);
}

export function validateTodoNFT(data: unknown): ValidationResult<z.infer<typeof createTodoNFTSchema>> {
  return validateSafely(createTodoNFTSchema, data);
}

export function validateSearch(data: unknown): ValidationResult<z.infer<typeof searchSchema>> {
  return validateSafely(searchSchema, data);
}

export function validateConfig(data: unknown): ValidationResult<z.infer<typeof configSchema>> {
  return validateSafely(configSchema, data);
}

export function validateFileUpload(data: unknown): ValidationResult<z.infer<typeof fileUploadSchema>> {
  return validateSafely(fileUploadSchema, data);
}

export function validateUserInput(data: unknown): ValidationResult<z.infer<typeof userInputSchema>> {
  return validateSafely(userInputSchema, data);
}

// Type exports
export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type CreateTodoNFTInput = z.infer<typeof createTodoNFTSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
export type ConfigInput = z.infer<typeof configSchema>;
export type FileUploadInput = z.infer<typeof fileUploadSchema>;
export type UserInputData = z.infer<typeof userInputSchema>;