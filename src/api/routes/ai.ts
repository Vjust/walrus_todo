import { Router } from 'express';
import { AIController } from '../controllers/ai-controller';
import { validate } from '../middleware/validation';
import { asyncHandler } from '../middleware/error-handler';
import { z } from 'zod';

const router = Router();
const controller = new AIController();

// POST /ai/summarize - Summarize todos
router.post(
  '/summarize',
  validate({
    body: z.object({
      todoIds: z.array(z.string().uuid()).optional(),
      includeCompleted: z.boolean().default(false)
    })
  }),
  asyncHandler(controller.summarize)
);

// POST /ai/categorize - Categorize todos
router.post(
  '/categorize',
  validate({
    body: z.object({
      todoIds: z.array(z.string().uuid()).optional(),
      categories: z.array(z.string()).optional()
    })
  }),
  asyncHandler(controller.categorize)
);

// POST /ai/prioritize - Prioritize todos
router.post(
  '/prioritize',
  validate({
    body: z.object({
      todoIds: z.array(z.string().uuid()).optional(),
      criteria: z.string().optional()
    })
  }),
  asyncHandler(controller.prioritize)
);

// POST /ai/suggest - Get task suggestions
router.post(
  '/suggest',
  validate({
    body: z.object({
      context: z.string().optional(),
      count: z.number().int().positive().max(10).default(5)
    })
  }),
  asyncHandler(controller.suggest)
);

// POST /ai/enhance - Enhance todo description
router.post(
  '/enhance/:id',
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      style: z.enum(['detailed', 'concise', 'actionable']).optional()
    })
  }),
  asyncHandler(controller.enhance)
);

// GET /ai/providers - Get available AI providers
router.get(
  '/providers',
  asyncHandler(controller.getProviders)
);

// POST /ai/verify - Verify AI operation on blockchain
router.post(
  '/verify',
  validate({
    body: z.object({
      operation: z.string(),
      input: z.any(),
      output: z.any(),
      provider: z.string()
    })
  }),
  asyncHandler(controller.verify)
);

export default router;