import { Command, Flags } from '@oclif/core';
import { CLIError } from '../utils/error-handler';
import { TodoService } from '../services';
import { createSuiNftStorage } from '../utils/sui-nft-storage';
import { createWalrusImageStorage } from '../utils/walrus-image-storage';
import { TODO_NFT_CONFIG, NETWORK_URLS, CURRENT_NETWORK } from '../constants';
import { SuiClient } from '@mysten/sui/client';
import * as path from 'path';

export default class ImageCommand extends Command {
  static description = 'Manage images for todos and NFTs';

  static examples = [
    '<%= config.bin %> image upload --todo 123 --list my-todos --image ./custom.png',
    '<%= config.bin %> image create-nft --todo 123 --list my-todos',
  ];

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
    nft: Flags.boolean({
      description: 'Create an NFT that references the image',
    }),
    'show-url': Flags.boolean({
      description: 'Display only the image URL',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ImageCommand);
    const todoService = new TodoService();

    try {
      // Get the todo item
      const todoItem = await todoService.getTodo(flags.todo, flags.list);
      if (!todoItem) {
        throw new CLIError(`Todo with ID ${flags.todo} not found in list ${flags.list || 'default'}`);
      }

      // Setup SuiClient
      const suiClient = new SuiClient({ url: NETWORK_URLS[CURRENT_NETWORK] });

      // Initialize WalrusImageStorage
      const walrusImageStorage = createWalrusImageStorage(suiClient);

      // Connect to Walrus
      this.log('Connecting to Walrus storage...');
      await walrusImageStorage.connect();
      this.log('Connected to Walrus storage');

      // Upload image
      this.log('Uploading image to Walrus...');
      let imageUrl;
      let blobId;

      if (flags.image) {
        // Resolve relative path to absolute
        const absoluteImagePath = path.resolve(process.cwd(), flags.image);
        imageUrl = await walrusImageStorage.uploadCustomTodoImage(
          absoluteImagePath,
          todoItem.title,
          todoItem.completed
        );
      } else {
        // Use default image
        imageUrl = await walrusImageStorage.uploadDefaultImage();
      }

      // Extract blob ID from URL - this is important for NFT creation
      blobId = imageUrl.split('/').pop() || '';

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

      // Create NFT if requested
      if (flags.nft) {
        if (!process.env.SUI_PRIVATE_KEY) {
          throw new CLIError('SUI_PRIVATE_KEY environment variable is required to create NFTs');
        }

        if (!TODO_NFT_CONFIG.MODULE_ADDRESS || TODO_NFT_CONFIG.MODULE_ADDRESS === '0x0') {
          throw new CLIError('Todo NFT module address is not configured. Please deploy the NFT module first.');
        }

        this.log('Creating NFT on Sui blockchain...');
        const nftStorage = createSuiNftStorage(
          suiClient,
          TODO_NFT_CONFIG.MODULE_ADDRESS
        );

        // Pass both the blob ID and image URL to createTodoNft
        const txDigest = await nftStorage.createTodoNft(todoItem, blobId, imageUrl);
        this.log(`✅ NFT created successfully!`);
        this.log(`📝 Transaction: ${txDigest}`);
        this.log(`📝 Your NFT has been created with the following:`);
        this.log(`   - Title: ${todoItem.title}`);
        this.log(`   - Image URL: ${imageUrl}`);
        this.log(`   - Walrus Blob ID: ${blobId}`);
        this.log('\nYou can view this NFT in your wallet with the embedded image from Walrus.');
      }
    } catch (error) {
      if (error instanceof CLIError) {
        this.error(error.message);
      } else {
        this.error(`Failed to process image: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}