import { Command, Flags } from '@oclif/core';
import { SuiClient } from '@mysten/sui/client';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
// Use require for chalk since it's an ESM module
const chalk = require('chalk');
import { CLIError } from '../utils/error-handler';
import { configService } from '../services/config-service';
import { WalrusImageStorage } from '../utils/walrus-image-storage';

export default class CreateCommand extends Command {
  static description = 'Create a new todo item as an NFT';

  static examples = [
    '<%= config.bin %> create --title "My first todo" --description "A test todo item" --image ./todo.png',
    '<%= config.bin %> create --title "Private todo" --description "Hidden task" --private',
  ];

  static flags = {
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
      description: 'Path to an image file for the todo item. If not provided, uses default image.',
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
        throw new CLIError('Contract not deployed. Please run "waltodo deploy" first.', 'NOT_DEPLOYED');
      }

      // Initialize Sui client
      const networkUrl = config.network === 'testnet' 
        ? 'https://fullnode.testnet.sui.io:443'
        : 'https://fullnode.devnet.sui.io:443';
      const suiClient = new SuiClient({ url: networkUrl });

      // Initialize Walrus image storage
      const walrusStorage = new WalrusImageStorage(suiClient);
      await walrusStorage.connect();

      // Upload image to Walrus
      let imageUrl: string;
      try {
        if (image) {
          // Upload custom image
          if (!fs.existsSync(image)) {
            throw new CLIError(`Image file not found: ${image}`, 'IMAGE_NOT_FOUND');
          }
          
          imageUrl = await walrusStorage.uploadImage(image);
        } else {
          // Use default image
          imageUrl = await walrusStorage.uploadDefaultImage();
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
        throw new CLIError('Failed to extract blob ID from image URL', 'INVALID_URL');
      }

      // Create todo NFT transaction
      const createCommand = [
        'sui',
        'client',
        'call',
        '--package', config.lastDeployment.packageId,
        '--module', 'todo_nft',
        '--function', 'create_todo',
        '--args',
        `"${isPrivate ? 'Untitled' : title}"`,
        `"${description}"`,
        `"${blobId}"`,
        '--gas-budget', '10000000'
      ].join(' ');

      // Execute transaction
      try {
        const output = execSync(createCommand, { encoding: 'utf8' });
        const result = JSON.parse(output);

        // Find the created NFT object
        const createdNft = result.effects.created?.[0];
        if (!createdNft) {
          throw new CLIError('Failed to find created NFT in transaction output', 'TX_PARSE_ERROR');
        }

        const nftId = createdNft.reference.objectId;

        // Success output
        this.log(chalk.green('\n✓ Todo NFT created successfully!'));
        this.log(chalk.blue('Details:'));
        this.log(chalk.dim(`  Object ID: ${nftId}`));
        this.log(chalk.dim(`  Title: ${title}`));
        this.log(chalk.dim(`  Image URL: ${imageUrl}`));
        this.log(chalk.dim(`  Network: ${config.network}`));
        this.log('\nView your NFT on Sui Explorer:');
        this.log(chalk.cyan(`  https://explorer.sui.io/object/${nftId}?network=${config.network}`));

      } catch (error) {
        throw new CLIError(
          `Transaction failed: ${error instanceof Error ? error.message : String(error)}`,
          'TX_FAILED'
        );
      }

    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to create todo: ${error instanceof Error ? error.message : String(error)}`,
        'CREATE_FAILED'
      );
    }
  }
}