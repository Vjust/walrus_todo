import { Router } from 'express';
import { SyncController } from '../controllers/syncController';
import { TodoService } from '../services/todoService';
import { WebSocketService } from '../services/websocketService';
import { validate, validateId, schemas } from '../middleware/validation';
import { extractWallet } from '../middleware/auth';
import { z } from 'zod';

// Define sync-specific validation schemas
const syncSchemas = {
  batchSync: z.object({
    operations: z.array(
      z.object({
        todoId: z.string().min(1),
        targets: z.array(z.enum(['walrus', 'blockchain'])).min(1),
        priority: z.enum(['high', 'normal', 'low']).optional(),
      })
    ).min(1),
    waitForCompletion: z.boolean().optional(),
  }),
};

export function createSyncRoutes(
  todoService: TodoService,
  websocketService?: WebSocketService
): Router {
  const router = Router();
  const syncController = new SyncController(todoService, websocketService);

  // Apply wallet extraction middleware to all routes
  router.use(extractWallet);

  /**
   * @route   POST /sync/todos/:id/walrus
   * @desc    Sync a todo to Walrus storage
   * @access  Protected (requires wallet address)
   */
  router.post(
    '/todos/:id/walrus',
    validateId(),
    (req, res, next) => syncController.syncTodoToWalrus(req, res, next)
  );

  /**
   * @route   POST /sync/todos/:id/blockchain
   * @desc    Sync a todo to blockchain
   * @access  Protected (requires wallet address)
   */
  router.post(
    '/todos/:id/blockchain',
    validateId(),
    (req, res, next) => syncController.syncTodoToBlockchain(req, res, next)
  );

  /**
   * @route   POST /sync/lists/:listName/walrus
   * @desc    Sync a list to Walrus storage
   * @access  Protected (requires wallet address)
   */
  router.post(
    '/lists/:listName/walrus',
    (req, res, next) => syncController.syncListToWalrus(req, res, next)
  );

  /**
   * @route   GET /sync/walrus/:blobId
   * @desc    Retrieve data from Walrus
   * @access  Public
   */
  router.get(
    '/walrus/:blobId',
    (req, res, next) => syncController.retrieveFromWalrus(req, res, next)
  );

  /**
   * @route   GET /sync/status/:todoId
   * @desc    Get sync status for a todo
   * @access  Public
   */
  router.get(
    '/status/:todoId',
    (req, res, next) => syncController.getSyncStatus(req, res, next)
  );

  /**
   * @route   POST /sync/batch
   * @desc    Batch sync operations
   * @access  Protected (requires wallet address)
   */
  router.post(
    '/batch',
    validate({ body: syncSchemas.batchSync }),
    (req, res, next) => syncController.batchSync(req, res, next)
  );

  return router;
}