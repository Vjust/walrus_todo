/**
 * TODO operations for managing tasks
 * Provides high-level functions for CRUD operations on TODOs
 */

import { Todo, TodoStore, generateId, validateTodo, createTodo as createTodoModel, TodoFilter, filterTodos, sortTodos, TodoSortField } from './todo';
import { WalrusStore } from '../storage/walrus-store';
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