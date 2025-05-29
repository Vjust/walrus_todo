import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';

// Zod schemas for validation
export const schemas = {
  createTodo: z.object({
    content: z.string().min(1).max(1000),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    category: z.string().max(100).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
  }),

  updateTodo: z.object({
    content: z.string().min(1).max(1000).optional(),
    completed: z.boolean().optional(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    category: z.string().max(100).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
  }),

  pagination: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    wallet: z.string().optional(),
  }),

  batchOperations: z.object({
    operations: z
      .array(
        z.object({
          action: z.enum(['create', 'update', 'delete', 'complete']),
          id: z.string().optional(),
          data: z
            .union([
              z.object({
                content: z.string().min(1).max(1000),
                priority: z.enum(['high', 'medium', 'low']).optional(),
                category: z.string().max(100).optional(),
                tags: z.array(z.string().max(50)).max(10).optional(),
              }),
              z.object({
                content: z.string().min(1).max(1000).optional(),
                completed: z.boolean().optional(),
                priority: z.enum(['high', 'medium', 'low']).optional(),
                category: z.string().max(100).optional(),
                tags: z.array(z.string().max(50)).max(10).optional(),
              }),
            ])
            .optional(),
        })
      )
      .min(1)
      .max(50),
  }),
};

// Generic validation middleware factory
export const validate = (schema: {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }

      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }

      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map((err: z.ZodIssue) => ({
          field: err.path.join('.'),
          message: err.message,
          received: (err as any).input || 'unknown',
        }));

        logger.warn('Validation error', {
          errors: errorMessages,
          body: req.body,
        });

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errorMessages,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.error('Unexpected validation error', error);
      res.status(500).json({
        success: false,
        error: 'Internal validation error',
        timestamp: new Date().toISOString(),
      });
    }
  };
};

// ID parameter validation
export const validateId = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { id } = req.params;

    if (!id || typeof id !== 'string' || id.length < 1) {
      res.status(400).json({
        success: false,
        error: 'Valid ID parameter required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Basic UUID format check (optional)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid ID format',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
};
