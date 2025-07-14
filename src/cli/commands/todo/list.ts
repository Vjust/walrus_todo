/**
 * List command - List all TODO items
 */

import { Command } from 'commander';
import { error, info, spinner, createTodoTable } from '../../ui';
import { logger } from '../../../utils/logger';
import { getTodos } from '../../../todos/operations';
import { formatError as formatErrorUtil } from '../../../utils/errors';

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