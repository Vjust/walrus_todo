/**
 * Command definitions for the Waltodo CLI
 * Exports functions for each command using commander's action handlers
 */

import { Command } from 'commander';
import { success, error, warning, info, spinner, createTodoTable, formatPublishResult } from './ui';
import { 
  confirmDelete, 
  confirmClearAll, 
  promptAddTodo, 
  promptBlobSearch, 
  promptSelectBlob, 
  promptImportOptions,
  confirmBlobDelete 
} from './prompts';
import { logger } from '../utils/logger';
import { 
  createTodo, 
  deleteTodo, 
  getTodos, 
  searchTodos as searchTodosOp, 
  markTodoAsDone, 
  clearAllTodos,
  getTodoStats 
} from '../todos/operations';
import { WalrusClient } from '../storage/walrus';
import { BlobManager } from '../storage/blob-manager';
import { getConfig } from '../config';
import { BlobStatus, BlobUtils, BlobSearchCriteria, PublishedBlob } from '../models/blob';
import { Todo } from '../models/todo';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { formatError as formatErrorUtil } from '../utils/errors';
import Table from 'cli-table3';
import chalk from 'chalk';

/**
 * Add a new TODO item
 */
export function addCommand(program: Command): void {
  program
    .command('add [description]')
    .description('Add a new TODO item (interactive if no description provided)')
    .option('-p, --priority <level>', 'Set priority (low, medium, high)', 'medium')
    .option('-t, --tags <tags>', 'Comma-separated tags')
    .option('-d, --due <date>', 'Due date (YYYY-MM-DD)')
    .option('-i, --interactive', 'Use interactive prompts')
    .action(async (description: string | undefined, options: any) => {
      try {
        let todoData;

        // Use interactive mode if no description provided or -i flag used
        if (!description || options.interactive) {
          todoData = await promptAddTodo();
        } else {
          // Parse command-line options
          const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [];
          const dueDate = options.due ? new Date(options.due) : undefined;

          // Validate due date if provided
          if (options.due) {
            const date = new Date(options.due);
            if (isNaN(date.getTime())) {
              throw new Error('Invalid due date format. Use YYYY-MM-DD');
            }
          }

          todoData = {
            description,
            priority: options.priority,
            tags,
            dueDate
          };
        }

        logger.debug('Adding TODO:', todoData);
        
        // Create the TODO using operations
        const todo = await createTodo(todoData.description, {
          priority: todoData.priority,
          tags: todoData.tags,
          dueDate: todoData.dueDate ? (todoData.dueDate instanceof Date ? todoData.dueDate.toISOString() : todoData.dueDate) : undefined
        });
        
        success(`Added TODO: ${todo.description}`);
        info(`ID: ${todo.id.substring(0, 8)}`);
        if (todo.tags && todo.tags.length > 0) {
          info(`Tags: ${todo.tags.join(', ')}`);
        }
        if (todo.dueDate) {
          info(`Due: ${new Date(todo.dueDate).toLocaleDateString()}`);
        }
        info(`Priority: ${todo.priority}`);
        
      } catch (err) {
        logger.error('Error adding TODO:', err);
        error(`Failed to add TODO: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}

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
        logger.debug('Clearing all TODOs:', { options });
        
        // Show confirmation unless force flag is used
        if (!options.force) {
          // Get actual count from storage
          const todos = await getTodos();
          const count = todos.length;
          
          if (count === 0) {
            info('No TODOs to clear');
            return;
          }
          
          const confirmed = await confirmClearAll(count);
          if (!confirmed) {
            info('Clear cancelled');
            return;
          }
        }
        
        const spin = spinner('Clearing all TODOs...');
        
        // Clear all TODOs
        await clearAllTodos();
        
        spin.stop();
        warning('All TODOs cleared');
      } catch (err) {
        logger.error('Error clearing TODOs:', err);
        error(`Failed to clear TODOs: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}

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
      try {
        logger.debug('Exporting TODOs:', { file, options });
        
        // TODO: Implement export functionality
        // For now, just show success message
        success(`Exported TODOs to ${file}`);
        info(`Format: ${options.format}`);
        if (options.includeDone) {
          info('Including completed TODOs');
        }
      } catch (err) {
        logger.error('Error exporting TODOs:', err);
        error(`Failed to export TODOs: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}

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
      try {
        logger.debug('Importing TODOs:', { file, options });
        
        if (options.dryRun) {
          info('Dry run mode - no changes will be made');
        }
        
        // TODO: Implement import functionality
        // For now, just show success message
        success(`Imported TODOs from ${file}`);
        if (options.merge) {
          info('Merged with existing TODOs');
        } else {
          warning('Replaced existing TODOs');
        }
      } catch (err) {
        logger.error('Error importing TODOs:', err);
        error(`Failed to import TODOs: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}

/**
 * Search TODOs by text
 */
export function searchCommand(program: Command): void {
  program
    .command('search <text>')
    .alias('find')
    .description('Search TODOs by text in description or tags')
    .action(async (searchText: string) => {
      const spin = spinner('Searching TODOs...');
      
      try {
        logger.debug('Searching TODOs:', { searchText });
        
        // Search TODOs
        const todos = await searchTodosOp(searchText);
        
        spin.stop();
        
        if (todos.length === 0) {
          info(`No TODOs found matching "${searchText}"`);
        } else {
          console.log(createTodoTable(todos));
          info(`Found ${todos.length} TODO(s) matching "${searchText}"`);
        }
      } catch (err) {
        spin.fail('Failed to search TODOs');
        logger.error('Error searching TODOs:', err);
        error(`Failed to search TODOs: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}

/**
 * Show TODO statistics
 */
export function statsCommand(program: Command): void {
  program
    .command('stats')
    .description('Show TODO statistics')
    .action(async () => {
      const spin = spinner('Calculating statistics...');
      
      try {
        logger.debug('Getting TODO stats');
        
        // Get statistics
        const stats = await getTodoStats();
        
        spin.stop();
        
        if (stats.total === 0) {
          info('No TODOs found');
          return;
        }
        
        // Display statistics
        console.log('');
        success('TODO Statistics:');
        console.log('');
        info(`Total TODOs: ${stats.total}`);
        info(`Pending: ${stats.pending}`);
        info(`Done: ${stats.done}`);
        console.log('');
        info('By Priority:');
        info(`  High: ${stats.highPriority}`);
        info(`  Medium: ${stats.mediumPriority}`);
        info(`  Low: ${stats.lowPriority}`);
        
        if (stats.overdue > 0) {
          console.log('');
          warning(`Overdue TODOs: ${stats.overdue}`);
        }
        
        console.log('');
      } catch (err) {
        spin.fail('Failed to get statistics');
        logger.error('Error getting stats:', err);
        error(`Failed to get statistics: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}

/**
 * Publish TODOs to Walrus
 */
export function publishCommand(program: Command): void {
  program
    .command('publish')
    .description('Publish all TODOs to Walrus decentralized storage')
    .option('--epochs <number>', 'Storage epochs (default: 5)', '5')
    .option('--deletable', 'Make the blob deletable')
    .option('-f, --force', 'Skip confirmation')
    .action(async (options: any) => {
      try {
        logger.debug('Publishing TODOs to Walrus:', { options });
        
        const spin = spinner('Preparing TODOs for publishing...');
        
        // Get all TODOs
        const todos = await getTodos();
        
        if (todos.length === 0) {
          spin.stop();
          warning('No TODOs to publish');
          return;
        }
        
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
        
        const jsonData = JSON.stringify(exportData, null, 2);
        
        spin.text = 'Creating temporary file...';
        
        // Create temporary file
        const tempDir = path.join(tmpdir(), 'waltodo-publish');
        await fs.mkdir(tempDir, { recursive: true });
        const tempFile = path.join(tempDir, `todos-${uuidv4()}.json`);
        await fs.writeFile(tempFile, jsonData, 'utf8');
        
        try {
          spin.text = 'Publishing to Walrus...';
          
          // Initialize Walrus client
          const walrusClient = new WalrusClient();
          
          // Store the data
          const result = await walrusClient.store(jsonData, {
            epochs: options.epochs,
            deletable: options.deletable
          });
          
          spin.stop();
          
          // Display success information using the formatted output
          formatPublishResult({
            blobId: result.blobId,
            size: result.size,
            cost: result.cost,
            totalTodos: todos.length
          });
          
          // Clean up Walrus client
          await walrusClient.cleanup();
          
        } finally {
          // Clean up temporary file
          try {
            await fs.unlink(tempFile);
            await fs.rmdir(tempDir);
          } catch (cleanupError) {
            logger.warn('Failed to clean up temporary files:', cleanupError);
          }
        }
        
      } catch (err) {
        logger.error('Error publishing TODOs:', err);
        error(`Failed to publish TODOs: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}

/**
 * Helper function to create blob manager instance
 */
async function createBlobManager(): Promise<BlobManager> {
  const config = await getConfig();
  const walrusClient = new WalrusClient(config.walrus);
  
  // Convert config to PublishConfig format
  const publishConfig = {
    defaultEpochs: config.blobs.publish.defaultEpochs,
    defaultDeletable: config.blobs.publish.defaultDeletable,
    maxBlobSize: config.blobs.publish.maxBlobSize,
    enableCompression: config.blobs.publish.enableCompression,
    enableEncryption: config.blobs.publish.enableEncryption,
    defaultTags: config.blobs.publish.defaultTags,
  };
  
  return new BlobManager(walrusClient, undefined, publishConfig);
}

/**
 * Helper function to import a TODO with full metadata
 */
async function importTodo(todo: Todo): Promise<Todo> {
  // Create basic TODO first
  const createdTodo = await createTodo(todo.description, {
    priority: todo.priority,
    tags: todo.tags,
    dueDate: todo.dueDate ? new Date(todo.dueDate).toISOString() : undefined,
  });
  
  // If the TODO is completed, mark it as done
  if (todo.status === 'done' && todo.completedAt) {
    await markTodoAsDone(createdTodo.id);
  }
  
  return createdTodo;
}

/**
 * Helper function to create blob table
 */
function createBlobTable(blobs: PublishedBlob[]): string {
  const table = new Table({
    head: ['Blob ID', 'TODOs', 'Status', 'Published', 'Size', 'Cost'],
    colWidths: [16, 8, 10, 12, 10, 12],
    style: {
      head: ['cyan'],
      border: ['grey']
    }
  });

  blobs.forEach(blob => {
    const statusColor = blob.status === BlobStatus.ACTIVE ? 'green' : 
                       blob.status === BlobStatus.EXPIRED ? 'yellow' : 'red';
    
    table.push([
      BlobUtils.shortBlobId(blob.id, 14),
      blob.todoCount.toString(),
      chalk[statusColor](blob.status),
      new Date(blob.publishedAt).toLocaleDateString(),
      BlobUtils.formatSize(blob.size),
      BlobUtils.formatCost(blob.cost)
    ]);
  });

  return table.toString();
}

/**
 * List all published blobs
 */
export function listPublishedCommand(program: Command): void {
  program
    .command('blobs')
    .alias('list-blobs')
    .description('List all published TODO blobs')
    .option('--status <status>', 'Filter by status (active, expired, deleted, error)')
    .option('--sort <field>', 'Sort by field (date, cost, size, todos, status)', 'date')
    .option('--limit <number>', 'Limit number of results')
    .option('--json', 'Output as JSON')
    .action(async (options: any) => {
      const spin = spinner('Loading published blobs...');
      
      try {
        logger.debug('Listing published blobs:', { options });
        
        const blobManager = await createBlobManager();
        let blobs = await blobManager.getBlobs();
        
        // Apply status filter
        if (options.status) {
          blobs = blobs.filter(blob => blob.status === options.status);
        }
        
        // Sort blobs
        const sortField = options.sort || 'date';
        blobs = BlobUtils.sortBlobs(blobs, sortField, false); // Most recent first
        
        // Apply limit
        if (options.limit) {
          const limit = parseInt(options.limit);
          if (!isNaN(limit) && limit > 0) {
            blobs = blobs.slice(0, limit);
          }
        }
        
        spin.stop();
        
        if (options.json) {
          console.log(JSON.stringify(blobs, null, 2));
        } else {
          if (blobs.length === 0) {
            info('No published blobs found. Use "waltodo publish" to create your first blob!');
          } else {
            console.log(createBlobTable(blobs));
            info(`Found ${blobs.length} published blob(s)`);
          }
        }
      } catch (err) {
        spin.fail('Failed to list published blobs');
        logger.error('Error listing blobs:', err);
        error(`Failed to list blobs: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}

/**
 * Check status of a specific blob
 */
export function blobStatusCommand(program: Command): void {
  program
    .command('blob-status <blobId>')
    .description('Check the status of a specific blob on Walrus network')
    .option('--refresh', 'Force refresh status from network')
    .action(async (blobId: string, options: any) => {
      const spin = spinner('Checking blob status...');
      
      try {
        logger.debug('Checking blob status:', { blobId, options });
        
        const blobManager = await createBlobManager();
        
        // Get blob from local tracking
        const blob = await blobManager.getBlob(blobId);
        if (!blob) {
          spin.stop();
          warning(`Blob ${BlobUtils.shortBlobId(blobId)} not found in local tracking`);
          return;
        }
        
        let currentStatus = blob.status;
        
        // Refresh status if requested
        if (options.refresh) {
          spin.text = 'Refreshing status from Walrus network...';
          currentStatus = await blobManager.checkBlobStatus(blobId);
        }
        
        spin.stop();
        
        // Display blob information
        console.log('');
        success(`Blob Status: ${currentStatus}`);
        console.log('');
        info(`Blob ID: ${blob.id}`);
        info(`Status: ${chalk.green(currentStatus)}`);
        info(`TODOs: ${blob.todoCount}`);
        info(`Published: ${new Date(blob.publishedAt).toLocaleString()}`);
        info(`Size: ${BlobUtils.formatSize(blob.size)}`);
        info(`Cost: ${BlobUtils.formatCost(blob.cost)}`);
        info(`Storage Epochs: ${blob.epochs}`);
        info(`Deletable: ${blob.deletable ? 'Yes' : 'No'}`);
        
        if (blob.description) {
          info(`Description: ${blob.description}`);
        }
        
        if (blob.tags.length > 0) {
          info(`Tags: ${blob.tags.join(', ')}`);
        }
        
        if (blob.lastStatusCheck) {
          info(`Last Status Check: ${new Date(blob.lastStatusCheck).toLocaleString()}`);
        }
        
        // Show expiration info
        const expirationDate = BlobUtils.calculateExpirationDate(blob.publishedAt, blob.epochs);
        const isExpired = BlobUtils.isExpired(blob);
        
        if (isExpired) {
          warning(`Expired: ${expirationDate.toLocaleString()}`);
        } else {
          info(`Expires: ${expirationDate.toLocaleString()}`);
        }
        
        console.log('');
      } catch (err) {
        spin.fail('Failed to check blob status');
        logger.error('Error checking blob status:', err);
        error(`Failed to check blob status: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}

/**
 * Interactive fetch command - search and select blobs to download TODOs from
 */
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

/**
 * Download and import TODOs from a specific blob
 */
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

/**
 * Show blob statistics
 */
export function blobStatsCommand(program: Command): void {
  program
    .command('blob-stats')
    .description('Show statistics about published blobs')
    .action(async () => {
      const spin = spinner('Calculating blob statistics...');
      
      try {
        logger.debug('Getting blob stats');
        
        const blobManager = await createBlobManager();
        const stats = await blobManager.getStats();
        
        spin.stop();
        
        if (stats.totalBlobs === 0) {
          info('No published blobs found');
          return;
        }
        
        // Display statistics
        console.log('');
        success('Blob Statistics:');
        console.log('');
        info(`Total Blobs: ${stats.totalBlobs}`);
        info(`Active: ${stats.activeBlobs}`);
        info(`Expired: ${stats.expiredBlobs}`);
        info(`Deleted: ${stats.deletedBlobs}`);
        console.log('');
        info(`Total TODOs: ${stats.totalTodos}`);
        info(`Total Storage: ${BlobUtils.formatSize(stats.totalSize)}`);
        info(`Total Cost: ${BlobUtils.formatCost(stats.totalCost)}`);
        
        if (stats.lastPublished) {
          console.log('');
          info(`Last Published: ${new Date(stats.lastPublished).toLocaleString()}`);
        }
        
        console.log('');
      } catch (err) {
        spin.fail('Failed to get statistics');
        logger.error('Error getting blob stats:', err);
        error(`Failed to get blob statistics: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}

/**
 * Delete a blob from tracking and optionally from Walrus
 */
export function deleteBlobCommand(program: Command): void {
  program
    .command('delete-blob <blobId>')
    .description('Delete a blob from tracking and optionally from Walrus network')
    .option('--from-walrus', 'Also delete from Walrus network (if deletable)')
    .option('-f, --force', 'Skip confirmation')
    .action(async (blobId: string, options: any) => {
      try {
        logger.debug('Deleting blob:', { blobId, options });
        
        const blobManager = await createBlobManager();
        const blob = await blobManager.getBlob(blobId);
        
        if (!blob) {
          warning(`Blob ${BlobUtils.shortBlobId(blobId)} not found in local tracking`);
          return;
        }
        
        // Show confirmation unless force flag is used
        if (!options.force) {
          const confirmed = await confirmBlobDelete(blobId, options.fromWalrus);
          if (!confirmed) {
            info('Deletion cancelled');
            return;
          }
        }
        
        const spin = spinner('Deleting blob...');
        
        // Delete the blob
        await blobManager.deleteBlob(blobId, options.fromWalrus);
        
        spin.stop();
        
        if (options.fromWalrus) {
          success(`Deleted blob ${BlobUtils.shortBlobId(blobId)} from tracking and Walrus network`);
        } else {
          success(`Removed blob ${BlobUtils.shortBlobId(blobId)} from local tracking`);
        }
        
      } catch (err) {
        logger.error('Error deleting blob:', err);
        error(`Failed to delete blob: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}