/**
 * Discover command - scan all user blobs for TODO data
 */

import { Command } from 'commander';
import { success, error, warning, info, spinner } from '../../ui';
import { logger } from '../../../utils/logger';
import { WalrusClient } from '../../../storage/walrus';
import { BlobStatus, BlobUtils } from '../../../models/blob';
import { formatError as formatErrorUtil } from '../../../utils/errors';
import { createBlobManager, createBlobTable } from '../shared';

export function discoverCommand(program: Command): void {
  program
    .command('discover')
    .description('Discover and list all your TODO blobs stored on Walrus')
    .option('--cached-only', 'Only show locally cached blobs (fast)')
    .option('--full-scan', 'Perform full on-chain scan (slow but comprehensive)')
    .option('--limit <number>', 'Maximum number of blobs to scan for full scan', '50')
    .option('--include-expired', 'Include expired blobs in results')
    .action(async (options) => {
      try {
        const blobManager = await createBlobManager();
        
        if (options.cachedOnly) {
          // Fast discovery using local cache
          const spin = spinner('Loading cached blob metadata...');
          
          const cachedBlobs = await blobManager.getBlobs();
          let filteredBlobs = cachedBlobs;
          
          if (!options.includeExpired) {
            filteredBlobs = cachedBlobs.filter(blob => blob.status !== BlobStatus.EXPIRED);
          }
          
          spin.stop();
          
          if (filteredBlobs.length === 0) {
            warning('No cached TODO blobs found.');
            info('Use "waltodo publish" to store TODOs, or try --full-scan for comprehensive discovery.');
            return;
          }
          
          success(`Found ${filteredBlobs.length} cached TODO blob(s):`);
          console.log();
          
          // Create table for cached blobs
          console.log(createBlobTable(filteredBlobs));
          
          console.log();
          info('💡 Tip: Use --full-scan to discover all blobs on-chain (slower)');
          
        } else if (options.fullScan) {
          // Comprehensive on-chain scanning
          const spin = spinner('Performing full on-chain blob discovery...');
          
          // Initialize Walrus client
          const walrusClient = new WalrusClient();
          
          try {
            // Get all user blobs from Walrus
            const allBlobsCommand = await (walrusClient as any).executeCommand([
              'list-blobs',
              '--json',
              ...(options.includeExpired ? ['--include-expired'] : [])
            ]);
            const { stdout } = allBlobsCommand;
            
            const userBlobs = JSON.parse(stdout);
            const limit = parseInt(options.limit) || 50;
            const blobsToScan = userBlobs.slice(0, limit);
            
            spin.text = `Scanning ${blobsToScan.length} blobs for TODO data...`;
            
            const todoBlobs: Array<{
              blobId: string;
              size: number;
              todoCount: number;
              publishedAt?: string;
              preview: string;
              status: string;
            }> = [];
            
            // Scan each blob for TODO data with progress indication
            for (let i = 0; i < blobsToScan.length; i++) {
              const blob = blobsToScan[i];
              const progress = `[${i + 1}/${blobsToScan.length}]`;
              spin.text = `${progress} Scanning blob ${blob.blobId.substring(0, 12)}...`;
              
              try {
                // Try to read and parse the blob
                const rawData = await walrusClient.retrieve(blob.blobId);
                const parsedData = JSON.parse(rawData);
                
                // Check if it's TODO data
                let todos: any[] = [];
                let publishedAt: string | undefined;
                
                if (Array.isArray(parsedData)) {
                  // Direct array of TODOs
                  todos = parsedData;
                } else if (parsedData.todos && Array.isArray(parsedData.todos)) {
                  // Export format with metadata
                  todos = parsedData.todos;
                  publishedAt = parsedData.metadata?.exportedAt;
                } else if (parsedData.data && Array.isArray(parsedData.data)) {
                  // Walrus JSON format
                  todos = parsedData.data;
                  publishedAt = parsedData.metadata?.timestamp;
                }
                
                // Validate that it's actually TODO data
                if (todos.length > 0 && todos[0].description && todos[0].id) {
                  const firstTodo = todos[0];
                  const preview = firstTodo.description.length > 50 
                    ? firstTodo.description.substring(0, 50) + '...'
                    : firstTodo.description;
                    
                  todoBlobs.push({
                    blobId: blob.blobId,
                    size: blob.size || rawData.length,
                    todoCount: todos.length,
                    publishedAt,
                    preview,
                    status: 'active'
                  });
                }
              } catch (parseError) {
                // Skip blobs that can't be parsed or aren't TODO data
                continue;
              }
            }
            
            spin.stop();
            
            if (todoBlobs.length === 0) {
              warning(`No TODO blobs found after scanning ${blobsToScan.length} blobs.`);
              info('Use "waltodo publish" to store your TODOs on Walrus.');
              return;
            }
            
            success(`Discovered ${todoBlobs.length} TODO blob(s) on Walrus:`);
            console.log();
            
            // Display discovered TODO blobs
            for (const todoBlob of todoBlobs) {
              console.log(`📋 ${BlobUtils.shortBlobId(todoBlob.blobId)}`);
              console.log(`   📊 ${todoBlob.todoCount} TODOs | 📦 ${BlobUtils.formatSize(todoBlob.size)}`);
              if (todoBlob.publishedAt) {
                console.log(`   📅 Published: ${new Date(todoBlob.publishedAt).toLocaleDateString()}`);
              }
              console.log(`   👀 Preview: "${todoBlob.preview}"`);
              console.log();
            }
            
            // Clean up
            await walrusClient.cleanup();
            
          } catch (walrusError) {
            spin.fail('Full scan failed');
            throw walrusError;
          }
          
        } else {
          // Default: Show cached first, with option to do full scan
          const spin = spinner('Loading cached TODO blobs...');
          
          const cachedBlobs = await blobManager.getBlobs();
          let filteredBlobs = cachedBlobs;
          
          if (!options.includeExpired) {
            filteredBlobs = cachedBlobs.filter(blob => blob.status !== BlobStatus.EXPIRED);
          }
          
          spin.stop();
          
          if (filteredBlobs.length > 0) {
            success(`Found ${filteredBlobs.length} cached TODO blob(s):`);
            console.log();
            console.log(createBlobTable(filteredBlobs));
            console.log();
          } else {
            warning('No cached TODO blobs found.');
            console.log();
          }
          
          info('💡 Discovery Options:');
          info('   --cached-only   Fast search using local cache');
          info('   --full-scan     Comprehensive on-chain discovery (slower)');
          
          if (filteredBlobs.length === 0) {
            console.log();
            info('To get started: waltodo publish');
          }
        }
        
      } catch (err) {
        logger.error('Error discovering TODO blobs:', err);
        error(`Failed to discover TODO blobs: ${formatErrorUtil(err)}`);
        process.exit(1);
      }
    });
}