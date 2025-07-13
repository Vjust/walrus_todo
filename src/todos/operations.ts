/**
 * TODO operations for managing tasks
 * Provides high-level functions for CRUD operations on TODOs
 */

import { Todo, TodoStore, generateId, validateTodo, createTodo as createTodoModel, TodoFilter, filterTodos, sortTodos, TodoSortField } from './todo';
import { WalrusStore } from '../storage/walrus-store';
import { WalrusJsonMetadata } from '../storage/walrus';
import { TodoPublisher } from '../storage/publisher';
import { getConfig } from '../config/manager';
import { logger } from '../utils/logger';
import { ValidationError, NotFoundError } from '../utils/errors';

/**
 * Get the TODO store instance
 */
let storeInstance: TodoStore | null = null;

async function getStore(): Promise<TodoStore> {
  if (!storeInstance) {
    const config = await getConfig();
    storeInstance = new WalrusStore(config.walrus);
  }
  return storeInstance;
}

/**
 * Create a new TODO
 */
export async function createTodo(
  description: string,
  options: {
    priority?: 'low' | 'medium' | 'high';
    tags?: string[];
    dueDate?: string;
  } = {}
): Promise<Todo> {
  try {
    logger.debug('Creating new TODO', { description, options });

    // Create TODO model
    const todoData = createTodoModel(description, options);
    
    // Validate the TODO
    validateTodo(todoData);

    // Get store and add TODO
    const store = await getStore();
    const todo = await store.add(todoData);

    logger.info('TODO created successfully', { id: todo.id });
    return todo;
  } catch (error) {
    logger.error('Failed to create TODO', error);
    throw error;
  }
}

/**
 * Update an existing TODO
 */
export async function updateTodo(
  id: string,
  updates: Partial<Omit<Todo, 'id' | 'createdAt'>>
): Promise<Todo> {
  try {
    logger.debug('Updating TODO', { id, updates });

    // Validate updates
    validateTodo(updates);

    // Get store and update TODO
    const store = await getStore();
    const todo = await store.update(id, updates);

    logger.info('TODO updated successfully', { id });
    return todo;
  } catch (error) {
    logger.error('Failed to update TODO', error);
    throw error;
  }
}

/**
 * Delete a TODO
 */
export async function deleteTodo(id: string): Promise<void> {
  try {
    logger.debug('Deleting TODO', { id });

    const store = await getStore();
    
    // Check if TODO exists
    const todo = await store.getById(id);
    if (!todo) {
      throw new NotFoundError(`TODO with id ${id} not found`);
    }

    await store.delete(id);
    logger.info('TODO deleted successfully', { id });
  } catch (error) {
    logger.error('Failed to delete TODO', error);
    throw error;
  }
}

/**
 * Get all TODOs with optional filtering and sorting
 */
export async function getTodos(
  filter?: TodoFilter,
  sortBy: TodoSortField = 'created',
  ascending: boolean = true
): Promise<Todo[]> {
  try {
    logger.debug('Getting TODOs', { filter, sortBy, ascending });

    const store = await getStore();
    let todos = await store.getAll();

    // Apply filters if provided
    if (filter) {
      todos = filterTodos(todos, filter);
    }

    // Sort TODOs
    todos = sortTodos(todos, sortBy, ascending);

    logger.debug(`Retrieved ${todos.length} TODOs`);
    return todos;
  } catch (error) {
    logger.error('Failed to get TODOs', error);
    throw error;
  }
}

/**
 * Search TODOs by text
 */
export async function searchTodos(searchText: string): Promise<Todo[]> {
  try {
    logger.debug('Searching TODOs', { searchText });

    if (!searchText || searchText.trim().length === 0) {
      return [];
    }

    const todos = await getTodos({ search: searchText });
    
    logger.debug(`Found ${todos.length} matching TODOs`);
    return todos;
  } catch (error) {
    logger.error('Failed to search TODOs', error);
    throw error;
  }
}

/**
 * Get a single TODO by ID
 */
export async function getTodoById(id: string): Promise<Todo | null> {
  try {
    logger.debug('Getting TODO by ID', { id });

    const store = await getStore();
    const todo = await store.getById(id);

    if (!todo) {
      logger.debug('TODO not found', { id });
    }

    return todo;
  } catch (error) {
    logger.error('Failed to get TODO', error);
    throw error;
  }
}

/**
 * Mark a TODO as done
 */
export async function markTodoAsDone(id: string): Promise<Todo> {
  try {
    logger.debug('Marking TODO as done', { id });

    const todo = await updateTodo(id, {
      status: 'done',
      completedAt: new Date().toISOString()
    });

    return todo;
  } catch (error) {
    logger.error('Failed to mark TODO as done', error);
    throw error;
  }
}

/**
 * Clear all TODOs
 */
export async function clearAllTodos(): Promise<void> {
  try {
    logger.debug('Clearing all TODOs');

    const store = await getStore();
    await store.clear();

    logger.info('All TODOs cleared');
  } catch (error) {
    logger.error('Failed to clear TODOs', error);
    throw error;
  }
}

/**
 * Get statistics about TODOs
 */
export interface TodoStats {
  total: number;
  pending: number;
  done: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
  overdue: number;
}

export async function getTodoStats(): Promise<TodoStats> {
  try {
    const todos = await getTodos();
    const now = new Date();

    const stats: TodoStats = {
      total: todos.length,
      pending: todos.filter(t => t.status === 'pending').length,
      done: todos.filter(t => t.status === 'done').length,
      highPriority: todos.filter(t => t.priority === 'high').length,
      mediumPriority: todos.filter(t => t.priority === 'medium').length,
      lowPriority: todos.filter(t => t.priority === 'low').length,
      overdue: todos.filter(t => 
        t.status === 'pending' && 
        t.dueDate && 
        new Date(t.dueDate) < now
      ).length,
    };

    return stats;
  } catch (error) {
    logger.error('Failed to get TODO stats', error);
    throw error;
  }
}

/**
 * Export format for Walrus publishing
 */
export interface WalrusExportData {
  todos: Todo[];
  metadata: WalrusJsonMetadata;
  exportInfo: {
    exportedAt: string;
    exportedBy: string;
    version: string;
    totalCount: number;
    filters?: TodoFilter;
    sortBy?: TodoSortField;
    ascending?: boolean;
  };
  statistics?: TodoStats;
}

/**
 * Options for Walrus export
 */
export interface WalrusExportOptions {
  includeStats?: boolean;
  includeMetadata?: boolean;
  filter?: TodoFilter;
  sortBy?: TodoSortField;
  ascending?: boolean;
  validateData?: boolean;
}

/**
 * Export TODOs formatted for Walrus publishing
 * Includes app metadata, schema version, and data validation
 */
export async function exportForWalrus(
  options: WalrusExportOptions = {}
): Promise<WalrusExportData> {
  try {
    logger.debug('Exporting TODOs for Walrus publishing', options);

    // Set defaults
    const exportOptions = {
      includeStats: true,
      includeMetadata: true,
      validateData: true,
      ascending: true,
      sortBy: 'created' as TodoSortField,
      ...options,
    };

    // Get TODOs with optional filtering and sorting
    const todos = await getTodos(
      exportOptions.filter,
      exportOptions.sortBy,
      exportOptions.ascending
    );

    // Validate data if requested
    if (exportOptions.validateData) {
      todos.forEach((todo, index) => {
        try {
          validateTodo(todo);
        } catch (error) {
          logger.error(`Validation failed for TODO at index ${index}:`, error);
          throw new ValidationError(
            `TODO validation failed at index ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      });
    }

    // Create metadata for Walrus storage
    const metadata: WalrusJsonMetadata = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      appName: 'waltodo',
      appVersion: '1.0.0',
      dataType: 'todos-export',
      schema: 'todo-export-v1',
    };

    // Create export info
    const exportInfo = {
      exportedAt: new Date().toISOString(),
      exportedBy: 'waltodo-operations',
      version: '1.0.0',
      totalCount: todos.length,
      ...(exportOptions.filter && { filters: exportOptions.filter }),
      ...(exportOptions.sortBy && { sortBy: exportOptions.sortBy }),
      ...(exportOptions.ascending !== undefined && { ascending: exportOptions.ascending }),
    };

    // Create base export data
    const exportData: WalrusExportData = {
      todos,
      metadata,
      exportInfo,
    };

    // Add statistics if requested
    if (exportOptions.includeStats) {
      const stats = await getTodoStats();
      exportData.statistics = stats;

      logger.debug('Export statistics generated', {
        total: stats.total,
        pending: stats.pending,
        done: stats.done
      });
    }

    // Log export summary
    logger.info('TODOs exported for Walrus publishing', {
      todoCount: todos.length,
      includeStats: exportOptions.includeStats,
      includeMetadata: exportOptions.includeMetadata,
      hasFilters: !!exportOptions.filter,
      sortBy: exportOptions.sortBy,
    });

    return exportData;
  } catch (error) {
    logger.error('Failed to export TODOs for Walrus', error);
    throw error;
  }
}

/**
 * Export and publish TODOs directly to Walrus
 * Convenience function that combines export and publish operations
 */
export async function exportAndPublishToWalrus(
  exportOptions: WalrusExportOptions = {},
  publishOptions: {
    estimateCost?: boolean;
    batchSize?: number;
    retryAttempts?: number;
  } = {}
): Promise<{
  exportData: WalrusExportData;
  publishResult: any;
}> {
  try {
    logger.debug('Exporting and publishing TODOs to Walrus', {
      exportOptions,
      publishOptions
    });

    // Export the data
    const exportData = await exportForWalrus(exportOptions);

    // Get Walrus configuration
    const config = await getConfig();
    
    // Create publisher (this would need WalrusClient instance)
    // Note: This is a simplified implementation - in practice you'd need to
    // initialize the WalrusClient with proper configuration
    logger.info('TODO data exported successfully for Walrus publishing', {
      todoCount: exportData.todos.length,
      hasStats: !!exportData.statistics,
      exportedAt: exportData.exportInfo.exportedAt
    });

    // Return export data and a placeholder for publish result
    // In a real implementation, you'd create a TodoPublisher instance and call publish
    const publishResult = {
      message: 'Export completed. Use TodoPublisher.publishBatch() to publish to Walrus.',
      todoCount: exportData.todos.length,
      estimatedSize: JSON.stringify(exportData).length,
    };

    return {
      exportData,
      publishResult,
    };
  } catch (error) {
    logger.error('Failed to export and publish TODOs to Walrus', error);
    throw error;
  }
}

/**
 * Validate TODOs for Walrus publishing
 * Checks data integrity and format compliance
 */
export async function validateTodosForWalrus(
  todos?: Todo[]
): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalTodos: number;
    validTodos: number;
    invalidTodos: number;
    estimatedSize: number;
  };
}> {
  try {
    logger.debug('Validating TODOs for Walrus publishing');

    // Get TODOs if not provided
    const todosToValidate = todos || await getTodos();
    const errors: string[] = [];
    const warnings: string[] = [];
    let validTodos = 0;
    let invalidTodos = 0;

    // Basic validation
    if (!Array.isArray(todosToValidate)) {
      errors.push('TODOs must be provided as an array');
      return {
        isValid: false,
        errors,
        warnings,
        stats: {
          totalTodos: 0,
          validTodos: 0,
          invalidTodos: 0,
          estimatedSize: 0,
        },
      };
    }

    if (todosToValidate.length === 0) {
      warnings.push('No TODOs to validate');
    }

    // Validate each TODO
    todosToValidate.forEach((todo, index) => {
      try {
        validateTodo(todo);
        validTodos++;
      } catch (error) {
        invalidTodos++;
        errors.push(`TODO at index ${index}: ${error instanceof Error ? error.message : 'Validation failed'}`);
      }

      // Additional warnings for Walrus publishing
      if (todo.description.length > 1000) {
        warnings.push(`TODO at index ${index} has very long description (${todo.description.length} chars)`);
      }

      if (todo.tags && todo.tags.length > 20) {
        warnings.push(`TODO at index ${index} has many tags (${todo.tags.length})`);
      }
    });

    // Size estimation
    const estimatedSize = JSON.stringify(todosToValidate).length;
    if (estimatedSize > 10 * 1024 * 1024) { // 10MB
      warnings.push(`Large dataset size (${Math.round(estimatedSize / 1024 / 1024)}MB) may increase publishing costs`);
    }

    const isValid = errors.length === 0;
    const stats = {
      totalTodos: todosToValidate.length,
      validTodos,
      invalidTodos,
      estimatedSize,
    };

    logger.info('TODO validation completed', {
      isValid,
      errorCount: errors.length,
      warningCount: warnings.length,
      ...stats
    });

    return {
      isValid,
      errors,
      warnings,
      stats,
    };
  } catch (error) {
    logger.error('Failed to validate TODOs for Walrus', error);
    throw error;
  }
}