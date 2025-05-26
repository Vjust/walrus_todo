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
import chalk from 'chalk';
import { RetryManager } from '../utils/retry-manager';
import * as fs from 'fs';
import * as path from 'path';
import { Todo } from '../types/todo';
import { AppConfig } from '../types/config';

// Define interface for parsed flags to fix property access
interface CompleteCommandFlags {
  id: string;
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
 * @param {string} [list='default'] - The name of the todo list. (Argument)
 * @param {string} id - The ID or title of the todo item to mark as complete. (Required flag: -i, --id)
 * @param {string} [network] - The blockchain network to use (e.g., 'localnet', 'devnet', 'testnet', 'mainnet').
 *                             Defaults to the network configured globally or 'testnet'. (Optional flag: -n, --network)
 */
export default class CompleteCommand extends BaseCommand {
  static description = `Mark a todo as completed.
  If the todo has an associated NFT or Walrus blob, updates blockchain storage as well.
  NFT updates may require gas tokens on the configured network.`;

  static examples = [
    '<%= config.bin %> complete my-list -i todo-123              # Complete todo by ID',
    '<%= config.bin %> complete my-list -i "Buy groceries"      # Complete todo by title',
    '<%= config.bin %> complete -i task-456                     # Complete from default list',
    '<%= config.bin %> complete work -i "Finish report"         # Complete specific todo',
    '<%= config.bin %> complete personal -i todo-789 --network testnet  # Use specific network',
  ];

  static flags = {
    ...BaseCommand.flags,
    id: Flags.string({
      char: 'i',
      description: 'Todo ID or title to mark as completed',
      required: true,
    }),
    network: Flags.string({
      char: 'n',
      description: 'Network to use (defaults to configured network)',
      options: ['localnet', 'devnet', 'testnet', 'mainnet'],
    }),
  };

  static args = {
    list: Args.string({
      name: 'list',
      description: 'List name',
      default: 'default',
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
  private async getNetworkStatus(suiClient: { getLatestSuiSystemState: () => Promise<{ protocolVersion?: { toString(): string } }> }): Promise<string> {
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
      const result = await (suiClient as { getObject: (params: { id: string; options: { showContent: boolean } }) => Promise<{ error?: { code: string }; data?: { content?: unknown } }> }).getObject({
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

      const dryRunResult = await (suiClient as { dryRunTransactionBlock: (params: { transactionBlock: string }) => Promise<{ effects?: { gasUsed?: { computationCost?: string; storageCost?: string } } }> }).dryRunTransactionBlock({
        transactionBlock: txb.serialize().toString(),
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
      const config: AppConfig = {
        activeNetwork: rawConfig.activeNetwork || 'testnet',
        activeAccount: rawConfig.activeAccount || '',
        storage: rawConfig.storage || { blobMappings: {}, allocation: {} },
        todo: rawConfig.todo || { lists: [] },
        walrus: rawConfig.walrus || {} as Record<string, unknown>,
        sui: rawConfig.sui || {} as Record<string, unknown>,
        ...rawConfig
      } as AppConfig;

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
      await this.writeConfigSafe(config as AppConfig);
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
  private async writeConfigSafe(config: AppConfig): Promise<void> {
    try {
      // First try the standard config service method
      if (typeof configService.saveConfig === 'function') {
        await configService.saveConfig(config);
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
    options?: string | { encoding?: string; mode?: string | number; flag?: string }
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
          mappings = JSON.parse(content);
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
    // Track non-blocking errors like Walrus blob update failure
    let lastWalrusError: Error | null = null;

    try {
      const { args, flags } = await this.parse(CompleteCommand);
      // Type assertion for flags to fix property access
      const typedFlags = flags as CompleteCommandFlags;

      // Get config once to avoid redeclaration issues
      const config = await configService.getConfig();

      // Validate network
      const network = typedFlags.network || config.network || 'testnet';
      const networkUrl = this.validateNetwork(network);

      // Check list exists
      const list = await this.todoService.getList(args.list);
      if (!list) {
        throw new CLIError(`List "${args.list}" not found`, 'LIST_NOT_FOUND');
      }

      // Find todo by ID or title
      const todo = await this.todoService.getTodoByTitleOrId(
        typedFlags.id,
        args.list
      );
      if (!todo) {
        throw new CLIError(
          `Todo "${typedFlags.id}" not found in list "${args.list}"`,
          'TODO_NOT_FOUND'
        );
      }

      // Verify not already completed
      if (todo.completed) {
        this.log(
          chalk.yellow(`Todo "${todo.title}" is already marked as completed`)
        );
        return;
      }

      // Initialize blockchain clients if needed
      let suiClient: unknown | undefined;
      let suiNftStorage: SuiNftStorage | undefined;

      if (todo.nftObjectId || todo.walrusBlobId) {
        // Validate deployment config first
        await this.validateBlockchainConfig(network);

        // Initialize and check network connection
        suiClient = { url: networkUrl }; // Mock SuiClient
        const protocolVersion = await this.getNetworkStatus(suiClient);
        this.log(
          chalk.dim(
            `Connected to ${network} (protocol version ${protocolVersion})`
          )
        );

        // Validate NFT state and estimate gas if NFT exists
        if (todo.nftObjectId) {
          await this.validateNftState(suiClient, todo.nftObjectId);

          // Initialize NFT storage
          const signer = {} as Ed25519Keypair;
          suiNftStorage = new SuiNftStorage(suiClient, signer, {
            address: config.lastDeployment?.packageId ?? '',
            packageId: config.lastDeployment?.packageId ?? '',
          });

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

      // Update local todo first
      this.log(chalk.blue(`Marking todo "${todo.title}" as completed...`));
      await this.todoService.toggleItemStatus(args.list, todo.id, true);
      this.log(chalk.green('\u2713 Local update successful'));

      // Update configuration to record completion
      await this.updateConfigWithCompletion(todo);

      // Update NFT if exists
      if (todo.nftObjectId && suiNftStorage) {
        try {
          this.log(chalk.blue('Updating NFT on blockchain...'));
          const txDigest = await RetryManager.retry(
            () =>
              suiNftStorage.updateTodoNftCompletionStatus(todo.nftObjectId || ''),
            {
              maxRetries: 3,
              initialDelay: 1000,
              onRetry: (error, attempt, _delay) => {
                const errorMessage = error instanceof Error
                  ? error.message
                  : typeof error === 'object' && error !== null && 'message' in error && typeof (error as Record<string, unknown>).message === 'string'
                    ? (error as Record<string, unknown>).message as string
                    : String(error);
                this.log(
                  chalk.yellow(
                    `Retry attempt ${attempt} after error: ${errorMessage}`
                  )
                );
              },
            }
          );
          this.log(chalk.green('\u2713 Todo NFT updated on blockchain'));
          this.log(chalk.dim(`Transaction: ${txDigest}`));

          // Verify NFT update with proper error handling
          await RetryManager.retry(
            async () => {
              try {
                // Add timeout for verification to prevent hanging
                const verificationPromise = (suiClient as { getObject: (params: { id: string; options: { showContent: boolean } }) => Promise<{ data?: { content?: unknown } }> }).getObject({
                  id: todo.nftObjectId || '',
                  options: { showContent: true },
                });

                let timeoutId: NodeJS.Timeout;
                const timeoutPromise = new Promise<never>((_, reject) => {
                  timeoutId = setTimeout(() => {
                    reject(
                      new Error('NFT verification timed out after 10 seconds')
                    );
                  }, 10000);
                });

                const result = await Promise.race([
                  verificationPromise,
                  timeoutPromise,
                ]);
                clearTimeout(timeoutId);

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
              onRetry: (error, attempt, _delay) => {
                const errorMessage = error instanceof Error
                  ? error.message
                  : typeof error === 'object' && error !== null && 'message' in error && typeof (error as Record<string, unknown>).message === 'string'
                    ? (error as Record<string, unknown>).message as string
                    : String(error);
                this.log(
                  chalk.yellow(
                    `Verification retry ${attempt} after error: ${errorMessage}`
                  )
                );
              },
            }
          );
        } catch (blockchainError) {
          // Keep local update but throw error for blockchain update
          throw new CLIError(
            `Failed to update NFT on blockchain: ${blockchainError instanceof Error ? blockchainError.message : String(blockchainError)}\nLocal update was successful, but blockchain state may be out of sync.`,
            'BLOCKCHAIN_UPDATE_FAILED'
          );
        }

        // If the todo has a Walrus blob ID, update it
        if (todo.walrusBlobId) {
          try {
            this.log(chalk.blue('Connecting to Walrus storage...'));
            await this.walrusStorage.connect();

            // Add proper timeout handling for Walrus operations with cleanup
            let timeoutId: NodeJS.Timeout;
            const timeout = new Promise<never>((_, reject) => {
              timeoutId = setTimeout(() => {
                reject(
                  new Error('Walrus operation timed out after 30 seconds')
                );
              }, 30000);
            });

            // Update todo on Walrus with retries
            this.log(chalk.blue('Updating todo on Walrus...'));

            const updatedTodo = {
              ...todo,
              completed: true,
              completedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            // Try update with retries
            const maxRetries = 3;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                // Use Promise.race with proper cleanup in both success and error cases
                let newBlobId: string | undefined;
                try {
                  newBlobId = (await Promise.race([
                    this.walrusStorage.updateTodo(
                      todo.walrusBlobId || '',
                      updatedTodo
                    ),
                    timeout,
                  ])) as string | undefined;
                  clearTimeout(timeoutId); // Clear timeout on success
                } catch (raceError) {
                  clearTimeout(timeoutId); // Always clear timeout
                  throw raceError; // Re-throw for outer catch to handle
                }

                if (typeof newBlobId === 'string') {
                  // Update local todo with new blob ID
                  await this.todoService.updateTodo(args.list, todo.id, {
                    walrusBlobId: newBlobId,
                    completedAt: updatedTodo.completedAt,
                    updatedAt: updatedTodo.updatedAt,
                  });

                  // Save blob mapping for future reference
                  this.saveBlobMapping(todo.id, newBlobId);

                  this.log(chalk.green('\u2713 Todo updated on Walrus'));
                  this.log(chalk.dim(`New blob ID: ${newBlobId}`));
                  this.log(
                    chalk.dim(
                      `Public URL: https://testnet.wal.app/blob/${newBlobId}`
                    )
                  );
                  break;
                } else {
                  throw new Error('Invalid blob ID returned from Walrus');
                }
              } catch (error) {
                lastWalrusError =
                  error instanceof Error ? error : new Error(String(error));
                if (attempt === maxRetries) {
                  this.log(
                    chalk.yellow(
                      '\u26a0\ufe0f Failed to update Walrus storage after all retries'
                    )
                  );
                  this.log(
                    chalk.yellow(
                      'The todo has been marked as completed locally and on-chain, but Walrus blob is out of sync.'
                    )
                  );
                  break;
                }
                this.log(
                  chalk.yellow(`Attempt ${attempt} failed, retrying...`)
                );
                await new Promise(resolve =>
                  setTimeout(resolve, 1000 * attempt)
                );
              }
            }
          } finally {
            // Always try to disconnect
            try {
              await this.walrusStorage.disconnect();
            } catch (disconnectError) {
              // Just log this error, it's not critical
              this.warn('Warning: Failed to disconnect from Walrus');
            }
          }
        }
      }

      // Show final success message with appropriate details
      this.log(chalk.green('\n\u2713 Todo completion summary:'));
      this.log(chalk.dim('Title:'));
      this.log(`  ${chalk.bold(todo.title)}`);

      this.log(chalk.dim('\nUpdates:'));
      this.log(`  ${chalk.green('\u2713')} Local storage`);
      if (todo.nftObjectId) {
        this.log(`  ${chalk.green('\u2713')} Blockchain NFT`);
        this.log(chalk.blue('\nView your updated NFT:'));
        this.log(
          chalk.cyan(
            `  https://explorer.sui.io/object/${todo.nftObjectId}?network=${network}`
          )
        );
      }
      if (todo.walrusBlobId) {
        const walrusUpdateStatus = lastWalrusError
          ? chalk.yellow('\u26a0\ufe0f')
          : chalk.green('\u2713');
        this.log(`  ${walrusUpdateStatus} Walrus storage`);
      }
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
