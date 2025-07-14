/**
 * Import command for the Waltodo CLI
 * Handles importing TODOs from JSON files
 */

import { Command } from 'commander';
import { success, error, info, warning, spinner, createTodoTable } from '../../ui';
import { logger } from '../../../utils/logger';
import { formatError as formatErrorUtil } from '../../../utils/errors';
import { getTodos, clearAllTodos, deleteTodo } from '../../../todos/operations';
import { Todo } from '../../../models/todo';
import { importTodo } from '../shared';
import { promises as fs } from 'fs';

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
      const spin = spinner('Reading import file...');
      
      try {
        logger.debug('Importing TODOs:', { file, options });
        
        // Read and parse file
        const fileContent = await fs.readFile(file, 'utf8');
        let importData: any;
        
        try {
          importData = JSON.parse(fileContent);
        } catch (parseError) {
          spin.fail('Invalid JSON file');
          throw new Error('The file does not contain valid JSON');
        }
        
        // Extract TODOs from various formats
        let todos: Todo[] = [];
        
        if (Array.isArray(importData)) {
          // Direct array of TODOs
          todos = importData;
        } else if (importData.todos && Array.isArray(importData.todos)) {
          // Export format with metadata
          todos = importData.todos;
        } else if (importData.data && Array.isArray(importData.data)) {
          // Alternative format
          todos = importData.data;
        } else {
          spin.fail('Invalid format');
          throw new Error('The file does not contain a valid TODO export format');
        }
        
        // Validate TODO structure
        if (todos.length === 0) {
          spin.stop();
          warning('No TODOs found in the import file');
          return;
        }
        
        // Basic validation of TODO structure
        const validTodos = todos.filter(todo => 
          todo && 
          typeof todo.description === 'string' && 
          todo.description.trim().length > 0
        );
        
        if (validTodos.length === 0) {
          spin.stop();
          error('No valid TODOs found in the import file');
          return;
        }
        
        spin.stop();
        
        if (options.dryRun) {
          info('Dry run mode - no changes will be made');
          console.log('');
          info(`Would import ${validTodos.length} TODOs:`);
          console.log(createTodoTable(validTodos));
          return;
        }
        
        // Get existing TODOs for merge logic
        const existingTodos = await getTodos();
        
        const importSpin = spinner('Importing TODOs...');
        
        let importedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        
        if (!options.merge) {
          // Replace all existing TODOs
          if (existingTodos.length > 0) {
            await clearAllTodos();
          }
          
          for (const todo of validTodos) {
            try {
              await importTodo(todo);
              importedCount++;
            } catch (importError) {
              logger.error(`Failed to import TODO: ${todo.description}`, importError);
              errorCount++;
            }
          }
        } else {
          // Merge with existing TODOs
          const existingIds = new Set(existingTodos.map(t => t.id));
          const existingDescriptions = new Set(existingTodos.map(t => t.description.toLowerCase()));
          
          for (const todo of validTodos) {
            try {
              // Skip if already exists (by ID or exact description match)
              if (todo.id && existingIds.has(todo.id)) {
                skippedCount++;
                continue;
              }
              
              if (existingDescriptions.has(todo.description.toLowerCase())) {
                skippedCount++;
                continue;
              }
              
              await importTodo(todo);
              importedCount++;
            } catch (importError) {
              logger.error(`Failed to import TODO: ${todo.description}`, importError);
              errorCount++;
            }
          }
        }
        
        importSpin.stop();
        
        // Show import results
        console.log('');
        success('Import completed!');
        console.log('');
        info(`Imported: ${importedCount} TODOs`);
        if (skippedCount > 0) {
          info(`Skipped: ${skippedCount} TODOs (already exist)`);
        }
        if (errorCount > 0) {
          warning(`Failed: ${errorCount} TODOs`);
        }
        
        if (options.merge) {
          info('Merged with existing TODOs');
        } else if (existingTodos.length > 0) {
          warning('Replaced existing TODOs');
        }
        
      } catch (err) {
        spin.fail('Failed to import TODOs');
        logger.error('Error importing TODOs:', err);
        error(`Failed to import TODOs: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}