import { Command, Flags } from '@oclif/core';
import { SuiClient } from '@mysten/sui/client';
import { TodoService } from '../services/todoService';
import { createWalrusStorage } from '../utils/walrus-storage';
import { WalrusImageStorage } from '../utils/walrus-image-storage';
import { SuiNftStorage } from '../utils/sui-nft-storage';
import { CLIError } from '../types/error';
import { NETWORK_URLS, CURRENT_NETWORK } from '../constants';
import { configService } from '../services/config-service';
// Use require for chalk since it's an ESM module
const chalk = require('chalk');

export default class StoreCommand extends Command {
  static description = 'Store todos on blockchain and Walrus (always creates an NFT)';

  static examples = [
    '<%= config.bin %> store --todo 123 --list my-todos',
    '<%= config.bin %> store --todo 123 --list my-todos --image ./custom-image.png'
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
    image: Flags.string({
      char: 'i',
      description: 'Path to a custom image for the NFT',
      required: false
    }),
  };

  private todoService = new TodoService();
  private suiClient = new SuiClient({ url: NETWORK_URLS[CURRENT_NETWORK] });
  private walrusStorage = createWalrusStorage(false); // Use real Walrus storage

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
      this.log(chalk.blue(`Storing todo "${todo.title}" on Walrus...`));
      const blobId = await this.walrusStorage.storeTodo(todo);

      this.log(chalk.green(`✓ Todo data stored successfully on Walrus`));
      this.log(chalk.dim(`Blob ID: ${blobId}`));

      // Update local todo with Walrus blob ID
      await this.todoService.updateTodo(flags.list, todo.id, {
        walrusBlobId: blobId,
        updatedAt: new Date().toISOString()
      });

      // Get config for Sui client
      const config = await configService.getConfig();
      if (!config?.lastDeployment?.packageId) {
        throw new CLIError('Contract not deployed. Please run "waltodo deploy" first.', 'NOT_DEPLOYED');
      }

      // Initialize Walrus image storage
      const walrusImageStorage = new WalrusImageStorage(this.suiClient, false);
      await walrusImageStorage.connect();

      // Upload image to Walrus
      let imageUrl: string;
      try {
        if (flags.image) {
          // Upload custom image
          this.log(chalk.blue('Uploading custom image to Walrus...'));
          imageUrl = await walrusImageStorage.uploadCustomTodoImage(
            flags.image,
            todo.title,
            todo.completed || false
          );
        } else {
          // Use default image
          this.log(chalk.blue('Uploading default image to Walrus...'));
          imageUrl = await walrusImageStorage.uploadDefaultImage();
        }
        this.log(chalk.green(`✓ Image uploaded to Walrus: ${imageUrl}`));
      } catch (error) {
        throw new CLIError(
          `Failed to upload image to Walrus: ${error instanceof Error ? error.message : String(error)}`,
          'IMAGE_UPLOAD_FAILED'
        );
      }

      // Initialize Sui NFT storage
      const suiNftStorage = new SuiNftStorage(this.suiClient, config.lastDeployment.packageId);

      // Create NFT on Sui blockchain
      this.log(chalk.blue('Creating NFT on Sui blockchain...'));
      const txDigest = await suiNftStorage.createTodoNft(todo, blobId, imageUrl);

      // Update local todo with NFT ID
      await this.todoService.updateTodo(flags.list, todo.id, {
        nftObjectId: txDigest,
        walrusBlobId: blobId,
        imageUrl: imageUrl
      });

      this.log(chalk.green(`✓ NFT created successfully with transaction: ${txDigest}`));
      this.log(chalk.green('✓ Todo stored successfully on blockchain and Walrus'));
      this.log(chalk.blue('\nView your NFT on Sui Explorer:'));
      this.log(chalk.cyan(`  https://explorer.sui.io/txblock/${txDigest}?network=${config.network}`));

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