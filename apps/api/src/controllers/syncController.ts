import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { TodoService } from '../services/todoService';
import { WebSocketService } from '../services/websocketService';
import {
  ApiResponse,
  SyncStatus,
  BatchSyncRequest,
  WalrusData,
  AuthenticatedRequest,
} from '../types';

// In-memory storage for sync status (in production, use Redis or database)
const syncStatusMap = new Map<string, SyncStatus>();

export class SyncController {
  constructor(
    private todoService: TodoService,
    private websocketService?: WebSocketService
  ) {}

  /**
   * Sync a todo to Walrus storage
   */
  async syncTodoToWalrus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const wallet = req.wallet || req.get('X-Wallet-Address') || 'anonymous';

      logger.info('Syncing todo to Walrus', { todoId: id, wallet });

      // Get the todo
      const todo = await this.todoService.getTodoById(id, wallet);
      if (!todo) {
        res.status(404).json({
          success: false,
          error: 'Todo not found',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      // Create sync status
      const syncStatus: SyncStatus = {
        todoId: id,
        status: 'syncing',
        walrus: {
          synced: false,
        },
        lastAttempt: new Date().toISOString(),
        retryCount: 0,
      };

      syncStatusMap.set(id, syncStatus);

      // Simulate Walrus sync (in production, actually upload to Walrus)
      setTimeout(() => {
        const updatedStatus = syncStatusMap.get(id);
        if (updatedStatus) {
          updatedStatus.status = 'completed';
          updatedStatus.walrus = {
            synced: true,
            blobId: `blob_${id}_${Date.now()}`,
            url: `https://walrus.example.com/blob/${id}`,
            syncedAt: new Date().toISOString(),
          };
          syncStatusMap.set(id, updatedStatus);

          // Emit WebSocket event
          if (this.websocketService) {
            this.websocketService.broadcast({
              type: 'SYNC_COMPLETED',
              data: {
                todoId: id,
                target: 'walrus',
                status: updatedStatus,
              },
              wallet,
            });
          }
        }
      }, 1000);

      res.json({
        success: true,
        data: {
          message: 'Sync to Walrus initiated',
          syncId: id,
          status: syncStatus,
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Sync a todo to blockchain
   */
  async syncTodoToBlockchain(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const wallet = req.wallet || req.get('X-Wallet-Address') || 'anonymous';

      logger.info('Syncing todo to blockchain', { todoId: id, wallet });

      // Get the todo
      const todo = await this.todoService.getTodoById(id, wallet);
      if (!todo) {
        res.status(404).json({
          success: false,
          error: 'Todo not found',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      // Create or update sync status
      const existingStatus = syncStatusMap.get(id);
      const syncStatus: SyncStatus = existingStatus || {
        todoId: id,
        status: 'syncing',
        blockchain: {
          synced: false,
        },
        lastAttempt: new Date().toISOString(),
        retryCount: 0,
      };

      syncStatus.status = 'syncing';
      syncStatus.blockchain = { synced: false };
      syncStatusMap.set(id, syncStatus);

      // Simulate blockchain sync (in production, actually create transaction)
      setTimeout(() => {
        const updatedStatus = syncStatusMap.get(id);
        if (updatedStatus) {
          updatedStatus.status = 'completed';
          updatedStatus.blockchain = {
            synced: true,
            objectId: `0x${id.substring(0, 8)}${Date.now().toString(16)}`,
            transactionHash: `0x${Date.now().toString(16)}`,
            syncedAt: new Date().toISOString(),
          };
          syncStatusMap.set(id, updatedStatus);

          // Emit WebSocket event
          if (this.websocketService) {
            this.websocketService.broadcast({
              type: 'SYNC_COMPLETED',
              data: {
                todoId: id,
                target: 'blockchain',
                status: updatedStatus,
              },
              wallet,
            });
          }
        }
      }, 2000);

      res.json({
        success: true,
        data: {
          message: 'Sync to blockchain initiated',
          syncId: id,
          status: syncStatus,
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Sync a list to Walrus storage
   */
  async syncListToWalrus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { listName } = req.params;
      const wallet = req.wallet || req.get('X-Wallet-Address') || 'anonymous';

      logger.info('Syncing list to Walrus', { listName, wallet });

      // Get todos for the list
      const result = await this.todoService.getTodos(wallet, {
        category: listName,
      });

      if (!result.todos.length) {
        res.status(404).json({
          success: false,
          error: 'No todos found in list',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      // Create Walrus data structure
      const walrusData: WalrusData = {
        type: 'list',
        data: result.todos,
        metadata: {
          wallet,
          listName,
          createdAt: new Date().toISOString(),
          version: '1.0.0',
        },
      };

      // Simulate Walrus upload
      const blobId = `list_${listName}_${Date.now()}`;
      
      res.json({
        success: true,
        data: {
          message: 'List synced to Walrus',
          blobId,
          url: `https://walrus.example.com/blob/${blobId}`,
          itemCount: result.todos.length,
          walrusData,
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieve data from Walrus
   */
  async retrieveFromWalrus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { blobId } = req.params;

      logger.info('Retrieving from Walrus', { blobId });

      // Simulate Walrus retrieval (in production, actually fetch from Walrus)
      const mockData: WalrusData = {
        type: 'todo',
        data: {
          id: '123',
          title: 'Mock Todo',
          description: 'Retrieved from Walrus',
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          wallet: '0x123...',
        },
        metadata: {
          wallet: '0x123...',
          createdAt: new Date().toISOString(),
          version: '1.0.0',
        },
      };

      res.json({
        success: true,
        data: mockData,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get sync status for a todo
   */
  async getSyncStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { todoId } = req.params;

      const status = syncStatusMap.get(todoId);
      
      if (!status) {
        res.status(404).json({
          success: false,
          error: 'Sync status not found',
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Batch sync operations
   */
  async batchSync(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { operations, waitForCompletion = false } = req.body as BatchSyncRequest;
      const wallet = req.wallet || req.get('X-Wallet-Address') || 'anonymous';

      logger.info('Processing batch sync', { 
        operationCount: operations.length, 
        wallet,
        waitForCompletion 
      });

      const results = [];

      for (const operation of operations) {
        const { todoId, targets, priority = 'normal' } = operation;

        // Verify todo exists
        const todo = await this.todoService.getTodoById(todoId, wallet);
        if (!todo) {
          results.push({
            todoId,
            success: false,
            error: 'Todo not found',
          });
          continue;
        }

        // Create sync status
        const syncStatus: SyncStatus = {
          todoId,
          status: 'pending',
          lastAttempt: new Date().toISOString(),
          retryCount: 0,
        };

        if (targets.includes('walrus')) {
          syncStatus.walrus = { synced: false };
        }
        if (targets.includes('blockchain')) {
          syncStatus.blockchain = { synced: false };
        }

        syncStatusMap.set(todoId, syncStatus);

        // Simulate async processing
        setTimeout(() => {
          const status = syncStatusMap.get(todoId);
          if (status) {
            status.status = 'completed';
            if (status.walrus) {
              status.walrus = {
                synced: true,
                blobId: `blob_${todoId}_${Date.now()}`,
                url: `https://walrus.example.com/blob/${todoId}`,
                syncedAt: new Date().toISOString(),
              };
            }
            if (status.blockchain) {
              status.blockchain = {
                synced: true,
                objectId: `0x${todoId.substring(0, 8)}${Date.now().toString(16)}`,
                transactionHash: `0x${Date.now().toString(16)}`,
                syncedAt: new Date().toISOString(),
              };
            }
            syncStatusMap.set(todoId, status);
          }
        }, priority === 'high' ? 500 : 2000);

        results.push({
          todoId,
          success: true,
          status: syncStatus,
        });
      }

      res.json({
        success: true,
        data: {
          message: `Batch sync initiated for ${operations.length} operations`,
          results,
          waitForCompletion,
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}