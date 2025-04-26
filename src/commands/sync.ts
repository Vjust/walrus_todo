/**
 * Sync Command Module
 * Synchronizes local state with blockchain
 * Handles conflict resolution and merging
 */

import chalk from 'chalk';
import { suiService } from '../services/sui-service';
import { walrusService } from '../services/walrus-service';

/**
 * Interface for sync command options
 * @interface SyncOptions
 */
interface SyncOptions {
  list: string;
}

/**
 * Synchronizes local state with blockchain
 * @param options - Command line options for syncing
 */
export async function sync(options: SyncOptions): Promise<void> {
  try {
    const { list } = options;
    
    // Get on-chain list state
    const onChainList = await suiService.getListState(list);
    if (!onChainList) {
      console.error(chalk.red(`Todo list '${list}' not found on blockchain`));
      process.exit(1);
    }

    // Sync Walrus data with blockchain state
    await walrusService.syncWithBlockchain(list, onChainList);
    
    console.log(chalk.green('✔ List synchronized with blockchain state'));
    console.log(chalk.dim('List:'), list);

  } catch (error) {
    console.error(chalk.red('Failed to sync list:'), error);
    process.exit(1);
  }
}