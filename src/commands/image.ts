import { Command, Flags, Args } from '@oclif/core';  // Added Args to import
import { CLIError } from '../utils/error-handler';
import { TodoService } from '../services/todoService';
import { createSuiNftStorage } from '../utils/sui-nft-storage';
import { configService } from '../services/config-service';
import { createWalrusImageStorage } from '../utils/walrus-image-storage';
import { NETWORK_URLS } from '../constants';
import { SuiClient } from '@mysten/sui/client';
// Removed unused chalk import
import * as path from 'path';

export default class ImageCommand extends Command {
  static description = 'Manage images for todos and NFTs';

  static examples = [
    '<%= config.bin %> image upload --todo 123 --list my-todos --image ./custom.png',
    '<%= config.bin %> image create-nft --todo 123 --list my-todos',
  ];

  static args = {
    action: Args.string({
      name: 'action',
      description: 'Action to perform (upload or create-nft)',
      required: true,
      options: ['upload', 'create-nft'],
    }),
  };

  static flags = {
    todo: Flags.string({
      char: 't',
      description: 'ID of the todo to create an image for',
      required: true,
    }),
    list: Flags.string({
      char: 'l',
      description: 'Name of the todo list',
    }),
    image: Flags.string({
      char: 'i',
      description: 'Path to a custom image file',
    }),
    'show-url': Flags.boolean({
      description: 'Display only the image URL',
    }),
  };

  async run(): Promise<void> {
    const config = await configService.getConfig();
    const { args, flags } = await this.parse(ImageCommand);
    const todoService = new TodoService();

    try {
      // Get the todo item
      const todoItem = await todoService.getTodo(flags.todo, flags.list);
      if (!todoItem) {
        throw new CLIError(`Todo with ID ${flags.todo} not found in list ${flags.list || 'default'}`);
      }
      
      // Removed unused todoItemTyped variable

      // Setup SuiClient
      const suiClient = new SuiClient({ url: NETWORK_URLS[config.network as keyof typeof NETWORK_URLS] });

      // Initialize WalrusImageStorage
      const walrusImageStorage = createWalrusImageStorage(suiClient);

      // Connect to Walrus
      this.log('Connecting to Walrus storage...');
      await walrusImageStorage.connect();
      this.log('Connected to Walrus storage');

      if (args.action === 'upload') {
        // Upload image logic
        this.log('Uploading image to Walrus...');
        let imageUrl;
        // blobId will be declared below where it's assigned

        if (flags.image) {
          // Resolve relative path to absolute
          const absoluteImagePath = path.resolve(process.cwd(), flags.image);
          imageUrl = await walrusImageStorage.uploadCustomTodoImage(absoluteImagePath, todoItem.title, todoItem.completed);
        } else {
          // Use default image
          imageUrl = await walrusImageStorage.uploadDefaultImage();
        }

        // Extract blob ID from URL - this is important for NFT creation
        const blobId = imageUrl.split('/').pop() || ''; // Use const as it's not reassigned

        // Update todo with image URL
        const updatedTodo = {
          ...todoItem,
          imageUrl
        };
        await todoService.updateTodo(flags.todo, flags.list || 'default', updatedTodo);

        if (flags['show-url']) {
          // Only show the URL if requested
          this.log(imageUrl);
          return;
        }

        this.log(`✅ Image uploaded successfully to Walrus`);
        this.log(`📝 Image URL: ${imageUrl}`);
        this.log(`📝 Blob ID: ${blobId}`);
      } else if (args.action === 'create-nft') {
        // Create NFT logic (requires image URL and blob ID)
        if (!todoItem.imageUrl) {
          throw new CLIError('No image URL found for this todo. Please upload an image first using "upload" action.', 'NO_IMAGE_URL');
        }
        const blobId = todoItem.imageUrl.split('/').pop() || '';

        if (!config.lastDeployment?.packageId) {
          throw new CLIError('Todo NFT module address is not configured. Please deploy the NFT module first.');
        }

        this.log('Creating NFT on Sui blockchain...');
        const nftStorage = createSuiNftStorage(
          suiClient,
          config.lastDeployment.packageId
        );

        // Pass both the blob ID and image URL to createTodoNft
        const txDigest = await nftStorage.createTodoNft(todoItem, blobId, todoItem.imageUrl);
        this.log(`✅ NFT created successfully!`);
        this.log(`📝 Transaction: ${txDigest}`);
        this.log(`📝 Your NFT has been created with the following:`);
        this.log(`   - Title: ${todoItem.title}`);
        this.log(`   - Image URL: ${todoItem.imageUrl}`);
        this.log(`   - Walrus Blob ID: ${blobId}`);
        this.log('\nYou can view this NFT in your wallet with the embedded image from Walrus.');
      } else {
        throw new CLIError(`Invalid action: ${args.action}. Use 'upload' or 'create-nft'.`, 'INVALID_ACTION');
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to process image: ${error instanceof Error ? error.message : String(error)}`,
        'IMAGE_FAILED'
      );
    }
  }
}
