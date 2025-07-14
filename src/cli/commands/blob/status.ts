/**
 * Status command - checks the status of a specific blob on Walrus network
 */

import { Command } from 'commander';
import { spinner, success, info, warning, error } from '../../ui';
import { logger } from '../../../utils/logger';
import { formatError as formatErrorUtil } from '../../../utils/errors';
import { BlobUtils } from '../../../models/blob';
import { createBlobManager } from '../shared/helpers';
import chalk from 'chalk';

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