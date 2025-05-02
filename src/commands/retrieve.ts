import { Command, Flags } from '@oclif/core';
import { SuiClient } from '@mysten/sui/client';
import { TodoService } from '../services/todoService';
import { WalrusStorage } from '../utils/walrus-storage';
import { NETWORK_URLS, CURRENT_NETWORK } from '../constants';
import { CLIError } from '../types/error';
import chalk from 'chalk';

export default class RetrieveCommand extends Command {
  static description = 'Retrieve todos from blockchain or Walrus storage';

  static examples = [
    '<%= config.bin %> retrieve --blob-id QmXyz --list my-todos',
    '<%= config.bin %> retrieve --object-id 0x123 --list my-todos',
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
  private walrusStorage = new WalrusStorage();

  async run(): Promise<void> {
    try {
      const { flags } = await this.parse(RetrieveCommand);

      // Validate input
      if (!flags['blob-id'] && !flags['object-id']) {
        throw new CLIError('Either --blob-id or --object-id must be specified', 'MISSING_PARAMETER');
      }

      if (flags['blob-id']) {
        // Initialize Walrus storage
        await this.walrusStorage.connect();

        // Retrieve todo from Walrus
        this.log(`Retrieving todo from Walrus (blob ID: ${flags['blob-id']})...`);
        const todo = await this.walrusStorage.retrieveTodo(flags['blob-id']);

        // Save to local list
        await this.todoService.addTodo(flags.list, todo);

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