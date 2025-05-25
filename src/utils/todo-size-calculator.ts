import { Todo, TodoList } from '../types/todo';
import { TodoSerializer } from './todo-serializer';

/**
 * Storage size buffer constants
 */
const SIZE_BUFFER_PERCENTAGE = 10; // 10% buffer
const MIN_SIZE_BUFFER_BYTES = 1024; // Minimum 1KB buffer
const MAX_SIZE_BUFFER_BYTES = 1024 * 1024; // Maximum 1MB buffer
const METADATA_ESTIMATED_SIZE = 512; // Estimated size for metadata fields

/**
 * Utility class for accurately calculating storage requirements for todos
 */
export class TodoSizeCalculator {
  /**
   * Calculates the exact size of a todo in bytes including buffer
   *
   * @param todo The todo object to measure
   * @param options Optional configuration
   * @returns Size in bytes including buffer
   */
  static calculateTodoSize(
    todo: Todo,
    options: {
      includeBuffer?: boolean;
      bufferPercentage?: number;
    } = {}
  ): number {
    const { includeBuffer = true, bufferPercentage = SIZE_BUFFER_PERCENTAGE } =
      options;

    // Serialize to determine exact size in bytes
    const serialized = TodoSerializer.todoToBuffer(todo);
    const exactSize = serialized.length;

    // If buffer is not requested, return exact size
    if (!includeBuffer) return exactSize;

    // Calculate buffer based on percentage with limits
    const calculatedBuffer = Math.floor(exactSize * (bufferPercentage / 100));
    const buffer = Math.min(
      Math.max(calculatedBuffer, MIN_SIZE_BUFFER_BYTES),
      MAX_SIZE_BUFFER_BYTES
    );

    // Add storage metadata overhead estimate
    return exactSize + buffer + METADATA_ESTIMATED_SIZE;
  }

  /**
   * Estimates the size of a todo based on field contents without full serialization
   * Useful for quick estimates when the todo object is still being constructed
   *
   * @param todo Partial todo object or properties
   * @returns Estimated size in bytes
   */
  static estimateTodoSize(todo: Partial<Todo>): number {
    let estimatedSize = 0;

    // Base structure overhead (JSON braces, commas, quotes)
    estimatedSize += 20;

    // Add size for each field that exists
    if (todo.id) estimatedSize += 10 + todo.id.length;
    if (todo.title) estimatedSize += 14 + todo.title.length;
    if (todo.description) estimatedSize += 19 + todo.description.length;
    if (todo.completed !== undefined)
      estimatedSize += 16 + (todo.completed ? 4 : 5);
    if (todo.priority) estimatedSize += 16 + todo.priority.length;
    if (todo.dueDate) estimatedSize += 14 + todo.dueDate.length;
    if (todo.tags) estimatedSize += 12 + JSON.stringify(todo.tags).length;
    if (todo.createdAt) estimatedSize += 16 + todo.createdAt.length;
    if (todo.updatedAt) estimatedSize += 16 + todo.updatedAt.length;
    if (todo.completedAt) estimatedSize += 18 + todo.completedAt.length;
    if (todo.private !== undefined)
      estimatedSize += 14 + (todo.private ? 4 : 5);
    if (todo.storageLocation) estimatedSize += 22 + todo.storageLocation.length;
    if (todo.walrusBlobId) estimatedSize += 19 + todo.walrusBlobId.length;
    if (todo.nftObjectId) estimatedSize += 18 + todo.nftObjectId.length;
    if (todo.imageUrl) estimatedSize += 15 + todo.imageUrl.length;

    // Add buffer and metadata overhead
    return estimatedSize + MIN_SIZE_BUFFER_BYTES + METADATA_ESTIMATED_SIZE;
  }

  /**
   * Calculates the exact size of a todo list in bytes including buffer
   *
   * @param todoList The todo list to measure
   * @param options Optional configuration
   * @returns Size in bytes including buffer
   */
  static calculateTodoListSize(
    todoList: TodoList,
    options: {
      includeBuffer?: boolean;
      bufferPercentage?: number;
    } = {}
  ): number {
    const { includeBuffer = true, bufferPercentage = SIZE_BUFFER_PERCENTAGE } =
      options;

    // Serialize to determine exact size in bytes
    const serialized = TodoSerializer.todoListToBuffer(todoList);
    const exactSize = serialized.length;

    // If buffer is not requested, return exact size
    if (!includeBuffer) return exactSize;

    // Calculate buffer based on percentage with limits
    const calculatedBuffer = Math.floor(exactSize * (bufferPercentage / 100));
    const buffer = Math.min(
      Math.max(calculatedBuffer, MIN_SIZE_BUFFER_BYTES),
      MAX_SIZE_BUFFER_BYTES
    );

    // Add storage metadata overhead estimate
    return exactSize + buffer + METADATA_ESTIMATED_SIZE;
  }

  /**
   * Calculates the optimal total storage allocation size needed for a set of todos
   *
   * @param todos Array of todos to calculate storage for
   * @param options Optional configuration
   * @returns Recommended storage allocation size in bytes
   */
  static calculateOptimalStorageSize(
    todos: Todo[],
    options: {
      includeBuffer?: boolean;
      extraAllocation?: number;
      minSize?: number;
    } = {}
  ): number {
    const {
      includeBuffer = true,
      extraAllocation = 0,
      minSize = 1024 * 1024, // 1MB minimum
    } = options;

    // Calculate total size for all todos
    let totalSize = 0;
    for (const todo of todos) {
      totalSize += this.calculateTodoSize(todo, { includeBuffer });
    }

    // Add extra allocation for future todos
    totalSize += extraAllocation;

    // Ensure minimum size
    return Math.max(totalSize, minSize);
  }

  /**
   * Analyzes existing storage availability against requirements
   *
   * @param requiredBytes The total bytes needed
   * @param availableBytes The available storage space (remaining)
   * @param options Optional configuration
   * @returns Analysis result with recommendation
   */
  static analyzeStorageRequirements(
    requiredBytes: number,
    availableBytes: number,
    options: {
      minimumBuffer?: number;
    } = {}
  ): {
    isStorageSufficient: boolean;
    remainingBytes: number;
    remainingPercentage: number;
    recommendation: 'use-existing' | 'expand' | 'create-new';
  } {
    const { minimumBuffer = 1024 * 1024 } = options;

    // Calculate remaining bytes if we use the required space
    const remainingBytes = availableBytes - requiredBytes;
    const remainingPercentage = (remainingBytes / availableBytes) * 100;

    // Determine if storage is sufficient
    const isStorageSufficient = remainingBytes > minimumBuffer;

    // Provide recommendation
    let recommendation: 'use-existing' | 'expand' | 'create-new';
    if (isStorageSufficient) {
      recommendation = 'use-existing';
    } else if (remainingBytes > 0) {
      recommendation = 'expand';
    } else {
      recommendation = 'create-new';
    }

    return {
      isStorageSufficient,
      remainingBytes,
      remainingPercentage,
      recommendation,
    };
  }
}
