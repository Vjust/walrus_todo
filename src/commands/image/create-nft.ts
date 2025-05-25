import { Flags } from '@oclif/core';
import BaseCommand from '../../base-command';
import { CLIError } from '../../types/errors/consolidated';
import { TodoService } from '../../services/todoService';
import { SuiNftStorage } from '../../utils/sui-nft-storage';
import { NETWORK_URLS } from '../../constants';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
// Removed unused chalk import
import { configService } from '../../services/config-service';

/**
 * @class CreateNftCommand
 * @description This command creates an NFT on the Sui blockchain for a specified todo item that already has an associated image.
 * It ensures the todo exists and has an image URL before minting the NFT, linking it to the Walrus blob ID of the image.
 * The command provides feedback on the transaction and NFT details upon successful creation.
 *
 * @param {string} todo - The ID of the todo item for which to create an NFT. (Required flag: -t, --todo)
 * @param {string} list - The name of the todo list containing the specified todo item. (Required flag: -l, --list)
 */
export default class CreateNftCommand extends BaseCommand {
  static description =
    'Mint an NFT on Sui blockchain from a todo image stored in Walrus';

  static examples = [
    '<%= config.bin %> image create-nft --todo 123 --list my-todos                # Create NFT',
    '<%= config.bin %> image create-nft -t "Buy milk" -l shopping                 # Create by title',
    '<%= config.bin %> image create-nft --todo task-456 --list work --network testnet  # On testnet',
    '<%= config.bin %> image create-nft --todo 789 --list personal --gas-budget 100000000  # Custom gas',
  ];

  static flags = {
    ...BaseCommand.flags,
    todo: Flags.string({
      char: 't',
      description: 'ID of the todo to create NFT for',
      required: true,
    }),
    list: Flags.string({
      char: 'l',
      description: 'Name of the todo list',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const config = await configService.getConfig();
    const { flags } = await this.parse(CreateNftCommand);
    const todoService = new TodoService();

    try {
      // Get the todo item
      const todoItem = await todoService.getTodo(flags.todo, flags.list);
      if (!todoItem) {
        throw new CLIError(
          `Todo with ID ${flags.todo} not found in list ${flags.list}`,
          'TODO_NOT_FOUND'
        );
      }

      if (!todoItem.imageUrl) {
        throw new CLIError(
          'No image URL found for this todo. Please upload an image first using "image upload".',
          'NO_IMAGE_URL'
        );
      }

      const blobId = todoItem.imageUrl.split('/').pop() || '';

      if (!config.lastDeployment?.packageId) {
        throw new CLIError(
          'Todo NFT module address not configured. Please deploy the NFT module first.',
          'NOT_DEPLOYED'
        );
      }

      // Setup SuiClient with type assertion for network
      const suiClient = new SuiClient({
        url: NETWORK_URLS[config.network as keyof typeof NETWORK_URLS],
      });

      // Initialize Sui NFT storage
      const suiNftStorage = new SuiNftStorage(suiClient, {} as Ed25519Keypair, {
        address: config.lastDeployment.packageId,
        packageId: config.lastDeployment.packageId,
      });

      // Create NFT
      this.log('Creating NFT on Sui blockchain...');
      const txDigest = await suiNftStorage.createTodoNft(todoItem, blobId);

      this.log(`✅ NFT created successfully!`);
      this.log(`📝 Transaction: ${txDigest}`);
      this.log(`📝 Your NFT has been created with the following:`);
      this.log(`   - Title: ${todoItem.title}`);
      this.log(`   - Image URL: ${todoItem.imageUrl}`);
      this.log(`   - Walrus Blob ID: ${blobId}`);
      this.log(
        '\nYou can view this NFT in your wallet with the embedded image from Walrus.'
      );
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to create NFT: ${error instanceof Error ? error.message : String(error)}`,
        'NFT_CREATE_FAILED'
      );
    }
  }
}
