import { Command, Flags } from '@oclif/core';
import { SuiClient } from '@mysten/sui/client';
import { TodoService } from '../services/todoService';
import { createWalrusStorage } from '../utils/walrus-storage';
import { SuiNftStorage } from '../utils/sui-nft-storage';
import { NETWORK_URLS, CURRENT_NETWORK } from '../constants';
import { CLIError } from '../types/error';
import { configService } from '../services/config-service';
// Use require for chalk since it's an ESM module
const chalk = require('chalk');

export default class FetchCommand extends Command {
  static description = 'Fetch todos from blockchain or Walrus storage';

  static examples = [
    '<%= config.bin %> fetch --blob-id QmXyz --list my-todos',
    '<%= config.bin %> fetch --object-id 0x123 --list my-todos',
  ];

  static flags = {
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
  private suiClient = new SuiClient({ url: NETWORK_URLS[CURRENT_NETWORK] });
  private walrusStorage = createWalrusStorage(true); // Use mock mode for testing

  async run(): Promise<void> {
    try {
      const { flags } = await this.parse(FetchCommand);

      // Validate input
      if (!flags['blob-id'] && !flags['object-id']) {
        throw new CLIError('Either --blob-id or --object-id must be specified', 'MISSING_PARAMETER');
      }

      // Get config for Sui client
      const config = await configService.getConfig();
      if (!config?.lastDeployment?.packageId) {
        throw new CLIError('Contract not deployed. Please run "waltodo deploy" first.', 'NOT_DEPLOYED');
      }

      if (flags['blob-id']) {
        // Initialize Walrus storage
        await this.walrusStorage.connect();

        // Retrieve todo from Walrus
        this.log(chalk.blue(`Retrieving todo from Walrus (blob ID: ${flags['blob-id']})...`));
        const todo = await this.walrusStorage.retrieveTodo(flags['blob-id']);

        // Save to local list
        const savedTodo = await this.todoService.addTodo(flags.list, todo);

        this.log(chalk.green(`✓ Todo retrieved successfully`));
        this.log(chalk.dim('Details:'));
        this.log(`  Title: ${todo.title}`);
        this.log(`  Status: ${todo.completed ? 'Completed' : 'Pending'}`);
        this.log(`  Priority: ${todo.priority}`);
        
        if (todo.tags?.length) {
          this.log(`  Tags: ${todo.tags.join(', ')}`);
        }

        // Cleanup
        await this.walrusStorage.disconnect();
      } else if (flags['object-id']) {
        // Initialize Sui NFT storage
        const suiNftStorage = new SuiNftStorage(this.suiClient, config.lastDeployment.packageId);
        
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
        const savedTodo = await this.todoService.addTodo(flags.list, {
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
