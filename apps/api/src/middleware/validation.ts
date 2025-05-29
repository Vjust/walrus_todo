import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validationResult, ValidationChain } from 'express-validator';
import { logger } from '../utils/logger';

// Zod schemas for validation
export const schemas = {
  createTodo: z.object({
    description: z.string().min(1).max(1000),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    category: z.string().max(100).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
    listName: z.string().max(100).optional(),
  }),

  updateTodo: z.object({
    description: z.string().min(1).max(1000).optional(),
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
                description: z.string().min(1).max(1000),
                priority: z.enum(['high', 'medium', 'low']).optional(),
                category: z.string().max(100).optional(),
                tags: z.array(z.string().max(50)).max(10).optional(),
              }),
              z.object({
                description: z.string().min(1).max(1000).optional(),
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

  createList: z.object({
    name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9-_]+$/, {
      message: 'List name can only contain letters, numbers, hyphens, and underscores',
    }),
    description: z.string().max(500).optional(),
  }),

  // AI-related schemas
  aiSuggestion: z.object({
    wallet: z.string().min(1),
    context: z.string().max(200).optional(),
    limit: z.number().min(1).max(20).optional(),
  }),

  aiSummarize: z.object({
    wallet: z.string().min(1),
    timeframe: z.enum(['day', 'week', 'month', 'all']).optional(),
    includeCompleted: z.boolean().optional(),
  }),

  aiCategorize: z.object({
    wallet: z.string().min(1),
    todoIds: z.array(z.string()).optional(),
  }),

  aiPrioritize: z.object({
    wallet: z.string().min(1),
    considerDeadlines: z.boolean().optional(),
    considerDependencies: z.boolean().optional(),
  }),

  aiAnalyze: z.object({
    wallet: z.string().min(1),
    timeframe: z.enum(['day', 'week', 'month', 'all']).optional(),
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

// AI validation schemas
export const aiSchemas = {
  suggest: z.object({
    wallet: z.string(),
    context: z.string().optional(),
    count: z.number().min(1).max(10).optional().default(5),
  }),

  summarize: z.object({
    wallet: z.string(),
    timeframe: z.enum(['day', 'week', 'month', 'all']).optional().default('all'),
    includeCompleted: z.boolean().optional().default(true),
  }),

  categorize: z.object({
    wallet: z.string(),
    todoIds: z.array(z.string()).optional(),
  }),

  prioritize: z.object({
    wallet: z.string(),
    todoIds: z.array(z.string()).optional(),
  }),

  analyze: z.object({
    wallet: z.string(),
    timeframe: z.enum(['day', 'week', 'month', 'all']).optional().default('week'),
  }),
};

// AI validation middleware
export const validateAISuggestionRequest = validate({ body: aiSchemas.suggest });
export const validateAISummarizeRequest = validate({ body: aiSchemas.summarize });
export const validateAICategorizeRequest = validate({ body: aiSchemas.categorize });
export const validateAIPrioritizeRequest = validate({ body: aiSchemas.prioritize });
export const validateAIAnalyzeRequest = validate({ body: aiSchemas.analyze });

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


// Express-validator middleware for auth routes
export const validateRequest = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Express-validator validation error', {
        errors: errors.array(),
        body: req.body,
      });

      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
};
