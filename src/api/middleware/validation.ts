import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../types/errors/consolidated/ValidationError';
import { z, ZodError, ZodSchema } from 'zod';

export interface ValidationOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(options: ValidationOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate body
      if (options.body) {
        req.body = await options.body.parseAsync(req.body);
      }

      // Validate query
      if (options.query) {
        req.query = await options.query.parseAsync(req.query);
      }

      // Validate params
      if (options.params) {
        req.params = await options.params.parseAsync(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = new ValidationError(
          'Request validation failed',
          error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
            code: e.code,
          }))
        );
        next(validationError);
      } else {
        next(error);
      }
    }
  };
}

// Common validation schemas
export const schemas = {
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),

  // Todo schemas
  createTodo: z.object({
    content: z.string().min(1).max(1000),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),

  updateTodo: z.object({
    content: z.string().min(1).max(1000).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    completed: z.boolean().optional(),
  }),

  // AI schemas
  aiOperation: z.object({
    operation: z.enum(['summarize', 'categorize', 'prioritize', 'suggest']),
    input: z.string().optional(),
    options: z.record(z.any()).optional(),
  }),

  // Sync schemas
  syncRequest: z.object({
    lastSync: z.string().datetime().optional(),
    includeDeleted: z.boolean().default(false),
  }),
};

// Helper function to create ID validation
export function validateId(paramName: string = 'id') {
  return validate({
    params: z.object({
      [paramName]: z.string().uuid(),
    }),
  });
}
