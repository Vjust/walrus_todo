import { Command, Flags, Args } from '@oclif/core';  // Added Args to import
import { CLIError } from '../utils/error-handler';
import { TodoService } from '../services/todoService';
import { SuiNftStorage } from '../utils/sui-nft-storage';
import { configService } from '../services/config-service';
import { WalrusImageStorage } from '../utils/walrus-image-storage';
import { NETWORK_URLS } from '../constants';
import { SuiClient } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
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
      description: 'Action to perform (upload, create-nft, or list)',
      required: true,
      options: ['upload', 'create-nft', 'list'],
    }),
  };

  static flags = {
    todo: Flags.string({
      char: 't',
      description: 'ID of the todo to create an image for',
      required: false, // Changed from true to false
      dependsOn: ['list'], // Only makes sense with list specified
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
      // Setup SuiClient
      const suiClient = {
        url: NETWORK_URLS[config.network as keyof typeof NETWORK_URLS],
        core: {},
        jsonRpc: {},
        signAndExecuteTransaction: async () => { },
        getEpochMetrics: async () => null,
        getObject: async () => null,
        getTransactionBlock: async () => null
      } as unknown as SuiClient;

      // Initialize WalrusImageStorage
      const walrusImageStorage = new WalrusImageStorage(suiClient);

      // For list action, we don't need a todo item or connection to Walrus
      if (args.action === 'list') {
        const allLists = await todoService.getAllLists();
        let foundImages = false;
        
        this.log('📷 Todos with associated images:');
        for (const listName of allLists) {
          const list = await todoService.getList(listName);
          if (list) {
            const todosWithImages = list.todos.filter(todo => todo.imageUrl);
            if (todosWithImages.length > 0) {
              this.log(`\n📝 List: ${listName}`);
              todosWithImages.forEach(todo => {
                this.log(`   - [${todo.id}] ${todo.title}: ${todo.imageUrl}`);
              });
              foundImages = true;
            }
          }
        }
        
        if (!foundImages) {
          this.log('⚠️ No todos with images found');
          this.log('\nTo add an image to a todo, use:');
          this.log('  waltodo image upload --todo <id> --list <list> [--image <path>]');
        }
        return;
      }
      
      // For upload and create-nft actions, we need a todo item
      if (!flags.todo || !flags.list) {
        throw new CLIError(`Todo ID (--todo) and list name (--list) are required for ${args.action} action`, 'MISSING_PARAMETERS');
      }
      
      // Get the todo item
      const todoItem = await todoService.getTodo(flags.todo, flags.list);
      if (!todoItem) {
        throw new CLIError(`Todo with ID ${flags.todo} not found in list ${flags.list}`, 'TODO_NOT_FOUND');
      }

      // Connect to Walrus
      this.log('Connecting to Walrus storage...');
      await walrusImageStorage.connect();
      this.log('Connected to Walrus storage');

      if (args.action === 'upload') {
        // Upload image logic
        this.log('Uploading image to Walrus...');
        let imageUrl;

        if (flags.image) {
          // Resolve relative path to absolute
          const absoluteImagePath = path.resolve(process.cwd(), flags.image);
          imageUrl = await walrusImageStorage.uploadTodoImage(absoluteImagePath, todoItem.title, todoItem.completed);
        } else {
          // Use default image
          imageUrl = await walrusImageStorage.uploadDefaultImage();
        }

        // Extract blob ID from URL - this is important for NFT creation
        const blobId = imageUrl.split('/').pop() || '';

        // Update todo with image URL
        const updatedTodo = {
          ...todoItem,
          imageUrl
        };
        await todoService.updateTodo(flags.todo, flags.list, updatedTodo);

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
        const nftStorage = new SuiNftStorage(
          suiClient,
          {} as Ed25519Keypair,
          { address: config.lastDeployment.packageId, packageId: config.lastDeployment.packageId }
        );

        // Create NFT with todo data and blob ID
        const txDigest = await nftStorage.createTodoNft(todoItem, blobId);
        this.log(`✅ NFT created successfully!`);
        this.log(`📝 Transaction: ${txDigest}`);
        this.log(`📝 Your NFT has been created with the following:`);
        this.log(`   - Title: ${todoItem.title}`);
        this.log(`   - Image URL: ${todoItem.imageUrl}`);
        this.log(`   - Walrus Blob ID: ${blobId}`);
        this.log('\nYou can view this NFT in your wallet with the embedded image from Walrus.');
      } else {
        throw new CLIError(`Invalid action: ${args.action}. Use 'upload', 'create-nft', or 'list'.`, 'INVALID_ACTION');
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
