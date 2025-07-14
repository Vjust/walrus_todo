/**
 * Delete command - Delete a TODO item
 */

import { Command } from 'commander';
import { success, error, info, spinner } from '../../ui';
import { confirmDelete } from '../../prompts/index';
import { logger } from '../../../utils/logger';
import { deleteTodo } from '../../../todos/operations';
import { formatError as formatErrorUtil } from '../../../utils/errors';

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