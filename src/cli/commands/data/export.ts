/**
 * Export command for the Waltodo CLI
 * Handles exporting TODOs to JSON or CSV files
 */

import { Command } from 'commander';
import { success, error, info, warning, spinner } from '../../ui';
import { logger } from '../../../utils/logger';
import { formatError as formatErrorUtil } from '../../../utils/errors';
import { getTodos } from '../../../todos/operations';
import { promises as fs } from 'fs';
import path from 'path';

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
      const spin = spinner('Preparing TODOs for export...');
      
      try {
        logger.debug('Exporting TODOs:', { file, options });
        
        // Get TODOs with optional filtering
        const filter = options.includeDone ? undefined : { status: 'pending' };
        const todos = await getTodos(filter);
        
        if (todos.length === 0) {
          spin.stop();
          warning('No TODOs to export');
          return;
        }
        
        spin.text = 'Writing to file...';
        
        // Create export data with metadata
        const exportData = {
          metadata: {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            totalTodos: todos.length,
            exportSource: 'waltodo-cli'
          },
          todos: todos
        };
        
        let fileContent: string;
        
        if (options.format === 'csv') {
          // Convert to CSV format
          const headers = ['id', 'description', 'status', 'priority', 'tags', 'dueDate', 'createdAt', 'completedAt'];
          const csvRows = [headers.join(',')];
          
          for (const todo of todos) {
            const row = [
              todo.id,
              `"${todo.description.replace(/"/g, '""')}"`, // Escape quotes
              todo.status,
              todo.priority,
              todo.tags?.join(';') || '',
              todo.dueDate || '',
              todo.createdAt,
              todo.completedAt || ''
            ];
            csvRows.push(row.join(','));
          }
          
          fileContent = csvRows.join('\n');
        } else {
          // Default to JSON
          fileContent = JSON.stringify(exportData, null, 2);
        }
        
        // Ensure directory exists
        const dir = path.dirname(file);
        await fs.mkdir(dir, { recursive: true });
        
        // Write file
        await fs.writeFile(file, fileContent, 'utf8');
        
        spin.stop();
        success(`Exported ${todos.length} TODOs to ${file}`);
        info(`Format: ${options.format}`);
        if (options.includeDone) {
          info('Including completed TODOs');
        }
      } catch (err) {
        spin.fail('Failed to export TODOs');
        logger.error('Error exporting TODOs:', err);
        error(`Failed to export TODOs: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}