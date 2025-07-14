/**
 * Delete blob command - removes a blob from tracking and optionally from Walrus network
 */

import { Command } from 'commander';
import { warning, info, success, error, spinner } from '../../ui';
import { confirmBlobDelete } from '../../prompts/index';
import { logger } from '../../../utils/logger';
import { BlobUtils } from '../../../models/blob';
import { formatError as formatErrorUtil } from '../../../utils/errors';
import { createBlobManager } from '../shared';

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