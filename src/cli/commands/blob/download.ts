/**
 * Download and import TODOs from a specific blob
 */

import { Command } from 'commander';
import { success, error, warning, info, spinner, createTodoTable } from '../../ui';
import { logger } from '../../../utils/logger';
import { getTodos, clearAllTodos, deleteTodo } from '../../../todos/operations';
import { BlobUtils } from '../../../models/blob';
import { formatError as formatErrorUtil } from '../../../utils/errors';
import { createBlobManager, importTodo } from '../shared';

export function downloadBlobCommand(program: Command): void {
  program
    .command('download <blobId>')
    .description('Download and import TODOs from a specific blob')
    .option('--merge', 'Merge with existing TODOs instead of replacing')
    .option('--overwrite', 'Overwrite existing TODOs with same ID')
    .option('--dry-run', 'Show what would be imported without actually importing')
    .action(async (blobId: string, options: any) => {
      const spin = spinner('Downloading TODOs from blob...');
      
      try {
        logger.debug('Downloading TODOs from blob:', { blobId, options });
        
        const blobManager = await createBlobManager();
        
        // Download TODOs
        const todos = await blobManager.downloadTodos(blobId);
        
        spin.stop();
        
        if (options.dryRun) {
          info('Dry run mode - no changes will be made');
          console.log('');
          info(`Would import ${todos.length} TODOs:`);
          console.log(createTodoTable(todos));
          return;
        }
        
        success(`Downloaded ${todos.length} TODOs from blob ${BlobUtils.shortBlobId(blobId)}`);
        
        // Get current TODOs for merge logic
        const existingTodos = await getTodos();
        
        const importSpin = spinner('Importing TODOs...');
        
        let importedCount = 0;
        let skippedCount = 0;
        let overwrittenCount = 0;
        
        if (!options.merge) {
          // Replace all existing TODOs
          await clearAllTodos();
          for (const todo of todos) {
            await importTodo(todo);
            importedCount++;
          }
        } else {
          // Merge with existing TODOs
          const existingIds = new Set(existingTodos.map(t => t.id));
          
          for (const todo of todos) {
            if (existingIds.has(todo.id)) {
              if (options.overwrite) {
                await deleteTodo(todo.id);
                await importTodo(todo);
                overwrittenCount++;
              } else {
                skippedCount++;
              }
            } else {
              await importTodo(todo);
              importedCount++;
            }
          }
        }
        
        importSpin.stop();
        
        success('Import completed successfully!');
        info(`Imported: ${importedCount} TODOs`);
        if (overwrittenCount > 0) {
          info(`Overwritten: ${overwrittenCount} TODOs`);
        }
        if (skippedCount > 0) {
          info(`Skipped: ${skippedCount} TODOs`);
        }
        
      } catch (err) {
        spin.fail('Failed to download TODOs');
        logger.error('Error downloading TODOs:', err);
        error(`Failed to download TODOs: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}