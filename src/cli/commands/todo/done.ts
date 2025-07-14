/**
 * Done command - Mark a TODO as done
 */

import { Command } from 'commander';
import { success, error, info, spinner } from '../../ui';
import { logger } from '../../../utils/logger';
import { markTodoAsDone } from '../../../todos/operations';
import { formatError as formatErrorUtil } from '../../../utils/errors';

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