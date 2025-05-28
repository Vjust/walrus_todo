import { Todo, StorageLocation } from '../types/todo';
import { WalrusStorage } from './walrus-storage';
import crypto from 'crypto';

/**
 * Storage Validator - Validates storage operations and ensures data integrity
 * for todos stored across different storage locations.
 */
export class StorageValidator {
  private walrusStorage: WalrusStorage;

  constructor(walrusStorage: WalrusStorage) {
    this.walrusStorage = walrusStorage;
  }

  /**
   * Validates a todo's data integrity
   */
  async validateTodoIntegrity(
    todo: Todo
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check basic required fields
    if (!todo.id) errors.push('Todo ID is missing');
    if (!todo.title) errors.push('Todo title is missing');
    if (!todo.createdAt) errors.push('Todo creation date is missing');
    if (!todo.storageLocation) errors.push('Storage location is missing');

    // Validate storage-specific requirements
    if (
      (todo.storageLocation === 'blockchain' ||
        todo.storageLocation === 'both') &&
      !todo.walrusBlobId
    ) {
      errors.push('Blockchain storage requires a Walrus blob ID');
    }

    // Validate checksum if present
    const todoWithChecksum = todo as Todo & { checksum?: string };
    if (todoWithChecksum.checksum) {
      const calculatedChecksum = this.calculateChecksum(todo);
      if (todoWithChecksum.checksum !== calculatedChecksum) {
        errors.push('Todo checksum mismatch - data may be corrupted');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculates a checksum for a todo
   */
  calculateChecksum(todo: Todo): string {
    const todoData = {
      id: todo.id,
      title: todo.title,
      description: todo.description,
      completed: todo.completed,
      priority: todo.priority,
      tags: todo.tags,
      dueDate: todo.dueDate,
      createdAt: todo.createdAt,
    };

    const dataString = JSON.stringify(todoData, Object.keys(todoData).sort());
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Validates a storage transition
   */
  async validateStorageTransition(
    todo: Todo,
    newStorage: StorageLocation
  ): Promise<{ valid: boolean; warnings: string[]; errors: string[] }> {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check for same storage location
    if (todo.storageLocation === newStorage) {
      warnings.push(`Todo is already stored in ${newStorage}`);
      return { valid: true, warnings, errors };
    }

    // Validate specific transitions
    switch (`${todo.storageLocation}->${newStorage}`) {
      case 'local->blockchain':
      case 'local->both':
        // Check blockchain connectivity
        try {
          // Check if storage has connect method and call it
          if (
            'connect' in this.walrusStorage &&
            typeof this.walrusStorage.connect === 'function'
          ) {
            await this.walrusStorage.connect();
          }
        } catch (error) {
          errors.push(
            `Cannot connect to blockchain: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        break;

      case 'blockchain->local':
        warnings.push(
          'Moving from blockchain to local will not remove blockchain data'
        );
        if (!todo.walrusBlobId) {
          errors.push('Cannot retrieve from blockchain: missing blob ID');
        }
        break;

      case 'blockchain->both':
        if (!todo.walrusBlobId) {
          errors.push('Cannot sync from blockchain: missing blob ID');
        }
        break;

      case 'both->local':
        warnings.push('Blockchain copy will remain but will not be updated');
        break;

      case 'both->blockchain':
        warnings.push('Local copy will be removed');
        break;
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Validates storage availability and capacity
   */
  async validateStorageAvailability(
    storageLocation: StorageLocation
  ): Promise<{ available: boolean; message?: string }> {
    try {
      switch (storageLocation) {
        case 'local':
          // Check local storage (simple check for now)
          return { available: true };

        case 'blockchain':
        case 'both': {
          // Check blockchain connectivity and funds
          await this.walrusStorage.connect();
          const balance = await this.walrusStorage.checkBalance();

          if (balance < 0.001) {
            // Minimum required balance
            return {
              available: false,
              message: 'Insufficient funds for blockchain storage',
            };
          }

          return { available: true };
        }

        default:
          return {
            available: false,
            message: `Unknown storage location: ${storageLocation}`,
          };
      }
    } catch (error) {
      return {
        available: false,
        message: (error as Error).message,
      };
    }
  }

  /**
   * Validates batch storage operations
   */
  async validateBatchStorage(
    todos: Todo[],
    newStorage: StorageLocation
  ): Promise<{
    valid: boolean;
    validTodos: Todo[];
    invalidTodos: Array<{ todo: Todo; errors: string[] }>;
    totalCost?: number;
  }> {
    const validTodos: Todo[] = [];
    const invalidTodos: Array<{ todo: Todo; errors: string[] }> = [];
    let totalCost = 0;

    for (const todo of todos) {
      const integrityCheck = await this.validateTodoIntegrity(todo);

      if (!integrityCheck.valid) {
        invalidTodos.push({ todo, errors: integrityCheck.errors });
        continue;
      }

      const transitionCheck = await this.validateStorageTransition(
        todo,
        newStorage
      );

      if (!transitionCheck.valid) {
        invalidTodos.push({ todo, errors: transitionCheck.errors });
        continue;
      }

      validTodos.push(todo);

      // Estimate storage cost
      if (newStorage === 'blockchain' || newStorage === 'both') {
        totalCost += await this.estimateStorageCost(todo);
      }
    }

    return {
      valid: invalidTodos.length === 0,
      validTodos,
      invalidTodos,
      totalCost: totalCost > 0 ? totalCost : undefined,
    };
  }

  /**
   * Estimates storage cost for a todo
   */
  private async estimateStorageCost(todo: Todo): Promise<number> {
    // Simple size calculation
    const todoJson = JSON.stringify(todo);
    const sizeInBytes = Buffer.byteLength(todoJson);

    // Rough estimate: $0.01 per KB
    return (sizeInBytes / 1024) * 0.01;
  }

  /**
   * Validates sync status for todos in 'both' storage mode
   */
  async validateSyncStatus(todo: Todo): Promise<{
    synced: boolean;
    localNewer?: boolean;
    blockchainNewer?: boolean;
    error?: string;
  }> {
    if (todo.storageLocation !== 'both' || !todo.walrusBlobId) {
      return { synced: true };
    }

    try {
      await this.walrusStorage.connect();
      const blockchainTodo = await this.walrusStorage.retrieveTodo(
        todo.walrusBlobId
      );

      const localTime = new Date(todo.updatedAt).getTime();
      const blockchainTime = new Date(blockchainTodo.updatedAt).getTime();

      if (localTime === blockchainTime) {
        // Check checksums to ensure data is identical
        const localChecksum = this.calculateChecksum(todo);
        const blockchainChecksum = this.calculateChecksum(blockchainTodo);

        return {
          synced: localChecksum === blockchainChecksum,
        };
      }

      return {
        synced: false,
        localNewer: localTime > blockchainTime,
        blockchainNewer: blockchainTime > localTime,
      };
    } catch (error) {
      return {
        synced: false,
        error: (error as Error).message,
      };
    }
  }
}
