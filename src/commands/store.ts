import { Command, Flags } from '@oclif/core';
import { SuiClient } from '@mysten/sui/client';
import { TodoService } from '../services/todoService';
import { createWalrusStorage } from '../utils/walrus-storage';
import { WalrusImageStorage } from '../utils/walrus-image-storage';
import { SuiNftStorage } from '../utils/sui-nft-storage';
import { CLIError } from '../types/error';
import { NETWORK_URLS } from '../constants';
import { configService } from '../services/config-service';
import chalk from 'chalk';

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
  private walrusStorage = createWalrusStorage(false); // Use real Walrus storage

  async run(): Promise<void> {
    try {
      const { flags } = await this.parse(StoreCommand);
      const configStore = await configService.getConfig();  // Changed to avoid redeclaration

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

      this.log(chalk.green("✓ Todo data stored successfully on Walrus"));
      this.log(chalk.dim("Blob ID: " + blobId));  // Changed to double quotes for consistency

      // Update local todo with Walrus blob ID
      await this.todoService.updateTodo(flags.list, todo.id, {
        walrusBlobId: blobId,
        updatedAt: new Date().toISOString()
      });

      // Get config for Sui client
      const configStoreInner = await configService.getConfig();  // Used unique name to avoid redeclaration
      if (!configStore?.lastDeployment?.packageId) {  // Used configStore as defined earlier
        throw new CLIError('Contract not deployed. Please run "waltodo deploy" first.', 'NOT_DEPLOYED');
      }

      // Initialize Walrus image storage
      const configStoreInner2 = await configService.getConfig();  // Used another unique name
      const suiClient = new SuiClient({ url: NETWORK_URLS[configStoreInner.network as keyof typeof NETWORK_URLS] });  // Changed to correct variable name
      const walrusImageStorage = new WalrusImageStorage(suiClient, false);
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
      if (!configStoreInner2.lastDeployment) {
        throw new CLIError('Contract not deployed. Please run "waltodo deploy" first.', 'NOT_DEPLOYED');
      }
      const suiNftStorage = new SuiNftStorage(suiClient, configStoreInner2.lastDeployment.packageId);  // Added check for undefined

      // Create NFT on Sui blockchain
      this.log(chalk.blue('Creating NFT on Sui blockchain...'));
      const txDigest = await suiNftStorage.createTodoNft(todo, blobId, imageUrl);

      // Get transaction effects to extract the created NFT Object ID
      const txResponse = await suiClient.getTransactionBlock({  // Changed to local suiClient variable
        digest: txDigest,
      });
      if (txResponse.effects?.status.status !== 'success') {
        throw new CLIError('Transaction failed', 'TX_FAILED');
      }
      const createdObjects = txResponse.effects.created;
      if (!createdObjects || createdObjects.length === 0) {
        throw new CLIError('No objects created in transaction', 'TX_PARSE_ERROR');
      }
      const nftObjectId = createdObjects[0].reference.objectId;

      // Update local todo with NFT Object ID
      await this.todoService.updateTodo(flags.list, todo.id, {
        nftObjectId,
        walrusBlobId: blobId,
        imageUrl: imageUrl
      });

      this.log(chalk.green(`✓ NFT created successfully with Object ID: ${nftObjectId}`));
      this.log(chalk.green('✓ Todo stored successfully on blockchain and Walrus'));
      this.log(chalk.blue('\nView your NFT on Sui Explorer:'));
      this.log(chalk.cyan(`  https://explorer.sui.io/txblock/${txDigest}?network=${configStore.network}`));  // Use the correct variable

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
