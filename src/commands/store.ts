import { Command, Flags } from '@oclif/core';
import { SuiClient } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { TodoService } from '../services/todoService';
import { createWalrusStorage } from '../utils/walrus-storage';
import { WalrusImageStorage } from '../utils/walrus-image-storage';
import { SuiNftStorage } from '../utils/sui-nft-storage';
import { CLIError } from '../types/error';
import { NETWORK_URLS } from '../constants';
import { configService } from '../services/config-service';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

/**
 * @class StoreCommand
 * @description This command stores a todo item on the blockchain using Walrus storage and creates an associated NFT on the Sui blockchain.
 * It handles uploading todo data and images to Walrus, creating or updating NFTs, and provides detailed feedback on the storage process.
 * The todo data is secured on the blockchain while maintaining a reference in the local storage for easy access.
 * The command supports mock mode for testing and includes robust error handling with rollback mechanisms to maintain data consistency.
 */
export default class StoreCommand extends Command {
  static description = 'Store a todo on blockchain with Walrus storage and create an NFT';

  static examples = [
    '<%= config.bin %> store --todo 123 --list my-todos',
    '<%= config.bin %> store --todo "Buy groceries" --list my-todos',
    '<%= config.bin %> store --todo 123 --list my-todos --image ./custom-image.png',
    '<%= config.bin %> store --todo 123 --list my-todos --mock'
  ];

  static flags = {
    mock: Flags.boolean({
      description: 'Use mock mode for testing',
      default: false
    }),
    todo: Flags.string({
      char: 't',
      description: 'ID or title of the todo to store',
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
    network: Flags.string({
      char: 'n',
      description: 'Network to use (defaults to configured network)',
      options: ['localnet', 'devnet', 'testnet', 'mainnet'],
    }),
  };

  /**
   * Service for managing todo operations
   * @private
   */
  private todoService = new TodoService();
  
  /**
   * Walrus storage client instance
   * @private
   */
  private walrusStorage = createWalrusStorage(false);
  
  /**
   * Reference to the spinner object for displaying progress
   * @private
   */
  private spinner: { text: string } | null = null;

  /**
   * Start a spinner with the given text message
   * Used to indicate ongoing operations to the user
   * @param text The text to display alongside the spinner
   * @private
   */
  private startSpinner(text: string) {
    if (this.spinner) {
      this.spinner.text = text;
    } else {
      this.log(chalk.blue(text));
    }
  }

  /**
   * Stop the current spinner and display a success or failure message
   * @param success Whether the operation succeeded
   * @param text Optional message to display
   * @private
   */
  private stopSpinner(success = true, text?: string) {
    if (text) {
      this.log(success ? chalk.green(`✓ ${text}`) : chalk.red(`✗ ${text}`));
    }
  }

  /**
   * Main command execution method
   * Handles the entire workflow of storing a todo on the blockchain:
   * 1. Configuration validation and network setup
   * 2. Todo verification and retrieval from local storage
   * 3. Blockchain storage of todo data via Walrus
   * 4. Image preparation and upload (custom or default)
   * 5. NFT creation or update on Sui blockchain
   * 6. Local storage updates with blockchain references
   * 
   * Each step includes thorough error handling and rollback mechanisms
   * to ensure data consistency between local and blockchain storage.
   */
  async run(): Promise<void> {
    try {
      const { flags } = await this.parse(StoreCommand);
      
      this.startSpinner('Loading configuration...');
      const config = await configService.getConfig();
      
      const network = flags.network || config.network || 'testnet';
      const mockMode = flags.mock || false;

      this.walrusStorage = createWalrusStorage(mockMode);
      
      // Validate network configuration
      if (!NETWORK_URLS[network as keyof typeof NETWORK_URLS]) {
        throw new CLIError(`Invalid network: ${network}. Available networks: ${Object.keys(NETWORK_URLS).join(', ')}`, 'INVALID_NETWORK');
      }

      // Validate deployment information
      if (!config.lastDeployment?.packageId) {
        throw new CLIError(
          `Contract not deployed on network "${network}". Please run "waltodo deploy --network ${network}" first.`,
          'NOT_DEPLOYED'
        );
      }
      this.stopSpinner(true, 'Configuration validated');

      // Get the todo from local storage using title or ID
      const todo = await this.todoService.getTodoByTitleOrId(flags.todo, flags.list);
      if (!todo) {
        throw new CLIError(`Todo "${flags.todo}" not found in list "${flags.list}"`, 'TODO_NOT_FOUND');
      }

      // Initialize SUI client using the provided or configured network
      const networkUrl = NETWORK_URLS[network as keyof typeof NETWORK_URLS];
      if (!networkUrl) {
        throw new CLIError(`Invalid network: ${network}`, 'INVALID_NETWORK');
      }
      
      /**
       * SUI client object for blockchain interactions
       * In mock mode, this is a minimal mock implementation
       */
      const suiClient = {
        url: networkUrl,
        core: {},
        jsonRpc: {},
        signAndExecuteTransaction: async () => { },
        getEpochMetrics: async () => null,
        getObject: async () => null,
        getTransactionBlock: async () => null
      } as unknown as SuiClient;
      
      // Initialize and validate Walrus storage connection
      this.startSpinner('Connecting to Walrus storage...');
      await this.walrusStorage.connect();
      const isConnected = await this.walrusStorage.isConnected();
      if (!isConnected) {
        throw new CLIError('Failed to establish connection with Walrus storage', 'WALRUS_CONNECTION_FAILED');
      }
      this.stopSpinner(true, 'Connected to Walrus storage');

      // Store todo on Walrus with enhanced error handling and rollback
      this.startSpinner(`Storing todo "${todo.title}" on Walrus...`);
      let blobId;
      const originalBlobId = todo.walrusBlobId;
      
      try {
        // Pre-upload validation
        this.startSpinner('Validating todo data...');
        if (!todo.title || typeof todo.title !== 'string') {
          throw new CLIError('Invalid todo: missing or invalid title', 'VALIDATION_ERROR');
        }
        this.stopSpinner(true, 'Todo data validated');

        // Storage verification
        this.startSpinner('Verifying storage capacity...');
        await this.walrusStorage.ensureStorageAllocated();
        this.stopSpinner(true, 'Storage capacity verified');

        // Attempt upload with enhanced monitoring
        this.startSpinner('Uploading to Walrus storage...');
        blobId = await this.walrusStorage.storeTodo(todo);
        
        // Verify upload success
        this.startSpinner('Verifying upload...');
        const uploadedTodo = await this.walrusStorage.retrieveTodo(blobId);
        if (!uploadedTodo || uploadedTodo.id !== todo.id) {
          throw new CLIError('Upload verification failed: content mismatch', 'VERIFICATION_ERROR');
        }
        
        this.stopSpinner(true, 'Todo data stored and verified on Walrus');
        this.log(chalk.dim("Blob ID: " + blobId));

        // Update local state only after successful verification
        await this.todoService.updateTodo(flags.list, todo.id, {
          walrusBlobId: blobId,
          updatedAt: new Date().toISOString()
        });

      } catch (walrusError) {
        this.stopSpinner(false);
        const errorMessage = walrusError instanceof Error ? walrusError.message : String(walrusError);
        
        // Attempt rollback if needed
        if (blobId && blobId !== originalBlobId) {
          this.startSpinner('Upload failed. Rolling back to previous state...');
          try {
            await this.todoService.updateTodo(flags.list, todo.id, {
              walrusBlobId: originalBlobId,
              updatedAt: new Date().toISOString()
            });
            this.stopSpinner(true, 'Rollback successful');
          } catch (rollbackError) {
            this.stopSpinner(false, 'Rollback failed');
            console.error(chalk.red('Warning: Local state may be inconsistent'));
          }
        }

        // Categorized error handling with detailed messages
        if (errorMessage.includes('timeout') || errorMessage.includes('connection')) {
          throw new CLIError(
            'Network error while storing todo. Please check your connection and try again.\n' +
            `Details: ${errorMessage}`,
            'NETWORK_ERROR'
          );
        } else if (errorMessage.includes('storage') || errorMessage.includes('capacity')) {
          throw new CLIError(
            'Storage allocation failed. Please ensure you have sufficient WAL tokens.\n' +
            `Details: ${errorMessage}`,
            'STORAGE_ERROR'
          );
        } else if (errorMessage.includes('validation')) {
          throw new CLIError(
            'Todo data validation failed. Please check the data format.\n' +
            `Details: ${errorMessage}`,
            'VALIDATION_ERROR'
          );
        } else if (errorMessage.includes('verification')) {
          throw new CLIError(
            'Upload verification failed. The todo may not have been stored correctly.\n' +
            `Details: ${errorMessage}`,
            'VERIFICATION_ERROR'
          );
        } else {
          throw new CLIError(
            'Failed to store todo. Please try again.\n' +
            `Details: ${errorMessage}`,
            'WALRUS_STORAGE_FAILED'
          );
        }
      }

      // Initialize and validate image storage connection
      this.startSpinner('Initializing image storage...');
      const walrusImageStorage = new WalrusImageStorage(suiClient, mockMode);
      await walrusImageStorage.connect();
      
      // Connection is validated through the connect() call - it will throw if connection fails
      this.stopSpinner(true, 'Image storage initialized');

      // Upload image to Walrus with progress
      let imageUrl: string = todo.imageUrl || '';
      const originalImageUrl = todo.imageUrl;

      try {
        this.startSpinner('Preparing image upload...');
        if (flags.image) {
          // Verify image file exists and validate
          const imagePath = path.resolve(process.cwd(), flags.image);
          if (!fs.existsSync(imagePath)) {
            throw new CLIError(`Image file not found: ${flags.image}`, 'FILE_NOT_FOUND');
          }

          const stats = fs.statSync(imagePath);
          if (stats.size > 10 * 1024 * 1024) { // 10MB limit
            throw new CLIError('Image file size exceeds 10MB limit', 'FILE_SIZE_ERROR');
          }

          const ext = path.extname(imagePath).toLowerCase();
          if (!['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
            throw new CLIError('Invalid image format. Supported formats: JPG, PNG, GIF', 'FILE_FORMAT_ERROR');
          }

          // Upload custom image with verification
          this.startSpinner('Uploading custom image to Walrus...');
          imageUrl = await walrusImageStorage.uploadTodoImage(
            imagePath,
            todo.title,
            todo.completed || false
          );
        } else {
          // Use default image with verification
          this.startSpinner('Uploading default image to Walrus...');
          imageUrl = await walrusImageStorage.uploadDefaultImage();
        }

        // Verify image URL is accessible
        this.startSpinner('Verifying image accessibility...');
        try {
          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`Image verification failed: ${response.statusText}`);
          }
        } catch (verifyError) {
          throw new CLIError(
            `Image accessibility check failed: ${verifyError instanceof Error ? verifyError.message : String(verifyError)}`,
            'IMAGE_VERIFICATION_ERROR'
          );
        }

        this.stopSpinner(true, `Image uploaded and verified: ${imageUrl}`);
        
        await this.todoService.updateTodo(flags.list, todo.id, {
          imageUrl,
          updatedAt: new Date().toISOString()
        });

      } catch (error) {
        this.stopSpinner(false);
        
        // Attempt rollback if needed
        if (imageUrl && imageUrl !== originalImageUrl) {
          this.startSpinner('Image upload failed. Rolling back to previous state...');
          try {
            await this.todoService.updateTodo(flags.list, todo.id, {
              imageUrl: originalImageUrl,
              updatedAt: new Date().toISOString()
            });
            this.stopSpinner(true, 'Image rollback successful');
          } catch (rollbackError) {
            this.stopSpinner(false, 'Image rollback failed');
            console.error(chalk.red('Warning: Local image state may be inconsistent'));
          }
        }

        if (error instanceof CLIError) {
          throw error;
        }

        // Categorized error handling
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('size')) {
          throw new CLIError('Image file size exceeds limit: Maximum size is 10MB', 'FILE_SIZE_ERROR');
        } else if (errorMessage.includes('format')) {
          throw new CLIError('Invalid image format. Supported formats: JPG, PNG, GIF', 'FILE_FORMAT_ERROR');
        } else if (errorMessage.includes('verification')) {
          throw new CLIError('Image upload verification failed. Please try again', 'IMAGE_VERIFICATION_ERROR');
        } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
          throw new CLIError('Network error during image upload. Please check your connection', 'NETWORK_ERROR');
        } else {
          throw new CLIError(
            `Failed to upload image to Walrus: ${errorMessage}`,
            'IMAGE_UPLOAD_FAILED'
          );
        }
      }

      // Initialize Sui NFT storage with mock mode
      // Initialize NFT storage with validation
      this.startSpinner('Initializing NFT storage...');
      const signer = {} as Ed25519Keypair;
const suiNftStorage = new SuiNftStorage(
  suiClient,
  signer,
  { address: config.lastDeployment.packageId, packageId: config.lastDeployment.packageId, collectionId: '' }
);
      
      if (!mockMode) {
        const networkStatus = await suiClient.getLatestCheckpointSequenceNumber().catch(() => null);
        if (!networkStatus) {
          throw new CLIError(`Unable to connect to Sui network: ${network}`, 'NETWORK_ERROR');
        }
      }
      this.stopSpinner(true, 'NFT storage initialized');

      // Check if NFT already exists for this todo
      let txDigest: string | undefined;
      const existingNftId = todo.nftObjectId;
      
      try {
        if (existingNftId) {
          this.startSpinner('Found existing NFT, checking for updates...');
          const existingNft = await suiNftStorage.getTodoNft(existingNftId);

          // Compare and update if needed
          let updateNeeded = false;
          
          if (existingNft.title !== todo.title) {
            this.startSpinner('Updating NFT title...');
            await suiNftStorage.createTodoNft(todo, todo.walrusBlobId!);
            updateNeeded = true;
          }

          if (existingNft.description !== (todo.description || '')) {
            this.startSpinner('Updating NFT description...');
            await suiNftStorage.createTodoNft(todo, todo.walrusBlobId!);
            updateNeeded = true;
          }

          if (existingNft.walrusBlobId !== blobId) {
            this.startSpinner('Updating NFT image...');
            txDigest = await suiNftStorage.createTodoNft(todo, blobId);
            updateNeeded = true;
          }

          if (updateNeeded) {
            this.stopSpinner(true, 'NFT updated successfully');
          } else {
            this.stopSpinner(true, 'NFT is already up to date');
          }
          
        } else {
          // Create new NFT if none exists
          this.startSpinner('Creating new NFT on Sui blockchain...');
          txDigest = await suiNftStorage.createTodoNft(todo, blobId);
        }
        this.stopSpinner(true, 'NFT creation transaction submitted');
      } catch (nftError) {
        this.stopSpinner(false);
        const errorMessage = nftError instanceof Error ? nftError.message : String(nftError);
        if (errorMessage.includes('gas')) {
          throw new CLIError('Insufficient gas for NFT creation. Please add funds to your wallet.', 'INSUFFICIENT_GAS');
        } else if (errorMessage.includes('network')) {
          throw new CLIError(`Network error during NFT creation: ${errorMessage}`, 'NETWORK_ERROR');
        } else {
          throw new CLIError(`Failed to create NFT: ${errorMessage}`, 'NFT_CREATION_FAILED');
        }
      }

      // Get transaction effects to extract the created NFT Object ID
      let txResponse;
      let nftObjectId;
      try {
        if (flags.mock) {
          // In mock mode, generate a mock NFT object ID
          nftObjectId = `0xmock-nft-${Date.now()}`;
        } else if (txDigest) {
          // In real mode, get the object ID from transaction
          txResponse = await suiClient.getTransactionBlock({
            digest: txDigest,
          });
          
          if (txResponse.effects?.status.status !== 'success') {
            throw new CLIError(
              `Transaction failed with status: ${txResponse.effects?.status.status || 'unknown'}`, 
              'TX_FAILED'
            );
          }
          
          const createdObjects = txResponse.effects.created;
          if (!createdObjects || createdObjects.length === 0) {
            throw new CLIError('No objects created in transaction', 'TX_PARSE_ERROR');
          }
          
          nftObjectId = createdObjects[0].reference.objectId;
        }

        // Update local todo with NFT Object ID
        await this.todoService.updateTodo(flags.list, todo.id, {
          nftObjectId,
          walrusBlobId: blobId,
          imageUrl: imageUrl
        });

        // Display success messages and retrieval instructions
        this.log('\n' + chalk.green.bold('✨ Todo successfully stored! ✨'));
        this.log('\n' + chalk.blue.bold('Storage Summary:'));
        this.log(chalk.dim('----------------------------------------'));
        this.log(chalk.green('✓ Stored locally in list:'), chalk.cyan(flags.list));
        this.log(chalk.green('✓ Stored on Walrus with blob ID:'), chalk.dim(blobId));
        this.log(chalk.green('✓ Created NFT with object ID:'), chalk.cyan(nftObjectId));

        this.log('\n' + chalk.blue.bold('How to Retrieve:'));
        this.log(chalk.dim('----------------------------------------'));
        this.log(chalk.yellow('1. By todo title/ID (recommended):'));
        this.log(chalk.dim(`   ${this.config.bin} retrieve --todo "${todo.title}" --list ${flags.list}`));
        this.log(chalk.yellow('2. By Walrus blob ID:'));
        this.log(chalk.dim(`   ${this.config.bin} retrieve --blob-id ${blobId} --list ${flags.list}`));
        this.log(chalk.yellow('3. By NFT object ID:'));
        this.log(chalk.dim(`   ${this.config.bin} retrieve --object-id ${nftObjectId} --list ${flags.list}`));

        if (!flags.mock) {
          this.log('\n' + chalk.blue.bold('View on Sui Explorer:'));
          this.log(chalk.dim('----------------------------------------'));
          this.log(chalk.cyan(`  https://explorer.sui.io/object/${nftObjectId}?network=${network}`));
          this.log(chalk.cyan(`  https://explorer.sui.io/txblock/${txDigest}?network=${network}`));
        }
      } catch (txError) {
        if (txError instanceof CLIError) {
          throw txError;
        }
        throw new CLIError(
          `Failed to process transaction: ${txError instanceof Error ? txError.message : String(txError)}`,
          'TX_PROCESSING_FAILED'
        );
      } finally {
        // Enhanced cleanup with proper error handling
        this.startSpinner('Cleaning up resources...');
        try {
          await Promise.all([
            this.walrusStorage.disconnect(),
            walrusImageStorage.disconnect?.()
          ]);
          this.stopSpinner(true, 'Resources cleaned up');
        } catch (cleanupError) {
          this.stopSpinner(false, 'Resource cleanup encountered issues');
          console.warn(`Warning: Some resources may not have been properly cleaned up: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
        }
      }
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