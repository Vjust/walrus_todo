/**
 * TODO model and interfaces
 * Defines the structure and validation for TODO items
 */

import { v4 as uuidv4 } from 'uuid';
import { ValidationError } from '../utils/errors';

/**
 * Priority levels for TODO items
 */
export type Priority = 'low' | 'medium' | 'high';

/**
 * Status of a TODO item
 */
export type TodoStatus = 'pending' | 'done';

/**
 * Main TODO interface
 */
export interface Todo {
  id: string;
  description: string;
  priority: Priority;
  status: TodoStatus;
  tags?: string[];
  dueDate?: string; // ISO date string
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  completedAt?: string; // ISO date string
}

/**
 * Interface for TODO storage operations
 */
export interface TodoStore {
  /**
   * Get all TODOs
   */
  getAll(): Promise<Todo[]>;

  /**
   * Get a specific TODO by ID
   */
  getById(id: string): Promise<Todo | null>;

  /**
   * Add a new TODO
   */
  add(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Promise<Todo>;

  /**
   * Update an existing TODO
   */
  update(id: string, updates: Partial<Omit<Todo, 'id' | 'createdAt'>>): Promise<Todo>;

  /**
   * Delete a TODO
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all TODOs
   */
  clear(): Promise<void>;
}

/**
 * Generate a new unique ID for a TODO
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Create a new TODO with defaults
 */
export function createTodo(
  description: string,
  options: {
    priority?: Priority;
    tags?: string[];
    dueDate?: string;
  } = {}
): Omit<Todo, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    description: description.trim(),
    priority: options.priority || 'medium',
    status: 'pending',
    tags: options.tags?.map(tag => tag.trim()).filter(Boolean),
    dueDate: options.dueDate,
  };
}

/**
 * Validate a TODO object
 */
export function validateTodo(todo: Partial<Todo>): void {
  if (!todo.description || todo.description.trim().length === 0) {
    throw new ValidationError('Description is required');
  }

  if (todo.description.trim().length > 500) {
    throw new ValidationError('Description must be 500 characters or less');
  }

  if (todo.priority && !['low', 'medium', 'high'].includes(todo.priority)) {
    throw new ValidationError('Priority must be low, medium, or high');
  }

  if (todo.status && !['pending', 'done'].includes(todo.status)) {
    throw new ValidationError('Status must be pending or done');
  }

  if (todo.dueDate) {
    const date = new Date(todo.dueDate);
    if (isNaN(date.getTime())) {
      throw new ValidationError('Invalid due date format');
    }
  }

  if (todo.tags) {
    if (!Array.isArray(todo.tags)) {
      throw new ValidationError('Tags must be an array');
    }
    if (todo.tags.length > 10) {
      throw new ValidationError('Maximum 10 tags allowed');
    }
    if (todo.tags.some(tag => tag.length > 50)) {
      throw new ValidationError('Each tag must be 50 characters or less');
    }
  }
}

/**
 * Filter TODOs based on criteria
 */
export interface TodoFilter {
  status?: TodoStatus;
  priority?: Priority;
  tag?: string;
  search?: string;
}

/**
 * Apply filters to a list of TODOs
 */
export function filterTodos(todos: Todo[], filter: TodoFilter): Todo[] {
  return todos.filter(todo => {
    if (filter.status && todo.status !== filter.status) {
      return false;
    }

    if (filter.priority && todo.priority !== filter.priority) {
      return false;
    }

    if (filter.tag && (!todo.tags || !todo.tags.includes(filter.tag))) {
      return false;
    }

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      const inDescription = todo.description.toLowerCase().includes(searchLower);
      const inTags = todo.tags?.some(tag => tag.toLowerCase().includes(searchLower)) || false;
      if (!inDescription && !inTags) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sort TODOs by field
 */
export type TodoSortField = 'created' | 'due' | 'priority' | 'status';

/**
 * Sort TODOs
 */
export function sortTodos(todos: Todo[], sortBy: TodoSortField = 'created', ascending: boolean = true): Todo[] {
  const sorted = [...todos].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'created':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      
      case 'due':
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        break;
      
      case 'priority':
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
        break;
      
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
    }

    return ascending ? comparison : -comparison;
  });

  return sorted;
}