import { Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import { SuiClient } from '../utils/adapters/sui-client-compatibility';
import { Transaction } from '@mysten/sui/transactions';
import * as fs from 'fs';
import { KeystoreSigner } from '../utils/sui-keystore';
import chalk = require('chalk');
import { CLIError } from '../types/errors/consolidated';
import { configService } from '../services/config-service';
import { WalrusImageStorage } from '../utils/walrus-image-storage';

/**
 * @class CreateCommand
 * @description This command enables users to create a new todo item as an NFT on the Sui blockchain.
 * It uploads an associated image to Walrus storage (either a custom image or a default one) and then creates the NFT with the provided title and description.
 * The command handles the blockchain transaction to mint the NFT and provides a link to view it on the Sui Explorer.
 *
 * @param {string} title - The title of the todo item to be created as an NFT. (Required flag: -t, --title)
 * @param {string} description - A brief description of the todo item. (Required flag: -d, --description)
 * @param {string} [image] - Path to a custom image file for the todo item. If not provided, a default image is used. (Optional flag: -i, --image)
 * @param {boolean} [private=false] - If true, the todo is marked as private and will appear as "Untitled" in wallets. (Optional flag: -p, --private)
 */
export default class CreateCommand extends BaseCommand {
  static description = 'Create a new todo item as an NFT on the Sui blockchain';

  static examples = [
    '<%= config.bin %> create --title "My first todo" --description "A test todo item" --image ./todo.png',
    '<%= config.bin %> create --title "Private todo" --description "Hidden task" --private',
    '<%= config.bin %> create -t "Quick task" -d "Simple todo"                    # Short flags',
    '<%= config.bin %> create --title "Work task" --list work --priority high    # Add to list',
    '<%= config.bin %> create --title "NFT Todo" --network testnet --gas-budget 50000000  # Custom gas',
  ];

  static flags = {
    ...BaseCommand.flags,
    title: Flags.string({
      char: 't',
      description: 'Title of the todo item',
      required: true,
    }),
    description: Flags.string({
      char: 'd',
      description: 'Description of the todo item',
      required: true,
    }),
    image: Flags.string({
      char: 'i',
      description:
        'Path to an image file for the todo item. If not provided, uses default image.',
    }),
    private: Flags.boolean({
      char: 'p',
      description: 'Create a private todo (will show as "Untitled" in wallets)',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(CreateCommand);
    const { title, description, image, private: isPrivate } = flags;

    try {
      // Verify network and get config
      const config = await configService.getConfig();
      if (!config?.lastDeployment?.packageId) {
        throw new CLIError(
          'Contract not deployed. Please run "waltodo deploy" first.',
          'NOT_DEPLOYED'
        );
      }

      // Initialize Sui client
      const networkUrl =
        config.network === 'testnet'
          ? 'https://fullnode.testnet.sui.io:443'
          : 'https://fullnode.devnet.sui.io:443';
      const suiClient = new SuiClient({ url: networkUrl });

      // Initialize Walrus image storage
      const walrusStorage = new WalrusImageStorage(suiClient); // Add instantiation here
      await walrusStorage.connect(); // Ensure connection is established

      // Upload image to Walrus with retry and error handling
      let imageUrl: string;
      try {
        if (image) {
          // Upload custom image
          if (!fs.existsSync(image)) {
            throw new CLIError(
              `Image file not found: ${image}`,
              'IMAGE_NOT_FOUND'
            );
          }
          imageUrl = await walrusStorage.uploadImage(image);
        } else {
          // Use default image with retry and error handling
          imageUrl = await walrusStorage
            .uploadDefaultImage()
            .catch((err: Error) => {
              if (err.message.includes('blob has not been registered')) {
                throw new CLIError(
                  'Walrus blob not registered. Ensure Walrus is configured and blobs are registered.',
                  'WALRUS_BLOB_ERROR'
                );
              } else {
                throw new CLIError(
                  'Failed to upload default image: ' + err.message,
                  'IMAGE_UPLOAD_FAILED'
                ); // Changed to double quotes for consistency
              }
            });
        }
      } catch (error) {
        throw new CLIError(
          `Failed to upload image to Walrus: ${error instanceof Error ? error.message : String(error)}`,
          'IMAGE_UPLOAD_FAILED'
        );
      }

      // Extract the blob ID from the URL
      const blobId = imageUrl.split('/').pop();
      if (!blobId) {
        throw new CLIError(
          'Failed to extract blob ID from image URL',
          'INVALID_URL'
        );
      }

      // Create todo NFT transaction with correct TransactionBlock
      const txb = new Transaction();
      const args = [
        txb.pure(isPrivate ? 'Untitled' : title),
        txb.pure(description),
        txb.pure(blobId),
      ];
      txb.moveCall({
        target: `${config.lastDeployment.packageId}::todo_nft::create_todo`,
        arguments: args,
      });
      const signer = new KeystoreSigner(suiClient);
      const tx = await signer.signAndExecuteTransaction(txb) as any;
      if ((tx as any).effects?.status.status !== 'success') {
        // Add optional chaining for null check
        throw new CLIError('Transaction failed', 'TX_FAILED');
      }
      const createdObjects = (tx as any).effects.created;
      if (!createdObjects || createdObjects.length === 0) {
        throw new CLIError(
          'No objects created in transaction',
          'TX_PARSE_ERROR'
        );
      }
      const nftId = createdObjects[0].reference.objectId;

      // Success output
      this.log(chalk.green('\n✓ Todo NFT created successfully!'));
      this.log(chalk.blue('Details:'));
      this.log(chalk.dim(`  Object ID: ${nftId}`));
      this.log(chalk.dim(`  Title: ${title}`));
      this.log(chalk.dim(`  Image URL: ${imageUrl}`));
      this.log(chalk.dim(`  Network: ${config.network}`));
      this.log('\nView your NFT on Sui Explorer:');
      this.log(
        chalk.cyan(
          `  https://explorer.sui.io/object/${nftId}?network=${config.network}`
        )
      );

      // 'disconnect' method may not exist; removed or handle appropriately if defined in WalrusImageStorage
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Transaction or creation failed: ${error instanceof Error ? error.message : String(error)}`,
        'CREATE_FAILED'
      );
    }
  }
}
