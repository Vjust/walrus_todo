/**
 * Publish command - publishes all TODOs to Walrus decentralized storage
 */

import { Command } from 'commander';
import { spinner, success, warning, info, error, formatPublishResult } from '../../ui';
import { logger } from '../../../utils/logger';
import { formatError as formatErrorUtil } from '../../../utils/errors';
import { getTodos } from '../../../todos/operations';
import { WalrusClient } from '../../../storage/walrus';
import { createBlobManager } from '../shared/helpers';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

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
          
          spin.text = 'Saving blob metadata...';
          
          // Track the blob in local database
          const blobManager = await createBlobManager();
          await blobManager.trackBlob(
            result.blobId,
            todos,
            parseInt(options.epochs) || 5,
            result.cost,
            result.size,
            options.deletable,
            `Published ${todos.length} TODOs at ${new Date().toISOString()}`,
            ['publish', 'todos']
          );
          
          spin.stop();
          
          // Display success information using the formatted output
          formatPublishResult({
            blobId: result.blobId,
            size: result.size,
            cost: result.cost,
            totalTodos: todos.length
          });
          
          info(`Blob metadata saved locally for fast discovery`);
          
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