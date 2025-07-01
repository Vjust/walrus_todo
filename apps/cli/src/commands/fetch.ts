import { Flags, Args } from '@oclif/core';
import { BaseCommand } from '../base-command';
import { TodoService } from '../services/todo';
import { createWalrusStorage } from '../utils/walrus-storage';
import { SuiNftStorage } from '../utils/sui-nft-storage';
import { NETWORK_URLS, RETRY_CONFIG } from '../constants';
import { CLIError } from '../types/errors/consolidated';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { configService } from '../services/config-service';
import chalk = require('chalk');
import { RetryManager } from '../utils/retry-manager';
import { SuiClient } from '../utils/adapters/sui-client-compatibility';
import {
  createBackgroundOperationsManager,
  BackgroundOperations,
} from '../utils/background-operations';
import { jobManager } from '../utils/PerformanceMonitor';
import { v4 as uuidv4 } from 'uuid';

/**
 * @class FetchCommand
 * @description Enhanced fetch command with positional syntax support and smart detection.
 * Fetches todos directly from blockchain storage (Sui NFT) or Walrus storage using their IDs.
 * Supports both positional arguments and legacy flag syntax for backward compatibility.
 *
 * Positional Usage:
 * - waltodo fetch <id>                  # Auto-detect blob ID or object ID
 * - waltodo fetch <blob-id> --list work # Fetch blob and save to work list
 * - waltodo fetch <object-id>           # Fetch NFT from blockchain
 *
 * Legacy Flag Usage (still supported):
 * - waltodo fetch --blob-id <id> --list mylist
 * - waltodo fetch --object-id <id> --list mylist
 *
 * @param {string} [id] - The ID to fetch (blob ID or object ID) - positional argument
 * @param {string} [blob-id] - The Walrus blob ID to retrieve (legacy flag: --blob-id)
 * @param {string} [object-id] - The NFT object ID to retrieve (legacy flag: --object-id)
 * @param {string} [list='default'] - The name of the local todo list to save to (flag: -l, --list)
 * @param {boolean} [dry-run=false] - Simulate operation without network calls (flag: --dry-run)
 * @param {string} [network] - Blockchain network to use (flag: -n, --network)
 */
export default class FetchCommand extends BaseCommand {
  static description =
    "Fetch todos with smart ID detection and intuitive syntax\n\nNEW SYNTAX:\n  waltodo fetch <id>                      # Auto-detect blob or object ID\n  waltodo fetch <id> --list work          # Fetch and save to specific list\n\nThe new syntax automatically detects whether you're fetching by blob ID\nor NFT object ID based on the format - no need to specify!\n\nID Detection:\n  • Blob IDs: Base58/64 strings (e.g., QmXyz123, bafy...)\n  • Object IDs: Hex strings starting with 0x (64+ chars)\n\nLEGACY SYNTAX (still supported):\n  waltodo fetch --blob-id <id> --list <list>\n  waltodo fetch --object-id <id> --list <list>";

  static args = {
    id: Args.string({
      description: 'Blob ID or NFT object ID to fetch',
      required: false,
    }),
  };

  static examples = [
    // Positional syntax (new, intuitive)
    '<%= config.bin %> fetch QmXyz123                      # Fetch by blob ID (auto-detected)',
    '<%= config.bin %> fetch 0x123abc...                   # Fetch by NFT object ID (auto-detected)',
    '<%= config.bin %> fetch abc123 --list work            # Fetch and save to work list',
    '<%= config.bin %> fetch 0x456def --network testnet    # Fetch from specific network',

    // Legacy flag syntax (backward compatibility)
    '<%= config.bin %> fetch --blob-id QmXyz --list my-todos           # Legacy: explicit blob ID',
    '<%= config.bin %> fetch --object-id 0x123 --list my-todos         # Legacy: explicit object ID',
    '<%= config.bin %> fetch --blob-id abc123 --dry-run                # Legacy: test fetch',
  ];

  static flags = {
    ...BaseCommand.flags,
    'blob-id': Flags.string({
      description: '[Legacy] Walrus blob ID to retrieve',
      exclusive: ['object-id'],
    }),
    'object-id': Flags.string({
      description: '[Legacy] NFT object ID to retrieve',
      exclusive: ['blob-id'],
    }),
    list: Flags.string({
      char: 'l',
      description: 'Save to this todo list',
      default: 'default',
    }),
    'dry-run': Flags.boolean({
      description: 'Simulate operation without making network calls',
      default: false,
    }),
    network: Flags.string({
      char: 'n',
      description: 'Network to use (defaults to configured network)',
      options: ['localnet', 'devnet', 'testnet', 'mainnet'],
    }),
    background: Flags.boolean({
      char: 'b',
      description: 'Run fetch in background without blocking terminal',
      default: false,
    }),
    'job-id': Flags.string({
      description: 'Custom job ID for background operation tracking',
    }),
    wait: Flags.boolean({
      char: 'w',
      description:
        'Wait for background operation to complete and show progress',
      default: false,
    }),
    timeout: Flags.integer({
      char: 't',
      description: 'Timeout for fetch operation in seconds',
      default: 300,
      min: 30,
    }),
    'progress-interval': Flags.integer({
      description:
        'Progress update interval in seconds for background operations',
      default: 5,
      min: 1,
    }),
  };

  private todoService = new TodoService();
  private walrusStorage = createWalrusStorage('testnet', true); // Use mock mode for testing
  private parsedFlags!: Record<string, unknown>; // Will be populated after parsing
  private backgroundOps?: BackgroundOperations;

  /**
   * Creates a SuiClient instance for the specified network
   *
   * @param network Network name to connect to (mainnet, testnet, devnet, local)
   * @returns Configured SuiClient instance
   */
  private createSuiClient(network: string): SuiClient {
    // In a proper implementation, this would create a real SuiClient
    // For now, we stub it for testing purposes
    if (this?.parsedFlags?.['dry-run']) {
      return {
        url: NETWORK_URLS[network as keyof typeof NETWORK_URLS],
        core: {} as Record<string, never>,
        jsonRpc: {} as Record<string, never>,
        signAndExecuteTransaction: async () => {},
        getEpochMetrics: async () => null,
        getObject: async () => null,
        getTransactionBlock: async () => null,
      } as unknown as SuiClient;
    }

    // For actual implementation, this would create a real client
    throw new CLIError(
      'Real network operations not supported in this version. Use --dry-run flag.',
      'NETWORK_NOT_SUPPORTED'
    );
  }

  /**
   * Gets a signer for blockchain transactions
   *
   * @returns Ed25519Keypair for signing transactions
   */
  private async getSigner(): Promise<Ed25519Keypair> {
    // In a proper implementation, this would load a keypair from the keystore
    // For now, we stub it for testing purposes
    if (this?.parsedFlags?.['dry-run']) {
      return {} as unknown as Ed25519Keypair;
    }

    // For actual implementation, this would load a keypair from the keystore
    throw new CLIError(
      'Real signers not supported in this version. Use --dry-run flag.',
      'SIGNER_NOT_SUPPORTED'
    );
  }

  /**
   * Smart detection of ID type based on common patterns
   * @param id The ID to analyze
   * @returns 'blob' | 'object'
   */
  private detectIdType(id: string): 'blob' | 'object' {
    // Sui object IDs typically start with 0x and are 64 characters long (66 with 0x prefix)
    if (id.startsWith('0x') && id.length >= 64) {
      return 'object';
    }

    // Walrus blob IDs are typically:
    // - Base58 encoded strings (IPFS-style, often start with 'Qm')
    // - Base32/Base64 encoded (can start with 'bafy', etc.)
    // - Or other alphanumeric identifiers
    // - Generally shorter than Sui object IDs
    if (
      id.startsWith('Qm') ||
      id.startsWith('bafy') ||
      (id.length > 20 && id.length < 60 && /^[A-Za-z0-9+/=_-]+$/.test(id))
    ) {
      return 'blob';
    }

    // For ambiguous cases, default to blob and provide helpful logging
    this.debug(
      `ID '${id}' doesn't match standard patterns. Defaulting to blob ID.`
    );
    return 'blob';
  }

  async run(): Promise<void> {
    try {
      const { args, flags } = await this.parse(FetchCommand);
      this?.parsedFlags = flags;

      // Handle background operation
      if (flags.background) {
        return this.runInBackground(args, flags);
      }

      let blobId: string | undefined;
      let objectId: string | undefined;

      // Handle positional argument or legacy flags
      if (args.id) {
        // Auto-detect ID type from positional argument
        const idType = this.detectIdType(args.id);
        if (idType === 'blob') {
          blobId = args.id;
          this.log(chalk.dim(`🔍 Auto-detected as Walrus blob ID: ${args.id}`));
        } else {
          objectId = args.id;
          this.log(
            chalk.dim(`🔍 Auto-detected as Sui NFT object ID: ${args.id}`)
          );
        }
      } else if (flags?.["blob-id"]) {
        // Legacy blob-id flag
        blobId = flags?.["blob-id"];
        this.log(chalk.dim(`Using explicit blob ID: ${flags?.["blob-id"]}`));
      } else if (flags?.["object-id"]) {
        // Legacy object-id flag
        objectId = flags?.["object-id"];
        this.log(chalk.dim(`Using explicit object ID: ${flags?.["object-id"]}`));
      }

      // Validate input
      if (!blobId && !objectId) {
        // Make the error message more helpful with both syntaxes
        this.log(chalk.yellow('⚠️  You must specify an ID to fetch'));
        this.log(chalk.dim('\nPositional syntax (recommended):'));
        this.log(
          chalk.dim(
            `  ${this?.config?.bin} fetch <id>                    # Auto-detect blob or object ID`
          )
        );
        this.log(
          chalk.dim(
            `  ${this?.config?.bin} fetch QmXyz123                # Blob ID (auto-detected)`
          )
        );
        this.log(
          chalk.dim(
            `  ${this?.config?.bin} fetch 0x123abc...             # Object ID (auto-detected)`
          )
        );

        this.log(chalk.dim('\nLegacy flag syntax:'));
        this.log(
          chalk.dim(
            `  ${this?.config?.bin} fetch --blob-id <blob-id>     # Explicit blob ID`
          )
        );
        this.log(
          chalk.dim(
            `  ${this?.config?.bin} fetch --object-id <object-id> # Explicit object ID`
          )
        );

        this.log(
          chalk.dim(
            '\n💡 Tip: Use "waltodo list -v" to see stored blob and object IDs'
          )
        );

        throw new CLIError('No ID specified to fetch', 'MISSING_PARAMETER');
      }

      // Get config for Sui client
      const configInner = await configService.getConfig();
      const network = flags.network || configInner?.network || 'testnet';

      // Validate network early
      if (!NETWORK_URLS[network as keyof typeof NETWORK_URLS]) {
        throw new CLIError(
          `Invalid network: ${network}. Available networks: ${Object.keys(NETWORK_URLS).join(', ')}`,
          'INVALID_NETWORK'
        );
      }

      if (blobId) {
        let todo;

        try {
          // Initialize Walrus storage
          this.log(chalk.blue('🌐 Connecting to Walrus storage...'));
          await this?.walrusStorage?.connect();

          // Retrieve todo from Walrus with retry
          this.log(
            chalk.blue(`📥 Retrieving todo from Walrus (blob ID: ${blobId})...`)
          );
          todo = await RetryManager.retry(
            () => this?.walrusStorage?.retrieveTodo(blobId),
            {
              maxRetries: RETRY_CONFIG.ATTEMPTS,
              retryableErrors: [/NETWORK_ERROR/, /CONNECTION_REFUSED/],
              onRetry: (error, attempt, _delay) => {
                const errorMessage = error
                  ? typeof error === 'object' && error && 'message' in error
                    ? (error as Error).message
                    : String(error)
                  : 'Unknown error';
                this.log(
                  chalk.yellow(
                    `Retry attempt ${attempt} after error: ${errorMessage}`
                  )
                );
              },
            }
          );

          // Save to local list
          await this?.todoService?.addTodo(flags.list, todo);

          this.log(chalk.green('✓ Todo retrieved successfully from Walrus'));
          this.log(chalk.dim('\nTodo details:'));
          this.log(`  ${chalk.bold('Title:')} ${todo.title}`);
          this.log(
            `  ${chalk.bold('Status:')} ${todo.completed ? chalk.green('Completed') : chalk.yellow('Pending')}`
          );
          this.log(
            `  ${chalk.bold('Priority:')} ${getColoredPriority(todo.priority)}`
          );
          this.log(`  ${chalk.bold('List:')} ${chalk.cyan(flags.list)}`);
          this.log(`  ${chalk.bold('Blob ID:')} ${chalk.dim(blobId)}`);

          if (todo.tags?.length) {
            this.log(
              `  ${chalk.bold('Tags:')} ${todo?.tags?.map(tag => chalk.blue(tag)).join(', ')}`
            );
          }
        } catch (error) {
          // Make sure we disconnect from Walrus even if there was an error
          try {
            await this?.walrusStorage?.disconnect();
          } catch (disconnectError) {
            this.debug(`Error during disconnect: ${disconnectError}`);
          }

          // Provide helpful error message if blob ID might be wrong
          if (error instanceof Error && error?.message?.includes('not found')) {
            throw new CLIError(
              `Todo not found with blob ID '${blobId}'.\n\n${chalk.yellow('Possible issues:')}\n  • The blob ID might not exist or be invalid\n  • The data might have expired from Walrus storage\n  • This might be a Sui object ID instead\n\n${chalk.blue('Try these solutions:')}\n  • If this is an NFT object ID: ${chalk.cyan(`waltodo fetch ${blobId}`)}\n  • Check the ID is correct: ${chalk.cyan('waltodo list -v')}\n  • Verify network: ${chalk.cyan(`waltodo fetch ${blobId} --network ${network}`)}\n\nOriginal error: ${error.message}`,
              'BLOB_NOT_FOUND'
            );
          }

          throw error;
        }

        // Cleanup
        await this?.walrusStorage?.disconnect();
      } else if (objectId) {
        // Check deployment status for NFT operations
        if (!configInner?.lastDeployment?.packageId) {
          throw new CLIError(
            `Contract not deployed. Please run "waltodo deploy --network ${network}" first.`,
            'NOT_DEPLOYED'
          );
        }

        // Initialize Sui client first - in a real implementation, this would use a proper client
        // This is a placeholder that should be replaced with a real implementation or dry-run flag
        const suiClient = this.createSuiClient(network);

        // A proper implementation would load the signer from a keystore
        const signer = await this.getSigner();

        // Use constants for empty strings
        const EMPTY_COLLECTION_ID = '';

        const suiNftStorage = new SuiNftStorage(suiClient, signer, {
          address: configInner?.lastDeployment?.packageId,
          packageId: configInner?.lastDeployment?.packageId,
          collectionId: EMPTY_COLLECTION_ID,
        });

        let todo: unknown;
        let nftData: unknown;

        try {
          // Retrieve NFT from blockchain with retry
          this.log(
            chalk.blue(
              `🔗 Retrieving NFT from blockchain (object ID: ${objectId})...`
            )
          );
          nftData = await RetryManager.retry(
            () => suiNftStorage.getTodoNft(objectId),
            {
              maxRetries: RETRY_CONFIG.ATTEMPTS,
              onRetry: (error, attempt, _delay) => {
                const errorMessage = error
                  ? typeof error === 'object' && error && 'message' in error
                    ? (error as Error).message
                    : String(error)
                  : 'Unknown error';
                this.log(
                  chalk.yellow(
                    `Retry attempt ${attempt} fetching NFT after error: ${errorMessage}`
                  )
                );
              },
            }
          );

          if (!nftData.walrusBlobId) {
            throw new CLIError(
              'NFT does not contain a Walrus blob ID',
              'INVALID_NFT'
            );
          }

          // Initialize Walrus storage
          this.log(chalk.blue('🌐 Connecting to Walrus storage...'));
          await this?.walrusStorage?.connect();

          // Retrieve todo data from Walrus with retry
          this.log(
            chalk.blue(
              `📥 Retrieving todo data from Walrus (blob ID: ${nftData.walrusBlobId})...`
            )
          );
          todo = await RetryManager.retry(
            () => this?.walrusStorage?.retrieveTodo(nftData.walrusBlobId),
            {
              maxRetries: RETRY_CONFIG.ATTEMPTS,
              retryableErrors: [/NETWORK_ERROR/, /CONNECTION_REFUSED/],
              onRetry: (error, attempt, _delay) => {
                const errorMessage = error
                  ? typeof error === 'object' && error && 'message' in error
                    ? (error as Error).message
                    : String(error)
                  : 'Unknown error';
                this.log(
                  chalk.yellow(
                    `Retry attempt ${attempt} after error: ${errorMessage}`
                  )
                );
              },
            }
          );

          // Save to local list
          await this?.todoService?.addTodo(flags.list, {
            ...todo,
            nftObjectId: objectId,
            walrusBlobId: nftData.walrusBlobId,
          });

          this.log(
            chalk.green(
              `✓ Todo retrieved successfully from blockchain and Walrus`
            )
          );
          this.log(chalk.dim('\nTodo details:'));
          this.log(`  ${chalk.bold('Title:')} ${todo.title}`);
          this.log(
            `  ${chalk.bold('Status:')} ${todo.completed ? chalk.green('Completed') : chalk.yellow('Pending')}`
          );
          this.log(
            `  ${chalk.bold('Priority:')} ${getColoredPriority(todo.priority)}`
          );
          this.log(`  ${chalk.bold('List:')} ${chalk.cyan(flags.list)}`);
          this.log(`  ${chalk.bold('NFT Object ID:')} ${chalk.cyan(objectId)}`);
          this.log(
            `  ${chalk.bold('Walrus Blob ID:')} ${chalk.dim(nftData.walrusBlobId)}`
          );

          if (todo.tags?.length) {
            this.log(
              `  ${chalk.bold('Tags:')} ${todo?.tags?.map(tag => chalk.blue(tag)).join(', ')}`
            );
          }

          // Add explorer link for NFTs
          if (!flags?.["dry-run"]) {
            this.log(chalk.blue('\n🔗 View on Sui Explorer:'));
            this.log(
              chalk.cyan(
                `  https://explorer?.sui?.io/object/${objectId}?network=${network}`
              )
            );
          }
        } catch (error) {
          // Make sure we disconnect from Walrus even if there was an error
          try {
            await this?.walrusStorage?.disconnect();
          } catch (disconnectError) {
            this.debug(`Error during disconnect: ${disconnectError}`);
          }

          // Provide helpful error message if object ID might be wrong
          if (
            error instanceof Error &&
            (error?.message?.includes('not found') ||
              error?.message?.includes('does not exist'))
          ) {
            throw new CLIError(
              `NFT not found with object ID '${objectId}'.\n\n${chalk.yellow('Possible issues:')}\n  • The object ID might not exist or be invalid\n  • The NFT might be on a different network\n  • This might be a Walrus blob ID instead\n\n${chalk.blue('Try these solutions:')}\n  • If this is a blob ID: ${chalk.cyan(`waltodo fetch ${objectId}`)}\n  • Check the correct network: ${chalk.cyan(`waltodo fetch ${objectId} --network testnet`)}\n  • Verify the ID: ${chalk.cyan('waltodo list -v')}\n  • View on explorer: ${chalk.cyan(`https://explorer?.sui?.io/object/${objectId}?network=${network}`)}\n\nOriginal error: ${error.message}`,
              'OBJECT_NOT_FOUND'
            );
          }

          throw error;
        }

        // Cleanup
        await this?.walrusStorage?.disconnect();
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to retrieve todo: ${error instanceof Error ? error.message : String(error)}`,
        'RETRIEVE_FAILED'
      );
    }
  }

  /**
   * Run fetch operation in background
   */
  private async runInBackground(args: any, flags: any): Promise<void> {
    const jobId = flags?.["job-id"] || uuidv4();
    const timeoutMs = flags.timeout * 1000;

    // Initialize background operations manager
    this?.backgroundOps = await createBackgroundOperationsManager();

    // Create background job
    const job = jobManager.createJob('fetch', [args.id].filter(Boolean), flags);

    this.log(chalk.blue(`🚀 Starting background fetch operation...`));
    this.log(chalk.dim(`Job ID: ${job.id}`));
    this.log(
      chalk.dim(
        `Target ID: ${args.id || flags?.["blob-id"] || flags?.["object-id"]}`
      )
    );
    this.log(chalk.dim(`Timeout: ${flags.timeout}s`));

    try {
      // Start the job
      jobManager.startJob(job.id);

      // Queue the background operation
      const operationId = await this.queueBackgroundFetch(
        args,
        flags,
        job.id,
        timeoutMs
      );

      if (flags.wait) {
        this.log(chalk.yellow('⏳ Waiting for fetch to complete...'));
        await this.waitForBackgroundOperation(
          operationId,
          job.id,
          flags?.["progress-interval"] || 5
        );
      } else {
        this.log(chalk.green('✓ Background fetch started'));
        this.log(chalk.dim(`\n💡 Track progress: waltodo jobs`));
        this.log(chalk.dim(`💡 Check status: waltodo status ${job.id}`));
        this.log(chalk.dim(`💡 Cancel job: waltodo cancel ${job.id}`));
      }
    } catch (error) {
      jobManager.failJob(
        job.id,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * Queue background fetch operation
   */
  private async queueBackgroundFetch(
    args: any,
    flags: any,
    jobId: string,
    timeoutMs: number
  ): Promise<string> {
    if (!this.backgroundOps) {
      throw new CLIError(
        'Background operations manager not initialized',
        'BACKGROUND_NOT_INITIALIZED'
      );
    }

    // Determine ID and type
    let blobId: string | undefined;
    let objectId: string | undefined;

    if (args.id) {
      const idType = this.detectIdType(args.id);
      if (idType === 'blob') {
        blobId = args.id;
      } else {
        objectId = args.id;
      }
    } else if (flags?.["blob-id"]) {
      blobId = flags?.["blob-id"];
    } else if (flags?.["object-id"]) {
      objectId = flags?.["object-id"];
    }

    // Prepare fetch data
    const fetchData = {
      args,
      flags: { ...flags, background: false }, // Remove background flag for actual execution
      jobId,
      blobId,
      objectId,
      network: flags.network,
      list: flags.list,
      'dry-run': flags?.["dry-run"],
    };

    // Queue operation with progress tracking
    const operationId = await this?.backgroundOps?.uploadTodosInBackground(
      [], // Empty todos array for fetch
      {
        network: flags.network,
        priority: 'normal',
        onProgress: (id, progress) => {
          jobManager.updateProgress(jobId, progress);
          jobManager.writeJobLog(jobId, `Fetch progress: ${progress}%`);
        },
        onComplete: (id, result) => {
          jobManager.completeJob(jobId, {
            operationId: id,
            result,
            itemsFetched: result?.fetched || 0,
            fetchType: blobId ? 'blob' : 'nft',
            targetId: blobId || objectId,
          });
          jobManager.writeJobLog(jobId, `Fetch completed successfully`);
        },
        onError: (id, error) => {
          jobManager.failJob(jobId, error.message);
          jobManager.writeJobLog(jobId, `Fetch error: ${error.message}`);
        },
      }
    );

    // Store fetch data for the background process
    await this.storeFetchOperation(operationId, fetchData, timeoutMs);

    return operationId;
  }

  /**
   * Store fetch operation data for background processing
   */
  private async storeFetchOperation(
    operationId: string,
    data: any,
    timeoutMs: number
  ): Promise<void> {
    const { createCache } = await import('../utils/performance-cache');
    const cache = createCache('background-fetches', {
      strategy: 'TTL',
      ttlMs: timeoutMs + 60000, // Add 1 minute buffer
    });

    await cache.set(operationId, {
      ...data,
      timestamp: Date.now(),
      timeout: timeoutMs,
    });
  }

  /**
   * Wait for background operation to complete with progress updates
   */
  private async waitForBackgroundOperation(
    operationId: string,
    jobId: string,
    progressIntervalSec: number
  ): Promise<void> {
    if (!this.backgroundOps) {
      throw new CLIError(
        'Background operations manager not initialized',
        'BACKGROUND_NOT_INITIALIZED'
      );
    }

    let lastProgress = 0;
    let lastLogTime = 0;
    const progressCallback = (progress: number) => {
      const now = Date.now();
      if (
        progress > lastProgress + 5 ||
        now - lastLogTime > progressIntervalSec * 1000
      ) {
        const progressBar = this.createProgressBarVisual(progress);
        const phase = this.getFetchPhase(progress);
        process?.stdout?.write(`\r${progressBar} ${progress}% - ${phase}`);
        lastProgress = progress;
        lastLogTime = now;
      }
    };

    try {
      const result = await this?.backgroundOps?.waitForOperationWithProgress(
        operationId,
        progressCallback,
        300000 // 5 minutes timeout
      );

      process?.stdout?.write('\n'); // New line after progress bar
      this.log(chalk.green('✓ Background fetch completed'));

      if (result?.fetched) {
        this.log(chalk.dim(`Items fetched: ${result.fetched}`));
      }

      // Show final job status
      const job = jobManager.getJob(jobId);
      if (job) {
        this.displayJobSummary(job);
      }
    } catch (error) {
      process?.stdout?.write('\n'); // New line after progress bar
      throw new CLIError(
        `Background fetch failed: ${error instanceof Error ? error.message : String(error)}`,
        'BACKGROUND_FETCH_FAILED'
      );
    }
  }

  /**
   * Get fetch phase description based on progress
   */
  private getFetchPhase(progress: number): string {
    if (progress < 10) return 'Initializing...';
    if (progress < 30) return 'Connecting to storage...';
    if (progress < 60) return 'Retrieving data...';
    if (progress < 90) return 'Processing response...';
    return 'Finalizing...';
  }

  /**
   * Create a simple progress bar
   */
  private createProgressBarVisual(
    progress: number,
    width: number = 25
  ): string {
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;
    return (
      chalk.blue('[') +
      chalk.blue('█'.repeat(filled)) +
      chalk.gray('░'.repeat(empty)) +
      chalk.blue(']')
    );
  }

  /**
   * Display job summary
   */
  private displayJobSummary(job: any): void {
    const duration = job.endTime
      ? job.endTime - job.startTime
      : Date.now() - job.startTime;
    const durationStr = this.formatDuration(duration);

    this.log(chalk.bold('\n📊 Fetch Summary'));
    this.log(chalk.gray('─'.repeat(30)));
    this.log(`Job ID: ${chalk.cyan(job.id)}`);
    this.log(`Status: ${this.getStatusDisplay(job.status)}`);
    this.log(`Duration: ${chalk.yellow(durationStr)}`);

    if (job.metadata?.fetchType) {
      this.log(
        `Fetch Type: ${chalk.blue(job?.metadata?.fetchType.toUpperCase())}`
      );
    }

    if (job.metadata?.targetId) {
      this.log(`Target ID: ${chalk.cyan(job?.metadata?.targetId)}`);
    }

    if (job.metadata?.itemsFetched) {
      this.log(`Items Fetched: ${chalk.green(job?.metadata?.itemsFetched)}`);
    }

    if (job.errorMessage) {
      this.log(`Error: ${chalk.red(job.errorMessage)}`);
    }
  }

  /**
   * Get colored status display
   */
  private getStatusDisplay(status: string): string {
    switch (status) {
      case 'completed':
        return chalk.green('✓ Completed');
      case 'failed':
        return chalk.red('✗ Failed');
      case 'running':
        return chalk.blue('🔄 Running');
      case 'pending':
        return chalk.yellow('⏳ Pending');
      default:
        return chalk.gray(status);
    }
  }

  /**
   * Format duration for display
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000)
      return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  }
}

// Helper function for colored priority output
function getColoredPriority(priority: string): string {
  switch (priority?.toLowerCase()) {
    case 'high':
      return chalk.red('High');
    case 'medium':
      return chalk.yellow('Medium');
    case 'low':
      return chalk.green('Low');
    default:
      return chalk.dim(priority || 'None');
  }
}
