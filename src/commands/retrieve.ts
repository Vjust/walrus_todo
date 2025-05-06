import { Command, Flags } from '@oclif/core';
import { SuiClient } from '@mysten/sui/client';
import { TodoService } from '../services/todoService';
import { createWalrusStorage } from '../utils/walrus-storage';
import { SuiNftStorage } from '../utils/sui-nft-storage';
import { NETWORK_URLS } from '../constants';
import { CLIError } from '../types/error';
import { configService } from '../services/config-service';
import chalk from 'chalk';

export default class RetrieveCommand extends Command {
  static description = 'Retrieve todos from blockchain or Walrus storage, with optional mock mode for testing';

  static examples = [
    '<%= config.bin %> retrieve --blob-id QmXyz --list my-todos',
    '<%= config.bin %> retrieve --object-id 0x123 --list my-todos',
    '<%= config.bin %> retrieve --blob-id QmXyz --mock --list my-todos',  // Example with mock mode
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
    mock: Flags.boolean({
      description: 'Use mock Walrus storage for testing',
      default: false
    }),
  };

  private todoService = new TodoService();

  async run(): Promise<void> {
    try {
      const { flags } = await this.parse(RetrieveCommand);
      const configRetrieve = await configService.getConfig();  // Changed to avoid redeclaration
      const mockMode = flags.mock || false;
      const suiClient = new SuiClient({ url: NETWORK_URLS[configRetrieve.network as keyof typeof NETWORK_URLS] });
      const walrusStorage = createWalrusStorage(mockMode);

      // Validate input
      if (!flags['blob-id'] && !flags['object-id']) {
        throw new CLIError('Either --blob-id or --object-id must be specified', 'MISSING_PARAMETER');
      }

      // Get config for Sui client
      const configInner = await configService.getConfig();  // Changed to avoid redeclaration
      if (!configRetrieve?.lastDeployment?.packageId) {
        throw new CLIError('Contract not deployed. Please run "waltodo deploy" first.', 'NOT_DEPLOYED');
      }

      if (flags['blob-id']) {
        // Initialize Walrus storage
        await walrusStorage.connect();

        // Retrieve todo from Walrus
        this.log(chalk.blue(`Retrieving todo from Walrus (blob ID: ${flags['blob-id']})...`));
        const todo = await walrusStorage.retrieveTodo(flags['blob-id']);

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
        await walrusStorage.disconnect();
      } else if (flags['object-id']) {
        // Initialize Sui NFT storage
        if (!configRetrieve.lastDeployment) {
          throw new CLIError('Contract not deployed. Please run "waltodo deploy" first.', 'NOT_DEPLOYED');
        }
        const suiNftStorage = new SuiNftStorage(suiClient, configRetrieve.lastDeployment.packageId);

        // Retrieve NFT from blockchain
        this.log(chalk.blue(`Retrieving NFT from blockchain (object ID: ${flags['object-id']})...`));
        const nftData = await suiNftStorage.getTodoNft(flags['object-id']);

        if (!nftData.walrusBlobId) {
          throw new CLIError('NFT does not contain a Walrus blob ID', 'INVALID_NFT');
        }

        // Initialize Walrus storage
        await walrusStorage.connect();

        // Retrieve todo data from Walrus
        this.log(chalk.blue(`Retrieving todo data from Walrus (blob ID: ${nftData.walrusBlobId})...`));
        const todo = await walrusStorage.retrieveTodo(nftData.walrusBlobId);

        // Save to local list
        const savedTodo = await this.todoService.addTodo(flags.list, {
          ...todo,
          nftObjectId: flags['object-id'],
          walrusBlobId: nftData.walrusBlobId
        });

        this.log(chalk.green("✓ Todo retrieved successfully from blockchain and Walrus"));
        this.log(chalk.dim("Details:"));
        this.log(`  Title: ${todo.title}`);
        this.log(`  Status: ${todo.completed ? 'Completed' : 'Pending'}`);
        this.log(`  Priority: ${todo.priority}`);
        this.log(`  NFT Object ID: ${flags['object-id']}`);
        this.log(`  Walrus Blob ID: ${nftData.walrusBlobId}`);

        if (todo.tags?.length) {
          this.log(`  Tags: ${todo.tags.join(', ')}`);
        }

        // Cleanup
        await walrusStorage.disconnect();
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
