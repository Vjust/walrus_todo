/**
 * Stats command - Show TODO statistics
 */

import { Command } from 'commander';
import { error, info, success, warning, spinner } from '../../ui';
import { logger } from '../../../utils/logger';
import { getTodoStats } from '../../../todos/operations';
import { formatError as formatErrorUtil } from '../../../utils/errors';

/**
 * Show TODO statistics
 */
export function statsCommand(program: Command): void {
  program
    .command('stats')
    .description('Show TODO statistics')
    .option('--json', 'Output as JSON')
    .action(async (options: any) => {
      try {
        logger.debug('Getting TODO statistics');
        
        // Get statistics
        const stats = await getTodoStats();
        
        if (options.json) {
          console.log(JSON.stringify(stats, null, 2));
        } else {
          // Create a statistics table
          const statsTable = createTable({
            head: ['Metric', 'Count'],
            rows: [
              ['Total TODOs', stats.total.toString()],
              ['Pending', stats.pending.toString()],
              ['Completed', stats.done.toString()],
              ['High Priority', stats.highPriority.toString()],
              ['Medium Priority', stats.mediumPriority.toString()],
              ['Low Priority', stats.lowPriority.toString()],
              ['Overdue', stats.overdue.toString()],
            ],
          });
          
          console.log('\nTODO Statistics:');
          console.log(statsTable);
          
          // Add percentage information
          if (stats.total > 0) {
            const completionRate = ((stats.done / stats.total) * 100).toFixed(1);
            info(`\nCompletion rate: ${completionRate}%`);
            
            if (stats.overdue > 0) {
              info(`Warning: You have ${stats.overdue} overdue TODO(s)!`);
            }
          } else {
            info('\nNo TODOs found. Use "waltodo add" to create your first TODO!');
          }
        }
        
      } catch (err) {
        logger.error('Error getting TODO stats:', err);
        error(`Failed to get TODO statistics: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}