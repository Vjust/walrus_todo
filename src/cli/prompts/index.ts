/**
 * Main export file for all CLI prompts
 * 
 * This file re-exports all prompt functions from subdirectories
 * to maintain backward compatibility for imports from '../prompts'
 */

// Re-export all TODO-related prompts
export {
  promptAddTodo,
  promptAddTodoInteractive,
  promptQuickAdd,
  promptEditTodo,
  confirmDelete,
  confirmClearAll,
  selectMultipleTodos,
  promptBatchOperation
} from './todo/index';

// Re-export all blob-related prompts
export {
  promptSelectBlob,
  promptBlobSearch,
  promptPublishConfig,
  confirmBlobDelete,
  promptImportOptions
} from './blob/index';

// Re-export all search-related prompts
export {
  promptListFilters,
  promptSmartSearch
} from './search/index';

// Re-export all sync-related prompts
export {
  promptSyncConflict
} from './sync/index';

// Re-export all shared types and helpers
export * from './shared/index';