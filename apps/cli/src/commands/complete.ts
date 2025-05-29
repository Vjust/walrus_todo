import { Args, Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { TodoService } from '../services/todoService';
import { createWalrusStorage } from '../utils/walrus-storage';
import { SuiNftStorage } from '../utils/sui-nft-storage';
import { NETWORK_URLS, TODO_NFT_CONFIG } from '../constants';
import { CLIError } from '../types/errors/consolidated';
import { configService } from '../services/config-service';
import chalk = require('chalk');
import { RetryManager } from '../utils/retry-manager';
import * as fs from 'fs';
import * as path from 'path';
import { Todo } from '../types/todo';
import { AppConfig } from '../types/config';
import {
  jobManager,
  BackgroundJob,
  performanceMonitor,
} from '../utils/PerformanceMonitor';
import { MultiProgress, ProgressBar } from '../utils/progress-indicators';
import { spawn } from 'child_process';

// Define interface for parsed flags to fix property access
interface CompleteCommandFlags {
  id?: string;
  list?: string;
  network?: string;
  debug?: boolean;
  verbose?: boolean;
  output?: string;
  mock?: boolean;
  apiKey?: string;
  help?: void;
  timeout?: number;
  force?: boolean;
  quiet?: boolean;
  background?: boolean;
  batch?: boolean;
  batchSize?: number;
}

// BufferEncoding type definition

/**
 * @class CompleteCommand
 * @description Marks a todo item as completed. This command handles updates for todos stored locally,
 * on the Walrus blockchain, and as NFTs on the Sui blockchain.
 *
 * Key functionalities:
 * - Marks a local todo item as complete.
 * - If the todo has an associated Sui NFT, it updates the NFT's 'completed' status on-chain.
 *   This requires the smart contract to be deployed and may incur gas fees.
 * - If the todo has an associated Walrus blob ID, it updates the blob on Walrus storage.
 * - Provides feedback on the success of local, NFT, and Walrus updates.
 * - Includes retries and error handling for blockchain operations.
 *
 * Usage patterns:
 * - waltodo complete <todo-id>                     # Complete from default list
 * - waltodo complete <list> <todo-id>              # Complete from specific list
 * - waltodo complete -i <todo-id> --list <list>    # Legacy format with flags
 *
 * @param {string} [listOrTodo] - List name or todo ID/title (positional)
 * @param {string} [todoId] - Todo ID or title when list is specified (positional)
 * @param {string} [network] - The blockchain network to use (optional flag: -n, --network)
 */
class CompleteCommand extends BaseCommand {
  static description = `Mark a todo as completed.
  If the todo has an associated NFT or Walrus blob, updates blockchain storage as well.
  NFT updates may require gas tokens on the configured network.
  
  Background Mode:
  Use --background to run completion in the background without blocking the terminal.
  Perfect for large blockchain operations or when dealing with network latency.
  
  Batch Mode:
  Use --batch to complete multiple todos in parallel with progress tracking.
  Combine with --list to complete all todos in a specific list.`;

  static examples = [
    '<%= config.bin %> complete todo-123                        # Complete from default list',
    '<%= config.bin %> complete mylist todo-456                 # Complete from specific list',
    '<%= config.bin %> complete "Buy groceries"                 # Complete by title from default list',
    '<%= config.bin %> complete work "Finish report"            # Complete by title from specific list',
    '<%= config.bin %> complete mylist todo-789 --network testnet  # Use specific network',
    '<%= config.bin %> complete todo-123 --background           # Complete in background',
    '<%= config.bin %> complete --batch --list work             # Complete all todos in list',
    '<%= config.bin %> complete --batch --batchSize 10          # Batch complete with custom batch size',
    '',
    'Legacy format (still supported):',
    '<%= config.bin %> complete -i todo-123                     # Complete with flags',
    '<%= config.bin %> complete mylist -i "Buy groceries"      # Complete with list and flags',
  ];

  static flags = {
    ...BaseCommand.flags,
    id: Flags.string({
      char: 'i',
      description: 'Todo ID or title to mark as completed (legacy format)',
      required: false,
    }),
    network: Flags.string({
      char: 'n',
      description: 'Network to use (defaults to configured network)',
      options: ['localnet', 'devnet', 'testnet', 'mainnet'],
    }),
    list: Flags.string({
      char: 'l',
      description: 'List name (legacy format)',
    }),
    background: Flags.boolean({
      char: 'b',
      description: 'Run completion in background (non-blocking)',
      default: false,
    }),
    batch: Flags.boolean({
      description: 'Enable batch completion mode for multiple todos',
      default: false,
    }),
    batchSize: Flags.integer({
      description: 'Number of todos to process in parallel (batch mode)',
      default: 5,
      min: 1,
      max: 20,
    }),
  };

  static args = {
    listOrTodo: Args.string({
      name: 'listOrTodo',
      description: 'List name or todo ID/title',
      required: false,
    }),
    todoId: Args.string({
      name: 'todoId',
      description: 'Todo ID or title',
      required: false,
    }),
  };

  private todoService = new TodoService();
  private walrusStorage = createWalrusStorage('testnet', false); // Use real Walrus storage

  /**
   * Validates the specified network against allowed network options
   * and retrieves the corresponding network URL.
   *
   * @param network The network name to validate
   * @returns The network URL for the specified network
   * @throws CLIError if the network is invalid
   */
  private validateNetwork(network: string): string {
    const validNetworks = ['localnet', 'devnet', 'testnet', 'mainnet'];
    if (!validNetworks.includes(network)) {
      throw new CLIError(
        `Invalid network: ${network}. Valid networks are: ${validNetworks.join(', ')}`,
        'INVALID_NETWORK'
      );
    }
    return NETWORK_URLS[network as keyof typeof NETWORK_URLS] || '';
  }

  /**
   * Checks that the smart contract has been deployed to the specified network.
   * This is required before we can interact with NFTs on the blockchain.
   *
   * @param network The network to validate deployment on
   * @throws CLIError if the contract is not deployed
   */
  private async validateBlockchainConfig(network: string): Promise<void> {
    const config = await configService.getConfig();
    if (!config.lastDeployment?.packageId) {
      throw new CLIError(
        'Contract not deployed. Run "waltodo deploy --network ' +
          network +
          '" first.',
        'NOT_DEPLOYED'
      );
    }
  }

  /**
   * Checks that we can connect to the specified network and retrieves
   * the current protocol version for informational purposes.
   *
   * @param suiClient Connected Sui client instance
   * @returns Protocol version string
   * @throws CLIError if connection fails
   */
  private async getNetworkStatus(suiClient: {
    getLatestSuiSystemState: () => Promise<{
      protocolVersion?: { toString(): string };
    }>;
  }): Promise<string> {
    try {
      const state = await suiClient.getLatestSuiSystemState();
      return state?.protocolVersion?.toString() || 'unknown';
    } catch (error) {
      throw new CLIError(
        `Failed to connect to network: ${error instanceof Error ? error.message : String(error)}`,
        'NETWORK_CONNECTION_FAILED'
      );
    }
  }

  /**
   * Validates that the NFT exists and is in a valid state for completion.
   * Performs several checks:
   * 1. Verifies the NFT exists and can be fetched
   * 2. Confirms the NFT has the expected type/structure
   * 3. Checks that the NFT is not already marked as completed
   *
   * @param suiClient Connected Sui client instance
   * @param nftObjectId ID of the NFT object to validate
   * @throws CLIError for various NFT-related validation failures
   */
  private async validateNftState(
    suiClient: unknown,
    nftObjectId: string
  ): Promise<void> {
    try {
      const result = await (
        suiClient as {
          getObject: (params: {
            id: string;
            options: { showContent: boolean };
          }) => Promise<{
            error?: { code: string };
            data?: { content?: unknown };
          }>;
        }
      ).getObject({
        id: nftObjectId,
        options: { showContent: true },
      });

      if (result.error) {
        throw new CLIError(
          `Failed to fetch NFT: ${result.error.code}`,
          'NFT_FETCH_FAILED'
        );
      }

      if (!result.data?.content) {
        throw new CLIError(
          'NFT data not found or inaccessible',
          'NFT_NOT_FOUND'
        );
      }

      // Check if NFT is already completed
      const content = result.data.content as {
        type?: string;
        fields?: { completed?: boolean };
      };

      // Verify NFT type
      const expectedType = `${TODO_NFT_CONFIG.MODULE_ADDRESS}::${TODO_NFT_CONFIG.MODULE_NAME}::${TODO_NFT_CONFIG.STRUCT_NAME}`;
      if (content.type !== expectedType) {
        throw new CLIError(
          `Invalid NFT type. Expected ${expectedType}`,
          'INVALID_NFT_TYPE'
        );
      }

      if (content.fields?.completed) {
        throw new CLIError(
          'NFT is already marked as completed',
          'NFT_ALREADY_COMPLETED'
        );
      }
    } catch (error) {
      if (error instanceof CLIError) throw error;
      throw new CLIError(
        `Failed to validate NFT state: ${error instanceof Error ? error.message : String(error)}`,
        'NFT_VALIDATION_FAILED'
      );
    }
  }

  /**
   * Performs a dry run of the NFT completion transaction to estimate
   * gas costs before actual execution. This allows users to see expected
   * costs before proceeding with the transaction.
   *
   * @param suiClient Connected Sui client instance
   * @param nftObjectId ID of the NFT object to update
   * @param packageId ID of the deployed smart contract package
   * @returns Object containing computation and storage gas costs
   * @throws CLIError if gas estimation fails
   */
  private async estimateGasForNftUpdate(
    suiClient: unknown,
    nftObjectId: string,
    packageId: string
  ): Promise<{ computationCost: string; storageCost: string }> {
    try {
      const txb = new Transaction();
      txb.moveCall({
        target: `${packageId}::${TODO_NFT_CONFIG.MODULE_NAME}::complete_todo`,
        arguments: [txb.object(nftObjectId)],
      });

      const serialized = txb.serialize();
      const transactionBlock =
        typeof serialized === 'string'
          ? serialized
          : Buffer.from(serialized).toString('base64');
      const dryRunResult = await (
        suiClient as {
          dryRunTransactionBlock: (params: {
            transactionBlock: string;
          }) => Promise<{
            effects?: {
              gasUsed?: { computationCost?: string; storageCost?: string };
            };
          }>;
        }
      ).dryRunTransactionBlock({
        transactionBlock,
      });

      return {
        computationCost: dryRunResult?.effects?.gasUsed?.computationCost || '0',
        storageCost: dryRunResult?.effects?.gasUsed?.storageCost || '0',
      };
    } catch (error) {
      throw new CLIError(
        `Failed to estimate gas: ${error instanceof Error ? error.message : String(error)}`,
        'GAS_ESTIMATION_FAILED'
      );
    }
  }

  /**
   * Updates configuration with information about completed todos.
   * Tracks completion statistics for reporting and analytics purposes.
   *
   * @param todo The todo item being marked as completed
   * @returns Promise that resolves when config update is complete
   */
  private async updateConfigWithCompletion(todo: Todo): Promise<void> {
    try {
      const rawConfig = await configService.getConfig();
      const config = {
        ...rawConfig,
        logging: (rawConfig as any).logging || {
          level: 'info' as const,
          console: true
        },
        completedTodos: (rawConfig as any).completedTodos
      } as any;

      // Initialize completed todos tracking if not exists
      if (!config.completedTodos) {
        config.completedTodos = {
          count: 0,
          lastCompleted: null,
          history: [],
          byCategory: {} as Record<string, number>,
        };
      }

      // Update statistics
      config.completedTodos.count++;
      config.completedTodos.lastCompleted = new Date().toISOString();

      // Add to history with proper metadata for tracking
      config.completedTodos.history = config.completedTodos.history || [];
      config.completedTodos.history.push({
        id: todo.id,
        title: todo.title,
        completedAt: new Date().toISOString(),
        listName: todo.listName || 'default',
        category: todo.category,
      });

      // Limit history size to prevent config file growth
      if (config.completedTodos.history.length > 100) {
        config.completedTodos.history =
          config.completedTodos.history.slice(-100);
      }

      // Track by category if available
      if (todo.category) {
        config.completedTodos.byCategory[todo.category] =
          (config.completedTodos.byCategory[todo.category] || 0) + 1;
      }

      // Write the config, using our custom wrapper to allow mocking in tests
      await this.writeConfigSafe(config);
    } catch (error) {
      // Non-blocking error - log but don't fail the command
      this.warning(
        `Failed to update completion statistics: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Write configuration safely with ability to mock in tests
   * This allows test code to count the number of calls to fs.writeFileSync
   *
   * @param config Configuration to write
   */
  private async writeConfigSafe(config: AppConfig & { completedTodos?: any }): Promise<void> {
    try {
      // First try the standard config service method
      if (typeof configService.saveConfig === 'function') {
        await configService.saveConfig(config as any);
        return;
      }

      // Fallback to direct file writing with wrapper
      const configDir = this.getConfigDir();
      const configPath = path.join(configDir, 'config.json');

      // Write config using our wrapper that can be mocked
      // ALWAYS use writeFileSafe to ensure consistent behavior
      this.writeFileSafe(configPath, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
      throw new Error(
        `Failed to save config: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Wrapper for fs.writeFileSync that can be mocked in tests
   * Always delegates to writeFileSafe method for consistent behavior and testability
   *
   * @param filePath Path to file
   * @param data Data to write
   * @param options Write options
   */
  private writeFileSyncWrapper(
    filePath: string,
    data: string,
    options?:
      | string
      | { encoding?: string; mode?: string | number; flag?: string }
  ): void {
    // Only use the centralized writeFileSafe method from BaseCommand
    // DO NOT call fs.writeFileSync directly to allow proper mocking in tests
    this.writeFileSafe(filePath, data, (options as BufferEncoding) || 'utf8');
  }

  /**
   * Save a mapping between todo ID and blob ID
   * This method uses the writeFileSafe method for consistent behavior
   * @param todoId Todo ID
   * @param blobId Blob ID
   */
  private saveBlobMapping(todoId: string, blobId: string): void {
    try {
      // Use the centralized getConfigDir method from BaseCommand
      const configDir = this.getConfigDir();
      const blobMappingsFile = path.join(configDir, 'blob-mappings.json');

      // Read existing mappings or create empty object
      let mappings: Record<string, string> = {};
      if (fs.existsSync(blobMappingsFile)) {
        try {
          const content = fs.readFileSync(blobMappingsFile, 'utf8');
          const contentStr =
            typeof content === 'string' ? content : String(content);
          mappings = JSON.parse(contentStr);
        } catch (error) {
          this.warning(
            `Error reading blob mappings file: ${error instanceof Error ? error.message : String(error)}`
          );
          // Continue with empty mappings
        }
      }

      // Add or update mapping
      mappings[todoId] = blobId;

      // Write mappings back to file using our centralized method
      // This ensures directory creation and consistent error handling
      this.writeFileSafe(
        blobMappingsFile,
        JSON.stringify(mappings, null, 2),
        'utf8'
      );
      this.debugLog(`Saved blob mapping: ${todoId} -> ${blobId}`);
    } catch (error) {
      this.warning(
        `Failed to save blob mapping: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create a background job for completing todos
   */
  private async createBackgroundJob(
    todos: Todo[],
    listName: string,
    flags: CompleteCommandFlags
  ): Promise<BackgroundJob> {
    const job = jobManager.createJob('complete', [], flags);

    // Spawn background process using current CLI binary
    const cliPath = process.argv[1] || 'waltodo';
    const args: string[] = [
      'complete',
      '--quiet', // Reduce output in background
      ...(flags.list ? ['--list', flags.list] : []),
      ...(flags.network ? ['--network', flags.network] : []),
      ...(flags.debug ? ['--debug'] : []),
      ...(flags.force ? ['--force'] : []),
      ...(flags.batch ? ['--batch'] : []),
      ...(flags.batchSize ? ['--batchSize', flags.batchSize.toString()] : []),
    ];

    // Add todo IDs or use batch mode for all todos in list
    if (flags.batch) {
      // Batch mode will process all incomplete todos in the specified list
    } else {
      // Add individual todo IDs
      args.push(...todos.map(t => t.id));
    }

    const childProcess = spawn(process.execPath, [cliPath, ...args], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        WALTODO_BACKGROUND_MODE: 'true', // Flag to prevent infinite recursion
      },
    });

    // Update job with process ID and metadata
    jobManager.startJob(job.id, childProcess.pid || 0);

    // Set up progress tracking
    jobManager.updateProgress(job.id, 0, 0, todos.length);

    // Update job metadata with completion details
    jobManager.updateJob(job.id, {
      metadata: {
        operation: 'complete',
        listName,
        todoCount: todos.length,
        todos: todos.map(t => ({ id: t.id, title: t.title })),
      },
    });

    // Write initial log
    jobManager.writeJobLog(
      job.id,
      `Starting completion of ${todos.length} todo(s) in list "${listName}"`
    );

    // Handle process completion
    childProcess.on('exit', (code: number | null) => {
      if (code === 0) {
        jobManager.writeJobLog(
          job.id,
          `Successfully completed all ${todos.length} todo(s)`
        );
        jobManager.completeJob(job.id, {
          completedTodos: todos.length,
          listName,
          operation: 'complete',
        });
      } else {
        jobManager.writeJobLog(job.id, `Process failed with exit code ${code}`);
        jobManager.failJob(job.id, `Process exited with code ${code}`);
      }
    });

    // Handle process errors
    childProcess.on('error', (error: Error) => {
      jobManager.writeJobLog(job.id, `Process error: ${error.message}`);
      jobManager.failJob(job.id, `Process error: ${error.message}`);
    });

    // Capture output and update progress based on log content
    if (childProcess.stdout) {
      childProcess.stdout.on('data', data => {
        const output = data.toString();
        jobManager.writeJobLog(job.id, output);

        // Try to extract progress from output
        this.updateProgressFromOutput(job.id, output, todos.length);
      });
    }

    if (childProcess.stderr) {
      childProcess.stderr.on('data', data => {
        const error = data.toString();
        jobManager.writeJobLog(job.id, `ERROR: ${error}`);
      });
    }

    // Allow parent process to exit
    childProcess.unref();

    return job;
  }

  /**
   * Extract progress information from command output
   */
  private updateProgressFromOutput(
    jobId: string,
    output: string,
    totalTodos: number
  ): void {
    try {
      // Look for completion indicators in the output
      const completionMatches = output.match(/✓.*completed/gi);
      if (completionMatches) {
        const currentProgress = completionMatches.length;
        const progressPercentage = Math.min(
          100,
          (currentProgress / totalTodos) * 100
        );
        jobManager.updateProgress(
          jobId,
          progressPercentage,
          currentProgress,
          totalTodos
        );
      }

      // Look for batch progress indicators
      const batchMatches = output.match(/Completing \[(\d+)\/(\d+)\]/i);
      if (batchMatches && batchMatches[1] && batchMatches[2]) {
        const completed = parseInt(batchMatches[1], 10);
        const total = parseInt(batchMatches[2], 10);
        const progressPercentage = Math.min(100, (completed / total) * 100);
        jobManager.updateProgress(jobId, progressPercentage, completed, total);
      }
    } catch (error) {
      // Ignore progress parsing errors
    }
  }

  /**
   * Complete multiple todos in batch with progress tracking
   */
  private async completeBatch(
    todos: Todo[],
    listName: string,
    flags: CompleteCommandFlags
  ): Promise<void> {
    const batchSize = flags.batchSize || 5;
    const totalTodos = todos.filter(t => !t.completed);

    if (totalTodos.length === 0) {
      this.log(chalk.yellow('No incomplete todos found for batch completion.'));
      return;
    }

    this.log(
      chalk.blue(`Starting batch completion of ${totalTodos.length} todos...`)
    );

    const showProgress = !flags.quiet;
    let multiProgress: MultiProgress | undefined, progressBar: any | undefined;

    if (showProgress) {
      multiProgress = this.createMultiProgress();
      progressBar = multiProgress.create('Completing todos', totalTodos.length);
    }

    let completed = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process todos in batches
    for (let i = 0; i < totalTodos.length; i += batchSize) {
      const batch = totalTodos.slice(i, i + batchSize);

      if (!flags.quiet) {
        this.log(
          chalk.gray(
            `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(totalTodos.length / batchSize)}...`
          )
        );
      }

      const batchPromises = batch.map(async (todo, index) => {
        try {
          if (!flags.quiet) {
            this.log(
              chalk.blue(
                `Completing [${completed + index + 1}/${totalTodos.length}] "${todo.title}"...`
              )
            );
          }
          await this.completeSingleTodo(todo, listName, flags, false);
          completed++;
          if (progressBar) progressBar.increment();
          if (!flags.quiet) {
            this.log(chalk.green(`✓ Completed "${todo.title}"`));
          }
          return { success: true, todo };
        } catch (error) {
          failed++;
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          errors.push(`${todo.title}: ${errorMsg}`);
          if (progressBar) progressBar.increment();
          if (!flags.quiet) {
            this.log(chalk.red(`✗ Failed "${todo.title}": ${errorMsg}`));
          }
          return {
            success: false,
            todo,
            error: errorMsg,
          };
        }
      });

      await Promise.all(batchPromises);

      // Small delay between batches to prevent overwhelming the system
      if (i + batchSize < totalTodos.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    if (multiProgress) {
      multiProgress.stop();
    }

    // Summary
    this.log(chalk.green(`\n✅ Batch completion finished:`));
    this.log(`  ${chalk.green('Completed:')} ${completed}`);
    if (failed > 0) {
      this.log(`  ${chalk.red('Failed:')} ${failed}`);
      if (errors.length > 0 && !flags.quiet) {
        this.log(chalk.red('\nErrors:'));
        errors.slice(0, 5).forEach(error => {
          this.log(chalk.red(`  • ${error}`));
        });
        if (errors.length > 5) {
          this.log(chalk.red(`  ... and ${errors.length - 5} more errors`));
        }
      }
    }

    if (failed > 0) {
      throw new CLIError(
        `Batch completion completed with ${failed} failures. ${completed} todos were successfully completed.`,
        'BATCH_COMPLETION_PARTIAL_FAILURE'
      );
    }
  }

  /**
   * Complete a single todo (extracted from main run method)
   */
  private async completeSingleTodo(
    todo: Todo,
    listName: string,
    flags: CompleteCommandFlags,
    showOutput: boolean = true
  ): Promise<void> {
    const operationId = `complete-${todo.id}-${Date.now()}`;

    return performanceMonitor.measureOperation(
      'complete-todo',
      async () => {
        // Verify not already completed
        if (todo.completed) {
          if (showOutput) {
            this.log(
              chalk.yellow(
                `Todo "${todo.title}" is already marked as completed`
              )
            );
          }
          return;
        }

        const config = await configService.getConfig();
        const network = flags.network || config.network || 'testnet';
        const networkUrl = this.validateNetwork(network);

        // Initialize blockchain clients if needed
        let suiClient: unknown | undefined;
        let suiNftStorage: SuiNftStorage | undefined;

        if (todo.nftObjectId || todo.walrusBlobId) {
          // Validate deployment config first
          await this.validateBlockchainConfig(network);

          // Initialize and check network connection
          suiClient = { url: networkUrl }; // Mock SuiClient
          const protocolVersion = await this.getNetworkStatus(suiClient as any);
          if (showOutput) {
            this.log(
              chalk.dim(
                `Connected to ${network} (protocol version ${protocolVersion})`
              )
            );
          }

          // Validate NFT state and estimate gas if NFT exists
          if (todo.nftObjectId) {
            await this.validateNftState(suiClient, todo.nftObjectId);

            // Initialize NFT storage
            const signer = {} as Ed25519Keypair;
            suiNftStorage = new SuiNftStorage(suiClient as any, signer, {
              address: config.lastDeployment?.packageId ?? '',
              packageId: config.lastDeployment?.packageId ?? '',
            });

            if (showOutput) {
              // Estimate gas for the operation
              const gasEstimate = await this.estimateGasForNftUpdate(
                suiClient,
                todo.nftObjectId,
                config.lastDeployment?.packageId ?? ''
              );
              this.log(
                chalk.dim(
                  `Estimated gas cost: ${Number(gasEstimate.computationCost) + Number(gasEstimate.storageCost)} MIST`
                )
              );
            }
          }
        }

        // Update local todo first
        if (showOutput) {
          this.log(chalk.blue(`Marking todo "${todo.title}" as completed...`));
        }
        await this.todoService.toggleItemStatus(listName, todo.id, true);
        if (showOutput) {
          this.log(chalk.green('✓ Local update successful'));
        }

        // Update configuration to record completion
        await this.updateConfigWithCompletion(todo);

        // Update NFT if exists (same as original implementation)
        if (todo.nftObjectId && suiNftStorage) {
          await this.updateNFT(todo, suiNftStorage, suiClient, showOutput);
        }

        // Update Walrus blob if exists (same as original implementation)
        if (todo.walrusBlobId) {
          await this.updateWalrusBlob(todo, listName, showOutput);
        }

        if (showOutput) {
          this.showCompletionSummary(todo, network);
        }
      },
      { todoId: todo.id, listName }
    );
  }

  /**
   * Update NFT on blockchain (extracted from main method)
   */
  private async updateNFT(
    todo: Todo,
    suiNftStorage: SuiNftStorage,
    suiClient: unknown,
    showOutput: boolean
  ): Promise<void> {
    try {
      if (showOutput) {
        this.log(chalk.blue('Updating NFT on blockchain...'));
      }
      const txDigest = await RetryManager.retry(
        () =>
          suiNftStorage.updateTodoNftCompletionStatus(todo.nftObjectId || ''),
        {
          maxRetries: 3,
          initialDelay: 1000,
          onRetry: (attempt: number, error: any, delay?: number) => {
            const errorMessage =
              error instanceof Error
                ? error.message
                : typeof error === 'object' &&
                    error !== null &&
                    'message' in error &&
                    typeof (error as Record<string, unknown>).message ===
                      'string'
                  ? ((error as Record<string, unknown>).message as string)
                  : String(error);
            if (showOutput) {
              this.log(
                chalk.yellow(
                  `Retry attempt ${attempt} after error: ${errorMessage}`
                )
              );
            }
          },
        }
      );
      if (showOutput) {
        this.log(chalk.green('✓ Todo NFT updated on blockchain'));
        this.log(chalk.dim(`Transaction: ${txDigest}`));
      }

      // Verify NFT update
      await this.verifyNFTUpdate(todo, suiClient, showOutput);
    } catch (blockchainError) {
      throw new CLIError(
        `Failed to update NFT on blockchain: ${blockchainError instanceof Error ? blockchainError.message : String(blockchainError)}\nLocal update was successful, but blockchain state may be out of sync.`,
        'BLOCKCHAIN_UPDATE_FAILED'
      );
    }
  }

  /**
   * Verify NFT update (extracted from main method)
   */
  private async verifyNFTUpdate(
    todo: Todo,
    suiClient: unknown,
    showOutput: boolean
  ): Promise<void> {
    await RetryManager.retry(
      async () => {
        try {
          const verificationPromise = (
            suiClient as {
              getObject: (params: {
                id: string;
                options: { showContent: boolean };
              }) => Promise<{ data?: { content?: unknown } }>;
            }
          ).getObject({
            id: todo.nftObjectId || '',
            options: { showContent: true },
          });

          let timeoutId: NodeJS.Timeout | undefined = undefined;
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(new Error('NFT verification timed out after 10 seconds'));
            }, 10000);
          });

          const result = await Promise.race([
            verificationPromise,
            timeoutPromise,
          ]);
          if (timeoutId) clearTimeout(timeoutId);

          const content = result.data?.content as {
            fields?: { completed?: boolean };
          };
          if (!content?.fields?.completed) {
            throw new Error(
              'NFT update verification failed: completed flag not set'
            );
          }
        } catch (verifyError) {
          const error =
            verifyError instanceof Error
              ? verifyError
              : new Error(String(verifyError));

          throw new Error(`NFT verification error: ${error.message}`);
        }
      },
      {
        maxRetries: 3,
        initialDelay: 2000,
        onRetry: (attempt: number, error: any, delay?: number) => {
          const errorMessage =
            error instanceof Error
              ? error.message
              : typeof error === 'object' &&
                  error !== null &&
                  'message' in error &&
                  typeof (error as Record<string, unknown>).message === 'string'
                ? ((error as Record<string, unknown>).message as string)
                : String(error);
          if (showOutput) {
            this.log(
              chalk.yellow(
                `Verification retry ${attempt} after error: ${errorMessage}`
              )
            );
          }
        },
      }
    );
  }

  /**
   * Update Walrus blob (extracted from main method)
   */
  private async updateWalrusBlob(
    todo: Todo,
    listName: string,
    showOutput: boolean
  ): Promise<Error | null> {
    let lastWalrusError: Error | null = null;

    try {
      if (showOutput) {
        this.log(chalk.blue('Connecting to Walrus storage...'));
      }
      await this.walrusStorage.connect();

      let timeoutId: NodeJS.Timeout | undefined = undefined;
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Walrus operation timed out after 30 seconds'));
        }, 30000);
      });

      if (showOutput) {
        this.log(chalk.blue('Updating todo on Walrus...'));
      }

      const updatedTodo = {
        ...todo,
        completed: true,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          let newBlobId: string | undefined;
          try {
            newBlobId = (await Promise.race([
              this.walrusStorage.updateTodo(
                todo.walrusBlobId || '',
                updatedTodo
              ),
              timeout,
            ])) as string | undefined;
            if (timeoutId) clearTimeout(timeoutId);
          } catch (raceError) {
            if (timeoutId) clearTimeout(timeoutId);
            throw raceError;
          }

          if (typeof newBlobId === 'string') {
            await this.todoService.updateTodo(listName, todo.id, {
              walrusBlobId: newBlobId,
              completedAt: updatedTodo.completedAt,
              updatedAt: updatedTodo.updatedAt,
            });

            this.saveBlobMapping(todo.id, newBlobId);

            if (showOutput) {
              this.log(chalk.green('✓ Todo updated on Walrus'));
              this.log(chalk.dim(`New blob ID: ${newBlobId}`));
              this.log(
                chalk.dim(
                  `Public URL: https://testnet.wal.app/blob/${newBlobId}`
                )
              );
            }
            break;
          } else {
            throw new Error('Invalid blob ID returned from Walrus');
          }
        } catch (error) {
          lastWalrusError =
            error instanceof Error ? error : new Error(String(error));
          if (attempt === maxRetries) {
            if (showOutput) {
              this.log(
                chalk.yellow(
                  '⚠️ Failed to update Walrus storage after all retries'
                )
              );
              this.log(
                chalk.yellow(
                  'The todo has been marked as completed locally and on-chain, but Walrus blob is out of sync.'
                )
              );
            }
            break;
          }
          if (showOutput) {
            this.log(chalk.yellow(`Attempt ${attempt} failed, retrying...`));
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    } finally {
      try {
        await this.walrusStorage.disconnect();
      } catch (disconnectError) {
        if (showOutput) {
          this.warn('Warning: Failed to disconnect from Walrus');
        }
      }
    }

    return lastWalrusError;
  }

  /**
   * Show completion summary (extracted from main method)
   */
  private showCompletionSummary(todo: Todo, network: string): void {
    this.log(chalk.green('\n✓ Todo completion summary:'));
    this.log(chalk.dim('Title:'));
    this.log(`  ${chalk.bold(todo.title)}`);

    this.log(chalk.dim('\nUpdates:'));
    this.log(`  ${chalk.green('✓')} Local storage`);
    if (todo.nftObjectId) {
      this.log(`  ${chalk.green('✓')} Blockchain NFT`);
      this.log(chalk.blue('\nView your updated NFT:'));
      this.log(
        chalk.cyan(
          `  https://explorer.sui.io/object/${todo.nftObjectId}?network=${network}`
        )
      );
    }
    if (todo.walrusBlobId) {
      this.log(`  ${chalk.green('✓')} Walrus storage`);
    }
  }

  /**
   * Main command execution method. Handles the complete workflow for marking
   * a todo as completed across all relevant storage systems.
   *
   * Execution flow:
   * 1. Parse and validate command arguments
   * 2. Find the specified todo in the specified list
   * 3. Check if the todo is already completed
   * 4. For blockchain operations, validate network and NFT state
   * 5. Update local storage first (atomic operation)
   * 6. If NFT exists, update it on the blockchain with verification
   * 7. If Walrus blob exists, update it with retry logic
   * 8. Present summary information to the user
   */
  async run(): Promise<void> {
    try {
      const { args, flags } = await this.parse(CompleteCommand);
      // Type assertion for flags to fix property access
      const typedFlags = flags as CompleteCommandFlags;

      // Get config once to avoid redeclaration issues
      const config = await configService.getConfig();

      // Validate network
      const network = typedFlags.network || config.network || 'testnet';
      const networkUrl = this.validateNetwork(network);

      // Handle batch mode
      if (typedFlags.batch) {
        const listName = typedFlags.list || 'default';
        const list = await this.todoService.getList(listName);
        if (!list) {
          const availableLists = await this.todoService.getAllLists();
          const listNames = availableLists.join(', ');
          throw new CLIError(
            `List "${listName}" not found.\n\nAvailable lists: ${listNames}`,
            'LIST_NOT_FOUND'
          );
        }

        const todos = list.todos;
        const incompleteTodos = todos.filter(t => !t.completed);

        // Check if we're already in background mode to prevent recursion
        if (process.env.WALTODO_BACKGROUND_MODE === 'true') {
          // We're in background mode, process directly
          await this.completeBatch(incompleteTodos, listName, typedFlags);
          return;
        }

        if (typedFlags.background) {
          const job = await this.createBackgroundJob(
            incompleteTodos,
            listName,
            typedFlags
          );
          this.log(
            chalk.green(`🚀 Started background batch completion job: ${job.id}`)
          );
          this.log(
            chalk.gray(
              `   Processing ${incompleteTodos.length} todos in list "${listName}"`
            )
          );
          this.log(chalk.gray('   Use "waltodo jobs" to check progress'));
          return;
        } else {
          await this.completeBatch(incompleteTodos, listName, typedFlags);
          return;
        }
      }

      // Determine list name and todo ID/title based on input format
      let listName: string;
      let todoIdentifier: string;

      if (typedFlags.id) {
        // Legacy format: using flags
        listName = typedFlags.list || args.listOrTodo || 'default';
        todoIdentifier = typedFlags.id;
      } else if (args.todoId) {
        // New format: waltodo complete <list> <todo>
        listName = args.listOrTodo || 'default';
        todoIdentifier = args.todoId;
      } else if (args.listOrTodo) {
        // New format: waltodo complete <todo> (default list)
        listName = 'default';
        todoIdentifier = args.listOrTodo;
      } else {
        // No arguments provided - show helpful error
        const listNames = await this.todoService.getAllLists();
        const todos: Todo[] = [];

        // Gather todos from all lists
        for (const listName of listNames) {
          const list = await this.todoService.getList(listName);
          if (list) {
            todos.push(...list.todos.filter(t => !t.completed));
          }
        }

        let helpMessage = 'Please specify a todo to complete.\n\n';
        helpMessage += 'Usage:\n';
        helpMessage +=
          '  waltodo complete <todo-id>             # Complete from default list\n';
        helpMessage +=
          '  waltodo complete <list> <todo-id>      # Complete from specific list\n';
        helpMessage +=
          '  waltodo complete --batch --list <list> # Complete all todos in list\n';
        helpMessage +=
          '  waltodo complete <todo-id> --background # Complete in background\n\n';

        if (todos.length > 0) {
          helpMessage += 'Available incomplete todos:\n';
          const todosByList = new Map<string, Todo[]>();

          for (const todo of todos) {
            const list = todo.listName || 'default';
            if (!todosByList.has(list)) {
              todosByList.set(list, []);
            }
            todosByList.get(list)!.push(todo);
          }

          for (const [list, listTodos] of Array.from(todosByList.entries())) {
            helpMessage += `\n${chalk.bold(list)}:\n`;
            for (const todo of listTodos.slice(0, 5)) {
              helpMessage += `  ${chalk.dim(todo.id.substring(0, 8))} - ${todo.title}\n`;
            }
            if (listTodos.length > 5) {
              helpMessage += `  ${chalk.dim(`... and ${listTodos.length - 5} more`)}\n`;
            }
          }
        }

        throw new CLIError(helpMessage, 'MISSING_ARGUMENTS');
      }

      // Check list exists
      const list = await this.todoService.getList(listName);
      if (!list) {
        const availableLists = await this.todoService.getAllLists();
        const listNames = availableLists.join(', ');
        throw new CLIError(
          `List "${listName}" not found.\n\nAvailable lists: ${listNames}`,
          'LIST_NOT_FOUND'
        );
      }

      // Find todo by ID or title
      const todo = await this.todoService.getTodoByTitleOrId(
        todoIdentifier,
        listName
      );
      if (!todo) {
        // Provide helpful error with available todos
        const todos = list.todos;
        const incompleteTodos = todos.filter(t => !t.completed);

        let errorMessage = `Todo "${todoIdentifier}" not found in list "${listName}"`;

        if (incompleteTodos.length > 0) {
          errorMessage += '\n\nAvailable todos in this list:\n';
          for (const t of incompleteTodos.slice(0, 10)) {
            errorMessage += `  ${chalk.dim(t.id.substring(0, 8))} - ${t.title}\n`;
          }
          if (incompleteTodos.length > 10) {
            errorMessage += `  ${chalk.dim(`... and ${incompleteTodos.length - 10} more`)}\n`;
          }
          errorMessage +=
            '\nTip: You can use either the todo ID or title to complete it.';
        } else {
          errorMessage += '\n\nThis list has no incomplete todos.';
        }

        throw new CLIError(errorMessage, 'TODO_NOT_FOUND');
      }

      // Check if we're already in background mode to prevent recursion
      if (process.env.WALTODO_BACKGROUND_MODE === 'true') {
        // We're in background mode, process directly without spawning
        await this.completeSingleTodo(
          todo,
          listName,
          typedFlags,
          !typedFlags.quiet
        );
        return;
      }

      // Handle background execution for single todo
      if (typedFlags.background) {
        const job = await this.createBackgroundJob(
          [todo],
          listName,
          typedFlags
        );
        this.log(
          chalk.green(`🚀 Started background completion job: ${job.id}`)
        );
        this.log(chalk.gray(`   Completing todo: "${todo.title}"`));
        this.log(chalk.gray('   Use "waltodo jobs" to check progress'));
        return;
      }

      // Complete single todo in foreground
      await this.completeSingleTodo(todo, listName, typedFlags, true);
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to complete todo: ${error instanceof Error ? error.message : String(error)}`,
        'COMPLETE_FAILED'
      );
    }
  }
}

// Export both named and default for compatibility
export { CompleteCommand };
export default CompleteCommand;
