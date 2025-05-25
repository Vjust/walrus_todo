import { Todo, TodoList } from '../types/todo';
import { TodoSizeCalculator } from './todo-size-calculator';
import { CLIError } from '../types/errors/consolidated';
import { WalrusStorage } from './walrus-storage';
import { Logger } from './Logger';

const logger = new Logger('batch-uploader');

interface BatchUploadResult {
  successful: { id: string; blobId: string }[];
  failed: { id: string; error: string }[];
  totalSaved: number; // WAL tokens saved by batch optimization
  totalBytesUploaded: number;
}

interface BatchUploadOptions {
  skipVerification?: boolean;
  epochs?: number;
  progressCallback?: (current: number, total: number, id: string) => void;
}

/**
 * BatchUploader provides optimization for uploading multiple todos or todo lists
 * at once, reducing storage costs by efficiently allocating storage.
 */
export class BatchUploader {
  constructor(private walrusStorage: WalrusStorage) {}

  /**
   * Calculates the optimal storage size needed for a batch of todos
   * and uploads them efficiently in a single transaction when possible
   *
   * @param todos Array of todos to upload as a batch
   * @param options Upload options
   * @returns Results of the batch upload operation
   */
  async uploadTodos(
    todos: Todo[],
    options: BatchUploadOptions = {}
  ): Promise<BatchUploadResult> {
    if (!todos.length) {
      throw new CLIError('No todos provided for batch upload', 'BATCH_EMPTY');
    }

    try {
      // Validate all todos before starting
      todos.forEach(todo => {
        if (!todo.id)
          throw new CLIError(`Todo is missing ID`, 'INVALID_TODO_DATA');
        if (!todo.title)
          throw new CLIError(
            `Todo "${todo.id}" is missing title`,
            'INVALID_TODO_DATA'
          );
      });

      logger.info(`Preparing batch upload for ${todos.length} todos...`);

      // Calculate total storage needed for all todos with optimal allocation
      const totalSizeNeeded = TodoSizeCalculator.calculateOptimalStorageSize(
        todos,
        { extraAllocation: 10 * 1024 } // Add 10KB extra for future growth
      );

      logger.info(`Total storage needed for batch: ${totalSizeNeeded} bytes`);

      // Ensure we have enough storage allocated
      const storage =
        await this.walrusStorage.ensureStorageAllocated(totalSizeNeeded);
      if (!storage) {
        throw new CLIError(
          'Failed to allocate storage for batch upload',
          'BATCH_STORAGE_FAILED'
        );
      }

      // Calculate how much we would have spent without batching
      // Each todo would need its own 1MB minimum allocation
      const unbatchedSize = todos.length * 1024 * 1024;
      const tokensSavedEstimate = Math.floor(
        (unbatchedSize - totalSizeNeeded) / 1024
      );

      logger.info(
        `Optimized batch allocation: saved approximately ${tokensSavedEstimate} WAL tokens`
      );

      // Process todos
      const result: BatchUploadResult = {
        successful: [],
        failed: [],
        totalSaved: tokensSavedEstimate,
        totalBytesUploaded: 0,
      };

      // Upload each todo
      for (let i = 0; i < todos.length; i++) {
        const todo = todos[i];
        const exactSize = TodoSizeCalculator.calculateTodoSize(todo, {
          includeBuffer: false,
        });

        if (options.progressCallback) {
          options.progressCallback(i + 1, todos.length, todo.id);
        }

        logger.info(`Uploading todo "${todo.title}" (${exactSize} bytes)...`);

        try {
          const blobId = await this.walrusStorage.storeTodo(todo);
          result.successful.push({ id: todo.id, blobId });
          result.totalBytesUploaded += exactSize;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error(`Failed to upload todo "${todo.id}": ${errorMessage}`);
          result.failed.push({ id: todo.id, error: errorMessage });
        }
      }

      logger.info(`Batch upload completed:`);
      logger.info(`- Successfully uploaded: ${result.successful.length} todos`);
      logger.info(`- Failed: ${result.failed.length} todos`);
      logger.info(`- Total bytes uploaded: ${result.totalBytesUploaded}`);

      return result;
    } catch (error) {
      if (error instanceof CLIError) throw error;
      throw new CLIError(
        `Batch upload failed: ${error instanceof Error ? error.message : String(error)}`,
        'BATCH_UPLOAD_FAILED'
      );
    }
  }

  /**
   * Uploads a todo list with all its todos in a batch operation
   *
   * @param todoList TodoList to upload
   * @param options Upload options
   * @returns Results of the batch upload
   */
  async uploadTodoList(
    todoList: TodoList,
    options: BatchUploadOptions = {}
  ): Promise<{ listBlobId: string; todoResults: BatchUploadResult }> {
    try {
      // First upload all the todos in the list as a batch
      const todoResults = await this.uploadTodos(todoList.todos, options);

      // Update the todo list with the new blob IDs
      for (const result of todoResults.successful) {
        const todoIndex = todoList.todos.findIndex(t => t.id === result.id);
        if (todoIndex >= 0) {
          todoList.todos[todoIndex].walrusBlobId = result.blobId;
        }
      }

      // Upload the todo list itself
      logger.info(`Uploading todo list "${todoList.name}"...`);
      const listBlobId = await this.walrusStorage.storeTodoList(todoList);

      return {
        listBlobId,
        todoResults,
      };
    } catch (error) {
      if (error instanceof CLIError) throw error;
      throw new CLIError(
        `Todo list batch upload failed: ${error instanceof Error ? error.message : String(error)}`,
        'BATCH_UPLOAD_FAILED'
      );
    }
  }
}

/**
 * Create a BatchUploader for efficient uploading of multiple todos
 * and todo lists at once.
 *
 * @param walrusStorage A connected WalrusStorage instance
 * @returns A new BatchUploader instance
 */
export function createBatchUploader(
  walrusStorage: WalrusStorage
): BatchUploader {
  return new BatchUploader(walrusStorage);
}
