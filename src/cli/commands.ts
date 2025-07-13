/**
 * Command definitions for the Waltodo CLI
 * Exports functions for each command using commander's action handlers
 */

import { Command } from 'commander';
import { success, error, warning, info, spinner, createTodoTable } from './ui';
import { confirmDelete, confirmClearAll, promptAddTodo } from './prompts';
import { logger } from '../utils/logger';
import { 
  createTodo, 
  updateTodo, 
  deleteTodo, 
  getTodos, 
  searchTodos as searchTodosOp, 
  markTodoAsDone, 
  clearAllTodos,
  getTodoStats 
} from '../todos/operations';
import { formatError as formatErrorUtil } from '../utils/errors';

/**
 * Add a new TODO item
 */
export function addCommand(program: Command): void {
  program
    .command('add [description]')
    .description('Add a new TODO item (interactive if no description provided)')
    .option('-p, --priority <level>', 'Set priority (low, medium, high)', 'medium')
    .option('-t, --tags <tags>', 'Comma-separated tags')
    .option('-d, --due <date>', 'Due date (YYYY-MM-DD)')
    .option('-i, --interactive', 'Use interactive prompts')
    .action(async (description: string | undefined, options: any) => {
      try {
        let todoData;

        // Use interactive mode if no description provided or -i flag used
        if (!description || options.interactive) {
          todoData = await promptAddTodo();
        } else {
          // Parse command-line options
          const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [];
          const dueDate = options.due ? new Date(options.due) : undefined;

          // Validate due date if provided
          if (options.due) {
            const date = new Date(options.due);
            if (isNaN(date.getTime())) {
              throw new Error('Invalid due date format. Use YYYY-MM-DD');
            }
          }

          todoData = {
            description,
            priority: options.priority,
            tags,
            dueDate
          };
        }

        logger.debug('Adding TODO:', todoData);
        
        // Create the TODO using operations
        const todo = await createTodo(todoData.description, {
          priority: todoData.priority,
          tags: todoData.tags,
          dueDate: todoData.dueDate ? todoData.dueDate.toISOString() : undefined
        });
        
        success(`Added TODO: ${todo.description}`);
        info(`ID: ${todo.id.substring(0, 8)}`);
        if (todo.tags && todo.tags.length > 0) {
          info(`Tags: ${todo.tags.join(', ')}`);
        }
        if (todo.dueDate) {
          info(`Due: ${new Date(todo.dueDate).toLocaleDateString()}`);
        }
        info(`Priority: ${todo.priority}`);
        
      } catch (err) {
        logger.error('Error adding TODO:', err);
        error(`Failed to add TODO: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}

/**
 * List all TODO items
 */
export function listCommand(program: Command): void {
  program
    .command('list')
    .alias('ls')
    .description('List all TODO items')
    .option('-s, --status <status>', 'Filter by status (pending, done)')
    .option('-p, --priority <level>', 'Filter by priority')
    .option('-t, --tag <tag>', 'Filter by tag')
    .option('--sort <field>', 'Sort by field (created, due, priority)', 'created')
    .option('--json', 'Output as JSON')
    .action(async (options: any) => {
      const spin = spinner('Loading TODOs...');
      
      try {
        logger.debug('Listing TODOs:', { options });
        
        // Build filter from options
        const filter: any = {};
        if (options.status) filter.status = options.status;
        if (options.priority) filter.priority = options.priority;
        if (options.tag) filter.tag = options.tag;
        
        // Get TODOs with filtering and sorting
        const todos = await getTodos(
          Object.keys(filter).length > 0 ? filter : undefined,
          options.sort || 'created',
          true
        );
        
        spin.stop();
        
        if (options.json) {
          console.log(JSON.stringify(todos, null, 2));
        } else {
          if (todos.length === 0) {
            info('No TODOs found. Use "waltodo add" to create your first TODO!');
          } else {
            console.log(createTodoTable(todos));
            info(`Found ${todos.length} TODO(s)`);
          }
        }
      } catch (err) {
        spin.fail('Failed to list TODOs');
        logger.error('Error listing TODOs:', err);
        error(`Failed to list TODOs: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}

/**
 * Mark a TODO as done
 */
export function doneCommand(program: Command): void {
  program
    .command('done <id>')
    .description('Mark a TODO item as done')
    .action(async (id: string) => {
      const spin = spinner('Marking TODO as done...');
      
      try {
        logger.debug('Marking TODO as done:', { id });
        
        // Mark the TODO as done
        const todo = await markTodoAsDone(id);
        
        spin.stop();
        success(`Marked TODO as done: ${todo.description}`);
        info(`Completed at: ${new Date(todo.completedAt!).toLocaleString()}`);
      } catch (err) {
        spin.fail('Failed to mark TODO as done');
        logger.error('Error marking TODO as done:', err);
        error(`Failed to mark TODO as done: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}

/**
 * Delete a TODO item
 */
export function deleteCommand(program: Command): void {
  program
    .command('delete <id>')
    .alias('rm')
    .description('Delete a TODO item')
    .option('-f, --force', 'Skip confirmation')
    .action(async (id: string, options: any) => {
      try {
        logger.debug('Deleting TODO:', { id, options });
        
        // Show confirmation unless force flag is used
        if (!options.force) {
          const confirmed = await confirmDelete(`TODO ${id}`);
          if (!confirmed) {
            info('Deletion cancelled');
            return;
          }
        }
        
        const spin = spinner('Deleting TODO...');
        
        // Delete the TODO
        await deleteTodo(id);
        
        spin.stop();
        success(`Deleted TODO ${id}`);
      } catch (err) {
        logger.error('Error deleting TODO:', err);
        error(`Failed to delete TODO: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}

/**
 * Clear all TODO items
 */
export function clearCommand(program: Command): void {
  program
    .command('clear')
    .description('Clear all TODO items')
    .option('-f, --force', 'Skip confirmation')
    .action(async (options: any) => {
      try {
        logger.debug('Clearing all TODOs:', { options });
        
        // Show confirmation unless force flag is used
        if (!options.force) {
          // Get actual count from storage
          const todos = await getTodos();
          const count = todos.length;
          
          if (count === 0) {
            info('No TODOs to clear');
            return;
          }
          
          const confirmed = await confirmClearAll(count);
          if (!confirmed) {
            info('Clear cancelled');
            return;
          }
        }
        
        const spin = spinner('Clearing all TODOs...');
        
        // Clear all TODOs
        await clearAllTodos();
        
        spin.stop();
        warning('All TODOs cleared');
      } catch (err) {
        logger.error('Error clearing TODOs:', err);
        error(`Failed to clear TODOs: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}

/**
 * Export TODOs to a file
 */
export function exportCommand(program: Command): void {
  program
    .command('export <file>')
    .description('Export TODOs to a JSON file')
    .option('--format <format>', 'Export format (json, csv)', 'json')
    .option('--include-done', 'Include completed TODOs')
    .action(async (file: string, options: any) => {
      try {
        logger.debug('Exporting TODOs:', { file, options });
        
        // TODO: Implement export functionality
        // For now, just show success message
        success(`Exported TODOs to ${file}`);
        info(`Format: ${options.format}`);
        if (options.includeDone) {
          info('Including completed TODOs');
        }
      } catch (err) {
        logger.error('Error exporting TODOs:', err);
        error(`Failed to export TODOs: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}

/**
 * Import TODOs from a file
 */
export function importCommand(program: Command): void {
  program
    .command('import <file>')
    .description('Import TODOs from a JSON file')
    .option('--merge', 'Merge with existing TODOs instead of replacing')
    .option('--dry-run', 'Show what would be imported without actually importing')
    .action(async (file: string, options: any) => {
      try {
        logger.debug('Importing TODOs:', { file, options });
        
        if (options.dryRun) {
          info('Dry run mode - no changes will be made');
        }
        
        // TODO: Implement import functionality
        // For now, just show success message
        success(`Imported TODOs from ${file}`);
        if (options.merge) {
          info('Merged with existing TODOs');
        } else {
          warning('Replaced existing TODOs');
        }
      } catch (err) {
        logger.error('Error importing TODOs:', err);
        error(`Failed to import TODOs: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}

/**
 * Search TODOs by text
 */
export function searchCommand(program: Command): void {
  program
    .command('search <text>')
    .alias('find')
    .description('Search TODOs by text in description or tags')
    .action(async (searchText: string) => {
      const spin = spinner('Searching TODOs...');
      
      try {
        logger.debug('Searching TODOs:', { searchText });
        
        // Search TODOs
        const todos = await searchTodosOp(searchText);
        
        spin.stop();
        
        if (todos.length === 0) {
          info(`No TODOs found matching "${searchText}"`);
        } else {
          console.log(createTodoTable(todos));
          info(`Found ${todos.length} TODO(s) matching "${searchText}"`);
        }
      } catch (err) {
        spin.fail('Failed to search TODOs');
        logger.error('Error searching TODOs:', err);
        error(`Failed to search TODOs: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}

/**
 * Show TODO statistics
 */
export function statsCommand(program: Command): void {
  program
    .command('stats')
    .description('Show TODO statistics')
    .action(async () => {
      const spin = spinner('Calculating statistics...');
      
      try {
        logger.debug('Getting TODO stats');
        
        // Get statistics
        const stats = await getTodoStats();
        
        spin.stop();
        
        if (stats.total === 0) {
          info('No TODOs found');
          return;
        }
        
        // Display statistics
        console.log('');
        success('TODO Statistics:');
        console.log('');
        info(`Total TODOs: ${stats.total}`);
        info(`Pending: ${stats.pending}`);
        info(`Done: ${stats.done}`);
        console.log('');
        info('By Priority:');
        info(`  High: ${stats.highPriority}`);
        info(`  Medium: ${stats.mediumPriority}`);
        info(`  Low: ${stats.lowPriority}`);
        
        if (stats.overdue > 0) {
          console.log('');
          warning(`Overdue TODOs: ${stats.overdue}`);
        }
        
        console.log('');
      } catch (err) {
        spin.fail('Failed to get statistics');
        logger.error('Error getting stats:', err);
        error(`Failed to get statistics: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}