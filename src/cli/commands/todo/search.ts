/**
 * Search command - Search TODOs by text in description or tags
 */

import { Command } from 'commander';
import { error, info, createTodoTable } from '../../ui';
import { logger } from '../../../utils/logger';
import { searchTodos } from '../../../todos/operations';
import { formatError as formatErrorUtil } from '../../../utils/errors';

/**
 * Search TODOs by text
 */
export function searchCommand(program: Command): void {
  program
    .command('search <text>')
    .alias('find')
    .description('Search TODOs by text in description or tags')
    .option('--json', 'Output as JSON')
    .action(async (searchText: string, options: any) => {
      try {
        logger.debug('Searching TODOs', { searchText });
        
        // Search for TODOs
        const todos = await searchTodos(searchText);
        
        if (options.json) {
          console.log(JSON.stringify(todos, null, 2));
        } else {
          if (todos.length === 0) {
            info(`No TODOs found matching "${searchText}"`);
          } else {
            console.log(createTodoTable(todos));
            info(`Found ${todos.length} TODO(s) matching "${searchText}"`);
          }
        }
        
      } catch (err) {
        logger.error('Error searching TODOs:', err);
        error(`Failed to search TODOs: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}