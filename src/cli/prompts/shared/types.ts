/**
 * Shared types for CLI prompts
 */

import { Priority } from '../../../todos/todo';

/**
 * Common prompt result for adding/editing TODOs
 */
export interface TodoPromptResult {
  description: string;
  priority: Priority;
  tags?: string[];
  dueDate?: string;
}

/**
 * Filter options for list operations
 */
export interface ListFilterOptions {
  status?: 'pending' | 'done';
  priority?: Priority;
  tag?: string;
  searchTerm?: string;
}

/**
 * Batch operation result
 */
export interface BatchOperationResult {
  action: 'mark-done' | 'delete' | 'change-priority' | 'add-tags' | 'remove-tags';
  selectedIds: string[];
  data?: any;
}

/**
 * Search query result
 */
export interface SearchQueryResult {
  query: string;
  type: 'text' | 'tag' | 'priority' | 'status';
}

/**
 * Blob search criteria
 */
export interface BlobSearchCriteria {
  searchTerm?: string;
  status?: string;
  tags?: string[];
  minTodos?: number;
  maxTodos?: number;
}

/**
 * Publish configuration options
 */
export interface PublishConfig {
  epochs: number;
  deletable: boolean;
  description?: string;
  tags: string[];
}

/**
 * Import options for fetching TODOs
 */
export interface ImportOptions {
  merge: boolean;
  overwriteExisting: boolean;
}