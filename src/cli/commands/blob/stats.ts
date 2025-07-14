/**
 * Blob statistics command - shows aggregate information about published blobs
 */

import { Command } from 'commander';
import { info, success, error, spinner } from '../../ui';
import { logger } from '../../../utils/logger';
import { BlobUtils } from '../../../models/blob';
import { formatError as formatErrorUtil } from '../../../utils/errors';
import { createBlobManager } from '../shared';

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