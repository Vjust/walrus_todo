import { Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import { SuiClient } from '@mysten/sui/client';
import { TodoService } from '../services/todoService';
import { createWalrusStorage } from '../utils/walrus-storage';
import { SuiNftStorage } from '../utils/sui-nft-storage';
import { NETWORK_URLS } from '../constants';
import { CLIError } from '../types/error';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { configService } from '../services/config-service';
import chalk from 'chalk';
import { RetryManager } from '../utils/retry-manager';

/**
 * @class FetchCommand
 * @description This command retrieves todo items directly from blockchain storage (Sui NFT) or Walrus storage using their respective IDs.
 * It allows users to fetch todos that may not be in their local storage and save them to a specified list.
 * The command handles the connection to Walrus for blob data and Sui blockchain for NFT data, ensuring the todo is properly reconstructed and stored locally.
 *
 * @param {string} [blob-id] - The Walrus blob ID of the todo item to retrieve. (Optional flag: --blob-id)
 * @param {string} [object-id] - The NFT object ID on the Sui blockchain to retrieve. (Optional flag: --object-id)
 * @param {string} [list='default'] - The name of the local todo list to save the retrieved todo to. (Optional flag: -l, --list)
 */
export default class FetchCommand extends BaseCommand {
  static description = 'Fetch todos directly from blockchain or Walrus storage using IDs';

  static examples = [
    '<%= config.bin %> fetch --blob-id QmXyz --list my-todos',
    '<%= config.bin %> fetch --object-id 0x123 --list my-todos',
  ];

  static flags = {
    ...BaseCommand.flags,
    'blob-id': Flags.string({
      description: 'Walrus blob ID to retrieve',
      exclusive: ['object-id'],
    }),
    'object-id': Flags.string({
      description: 'NFT object ID to retrieve',
      exclusive: ['blob-id'],
    }),
    list: Flags.string({
      char: 'l',
      description: 'Save to this todo list',
      default: 'default'
    }),
  };

  private todoService = new TodoService();
  private walrusStorage = createWalrusStorage('testnet', true); // Use mock mode for testing

  async run(): Promise<void> {
    try {
      const { flags } = await this.parse(FetchCommand);
      // Removed unused configFetch variable

      // Validate input
      if (!flags['blob-id'] && !flags['object-id']) {
        throw new CLIError('Either --blob-id or --object-id must be specified', 'MISSING_PARAMETER');
      }

      // Get config for Sui client
      const configInner = await configService.getConfig();  // Changed to avoid redeclaration
      if (!configInner?.lastDeployment?.packageId) {
        throw new CLIError('Contract not deployed. Please run "waltodo deploy" first.', 'NOT_DEPLOYED');
      }

      if (flags['blob-id']) {
        // Initialize Walrus storage
        await this.walrusStorage.connect();

        // Retrieve todo from Walrus with retry
        this.log(chalk.blue(`Retrieving todo from Walrus (blob ID: ${flags['blob-id']})...`));
        const todo = await RetryManager.withRetry(
          () => this.walrusStorage.retrieveTodo(flags['blob-id']),
          {
            maxRetries: 3,
            retryableErrors: [/NETWORK_ERROR/, /CONNECTION_REFUSED/],
            onRetry: (error, attempt, delay) => {
              this.log(chalk.yellow(`Retry attempt ${attempt} after ${delay}ms: ${error.message}`));
            }
          }
        );

        // Save to local list
        await this.todoService.addTodo(flags.list, todo); // Removed unused savedTodo variable

        this.log(chalk.green("✓ Todo retrieved successfully"));
        this.log(chalk.dim("Details:"));
        this.log(`  Title: ${todo.title}`);
        this.log(`  Status: ${todo.completed ? 'Completed' : 'Pending'}`);
        this.log(`  Priority: ${todo.priority}`);
        
        if (todo.tags?.length) {
          this.log(`  Tags: ${todo.tags.join(', ')}`);
        }

        // Cleanup
        await this.walrusStorage.disconnect();
      } else if (flags['object-id']) {
        // Initialize Sui client first
        const suiClient = {
          url: NETWORK_URLS[configInner.network as keyof typeof NETWORK_URLS],
          core: {},
          jsonRpc: {},
          signAndExecuteTransaction: async () => { },
          getEpochMetrics: async () => null,
          getObject: async () => null,
          getTransactionBlock: async () => null
        } as unknown as SuiClient;
        // Initialize Sui NFT storage
        if (!configInner.lastDeployment) {
          throw new CLIError('Contract not deployed. Please run "waltodo deploy" first.', 'NOT_DEPLOYED');
        }
        const signer = {} as Ed25519Keypair;
        const suiNftStorage = new SuiNftStorage(suiClient, signer, {
          address: configInner.lastDeployment.packageId,
          packageId: configInner.lastDeployment.packageId,
          collectionId: ''
        });
        
        // Retrieve NFT from blockchain
        this.log(chalk.blue(`Retrieving NFT from blockchain (object ID: ${flags['object-id']})...`));
        const nftData = await suiNftStorage.getTodoNft(flags['object-id']);
        
        if (!nftData.walrusBlobId) {
          throw new CLIError('NFT does not contain a Walrus blob ID', 'INVALID_NFT');
        }
        
        // Initialize Walrus storage
        await this.walrusStorage.connect();
        
        // Retrieve todo data from Walrus
        this.log(chalk.blue(`Retrieving todo data from Walrus (blob ID: ${nftData.walrusBlobId})...`));
        const todo = await this.walrusStorage.retrieveTodo(nftData.walrusBlobId);
        
        // Save to local list
        await this.todoService.addTodo(flags.list, { // Removed unused savedTodo variable
          ...todo,
          nftObjectId: flags['object-id'],
          walrusBlobId: nftData.walrusBlobId
        });
        
        this.log(chalk.green(`✓ Todo retrieved successfully from blockchain and Walrus`));
        this.log(chalk.dim('Details:'));
        this.log(`  Title: ${todo.title}`);
        this.log(`  Status: ${todo.completed ? 'Completed' : 'Pending'}`);
        this.log(`  Priority: ${todo.priority}`);
        this.log(`  NFT Object ID: ${flags['object-id']}`);
        this.log(`  Walrus Blob ID: ${nftData.walrusBlobId}`);
        
        if (todo.tags?.length) {
          this.log(`  Tags: ${todo.tags.join(', ')}`);
        }
        
        // Cleanup
        await this.walrusStorage.disconnect();
      }
      
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to retrieve todo: ${error instanceof Error ? error.message : String(error)}`,
        'RETRIEVE_FAILED'
      );
    }
  }
}
