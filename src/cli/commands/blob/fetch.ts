/**
 * Interactive fetch command - search and select blobs to download TODOs from
 */

import { Command } from 'commander';
import { success, error, warning, info, spinner } from '../../ui';
import { promptBlobSearch, promptSelectBlob, promptImportOptions } from '../../prompts/index';
import { logger } from '../../../utils/logger';
import { getTodos, clearAllTodos, deleteTodo } from '../../../todos/operations';
import { BlobStatus, BlobUtils, BlobSearchCriteria } from '../../../models/blob';
import { formatError as formatErrorUtil } from '../../../utils/errors';
import { createBlobManager, importTodo } from '../shared';

export function fetchCommand(program: Command): void {
  program
    .command('fetch')
    .description('Interactively search and fetch TODOs from published blobs on Walrus')
    .option('--merge', 'Merge with existing TODOs instead of replacing')
    .option('--blob-id <id>', 'Directly fetch from specific blob ID')
    .action(async (options: any) => {
      try {
        logger.debug('Starting interactive fetch:', { options });
        
        const blobManager = await createBlobManager();
        let selectedBlobId: string;
        
        if (options.blobId) {
          // Direct fetch by blob ID
          selectedBlobId = options.blobId;
        } else {
          // Interactive search and selection
          const spin = spinner('Searching for published blobs...');
          
          try {
            // Get search criteria from user
            spin.stop();
            info('Search for TODOs published on Walrus network');
            console.log('');
            
            const searchCriteria = await promptBlobSearch();
            
            const searchSpin = spinner('Searching blobs...');
            
            // Convert prompt criteria to blob search criteria
            const blobCriteria: BlobSearchCriteria = {};
            
            if (searchCriteria.searchTerm) {
              blobCriteria.descriptionSearch = searchCriteria.searchTerm;
            }
            if (searchCriteria.status) {
              blobCriteria.status = searchCriteria.status as BlobStatus;
            }
            if (searchCriteria.tags) {
              blobCriteria.tags = searchCriteria.tags;
            }
            if (searchCriteria.minTodos !== undefined) {
              blobCriteria.minTodoCount = searchCriteria.minTodos;
            }
            if (searchCriteria.maxTodos !== undefined) {
              blobCriteria.maxTodoCount = searchCriteria.maxTodos;
            }
            
            // Search for blobs
            const searchResult = await blobManager.searchBlobs(blobCriteria);
            
            searchSpin.stop();
            
            if (searchResult.blobs.length === 0) {
              warning('No blobs found matching your search criteria');
              return;
            }
            
            console.log('');
            info(`Found ${searchResult.totalMatches} matching blob(s):`);
            console.log('');
            
            // Let user select a blob
            const selected = await promptSelectBlob(searchResult.blobs);
            
            if (!selected) {
              info('Fetch cancelled');
              return;
            }
            
            selectedBlobId = selected;
          } catch (searchError) {
            spin.stop();
            throw searchError;
          }
        }
        
        // Download and import TODOs from selected blob
        const downloadSpin = spinner(`Downloading TODOs from blob ${BlobUtils.shortBlobId(selectedBlobId)}...`);
        
        try {
          // Download TODOs
          const downloadedTodos = await blobManager.downloadTodos(selectedBlobId);
          
          downloadSpin.stop();
          
          success(`Downloaded ${downloadedTodos.length} TODOs from blob`);
          
          // Get current TODOs count for import options
          const existingTodos = await getTodos();
          
          // Get import preferences
          const importOptions = await promptImportOptions(existingTodos.length);
          
          const importSpin = spinner('Importing TODOs...');
          
          // Import logic
          let importedCount = 0;
          let skippedCount = 0;
          let overwrittenCount = 0;
          
          if (!importOptions.merge) {
            // Replace all existing TODOs
            await clearAllTodos();
            for (const todo of downloadedTodos) {
              await importTodo(todo);
              importedCount++;
            }
          } else {
            // Merge with existing TODOs
            const existingIds = new Set(existingTodos.map(t => t.id));
            
            for (const todo of downloadedTodos) {
              if (existingIds.has(todo.id)) {
                if (importOptions.overwriteExisting) {
                  // Update existing TODO
                  await deleteTodo(todo.id);
                  await importTodo(todo);
                  overwrittenCount++;
                } else {
                  skippedCount++;
                }
              } else {
                // Add new TODO
                await importTodo(todo);
                importedCount++;
              }
            }
          }
          
          importSpin.stop();
          
          // Show import results
          console.log('');
          success('Import completed successfully!');
          console.log('');
          info(`Imported: ${importedCount} TODOs`);
          if (overwrittenCount > 0) {
            info(`Overwritten: ${overwrittenCount} TODOs`);
          }
          if (skippedCount > 0) {
            info(`Skipped: ${skippedCount} TODOs (already exist)`);
          }
          console.log('');
          
        } catch (downloadError) {
          downloadSpin.fail('Failed to download TODOs');
          throw downloadError;
        }
        
      } catch (err) {
        logger.error('Error fetching TODOs:', err);
        error(`Failed to fetch TODOs: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}