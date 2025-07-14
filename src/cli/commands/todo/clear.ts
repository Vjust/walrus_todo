/**
 * Clear command - Clear all TODO items
 */

import { Command } from 'commander';
import { success, error, info, confirm } from '../../ui';
import { logger } from '../../../utils/logger';
import { clearAllTodos, getTodoStats } from '../../../todos/operations';
import { formatError as formatErrorUtil } from '../../../utils/errors';

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
        logger.debug('Clear command invoked', { force: options.force });
        
        // Get current stats before clearing
        const stats = await getTodoStats();
        
        if (stats.total === 0) {
          info('No TODOs to clear.');
          return;
        }
        
        // Confirm unless --force is used
        if (!options.force) {
          const shouldClear = await confirm(
            `Are you sure you want to delete all ${stats.total} TODO(s)? This cannot be undone.`
          );
          
          if (!shouldClear) {
            info('Clear operation cancelled.');
            return;
          }
        }
        
        // Clear all TODOs
        await clearAllTodos();
        
        success(`Successfully cleared ${stats.total} TODO(s).`);
        logger.info('All TODOs cleared', { count: stats.total });
        
      } catch (err) {
        logger.error('Error clearing TODOs:', err);
        error(`Failed to clear TODOs: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}