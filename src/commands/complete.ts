import { Args, Command, Flags } from '@oclif/core';
import { SuiClient } from '@mysten/sui/client';
import { TodoService } from '../services/todoService';
import { createWalrusStorage } from '../utils/walrus-storage';
import { SuiNftStorage } from '../utils/sui-nft-storage';
import { NETWORK_URLS } from '../constants';
import { CLIError } from '../types/error';
import { configService } from '../services/config-service';
import chalk from 'chalk';

// Added import for SuiClient initialization

export default class CompleteCommand extends Command {
  static description = 'Mark a todo as completed (updates blockchain if NFT exists)';

  static examples = [
    '<%= config.bin %> complete my-list -i todo-123'
  ];

  static flags = {
    id: Flags.string({
      char: 'i',
      description: 'Todo ID to mark as completed',
      required: true
    })
  };

  static args = {
    list: Args.string({
      name: 'list',
      description: 'List name',
      default: 'default'
    })
  };

  private todoService = new TodoService();
  private walrusStorage = createWalrusStorage(false); // Use real Walrus storage

  async run(): Promise<void> {
    try {
      const { args, flags } = await this.parse(CompleteCommand);
      const config = await configService.getConfig();

      const list = await this.todoService.getList(args.list);
      if (!list) {
        throw new CLIError(`List "${args.list}" not found`, 'LIST_NOT_FOUND');
      }

      const todo = list.todos.find(t => t.id === flags.id);
      if (!todo) {
        throw new CLIError(`Todo "${flags.id}" not found in list "${args.list}"`, 'TODO_NOT_FOUND');
      }
      
      // Add SuiClient initialization
      const configInner = await configService.getConfig();  // Use a different variable name to avoid redeclaration
      const suiClient = new SuiClient({ url: NETWORK_URLS[configInner.network as keyof typeof NETWORK_URLS] });

      // Update local todo
      this.log(chalk.blue(`Marking todo "${todo.title}" as completed...`));
      await this.todoService.toggleItemStatus(args.list, flags.id, true);

      // Check if the todo has an NFT object ID
      if (todo.nftObjectId) {
        // Get config for Sui client – avoid redeclaration
        const configInner = await configService.getConfig();  // Use consistent variable name
        if (!configInner?.lastDeployment?.packageId) {
          throw new CLIError('Contract not deployed. Please run "waltodo deploy" first.', 'NOT_DEPLOYED');
        }

        // Update NFT on blockchain
        this.log(chalk.blue(`Updating NFT on blockchain...`));

        // Initialize Sui NFT storage
        if (!config.lastDeployment) {
          throw new CLIError('Contract not deployed. Please run "waltodo deploy" first.', 'NOT_DEPLOYED');
        }
        const suiNftStorage = new SuiNftStorage(suiClient, config.lastDeployment.packageId);
        await suiNftStorage.completeTodoNft(todo.nftObjectId);

        // If the todo has a Walrus blob ID, update it
        if (todo.walrusBlobId) {
          // Initialize Walrus storage
          await this.walrusStorage.connect();

          // Update todo on Walrus
          this.log(chalk.blue(`Updating todo on Walrus...`));
          const updatedTodo = { ...todo, completed: true, completedAt: new Date().toISOString() };
          const newBlobId = await this.walrusStorage.updateTodo(updatedTodo, todo.walrusBlobId);

          // Update local todo with new blob ID
          await this.todoService.updateTodo(args.list, todo.id, {
            walrusBlobId: newBlobId
          });

          this.log(chalk.green(`✓ Todo updated on Walrus (new blob ID: ${newBlobId})`));

          // Cleanup
          await this.walrusStorage.disconnect();
        }

        this.log(chalk.green(`✓ Todo NFT updated on blockchain`));
      }

      this.log(chalk.green(`\n✓ Marked todo as completed`));
      this.log(chalk.dim('Details:'));
      this.log(`  ${chalk.bold(todo.title)}`);

    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to complete todo: ${error instanceof Error ? error.message : String(error)}`,
        'COMPLETE_FAILED'
      );
    }
  }
}
