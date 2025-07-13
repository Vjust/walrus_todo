/**
 * CLI module exports
 * 
 * This module provides command-line interface functionality including
 * commands, prompts, UI utilities, and interactive mode.
 */

// Commands
export {
  addCommand,
  listCommand,
  doneCommand,
  deleteCommand,
  clearCommand,
  exportCommand,
  importCommand,
  searchCommand,
  statsCommand
} from './commands.js';

// Interactive mode
export { runInteractiveMode } from './interactive.js';

// UI utilities
export {
  success,
  error,
  warning,
  info,
  spinner,
  formatPriority,
  formatStatus,
  formatDate,
  createTodoTable,
  formatTodo,
  confirm
} from './ui.js';

// Prompts
export {
  promptAddTodo,
  confirmDelete,
  confirmClearAll,
  selectMultipleTodos,
  promptEditTodo,
  promptSyncConflict,
  promptListFilters,
  promptAddTodoInteractive,
  promptQuickAdd,
  promptBatchOperation,
  promptSmartSearch
} from './prompts.js';