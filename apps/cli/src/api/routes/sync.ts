import { Router } from 'express';
import { SyncController } from '../controllers/sync-controller';
import { validate } from '../middleware/validation';
import { asyncHandler } from '../middleware/error-handler';
import { z } from 'zod';

const router = Router();
const controller = new SyncController();

// POST /sync/pull - Pull changes from blockchain
router.post(
  '/pull',
  validate({
    body: z.object({
      lastSync: z.string().datetime().optional(),
      force: z.boolean().default(false),
    }),
  }),
  asyncHandler(controller.pull)
);

// POST /sync/push - Push changes to blockchain
router.post(
  '/push',
  validate({
    body: z.object({
      todoIds: z.array(z.string().uuid()).optional(),
      includeAll: z.boolean().default(false),
    }),
  }),
  asyncHandler(controller.push)
);

// GET /sync/status - Get sync status
router.get('/status', asyncHandler(controller.status));

// POST /sync/resolve - Resolve sync conflicts
router.post(
  '/resolve',
  validate({
    body: z.object({
      conflictId: z.string(),
      resolution: z.enum(['local', 'remote', 'merge']),
      mergedData: z.any().optional(),
    }),
  }),
  asyncHandler(controller.resolveConflict)
);

// GET /sync/conflicts - Get unresolved conflicts
router.get('/conflicts', asyncHandler(controller.getConflicts));

// POST /sync/full - Full synchronization
router.post(
  '/full',
  validate({
    body: z.object({
      direction: z
        .enum(['pull', 'push', 'bidirectional'])
        .default('bidirectional'),
      resolveStrategy: z.enum(['local', 'remote', 'newest']).default('newest'),
    }),
  }),
  asyncHandler(controller.fullSync)
);

export default router;
