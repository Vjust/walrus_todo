import type { Request, Response } from 'express';
import {
  PullRequestBody,
  PullResponse,
  PushRequestBody,
  PushResponse,
  StatusResponse,
  ResolveConflictRequestBody,
  ResolveConflictResponse,
  ConflictsResponse,
  FullSyncRequestBody,
  FullSyncResponse,
} from '../../types/express';
import { TodoService } from '../../services/todoService';
import { Logger } from '../../utils/Logger';
import { BaseError } from '../../types/errors/consolidated/BaseError';
import type { Todo } from '../../types/todo';

const logger = new Logger('SyncController');

interface SyncStatus {
  lastSync: Date | null;
  pendingChanges: number;
  conflicts: number;
  status: 'synced' | 'pending' | 'conflict';
}

interface SyncConflict {
  id: string;
  todoId: string;
  localVersion: Todo;
  remoteVersion: Todo;
  detectedAt: Date;
}

export class SyncController {
  private todoService: TodoService;
  private syncStatus: SyncStatus;
  private conflicts: SyncConflict[];

  constructor() {
    this.todoService = new TodoService();
    this.syncStatus = {
      lastSync: null,
      pendingChanges: 0,
      conflicts: 0,
      status: 'synced',
    };
    this.conflicts = [];
  }

  pull = async (
    req: Request<Record<string, never>, PullResponse, PullRequestBody>,
    res: Response<PullResponse>
  ): Promise<void> => {
    const { force } = req.body;

    logger.info('Pulling changes from blockchain', { force });

    // Simulate pulling changes
    const pulledTodos = [];
    const newConflicts = [];

    // Update sync status
    this.syncStatus.lastSync = new Date();
    this.syncStatus.status = newConflicts.length > 0 ? 'conflict' : 'synced';
    this.syncStatus.conflicts = newConflicts.length;

    res.json({
      data: {
        pulled: pulledTodos.length,
        conflicts: newConflicts.length,
        lastSync: this.syncStatus.lastSync,
      },
      message: `Pulled ${pulledTodos.length} changes`,
    });
  };

  push = async (
    req: Request<Record<string, never>, PushResponse, PushRequestBody>,
    res: Response<PushResponse>
  ): Promise<void> => {
    const { todoIds, includeAll } = req.body;

    logger.info('Pushing changes to blockchain', { todoIds, includeAll });

    let todos = await this.todoService.listTodos();

    if (!includeAll && todoIds && todoIds.length > 0) {
      todos = todos.filter(t => todoIds.includes(t.id));
    }

    // Simulate pushing changes
    const pushed = todos.length;

    // Update sync status
    this.syncStatus.lastSync = new Date();
    this.syncStatus.pendingChanges = 0;
    this.syncStatus.status = 'synced';

    res.json({
      data: {
        pushed,
        lastSync: this.syncStatus.lastSync,
      },
      message: `Pushed ${pushed} changes`,
    });
  };

  status = async (
    req: Request<Record<string, never>, StatusResponse>,
    res: Response<StatusResponse>
  ): Promise<void> => {
    const todos = await this.todoService.listTodos();

    // Calculate pending changes (todos not synced)
    const pendingChanges = todos.filter(
      t => !t.syncedAt || t.updatedAt > t.syncedAt
    ).length;

    this.syncStatus.pendingChanges = pendingChanges;

    res.json({
      data: this.syncStatus,
    });
  };

  resolveConflict = async (
    req: Request<
      Record<string, never>,
      ResolveConflictResponse,
      ResolveConflictRequestBody
    >,
    res: Response<ResolveConflictResponse>
  ): Promise<void> => {
    const { conflictId, resolution, mergedData } = req.body;

    const conflictIndex = this.conflicts.findIndex(c => c.id === conflictId);

    if (conflictIndex === -1) {
      throw new BaseError({
        message: `Conflict with id ${conflictId} not found`,
        code: 'NOT_FOUND',
      });
    }

    const conflict = this.conflicts[conflictIndex];
    if (!conflict) {
      throw new BaseError({
        message: `Conflict with id ${conflictId} not found`,
        code: 'NOT_FOUND',
      });
    }

    logger.info('Resolving conflict', { conflictId, resolution });

    // Apply resolution
    let resolvedData;
    switch (resolution) {
      case 'local':
        resolvedData = conflict.localVersion;
        break;
      case 'remote':
        resolvedData = conflict.remoteVersion;
        break;
      case 'merge':
        if (!mergedData) {
          throw new BaseError({
            message: 'Merged data required for merge resolution',
            code: 'VALIDATION_ERROR',
          });
        }
        resolvedData = mergedData;
        break;
    }

    // Remove conflict
    this.conflicts.splice(conflictIndex, 1);
    this.syncStatus.conflicts = this.conflicts.length;

    res.json({
      data: {
        resolved: true,
        todoId: conflict?.todoId,
        resolution,
        resolvedData,
      },
      message: 'Conflict resolved successfully',
    });
  };

  getConflicts = async (
    req: Request<Record<string, never>, ConflictsResponse>,
    res: Response<ConflictsResponse>
  ): Promise<void> => {
    res.json({
      data: this.conflicts,
      count: this.conflicts.length,
    });
  };

  fullSync = async (
    req: Request<Record<string, never>, FullSyncResponse, FullSyncRequestBody>,
    res: Response<FullSyncResponse>
  ): Promise<void> => {
    const { direction } = req.body;

    logger.info('Performing full sync', { direction });

    const todos = await this.todoService.listTodos();

    // Simulate full sync
    let pulled = 0;
    let pushed = 0;
    let resolved = 0;

    switch (direction) {
      case 'pull':
        pulled = 5; // Simulated
        break;
      case 'push':
        pushed = todos.length;
        break;
      case 'bidirectional':
        pulled = 3;
        pushed = todos.length;
        resolved = 2;
        break;
    }

    // Update sync status
    this.syncStatus.lastSync = new Date();
    this.syncStatus.pendingChanges = 0;
    this.syncStatus.conflicts = 0;
    this.syncStatus.status = 'synced';

    res.json({
      data: {
        pulled,
        pushed,
        resolved,
        lastSync: this.syncStatus.lastSync,
      },
      message: 'Full synchronization completed',
    });
  };
}
