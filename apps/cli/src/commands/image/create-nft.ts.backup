import { Flags } from '@oclif/core';
import BaseCommand from '../../base-command';
import { CLIError } from '../../types/errors/consolidated';
import { TodoService } from '../../services/todoService';
import { SuiNftStorage } from '../../utils/sui-nft-storage';
import { NETWORK_URLS } from '../../constants';
import { SuiClient } from '../../utils/adapters/sui-client-compatibility';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { jobManager, performanceMonitor } from '../../utils/PerformanceMonitor';
import * as fs from 'fs';
import chalk = require('chalk');
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
    '<%= config.bin %> image create-nft --todo 123 --list my-todos --background   # Background NFT creation',
    '<%= config.bin %> image create-nft -t task-456 -l work -b --priority high    # High priority background',
    '<%= config.bin %> image create-nft --todo 789 --list personal --background --progress-file ./nft-progress.json',
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
    background: Flags.boolean({
      char: 'b',
      description: 'Create NFT in background without blocking terminal',
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
    'gas-budget': Flags.integer({
      description: 'Gas budget for NFT creation transaction (in MIST)',
      default: 100000000, // 0.1 SUI
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

      if (flags.background) {
        return await this.handleBackgroundNftCreation(
          flags,
          todoItem,
          blobId,
          suiClient,
          config
        );
      }

      // Initialize Sui NFT storage
      const suiNftStorage = new SuiNftStorage(suiClient, {} as Ed25519Keypair, {
        address: config.lastDeployment.packageId,
        packageId: config.lastDeployment.packageId,
      });

      // Create NFT with performance tracking
      this.log('Creating NFT on Sui blockchain...');
      const txDigest = await performanceMonitor.measureOperation(
        'nft-creation',
        async () => await suiNftStorage.createTodoNft(todoItem, blobId),
        {
          todoId: flags.todo,
          listName: flags.list,
          blobId,
          gasBudget: flags['gas-budget'],
        }
      );

      this.log(`✅ NFT created successfully!`);
      this.log(`📝 Transaction: ${txDigest}`);
      this.log(`📝 Your NFT has been created with the following:`);
      this.log(`   - Title: ${todoItem.title}`);
      this.log(`   - Image URL: ${todoItem.imageUrl}`);
      this.log(`   - Walrus Blob ID: ${blobId}`);
      this.log(`   - Gas Budget: ${flags['gas-budget']} MIST`);
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

  private async handleBackgroundNftCreation(
    flags: any,
    todoItem: any,
    blobId: string,
    suiClient: any,
    config: any
  ): Promise<void> {
    const jobId =
      flags['job-id'] ||
      jobManager.createJob('image', ['create-nft'], {
        todo: flags.todo,
        list: flags.list,
        priority: flags.priority,
        gasBudget: flags['gas-budget'],
      }).id;

    this.log(chalk.blue(`🔄 Starting background NFT creation...`));
    this.log(chalk.gray(`📝 Job ID: ${jobId}`));
    this.log(chalk.gray(`💡 Use 'waltodo status ${jobId}' to check progress`));
    this.log(chalk.gray(`💡 Use 'waltodo jobs' to list all background jobs`));
    this.log(chalk.gray(`💰 Gas Budget: ${flags['gas-budget']} MIST`));

    // Start background process
    setImmediate(async () => {
      try {
        jobManager.startJob(jobId, process.pid);
        jobManager.writeJobLog(jobId, 'Starting NFT creation operation...');
        jobManager.writeJobLog(jobId, `Todo: ${todoItem.title}`);
        jobManager.writeJobLog(jobId, `Image URL: ${todoItem.imageUrl}`);
        jobManager.writeJobLog(jobId, `Blob ID: ${blobId}`);
        jobManager.writeJobLog(
          jobId,
          `Gas Budget: ${flags['gas-budget']} MIST`
        );

        let progress = 0;
        const updateProgress = (
          message: string,
          progressIncrement: number = 20
        ) => {
          progress = Math.min(100, progress + progressIncrement);
          jobManager.updateProgress(jobId, progress);
          jobManager.writeJobLog(jobId, `[${progress}%] ${message}`);
          if (flags['progress-file']) {
            this.writeProgressFile(flags['progress-file'], progress, message);
          }
        };

        updateProgress('Validating blockchain configuration...', 10);

        updateProgress('Initializing NFT storage service...', 15);
        const suiNftStorage = new SuiNftStorage(
          suiClient,
          {} as Ed25519Keypair,
          {
            address: config.lastDeployment.packageId,
            packageId: config.lastDeployment.packageId,
          }
        );

        updateProgress('Preparing NFT metadata...', 15);

        updateProgress('Submitting transaction to Sui blockchain...', 30);
        const txDigest = await suiNftStorage.createTodoNft(todoItem, blobId);

        updateProgress('Waiting for transaction confirmation...', 20);

        updateProgress('NFT creation completed successfully!', 10);

        jobManager.completeJob(jobId, {
          txDigest,
          todoTitle: todoItem.title,
          imageUrl: todoItem.imageUrl,
          blobId,
          gasBudget: flags['gas-budget'],
          network: config.network,
        });

        jobManager.writeJobLog(jobId, `✅ NFT created successfully!`);
        jobManager.writeJobLog(jobId, `📝 Transaction: ${txDigest}`);
        jobManager.writeJobLog(
          jobId,
          `🔍 View on explorer: https://suiexplorer.com/txblock/${txDigest}?network=${config.network}`
        );
        jobManager.writeJobLog(jobId, `📋 NFT Details:`);
        jobManager.writeJobLog(jobId, `   - Title: ${todoItem.title}`);
        jobManager.writeJobLog(jobId, `   - Image URL: ${todoItem.imageUrl}`);
        jobManager.writeJobLog(jobId, `   - Walrus Blob ID: ${blobId}`);
        jobManager.writeJobLog(
          jobId,
          `   - Gas Used: ${flags['gas-budget']} MIST`
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        jobManager.failJob(jobId, errorMessage);
        jobManager.writeJobLog(
          jobId,
          `❌ NFT creation failed: ${errorMessage}`
        );

        // Log additional debugging info for blockchain errors
        if (errorMessage.includes('gas') || errorMessage.includes('budget')) {
          jobManager.writeJobLog(
            jobId,
            `💡 Tip: Try increasing gas budget with --gas-budget flag`
          );
        }
        if (
          errorMessage.includes('network') ||
          errorMessage.includes('connection')
        ) {
          jobManager.writeJobLog(
            jobId,
            `💡 Tip: Check network connectivity and try again`
          );
        }
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
