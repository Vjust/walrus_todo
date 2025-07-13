/**
 * Interactive mode for Waltodo CLI
 * Provides a menu-driven interface for managing TODOs
 */

import inquirer, { Separator } from 'inquirer';
import chalk from 'chalk';
import { info, error, success, warning, createTodoTable, formatTodo, spinner } from './ui';
import { logger } from '../utils/logger';
import { Todo } from '../todos/todo';
import { 
  promptAddTodoInteractive, 
  promptQuickAdd, 
  promptEditTodo, 
  promptBatchOperation, 
  promptSmartSearch,
  confirmDelete,
  confirmClearAll
} from './prompts';
import {
  getTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  markTodoAsDone,
  clearAllTodos,
  searchTodos,
  getTodoStats,
  getTodoById
} from '../todos/operations';

interface InteractiveState {
  todos: Todo[];
  filteredTodos: Todo[];
  selectedFilter: string;
  recentSearches: string[];
  currentPage: number;
  itemsPerPage: number;
}

/**
 * Run interactive mode
 */
export async function runInteractiveMode(): Promise<void> {
  try {
    console.clear();
    console.log(chalk.bold.blue('🎯 Waltodo Interactive Mode'));
    console.log(chalk.gray('Use arrows to navigate, Enter to select, Ctrl+C to exit\n'));

    const state: InteractiveState = {
      todos: [],
      filteredTodos: [],
      selectedFilter: 'all',
      recentSearches: [],
      currentPage: 1,
      itemsPerPage: 10
    };

    // Load initial data
    await refreshTodos(state);

    // Main menu loop
    let shouldExit = false;
    while (!shouldExit) {
      try {
        const action = await showMainMenu(state);
        shouldExit = await handleMainMenuAction(action, state);
      } catch (err) {
        if (err instanceof Error && err.message === 'User forced exit') {
          shouldExit = true;
        } else {
          logger.error('Interactive mode action error:', err);
          error(`Action failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
          
          // Wait for user to acknowledge error
          await inquirer.prompt([{
            type: 'input',
            name: 'continue',
            message: 'Press Enter to continue...'
          }]);
        }
      }
    }

    console.log(chalk.blue('\n👋 Thanks for using Waltodo!'));
    
  } catch (err) {
    logger.error('Interactive mode error:', err);
    error(`Failed to start interactive mode: ${err instanceof Error ? err.message : 'Unknown error'}`);
    throw err;
  }
}

/**
 * Show the main menu
 */
async function showMainMenu(state: InteractiveState): Promise<string> {
  const stats = await getTodoStats();
  
  console.clear();
  console.log(chalk.bold.blue('🎯 Waltodo Interactive Mode'));
  console.log(chalk.gray(`${stats.total} total • ${stats.pending} pending • ${stats.done} done`));
  
  if (stats.overdue > 0) {
    console.log(chalk.red(`⚠️  ${stats.overdue} overdue TODOs`));
  }
  
  console.log(''); // Empty line

  // Show current filter info
  if (state.selectedFilter !== 'all') {
    console.log(chalk.yellow(`Filter: ${state.selectedFilter} (${state.filteredTodos.length} items)`));
  }

  // Show quick stats
  console.log(chalk.gray(`Showing ${state.filteredTodos.length} of ${state.todos.length} TODOs`));
  console.log(''); // Empty line

  const choices = [
    { name: '📋 List TODOs', value: 'list' },
    { name: '➕ Add TODO', value: 'add' },
    { name: '⚡ Quick Add', value: 'quick-add' },
    { name: '🔍 Search', value: 'search' },
    { name: '📊 Statistics', value: 'stats' },
    new Separator(),
    { name: '✏️  Edit TODO', value: 'edit' },
    { name: '✅ Mark as Done', value: 'done' },
    { name: '🗑️  Delete TODO', value: 'delete' },
    { name: '📦 Batch Operations', value: 'batch' },
    new Separator(),
    { name: '🧹 Clear Filter', value: 'clear-filter' },
    { name: '🗂️  Filter/Sort', value: 'filter' },
    { name: '💾 Export', value: 'export' },
    { name: '📥 Import', value: 'import' },
    new Separator(),
    { name: '🔄 Refresh', value: 'refresh' },
    { name: '❌ Clear All', value: 'clear-all' },
    { name: '🚪 Exit', value: 'exit' }
  ];

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices,
      pageSize: 15
    }
  ]);

  return action;
}

/**
 * Handle main menu action
 */
async function handleMainMenuAction(action: string, state: InteractiveState): Promise<boolean> {
  switch (action) {
    case 'list':
      await showTodoList(state);
      break;
    
    case 'add':
      await addTodoInteractive(state);
      break;
    
    case 'quick-add':
      await quickAddTodo(state);
      break;
    
    case 'search':
      await searchTodosInteractive(state);
      break;
    
    case 'stats':
      await showStatistics();
      break;
    
    case 'edit':
      await editTodoInteractive(state);
      break;
    
    case 'done':
      await markTodoAsDoneInteractive(state);
      break;
    
    case 'delete':
      await deleteTodoInteractive(state);
      break;
    
    case 'batch':
      await batchOperations(state);
      break;
    
    case 'clear-filter':
      await clearFilter(state);
      break;
    
    case 'filter':
      await filterTodosInteractive(state);
      break;
    
    case 'export':
      await exportTodos();
      break;
    
    case 'import':
      await importTodos(state);
      break;
    
    case 'refresh':
      await refreshTodos(state);
      success('TODOs refreshed!');
      await waitForUser();
      break;
    
    case 'clear-all':
      await clearAllTodosInteractive(state);
      break;
    
    case 'exit':
      return true;
    
    default:
      warning('Unknown action');
      await waitForUser();
  }
  
  return false;
}

/**
 * Refresh todos from storage
 */
async function refreshTodos(state: InteractiveState): Promise<void> {
  const spin = spinner('Loading TODOs...');
  try {
    state.todos = await getTodos();
    state.filteredTodos = [...state.todos];
    spin.succeed('TODOs loaded');
  } catch (err) {
    spin.fail('Failed to load TODOs');
    throw err;
  }
}

/**
 * Show paginated TODO list
 */
async function showTodoList(state: InteractiveState): Promise<void> {
  if (state.filteredTodos.length === 0) {
    console.log(chalk.gray('\n📝 No TODOs found'));
    if (state.selectedFilter !== 'all') {
      console.log(chalk.yellow('Try clearing the filter or adding some TODOs'));
    } else {
      console.log(chalk.yellow('Add your first TODO to get started!'));
    }
    await waitForUser();
    return;
  }

  let currentPage = 1;
  const itemsPerPage = 10;
  const totalPages = Math.ceil(state.filteredTodos.length / itemsPerPage);

  while (true) {
    console.clear();
    console.log(chalk.bold.blue('📋 TODO List'));
    console.log(chalk.gray(`Page ${currentPage} of ${totalPages} • ${state.filteredTodos.length} items\n`));

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, state.filteredTodos.length);
    const pageItems = state.filteredTodos.slice(startIndex, endIndex);

    console.log(createTodoTable(pageItems));

    const choices = [];
    
    if (totalPages > 1) {
      if (currentPage > 1) choices.push({ name: '⬅️  Previous page', value: 'prev' });
      if (currentPage < totalPages) choices.push({ name: '➡️  Next page', value: 'next' });
    }
    
    choices.push(
      new Separator(),
      { name: '↩️  Back to main menu', value: 'back' }
    );

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Navigation:',
        choices,
        pageSize: 10
      }
    ]);

    if (action === 'prev' && currentPage > 1) {
      currentPage--;
    } else if (action === 'next' && currentPage < totalPages) {
      currentPage++;
    } else if (action === 'back') {
      break;
    }
  }
}

/**
 * Add TODO interactively with all options
 */
async function addTodoInteractive(state: InteractiveState): Promise<void> {
  try {
    // Get existing tags for autocomplete
    const existingTags = [...new Set(state.todos.flatMap(todo => todo.tags))];
    
    const todoData = await promptAddTodoInteractive(existingTags);
    
    const spin = spinner('Creating TODO...');
    const newTodo = await createTodo(todoData.description, {
      priority: todoData.priority,
      tags: todoData.tags,
      dueDate: todoData.dueDate
    });
    
    spin.succeed('TODO created!');
    
    // Add to local state
    state.todos.unshift(newTodo);
    await applyCurrentFilter(state);
    
    success(`Created: ${newTodo.description}`);
    await waitForUser();
  } catch (err) {
    error(`Failed to create TODO: ${err instanceof Error ? err.message : 'Unknown error'}`);
    await waitForUser();
  }
}

/**
 * Quick add TODO with minimal prompts
 */
async function quickAddTodo(state: InteractiveState): Promise<void> {
  try {
    const todoData = await promptQuickAdd();
    
    const spin = spinner('Creating TODO...');
    const newTodo = await createTodo(todoData.description, {
      priority: todoData.priority
    });
    
    spin.succeed('TODO created!');
    
    // Add to local state
    state.todos.unshift(newTodo);
    await applyCurrentFilter(state);
    
    success(`Quick added: ${newTodo.description}`);
    await waitForUser();
  } catch (err) {
    error(`Failed to create TODO: ${err instanceof Error ? err.message : 'Unknown error'}`);
    await waitForUser();
  }
}

/**
 * Search TODOs interactively
 */
async function searchTodosInteractive(state: InteractiveState): Promise<void> {
  try {
    const existingTags = [...new Set(state.todos.flatMap(todo => todo.tags))];
    const searchData = await promptSmartSearch(existingTags, state.recentSearches);
    
    // Add to recent searches
    if (searchData.type === 'text' && !state.recentSearches.includes(searchData.query)) {
      state.recentSearches.unshift(searchData.query);
      state.recentSearches = state.recentSearches.slice(0, 10); // Keep last 10
    }
    
    const spin = spinner('Searching...');
    let results: Todo[] = [];
    
    switch (searchData.type) {
      case 'text':
        results = await searchTodos(searchData.query);
        break;
      case 'tag':
        results = state.todos.filter(todo => todo.tags.includes(searchData.query));
        break;
      case 'priority':
        results = state.todos.filter(todo => todo.priority === searchData.query);
        break;
      case 'status':
        results = state.todos.filter(todo => todo.status === searchData.query);
        break;
    }
    
    spin.succeed(`Found ${results.length} results`);
    
    state.filteredTodos = results;
    state.selectedFilter = `${searchData.type}:${searchData.query}`;
    
    if (results.length > 0) {
      await showTodoList(state);
    } else {
      info('No TODOs found matching your search');
      await waitForUser();
    }
  } catch (err) {
    error(`Search failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    await waitForUser();
  }
}

/**
 * Show statistics
 */
async function showStatistics(): Promise<void> {
  try {
    const spin = spinner('Calculating statistics...');
    const stats = await getTodoStats();
    spin.succeed('Statistics calculated');
    
    console.clear();
    console.log(chalk.bold.blue('📊 TODO Statistics\n'));
    
    console.log(chalk.white('📈 Overview:'));
    console.log(`  Total TODOs: ${chalk.bold(stats.total.toString())}`);
    console.log(`  Pending: ${chalk.yellow(stats.pending.toString())}`);
    console.log(`  Completed: ${chalk.green(stats.done.toString())}`);
    
    if (stats.total > 0) {
      const completionRate = Math.round((stats.done / stats.total) * 100);
      console.log(`  Completion Rate: ${completionRate >= 70 ? chalk.green : completionRate >= 40 ? chalk.yellow : chalk.red}${completionRate}%`);
    }
    
    console.log(chalk.white('\n🎯 By Priority:'));
    console.log(`  ${chalk.red('High')}: ${stats.highPriority}`);
    console.log(`  ${chalk.yellow('Medium')}: ${stats.mediumPriority}`);
    console.log(`  ${chalk.green('Low')}: ${stats.lowPriority}`);
    
    if (stats.overdue > 0) {
      console.log(chalk.white('\n⚠️  Attention:'));
      console.log(`  ${chalk.red('Overdue')}: ${stats.overdue}`);
    }
    
    console.log('');
    await waitForUser();
  } catch (err) {
    error(`Failed to get statistics: ${err instanceof Error ? err.message : 'Unknown error'}`);
    await waitForUser();
  }
}

/**
 * Edit TODO interactively
 */
async function editTodoInteractive(state: InteractiveState): Promise<void> {
  if (state.filteredTodos.length === 0) {
    warning('No TODOs available to edit');
    await waitForUser();
    return;
  }

  try {
    // Select TODO to edit
    const { todoId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'todoId',
        message: 'Select TODO to edit:',
        choices: state.filteredTodos.map(todo => ({
          name: `${todo.description} ${chalk.gray(`(${todo.priority})`)}`,
          value: todo.id
        }))
      }
    ]);

    const todo = state.filteredTodos.find(t => t.id === todoId);
    if (!todo) {
      error('TODO not found');
      return;
    }

    const updates = await promptEditTodo(todo);
    
    if (Object.keys(updates).length === 0) {
      info('No changes made');
      await waitForUser();
      return;
    }

    const spin = spinner('Updating TODO...');
    const updatedTodo = await updateTodo(todoId, updates);
    spin.succeed('TODO updated!');

    // Update local state
    const index = state.todos.findIndex(t => t.id === todoId);
    if (index !== -1) {
      state.todos[index] = updatedTodo;
    }
    await applyCurrentFilter(state);

    success('TODO updated successfully');
    await waitForUser();
  } catch (err) {
    error(`Failed to edit TODO: ${err instanceof Error ? err.message : 'Unknown error'}`);
    await waitForUser();
  }
}

/**
 * Mark TODO as done interactively
 */
async function markTodoAsDoneInteractive(state: InteractiveState): Promise<void> {
  const pendingTodos = state.filteredTodos.filter(todo => todo.status === 'pending');
  
  if (pendingTodos.length === 0) {
    warning('No pending TODOs to mark as done');
    await waitForUser();
    return;
  }

  try {
    const { todoId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'todoId',
        message: 'Select TODO to mark as done:',
        choices: pendingTodos.map(todo => ({
          name: formatTodo(todo),
          value: todo.id
        }))
      }
    ]);

    const spin = spinner('Marking as done...');
    const updatedTodo = await markTodoAsDone(todoId);
    spin.succeed('Marked as done!');

    // Update local state
    const index = state.todos.findIndex(t => t.id === todoId);
    if (index !== -1) {
      state.todos[index] = updatedTodo;
    }
    await applyCurrentFilter(state);

    success(`Completed: ${updatedTodo.description}`);
    await waitForUser();
  } catch (err) {
    error(`Failed to mark TODO as done: ${err instanceof Error ? err.message : 'Unknown error'}`);
    await waitForUser();
  }
}

/**
 * Delete TODO interactively
 */
async function deleteTodoInteractive(state: InteractiveState): Promise<void> {
  if (state.filteredTodos.length === 0) {
    warning('No TODOs available to delete');
    await waitForUser();
    return;
  }

  try {
    const { todoId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'todoId',
        message: 'Select TODO to delete:',
        choices: state.filteredTodos.map(todo => ({
          name: formatTodo(todo),
          value: todo.id
        }))
      }
    ]);

    const todo = state.filteredTodos.find(t => t.id === todoId);
    if (!todo) {
      error('TODO not found');
      return;
    }

    const confirmed = await confirmDelete(todo.description);
    if (!confirmed) {
      info('Delete cancelled');
      await waitForUser();
      return;
    }

    const spin = spinner('Deleting TODO...');
    await deleteTodo(todoId);
    spin.succeed('TODO deleted!');

    // Remove from local state
    state.todos = state.todos.filter(t => t.id !== todoId);
    await applyCurrentFilter(state);

    success(`Deleted: ${todo.description}`);
    await waitForUser();
  } catch (err) {
    error(`Failed to delete TODO: ${err instanceof Error ? err.message : 'Unknown error'}`);
    await waitForUser();
  }
}

/**
 * Batch operations on multiple TODOs
 */
async function batchOperations(state: InteractiveState): Promise<void> {
  if (state.filteredTodos.length === 0) {
    warning('No TODOs available for batch operations');
    await waitForUser();
    return;
  }

  try {
    const batchData = await promptBatchOperation(state.filteredTodos);
    
    const spin = spinner(`Performing ${batchData.action} on ${batchData.selectedIds.length} TODOs...`);
    
    for (const todoId of batchData.selectedIds) {
      switch (batchData.action) {
        case 'mark-done':
          await markTodoAsDone(todoId);
          break;
        case 'delete':
          await deleteTodo(todoId);
          break;
        case 'change-priority':
          await updateTodo(todoId, { priority: batchData.data.priority });
          break;
        case 'add-tags':
          const todo = await getTodoById(todoId);
          if (todo) {
            const newTags = [...new Set([...todo.tags, ...batchData.data.tags])];
            await updateTodo(todoId, { tags: newTags });
          }
          break;
        case 'remove-tags':
          const todoToUpdate = await getTodoById(todoId);
          if (todoToUpdate) {
            const filteredTags = todoToUpdate.tags.filter(tag => !batchData.data.tags.includes(tag));
            await updateTodo(todoId, { tags: filteredTags });
          }
          break;
      }
    }
    
    spin.succeed(`Batch operation completed!`);
    
    // Refresh data
    await refreshTodos(state);
    await applyCurrentFilter(state);
    
    success(`${batchData.action} applied to ${batchData.selectedIds.length} TODOs`);
    await waitForUser();
  } catch (err) {
    if (err instanceof Error && err.message.includes('cancelled')) {
      info(err.message);
    } else {
      error(`Batch operation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    await waitForUser();
  }
}

/**
 * Clear current filter
 */
async function clearFilter(state: InteractiveState): Promise<void> {
  state.filteredTodos = [...state.todos];
  state.selectedFilter = 'all';
  success('Filter cleared');
  await waitForUser();
}

/**
 * Filter TODOs interactively
 */
async function filterTodosInteractive(state: InteractiveState): Promise<void> {
  try {
    const { filterType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'filterType',
        message: 'Filter TODOs by:',
        choices: [
          { name: 'Status', value: 'status' },
          { name: 'Priority', value: 'priority' },
          { name: 'Tags', value: 'tags' },
          { name: 'Due Date', value: 'due' },
          { name: 'Clear all filters', value: 'clear' }
        ]
      }
    ]);

    if (filterType === 'clear') {
      await clearFilter(state);
      return;
    }

    // Apply filter based on type
    // Implementation would go here based on the filter type
    // For now, show a placeholder
    info(`Filter by ${filterType} will be implemented`);
    await waitForUser();
  } catch (err) {
    error(`Filter failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    await waitForUser();
  }
}

/**
 * Export TODOs
 */
async function exportTodos(): Promise<void> {
  info('Export functionality will be implemented');
  await waitForUser();
}

/**
 * Import TODOs
 */
async function importTodos(state: InteractiveState): Promise<void> {
  info('Import functionality will be implemented');
  await waitForUser();
}

/**
 * Clear all TODOs interactively
 */
async function clearAllTodosInteractive(state: InteractiveState): Promise<void> {
  if (state.todos.length === 0) {
    info('No TODOs to clear');
    await waitForUser();
    return;
  }

  try {
    const confirmed = await confirmClearAll(state.todos.length);
    if (!confirmed) {
      info('Clear cancelled');
      await waitForUser();
      return;
    }

    const spin = spinner('Clearing all TODOs...');
    await clearAllTodos();
    spin.succeed('All TODOs cleared!');

    // Clear local state
    state.todos = [];
    state.filteredTodos = [];

    warning('All TODOs have been cleared');
    await waitForUser();
  } catch (err) {
    error(`Failed to clear TODOs: ${err instanceof Error ? err.message : 'Unknown error'}`);
    await waitForUser();
  }
}

/**
 * Apply current filter to the todo list
 */
async function applyCurrentFilter(state: InteractiveState): Promise<void> {
  if (state.selectedFilter === 'all') {
    state.filteredTodos = [...state.todos];
  } else {
    // Re-apply the current filter
    // This is a simplified implementation
    state.filteredTodos = [...state.todos];
  }
}

/**
 * Wait for user input to continue
 */
async function waitForUser(): Promise<void> {
  await inquirer.prompt([
    {
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...'
    }
  ]);
}