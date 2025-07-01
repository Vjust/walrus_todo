import { Flags, Args } from '@oclif/core';
import { BaseCommand } from '../base-command';
import { SuiClient } from '../utils/adapters/sui-client-compatibility';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { TodoService } from '../services/todo';
import { createWalrusStorage } from '../utils/walrus-storage';
import { SuiNftStorage } from '../utils/sui-nft-storage';
import { NETWORK_URLS } from '../constants';
import { CLIError } from '../types/errors/consolidated';
import { configService } from '../services/config-service';
import chalk = require('chalk');
import { Logger } from '../utils/Logger';
import {
  createBackgroundOperationsManager,
  BackgroundOperations,
} from '../utils/background-operations';
import { jobManager } from '../utils/PerformanceMonitor';
import { v4 as uuidv4 } from 'uuid';

/**
 * @class RetrieveCommand
 * @description Enhanced retrieve command with positional syntax support and smart detection.
 * Supports both positional arguments and legacy flag syntax for backward compatibility.
 *
 * Positional Usage:
 * - waltodo retrieve <list-name>              # Retrieve all todos from list
 * - waltodo retrieve <blob-id>               # Retrieve specific blob
 * - waltodo retrieve <list-name> <todo-title> # Retrieve specific todo from list
 *
 * Legacy Flag Usage (still supported):
 * - waltodo retrieve --todo "title" --list mylist
 * - waltodo retrieve --blob-id <id> --list mylist
 * - waltodo retrieve --object-id <id> --list mylist
 *
 * @param {string} [identifier] - List name, blob ID, or object ID (positional)
 * @param {string} [todoTitle] - Todo title when first arg is list name (positional)
 * @param {string} [todo] - The title or ID of the todo item to retrieve (legacy flag: -t, --todo)
 * @param {string} [blob-id] - The Walrus blob ID to retrieve (legacy flag: --blob-id)
 * @param {string} [object-id] - The NFT object ID to retrieve (legacy flag: --object-id)
 * @param {string} [list='default'] - The name of the local todo list to save to (flag: -l, --list)
 * @param {boolean} [mock=false] - Use mock Walrus storage for testing (flag: --mock)
 * @param {string} [network] - Blockchain network to use (flag: -n, --network)
 */
export default class RetrieveCommand extends BaseCommand {
  static description =
    'Retrieve todos with smart detection and intuitive syntax\n\nNEW SYNTAX:\n  waltodo retrieve <list>                     # Retrieve all todos from list\n  waltodo retrieve <blob-id>                  # Auto-detect and retrieve by blob ID\n  waltodo retrieve <object-id>                # Auto-detect and retrieve by NFT ID\n  waltodo retrieve <list> "<todo-title>"      # Retrieve specific todo from list\n\nThe new syntax intelligently detects whether you\'re retrieving by list name,\nblob ID, or object ID - no need to specify the type!\n\nLEGACY SYNTAX (still supported):\n  waltodo retrieve --todo "title" --list <list>\n  waltodo retrieve --blob-id <id> --list <list>\n  waltodo retrieve --object-id <id> --list <list>';

  static examples = [
    // Positional syntax (new, intuitive)
    '<%= config.bin %> retrieve mylist                     # Retrieve all todos from "mylist"',
    '<%= config.bin %> retrieve QmXyz123                   # Retrieve specific blob by ID',
    '<%= config.bin %> retrieve mylist "Buy groceries"     # Retrieve specific todo from list',
    '<%= config.bin %> retrieve 0x123abc --network testnet # Retrieve NFT from specific network',

    // Legacy flag syntax (backward compatibility)
    '<%= config.bin %> retrieve --todo "Buy groceries" --list my-todos    # Legacy: retrieve by title',
    '<%= config.bin %> retrieve --blob-id QmXyz --list my-todos           # Legacy: retrieve by blob ID',
    '<%= config.bin %> retrieve --object-id 0x123 --list my-todos         # Legacy: retrieve by NFT ID',
    '<%= config.bin %> retrieve --blob-id QmXyz --mock --list my-todos    # Legacy: test retrieval',
  ];

  static args = {
    identifier: Args.string({
      description: 'List name, blob ID, or object ID to retrieve',
      required: false,
    }),
    todoTitle: Args.string({
      description: 'Todo title (when first argument is a list name)',
      required: false,
    }),
  };

  static flags = {
    ...BaseCommand.flags,
    todo: Flags.string({
      char: 't',
      description: '[Legacy] Title or ID of the todo to retrieve',
      exclusive: ['blob-id', 'object-id'],
    }),
    'blob-id': Flags.string({
      description: '[Legacy] Walrus blob ID to retrieve',
      exclusive: ['object-id', 'todo'],
    }),
    'object-id': Flags.string({
      description: '[Legacy] NFT object ID to retrieve',
      exclusive: ['blob-id', 'todo'],
    }),
    list: Flags.string({
      char: 'l',
      description:
        'Save to this todo list (or source list for positional syntax)',
      default: 'default',
    }),
    mock: Flags.boolean({
      description: 'Use mock Walrus storage for testing',
      default: false,
    }),
    network: Flags.string({
      char: 'n',
      description: 'Network to use (defaults to configured network)',
      options: ['localnet', 'devnet', 'testnet', 'mainnet'],
    }),
    background: Flags.boolean({
      char: 'b',
      description: 'Run retrieval in background without blocking terminal',
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
      description: 'Timeout for retrieval operation in seconds',
      default: 300,
      min: 30,
    }),
  };

  private todoService = new TodoService();
  private spinner: unknown = null;
  private backgroundOps?: BackgroundOperations;

  protected startSpinner(text: string) {
    if (this.spinner) {
      this.spinner?.text = text;
    } else {
      this.log(chalk.blue(text));
    }
  }

  protected stopSpinner(success = true, text?: string) {
    if (text) {
      this.log(success ? chalk.green(`✓ ${text}`) : chalk.red(`✗ ${text}`));
    }
  }

  /**
   * Smart detection of identifier type
   */
  private detectIdentifierType(identifier: string): 'list' | 'blob' | 'object' {
    // Sui object IDs typically start with 0x and are 64+ chars
    if (identifier.startsWith('0x') && identifier.length >= 64) {
      return 'object';
    }

    // Walrus blob IDs are typically base58/base64 encoded, longer strings
    // Common patterns: Qm (IPFS-style), or long alphanumeric strings
    if (
      identifier.startsWith('Qm') ||
      identifier.startsWith('bafy') ||
      (identifier.length > 32 && /^[A-Za-z0-9+/=_-]+$/.test(identifier))
    ) {
      return 'blob';
    }

    // Default to list name for shorter, simpler strings
    return 'list';
  }

  /**
   * Retrieve all todos from a list
   */
  private async retrieveAllFromList(listName: string): Promise<void> {
    this.startSpinner(`Retrieving all todos from list "${listName}"...`);

    const list = await this?.todoService?.getList(listName);
    if (!list || !list.todos || list.todos?.length === 0) {
      this.stopSpinner(false);
      throw new CLIError(
        `No todos found in list "${listName}". Use "waltodo list" to see available lists.`,
        'EMPTY_LIST'
      );
    }

    const todos = list.todos;

    this.stopSpinner(
      true,
      `Found ${todos.length} todo(s) in list "${listName}"`
    );

    // Display the todos
    this.log(chalk.dim('\nTodos in list:'));
    todos.forEach((todo, index) => {
      const status = todo.completed ? chalk.green('✓') : chalk.yellow('○');
      const priority = getColoredPriority(todo.priority);
      this.log(
        `  ${status} ${chalk.bold(todo.title)} ${chalk.dim(`[${priority}]`)}`
      );

      if (todo.walrusBlobId) {
        this.log(
          `    ${chalk.dim('Walrus:')} ${chalk.cyan(todo.walrusBlobId)}`
        );
      }
      if (todo.nftObjectId) {
        this.log(`    ${chalk.dim('NFT:')} ${chalk.cyan(todo.nftObjectId)}`);
      }
      if (index < todos.length - 1) this.log('');
    });

    this.log(
      chalk.dim(
        `\n💡 To retrieve a specific todo: waltodo retrieve ${listName} "<todo-title>"`
      )
    );
  }

  async run(): Promise<void> {
    try {
      const { args, flags } = await this.parse(RetrieveCommand);

      // Handle background operation
      if (flags.background) {
        return this.runInBackground(args, flags);
      }

      this.startSpinner('Loading configuration...');
      const config = await configService.getConfig();
      const network = flags.network || config.network || 'testnet';
      const mockMode = flags.mock || false;

      // Validate network configuration
      if (!NETWORK_URLS[network as keyof typeof NETWORK_URLS]) {
        throw new CLIError(
          `Invalid network: ${network}. Available networks: ${Object.keys(NETWORK_URLS).join(', ')}`,
          'INVALID_NETWORK'
        );
      }
      this.stopSpinner(true, 'Configuration validated');

      // Initialize variables for retrieval IDs
      let blobId: string | undefined;
      let objectId: string | undefined;
      let todoTitle: string | undefined;
      let sourceList = flags.list;
      let retrieveAll = false;

      // Handle positional arguments vs legacy flags
      if (args.identifier) {
        const identifierType = this.detectIdentifierType(args.identifier);

        this.startSpinner('Analyzing input parameters...');

        switch (identifierType) {
          case 'list':
            sourceList = args.identifier;
            if (args.todoTitle) {
              // Retrieve specific todo from list
              todoTitle = args.todoTitle;
              this.stopSpinner(
                true,
                `Will retrieve "${todoTitle}" from list "${sourceList}"`
              );
            } else {
              // Retrieve all todos from list
              retrieveAll = true;
              this.stopSpinner(
                true,
                `Will retrieve all todos from list "${sourceList}"`
              );
            }
            break;

          case 'blob':
            blobId = args.identifier;
            this.stopSpinner(true, `Detected Walrus blob ID: ${blobId}`);
            break;

          case 'object':
            objectId = args.identifier;
            this.stopSpinner(true, `Detected Sui object ID: ${objectId}`);
            break;
        }
      } else if (flags.todo) {
        // Legacy flag syntax
        todoTitle = flags.todo;
      } else if (flags?.["blob-id"]) {
        // Legacy flag syntax
        blobId = flags?.["blob-id"];
      } else if (flags?.["object-id"]) {
        // Legacy flag syntax
        objectId = flags?.["object-id"];
      }

      // Handle retrieve all case
      if (retrieveAll) {
        await this.retrieveAllFromList(sourceList);
        return;
      }

      // Look up IDs from local todo if title/id provided
      this.startSpinner('Looking up todo information...');
      if (todoTitle) {
        const localTodo = await this?.todoService?.getTodoByTitleOrId(
          todoTitle,
          sourceList
        );
        if (!localTodo) {
          this.stopSpinner(false);

          // Provide helpful suggestions
          const list = await this?.todoService?.getList(sourceList);
          if (list && list.todos && list?.todos?.length > 0) {
            this.log(
              chalk.yellow(
                `\n⚠️  Todo "${todoTitle}" not found in list "${sourceList}"`
              )
            );
            this.log(chalk.dim('\nAvailable todos in this list:'));
            list?.todos?.slice(0, 5).forEach(todo => {
              this.log(`  • ${todo.title}`);
            });
            if (list?.todos?.length > 5) {
              this.log(chalk.dim(`  ... and ${list?.todos?.length - 5} more`));
            }
            this.log(
              chalk.dim(
                `\n💡 Use: waltodo retrieve ${sourceList}    # to see all todos`
              )
            );
          }

          throw new CLIError(
            `Todo "${todoTitle}" not found in list "${sourceList}"`,
            'TODO_NOT_FOUND'
          );
        }
        blobId = localTodo.walrusBlobId;
        objectId = localTodo.nftObjectId;

        if (!blobId && !objectId) {
          throw new CLIError(
            `Todo "${todoTitle}" exists locally but has no blockchain or Walrus storage IDs. You need to store it first using "waltodo store".`,
            'NOT_STORED'
          );
        }
      } else {
        // Validate input if not using todo lookup
        if (!blobId && !objectId) {
          // Make the error message more helpful with both syntaxes
          this.log(chalk.yellow('⚠️'), 'You must specify what to retrieve');
          this.log(chalk.dim('\nPositional syntax (recommended):'));
          this.log(
            chalk.dim(
              `  ${this?.config?.bin} retrieve mylist                    # Retrieve all from list`
            )
          );
          this.log(
            chalk.dim(
              `  ${this?.config?.bin} retrieve mylist "Task Title"      # Retrieve specific todo`
            )
          );
          this.log(
            chalk.dim(
              `  ${this?.config?.bin} retrieve <blob-id>               # Retrieve by blob ID`
            )
          );
          this.log(
            chalk.dim(
              `  ${this?.config?.bin} retrieve <object-id>             # Retrieve by object ID`
            )
          );

          this.log(chalk.dim('\nLegacy flag syntax:'));
          this.log(
            chalk.dim(
              `  ${this?.config?.bin} retrieve --todo "My Task" --list ${flags.list}`
            )
          );
          this.log(
            chalk.dim(
              `  ${this?.config?.bin} retrieve --blob-id <id> --list ${flags.list}`
            )
          );
          this.log(
            chalk.dim(
              `  ${this?.config?.bin} retrieve --object-id <id> --list ${flags.list}`
            )
          );

          // If the user is in test mode, provide sample test IDs
          if (mockMode) {
            this.log(
              chalk.blue(
                '\nSince you specified --mock, you can use these test IDs:'
              )
            );
            this.log(chalk.dim(`  ${this?.config?.bin} retrieve mock-blob-123`));
            this.log(
              chalk.dim(`  ${this?.config?.bin} retrieve mock-object-456`)
            );
          }

          throw new CLIError(
            'No retrieval identifier specified',
            'MISSING_PARAMETER'
          );
        }
      }

      // Check deployment status if retrieving from blockchain
      if (objectId && !config?.lastDeployment?.packageId) {
        throw new CLIError(
          'Contract not deployed. Please run "waltodo deploy --network ' +
            network +
            '" first.',
          'NOT_DEPLOYED'
        );
      }

      // Initialize SUI client using the provided or configured network
      const networkUrl = NETWORK_URLS[network as keyof typeof NETWORK_URLS];
      const suiClient = new SuiClient({ url: networkUrl });

      // Initialize and verify network connection
      if (!mockMode) {
        this.startSpinner('Verifying network connection...');
        try {
          await suiClient.getLatestCheckpointSequenceNumber();
          this.stopSpinner(true, 'Network connection verified');
        } catch (_error) {
          this.stopSpinner(false);
          throw new CLIError(
            `Unable to connect to network ${network}: ${_error instanceof Error ? _error.message : String(_error)}`,
            'NETWORK_ERROR'
          );
        }
      }

      // Initialize and connect to Walrus storage
      this.startSpinner('Connecting to Walrus storage...');
      const walrusStorage = createWalrusStorage('testnet', mockMode);
      try {
        await walrusStorage.connect();
        if (!mockMode && !walrusStorage.getConnectionStatus()) {
          throw new CLIError(
            'Failed to establish connection with Walrus storage',
            'WALRUS_CONNECTION_FAILED'
          );
        }
        this.stopSpinner(true, 'Connected to Walrus storage');
      } catch (connectError) {
        this.stopSpinner(false);
        throw new CLIError(
          `Failed to connect to Walrus storage: ${connectError instanceof Error ? connectError.message : String(connectError)}`,
          'WALRUS_CONNECTION_FAILED'
        );
      }

      try {
        this.startSpinner('Preparing to retrieve data...');
        if (blobId) {
          // Retrieve todo from Walrus directly
          this.startSpinner(
            `Retrieving todo from Walrus (blob ID: ${blobId})...`
          );

          try {
            const todo = await walrusStorage.retrieveTodo(blobId);

            // Save to local list (use sourceList for positional, flags.list for legacy)
            const targetList =
              args.identifier && !flags.todo ? 'default' : flags.list;
            await this?.todoService?.addTodo(targetList, {
              ...todo,
              walrusBlobId: blobId,
            });

            this.stopSpinner(true, 'Todo retrieved successfully from Walrus');
            this.log(chalk.dim('Details:'));
            this.log(`  Title: ${chalk.bold(todo.title)}`);
            this.log(
              `  Status: ${todo.completed ? chalk.green('Completed') : chalk.yellow('Pending')}`
            );
            this.log(`  Priority: ${getColoredPriority(todo.priority)}`);
            this.log(`  List: ${chalk.cyan(targetList)}`);
            this.log(`  Walrus Blob ID: ${chalk.dim(blobId)}`);

            if (todo.tags?.length) {
              this.log(
                `  Tags: ${todo?.tags?.map(tag => chalk.blue(tag)).join(', ')}`
              );
            }
          } catch (blobError) {
            throw new CLIError(
              `Failed to retrieve todo from Walrus with blob ID ${blobId}: ${blobError instanceof Error ? blobError.message : String(blobError)}`,
              'WALRUS_RETRIEVAL_FAILED'
            );
          }
        } else if (objectId) {
          // Initialize Sui NFT storage with the packageId from config
          const signer = {} as Ed25519Keypair;
          const suiNftStorage = new SuiNftStorage(suiClient, signer, {
            address: config.lastDeployment?.packageId ?? '',
            packageId: config.lastDeployment?.packageId ?? '',
            collectionId: '',
          });

          // Retrieve NFT from blockchain
          this.startSpinner(
            `Retrieving NFT from blockchain (object ID: ${objectId})...`
          );

          try {
            const nftData = await suiNftStorage.getTodoNft(objectId);

            if (!nftData.walrusBlobId) {
              throw new CLIError(
                'NFT does not contain a valid Walrus blob ID. This might not be a todo NFT.',
                'INVALID_NFT'
              );
            }

            // Retrieve todo data from Walrus
            this.startSpinner(
              `Retrieving todo data from Walrus (blob ID: ${nftData.walrusBlobId})...`
            );
            const todo = await walrusStorage
              .retrieveTodo(nftData.walrusBlobId)
              .catch(_error => {
                if (_error?.message?.includes('not found')) {
                  throw new CLIError(
                    `Todo data not found in Walrus storage. The data may have expired or been deleted.`,
                    'DATA_NOT_FOUND'
                  );
                }
                throw _error;
              });

            // Save to local list (use sourceList for positional, flags.list for legacy)
            const targetList =
              args.identifier && !flags.todo ? 'default' : flags.list;
            await this?.todoService?.addTodo(targetList, {
              ...todo,
              nftObjectId: objectId,
              walrusBlobId: nftData.walrusBlobId,
            });

            this.stopSpinner(
              true,
              'Todo retrieved successfully from blockchain and Walrus'
            );
            this.log(chalk.dim('Details:'));
            this.log(`  Title: ${chalk.bold(todo.title)}`);
            this.log(
              `  Status: ${todo.completed ? chalk.green('Completed') : chalk.yellow('Pending')}`
            );
            this.log(`  Priority: ${getColoredPriority(todo.priority)}`);
            this.log(`  List: ${chalk.cyan(targetList)}`);
            this.log(`  NFT Object ID: ${chalk.cyan(objectId)}`);
            this.log(`  Walrus Blob ID: ${chalk.dim(nftData.walrusBlobId)}`);

            if (todo.dueDate) {
              this.log(`  Due Date: ${chalk.blue(todo.dueDate)}`);
            }

            if (todo.tags?.length) {
              this.log(
                `  Tags: ${todo?.tags?.map(tag => chalk.blue(tag)).join(', ')}`
              );
            }

            // Add a link to view the NFT on Sui Explorer
            if (!mockMode) {
              this.log(chalk.blue('\nView your NFT on Sui Explorer:'));
              this.log(
                chalk.cyan(
                  `  https://explorer?.sui?.io/object/${objectId}?network=${network}`
                )
              );
            }
          } catch (nftError) {
            if (nftError instanceof CLIError) {
              throw nftError;
            }
            throw new CLIError(
              `Failed to retrieve NFT with object ID ${objectId}: ${nftError instanceof Error ? nftError.message : String(nftError)}`,
              'NFT_RETRIEVAL_FAILED'
            );
          }
        }
      } finally {
        // Enhanced cleanup with proper error handling
        this.startSpinner('Cleaning up resources...');
        try {
          await walrusStorage.disconnect();
          this.stopSpinner(true, 'Resources cleaned up');
        } catch (cleanupError) {
          this.stopSpinner(false, 'Resource cleanup encountered issues');
          Logger.getInstance().warn(
            `Failed to disconnect from Walrus storage: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`
          );
        }
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
   * Run retrieval operation in background
   */
  private async runInBackground(args: any, flags: any): Promise<void> {
    const jobId = flags?.["job-id"] || uuidv4();
    const timeoutMs = flags.timeout * 1000;

    // Initialize background operations manager
    this?.backgroundOps = await createBackgroundOperationsManager();

    // Create background job
    const job = jobManager.createJob(
      'retrieve',
      [args.identifier, args.todoTitle].filter(Boolean),
      flags
    );

    this.log(chalk.blue(`🚀 Starting background retrieval operation...`));
    this.log(chalk.dim(`Job ID: ${job.id}`));
    this.log(chalk.dim(`Timeout: ${flags.timeout}s`));

    try {
      // Start the job
      jobManager.startJob(job.id);

      // Queue the background operation
      const operationId = await this.queueBackgroundRetrieval(
        args,
        flags,
        job.id,
        timeoutMs
      );

      if (flags.wait) {
        this.log(chalk.yellow('⏳ Waiting for retrieval to complete...'));
        await this.waitForBackgroundOperation(operationId, job.id);
      } else {
        this.log(chalk.green('✓ Background retrieval started'));
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
   * Queue background retrieval operation
   */
  private async queueBackgroundRetrieval(
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

    // Prepare retrieval data
    const retrievalData = {
      args,
      flags: { ...flags, background: false }, // Remove background flag for actual execution
      jobId,
      network: flags.network,
      list: flags.list,
      mock: flags.mock,
    };

    // Queue operation with progress tracking
    const operationId = await this?.backgroundOps?.uploadTodosInBackground(
      [], // Empty todos array for retrieval
      {
        network: flags.network,
        priority: 'normal',
        onProgress: (id, progress) => {
          jobManager.updateProgress(jobId, progress);
          jobManager.writeJobLog(jobId, `Progress: ${progress}%`);
        },
        onComplete: (id, result) => {
          jobManager.completeJob(jobId, {
            operationId: id,
            result,
            itemsRetrieved: result?.retrieved || 0,
          });
          jobManager.writeJobLog(jobId, `Retrieval completed successfully`);
        },
        onError: (id, error) => {
          jobManager.failJob(jobId, error.message);
          jobManager.writeJobLog(jobId, `Error: ${error.message}`);
        },
      }
    );

    // Store retrieval data for the background process
    await this.storeRetrievalOperation(operationId, retrievalData, timeoutMs);

    return operationId;
  }

  /**
   * Store retrieval operation data for background processing
   */
  private async storeRetrievalOperation(
    operationId: string,
    data: any,
    timeoutMs: number
  ): Promise<void> {
    const { createCache } = await import('../utils/performance-cache');
    const cache = createCache('background-retrievals', {
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
    jobId: string
  ): Promise<void> {
    if (!this.backgroundOps) {
      throw new CLIError(
        'Background operations manager not initialized',
        'BACKGROUND_NOT_INITIALIZED'
      );
    }

    let lastProgress = 0;
    const progressCallback = (progress: number) => {
      if (progress > lastProgress + 5) {
        // Update every 5%
        const progressBar = this.createProgressBarVisual(progress);
        process?.stdout?.write(`\r${progressBar} ${progress}%`);
        lastProgress = progress;
      }
    };

    try {
      const result = await this?.backgroundOps?.waitForOperationWithProgress(
        operationId,
        progressCallback,
        300000 // 5 minutes timeout
      );

      process?.stdout?.write('\n'); // New line after progress bar
      this.log(chalk.green('✓ Background retrieval completed'));

      if (result?.retrieved) {
        this.log(chalk.dim(`Items retrieved: ${result.retrieved}`));
      }

      // Show final job status
      const job = jobManager.getJob(jobId);
      if (job) {
        this.displayJobSummary(job);
      }
    } catch (error) {
      process?.stdout?.write('\n'); // New line after progress bar
      throw new CLIError(
        `Background retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
        'BACKGROUND_RETRIEVAL_FAILED'
      );
    }
  }

  /**
   * Create a simple progress bar
   */
  private createProgressBarVisual(
    progress: number,
    width: number = 20
  ): string {
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;
    return (
      chalk.green('[') +
      chalk.green('█'.repeat(filled)) +
      chalk.gray('░'.repeat(empty)) +
      chalk.green(']')
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

    this.log(chalk.bold('\n📊 Retrieval Summary'));
    this.log(chalk.gray('─'.repeat(30)));
    this.log(`Job ID: ${chalk.cyan(job.id)}`);
    this.log(`Status: ${this.getStatusDisplay(job.status)}`);
    this.log(`Duration: ${chalk.yellow(durationStr)}`);

    if (job.metadata?.itemsRetrieved) {
      this.log(`Items Retrieved: ${chalk.green(job?.metadata?.itemsRetrieved)}`);
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
