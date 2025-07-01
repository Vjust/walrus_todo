import { Flags, Args } from '@oclif/core';
import { BaseCommand } from '../base-command';
import { CLIError } from '../types/errors/consolidated';
import { TodoService } from '../services/todo';
import { SuiNftStorage } from '../utils/sui-nft-storage';
import { configService } from '../services/config-service';
import { WalrusImageStorage } from '../utils/walrus-image-storage';
import { NETWORK_URLS } from '../constants';
import { SuiClient } from '../utils/adapters/sui-client-compatibility';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { jobManager, performanceMonitor } from '../utils/PerformanceMonitor';
import {
  BackgroundOperations,
  createBackgroundOperationsManager,
} from '../utils/background-operations';
import * as path from 'path';
import * as fs from 'fs';
import chalk = require('chalk');

/**
 * @class ImageCommand
 * @description This command manages images associated with todo items, facilitating upload to Walrus storage and NFT creation on the Sui blockchain.
 * It supports three actions: uploading an image for a todo, creating an NFT from a todo with an image, and listing todos with associated images.
 * The command integrates with Walrus for image storage and Sui for NFT minting, ensuring seamless handling of multimedia todos.
 *
 * @param {string} action - The action to perform: 'upload' for image upload, 'create-nft' for NFT creation, or 'list' to view todos with images. (Required argument)
 * @param {string} [todo] - The ID of the todo item to associate an image with or create an NFT for. Required for 'upload' and 'create-nft' actions. (Optional flag: -t, --todo)
 * @param {string} [list] - The name of the todo list containing the specified todo. Required for 'upload' and 'create-nft' actions. (Optional flag: -l, --list)
 * @param {string} [image] - Path to a custom image file to upload for the todo. If not provided, a default image is used. (Optional flag: -i, --image)
 * @param {boolean} [show-url=false] - If true, displays only the image URL after upload. (Optional flag: --show-url)
 */
export default class ImageCommand extends BaseCommand {
  static description =
    'Upload images to Walrus storage and create NFTs from todo items with associated images';

  static examples = [
    '<%= config.bin %> image upload --todo 123 --list my-todos --image ./custom.png  # Upload image',
    '<%= config.bin %> image create-nft --todo 123 --list my-todos                   # Create NFT',
    '<%= config.bin %> image list --list my-todos                                    # List todo images',
    '<%= config.bin %> image upload --todo "Buy milk" --list shopping --image photo.jpg --background  # Background upload',
    '<%= config.bin %> image create-nft --todo task-456 --list work --background --priority high      # Background NFT creation',
    '<%= config.bin %> image upload --todo 789 --list personal --image large.jpg --background --progress-file ./progress.json',
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
    ...BaseCommand.flags,
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
    background: Flags.boolean({
      char: 'b',
      description: 'Run operation in background without blocking terminal',
      default: false,
    }),
    'job-id': Flags.string({
      description: 'Optional job ID for background operation tracking',
    }),
    priority: Flags.string({
      char: 'p',
      description: 'Job priority for background operations',
      options: ['low', 'medium', 'high'],
      default: 'medium',
    }),
    'progress-file': Flags.string({
      description: 'File to write progress updates for background operations',
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
        core: {} as Record<string, unknown>,
        jsonRpc: {} as Record<string, unknown>,
        signAndExecuteTransaction: async () => {},
        getEpochMetrics: async () => null,
        getObject: async () => null,
        getTransactionBlock: async () => null,
      } as unknown as typeof SuiClient;

      // Initialize WalrusImageStorage
      const walrusImageStorage = new WalrusImageStorage(suiClient);

      // For list action, we don't need a todo item or connection to Walrus
      if (args?.action === 'list') {
        const allLists = await todoService.getAllLists();
        let foundImages = false;

        this.log('📷 Todos with associated images:');
        for (const listName of allLists) {
          const list = await todoService.getList(listName);
          if (list) {
            const todosWithImages = list?.todos?.filter(todo => todo.imageUrl);
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
          this.log(
            '  waltodo image upload --todo <id> --list <list> [--image <path>]'
          );
        }
        return;
      }

      // For upload and create-nft actions, we need a todo item
      if (!flags.todo || !flags.list) {
        throw new CLIError(
          `Todo ID (--todo) and list name (--list) are required for ${args.action} action`,
          'MISSING_PARAMETERS'
        );
      }

      // Get the todo item
      const todoItem = await todoService.getTodo(flags.todo, flags.list);
      if (!todoItem) {
        throw new CLIError(
          `Todo with ID ${flags.todo} not found in list ${flags.list}`,
          'TODO_NOT_FOUND'
        );
      }

      // Connect to Walrus
      this.log('Connecting to Walrus storage...');
      await walrusImageStorage.connect();
      this.log('Connected to Walrus storage');

      if (args?.action === 'upload') {
        if (flags.background) {
          return await this.handleBackgroundUpload(
            flags,
            todoItem,
            walrusImageStorage,
            todoService
          );
        }

        // Upload image logic
        this.log('Uploading image to Walrus...');
        let imageUrl;

        const operationId = performanceMonitor.measureOperation(
          'image-upload',
          async () => {
            if (flags.image) {
              // Resolve relative path to absolute
              const absoluteImagePath = path.resolve(
                process.cwd(),
                flags.image
              );
              return await walrusImageStorage.uploadTodoImage(
                absoluteImagePath,
                todoItem.title,
                todoItem.completed
              );
            } else {
              // Use default image
              return await walrusImageStorage.uploadDefaultImage();
            }
          }
        );

        imageUrl = await operationId;

        // Extract blob ID from URL - this is important for NFT creation
        const blobId = imageUrl.split('/').pop() || '';

        // Update todo with image URL
        const updatedTodo = {
          ...todoItem,
          imageUrl,
        };
        await todoService.updateTodo(flags.todo, flags.list, updatedTodo);

        if (flags?.["show-url"]) {
          // Only show the URL if requested
          this.log(imageUrl);
          return;
        }

        this.log(`✅ Image uploaded successfully to Walrus`);
        this.log(`📝 Image URL: ${imageUrl}`);
        this.log(`📝 Blob ID: ${blobId}`);
      } else if (args?.action === 'create-nft') {
        // Create NFT logic (requires image URL and blob ID)
        if (!todoItem.imageUrl) {
          throw new CLIError(
            'No image URL found for this todo. Please upload an image first using "upload" action.',
            'NO_IMAGE_URL'
          );
        }
        const blobId = todoItem?.imageUrl?.split('/').pop() || '';

        if (!config.lastDeployment?.packageId) {
          throw new CLIError(
            'Todo NFT module address is not configured. Please deploy the NFT module first.'
          );
        }

        if (flags.background) {
          return await this.handleBackgroundNftCreation(
            flags,
            todoItem,
            blobId,
            suiClient,
            config
          );
        }

        this.log('Creating NFT on Sui blockchain...');
        const nftStorage = new SuiNftStorage(suiClient, {} as Ed25519Keypair, {
          address: config?.lastDeployment?.packageId,
          packageId: config?.lastDeployment?.packageId,
        });

        // Create NFT with todo data and blob ID
        const txDigest = await performanceMonitor.measureOperation(
          'nft-creation',
          async () => await nftStorage.createTodoNft(todoItem, blobId)
        );
        this.log(`✅ NFT created successfully!`);
        this.log(`📝 Transaction: ${txDigest}`);
        this.log(`📝 Your NFT has been created with the following:`);
        this.log(`   - Title: ${todoItem.title}`);
        this.log(`   - Image URL: ${todoItem.imageUrl}`);
        this.log(`   - Walrus Blob ID: ${blobId}`);
        this.log(
          '\nYou can view this NFT in your wallet with the embedded image from Walrus.'
        );
      } else {
        throw new CLIError(
          `Invalid action: ${args.action}. Use 'upload', 'create-nft', or 'list'.`,
          'INVALID_ACTION'
        );
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

  private async handleBackgroundUpload(
    flags: any,
    todoItem: any,
    walrusImageStorage: WalrusImageStorage,
    todoService: TodoService
  ): Promise<void> {
    const jobId =
      flags?.["job-id"] ||
      jobManager.createJob('image', ['upload'], {
        todo: flags.todo,
        list: flags.list,
        image: flags.image,
        priority: flags.priority,
      }).id;

    this.log(chalk.blue(`🔄 Starting background image upload...`));
    this.log(chalk.gray(`📝 Job ID: ${jobId}`));
    this.log(chalk.gray(`💡 Use 'waltodo status ${jobId}' to check progress`));
    this.log(chalk.gray(`💡 Use 'waltodo jobs' to list all background jobs`));

    // Start background process
    setImmediate(async () => {
      try {
        jobManager.startJob(jobId, process.pid);
        jobManager.writeJobLog(jobId, 'Starting image upload operation...');

        let progress = 0;
        const updateProgress = (
          message: string,
          progressIncrement: number = 10
        ) => {
          progress = Math.min(100, progress + progressIncrement);
          jobManager.updateProgress(jobId, progress);
          jobManager.writeJobLog(jobId, `[${progress}%] ${message}`);
          if (flags?.["progress-file"]) {
            this.writeProgressFile(flags?.["progress-file"], progress, message);
          }
        };

        updateProgress('Connecting to Walrus storage...', 10);
        await walrusImageStorage.connect();

        updateProgress('Preparing image upload...', 10);
        let imageUrl: string;

        if (flags.image) {
          const absoluteImagePath = path.resolve(process.cwd(), flags.image);
          updateProgress('Uploading custom image...', 20);
          imageUrl = await walrusImageStorage.uploadTodoImage(
            absoluteImagePath,
            todoItem.title,
            todoItem.completed
          );
        } else {
          updateProgress('Uploading default image...', 20);
          imageUrl = await walrusImageStorage.uploadDefaultImage();
        }

        updateProgress('Processing image metadata...', 20);
        const blobId = imageUrl.split('/').pop() || '';

        updateProgress('Updating todo with image URL...', 20);
        const updatedTodo = { ...todoItem, imageUrl };
        await todoService.updateTodo(flags.todo, flags.list, updatedTodo);

        updateProgress('Upload completed successfully!', 10);

        jobManager.completeJob(jobId, {
          imageUrl,
          blobId,
          todoId: flags.todo,
          listName: flags.list,
        });

        jobManager.writeJobLog(
          jobId,
          `✅ Image uploaded successfully: ${imageUrl}`
        );
        jobManager.writeJobLog(jobId, `📝 Blob ID: ${blobId}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        jobManager.failJob(jobId, errorMessage);
        jobManager.writeJobLog(jobId, `❌ Upload failed: ${errorMessage}`);
      }
    });

    // Exit immediately to return control to terminal
    return;
  }

  private async handleBackgroundNftCreation(
    flags: any,
    todoItem: any,
    blobId: string,
    suiClient: any,
    config: any
  ): Promise<void> {
    const jobId =
      flags?.["job-id"] ||
      jobManager.createJob('image', ['create-nft'], {
        todo: flags.todo,
        list: flags.list,
        priority: flags.priority,
      }).id;

    this.log(chalk.blue(`🔄 Starting background NFT creation...`));
    this.log(chalk.gray(`📝 Job ID: ${jobId}`));
    this.log(chalk.gray(`💡 Use 'waltodo status ${jobId}' to check progress`));
    this.log(chalk.gray(`💡 Use 'waltodo jobs' to list all background jobs`));

    // Start background process
    setImmediate(async () => {
      try {
        jobManager.startJob(jobId, process.pid);
        jobManager.writeJobLog(jobId, 'Starting NFT creation operation...');

        let progress = 0;
        const updateProgress = (
          message: string,
          progressIncrement: number = 20
        ) => {
          progress = Math.min(100, progress + progressIncrement);
          jobManager.updateProgress(jobId, progress);
          jobManager.writeJobLog(jobId, `[${progress}%] ${message}`);
          if (flags?.["progress-file"]) {
            this.writeProgressFile(flags?.["progress-file"], progress, message);
          }
        };

        updateProgress('Initializing NFT storage...', 20);
        const nftStorage = new SuiNftStorage(suiClient, {} as Ed25519Keypair, {
          address: config?.lastDeployment?.packageId,
          packageId: config?.lastDeployment?.packageId,
        });

        updateProgress('Preparing NFT metadata...', 20);

        updateProgress('Creating NFT on Sui blockchain...', 30);
        const txDigest = await nftStorage.createTodoNft(todoItem, blobId);

        updateProgress('NFT creation completed!', 30);

        jobManager.completeJob(jobId, {
          txDigest,
          todoTitle: todoItem.title,
          imageUrl: todoItem.imageUrl,
          blobId,
        });

        jobManager.writeJobLog(jobId, `✅ NFT created successfully!`);
        jobManager.writeJobLog(jobId, `📝 Transaction: ${txDigest}`);
        jobManager.writeJobLog(jobId, `📝 Title: ${todoItem.title}`);
        jobManager.writeJobLog(jobId, `📝 Image URL: ${todoItem.imageUrl}`);
        jobManager.writeJobLog(jobId, `📝 Walrus Blob ID: ${blobId}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        jobManager.failJob(jobId, errorMessage);
        jobManager.writeJobLog(
          jobId,
          `❌ NFT creation failed: ${errorMessage}`
        );
      }
    });

    // Exit immediately to return control to terminal
    return;
  }

  private writeProgressFile(
    filePath: string,
    progress: number,
    message: string
  ): void {
    try {
      const progressData = {
        progress,
        message,
        timestamp: new Date().toISOString(),
      };
      fs.writeFileSync(filePath, JSON.stringify(progressData, null, 2));
    } catch (error) {
      // Silently ignore progress file write errors
    }
  }
}
