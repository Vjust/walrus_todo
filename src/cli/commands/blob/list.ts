/**
 * List command - lists all published TODO blobs
 */

import { Command } from 'commander';
import { spinner, info, error } from '../../ui';
import { logger } from '../../../utils/logger';
import { formatError as formatErrorUtil } from '../../../utils/errors';
import { BlobStatus, BlobUtils } from '../../../models/blob';
import { createBlobManager, createBlobTable } from '../shared/helpers';

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