/**
 * Add command - Add a new TODO item
 */

import { Command } from 'commander';
import { success, error, info } from '../../ui';
import { promptAddTodo } from '../../prompts/index';
import { logger } from '../../../utils/logger';
import { createTodo } from '../../../todos/operations';
import { formatError as formatErrorUtil } from '../../../utils/errors';

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
          dueDate: todoData.dueDate ? (todoData.dueDate instanceof Date ? todoData.dueDate.toISOString() : todoData.dueDate) : undefined
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