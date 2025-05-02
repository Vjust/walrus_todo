import { Command, Flags } from '@oclif/core';
import { SuiClient } from '@mysten/sui/client';
import { TodoService } from '../services/todoService';
import { WalrusStorage } from '../utils/walrus-storage';
import { CLIError } from '../types/error';
import { NETWORK_URLS, CURRENT_NETWORK } from '../constants';

export default class StoreCommand extends Command {
  static description = 'Store todos on blockchain and Walrus';

  static examples = [
    '<%= config.bin %> store --todo 123 --list my-todos',
    '<%= config.bin %> store --todo 123 --list my-todos --create-nft'
  ];

  static flags = {
    todo: Flags.string({
      char: 't',
      description: 'ID of the todo to store',
      required: true,
    }),
    list: Flags.string({
      char: 'l',
      description: 'Todo list name',
      default: 'default'
    }),
    'create-nft': Flags.boolean({
      description: 'Create an NFT for the todo',
      default: false
    }),
  };

  private todoService = new TodoService();
  private suiClient = new SuiClient({ url: NETWORK_URLS[CURRENT_NETWORK] });
  private walrusStorage = new WalrusStorage();

  async run(): Promise<void> {
    try {
      const { flags } = await this.parse(StoreCommand);

      // Get the todo from local storage
      const todo = await this.todoService.getTodo(flags.todo, flags.list);
      if (!todo) {
        throw new CLIError(`Todo "${flags.todo}" not found in list "${flags.list}"`, 'TODO_NOT_FOUND');
      }

      // Initialize Walrus storage
      await this.walrusStorage.connect();

      // Store todo on Walrus
      this.log(`Storing todo "${todo.title}" on Walrus...`);
      const blobId = await this.walrusStorage.storeTodo(todo);

      this.log(`✓ Todo stored successfully on Walrus`);
      this.log(`Blob ID: ${blobId}`);

      // Update local todo with Walrus blob ID
      await this.todoService.updateTodo(flags.list, todo.id, {
        walrusBlobId: blobId,
        updatedAt: new Date().toISOString()
      });

      // Cleanup
      await this.walrusStorage.disconnect();

    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to store todo: ${error instanceof Error ? error.message : String(error)}`,
        'STORE_FAILED'
      );
    }
  }
}