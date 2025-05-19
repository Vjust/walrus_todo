import { Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { TodoService } from '../services/todoService';
import { createWalrusStorage } from '../utils/walrus-storage';
import { SuiNftStorage } from '../utils/sui-nft-storage';
import { NETWORK_URLS } from '../constants';
import { CLIError } from '../types/error';
import { configService } from '../services/config-service';
import chalk from 'chalk';

/**
 * @class RetrieveCommand
 * @description This command retrieves todo items from blockchain storage (Sui NFT) or Walrus storage using various identifiers.
 * It supports fetching by todo title/ID (from local storage to get associated blockchain IDs), Walrus blob ID, or Sui NFT object ID.
 * Retrieved todos are saved to a specified local list, with detailed output on the retrieval process and todo information.
 * The command includes options for mock mode testing and network selection for blockchain operations.
 *
 * @param {string} [todo] - The title or ID of the todo item to retrieve, using local data to find associated blockchain IDs. (Optional flag: -t, --todo)
 * @param {string} [blob-id] - The Walrus blob ID of the todo item to retrieve directly from Walrus storage. (Optional flag: --blob-id)
 * @param {string} [object-id] - The NFT object ID on the Sui blockchain to retrieve, which also fetches associated Walrus data. (Optional flag: --object-id)
 * @param {string} [list='default'] - The name of the local todo list to save the retrieved todo to. (Optional flag: -l, --list)
 * @param {boolean} [mock=false] - If true, uses mock Walrus storage for testing purposes. (Optional flag: --mock)
 * @param {string} [network] - The blockchain network to use for Sui operations ('localnet', 'devnet', 'testnet', 'mainnet'). Defaults to the configured network. (Optional flag: -n, --network)
 */
export default class RetrieveCommand extends BaseCommand {
  static description = 'Retrieve stored todos from blockchain or Walrus storage';

  static examples = [
    '<%= config.bin %> retrieve --todo "Buy groceries" --list my-todos',
    '<%= config.bin %> retrieve --blob-id QmXyz --list my-todos',
    '<%= config.bin %> retrieve --object-id 0x123 --list my-todos',
    '<%= config.bin %> retrieve --object-id 0x123 --network testnet --list my-todos',
    '<%= config.bin %> retrieve --blob-id QmXyz --mock --list my-todos',
  ];

  static flags = {
    ...BaseCommand.flags,
    todo: Flags.string({
      char: 't',
      description: 'Title or ID of the todo to retrieve',
      exclusive: ['blob-id', 'object-id'],
    }),
    'blob-id': Flags.string({
      description: 'Walrus blob ID to retrieve',
      exclusive: ['object-id', 'todo'],
    }),
    'object-id': Flags.string({
      description: 'NFT object ID to retrieve',
      exclusive: ['blob-id', 'todo'],
    }),
    list: Flags.string({
      char: 'l',
      description: 'Save to this todo list',
      default: 'default'
    }),
    mock: Flags.boolean({
      description: 'Use mock Walrus storage for testing',
      default: false
    }),
    network: Flags.string({
      char: 'n',
      description: 'Network to use (defaults to configured network)',
      options: ['localnet', 'devnet', 'testnet', 'mainnet'],
    }),
  };

  private todoService = new TodoService();
  private spinner: any = null;

  private startSpinner(text: string) {
    if (this.spinner) {
      this.spinner.text = text;
    } else {
      this.log(chalk.blue(text));
    }
  }

  private stopSpinner(success = true, text?: string) {
    if (text) {
      this.log(success ? chalk.green(`✓ ${text}`) : chalk.red(`✗ ${text}`));
    }
  }

  async run(): Promise<void> {
    try {
      const { flags } = await this.parse(RetrieveCommand);
      
      this.startSpinner('Loading configuration...');
      const config = await configService.getConfig();
      const network = flags.network || config.network || 'testnet';
      const mockMode = flags.mock || false;

      // Validate network configuration
      if (!NETWORK_URLS[network as keyof typeof NETWORK_URLS]) {
        throw new CLIError(`Invalid network: ${network}. Available networks: ${Object.keys(NETWORK_URLS).join(', ')}`, 'INVALID_NETWORK');
      }
      this.stopSpinner(true, 'Configuration validated');

      // Initialize variables for retrieval IDs
      let blobId: string | undefined;
      let objectId: string | undefined;

      // Look up IDs from local todo if title/id provided
      this.startSpinner('Looking up todo information...');
      if (flags.todo) {
        const localTodo = await this.todoService.getTodoByTitleOrId(flags.todo, flags.list);
        if (!localTodo) {
          this.stopSpinner(false);
          throw new CLIError(`Todo "${flags.todo}" not found in list "${flags.list}"`, 'TODO_NOT_FOUND');
        }
        blobId = localTodo.walrusBlobId;
        objectId = localTodo.nftObjectId;

        if (!blobId && !objectId) {
          throw new CLIError(
            `Todo "${flags.todo}" exists locally but has no blockchain or Walrus storage IDs. You need to store it first.`,
            'NOT_STORED'
          );
        }
      } else {
        // Validate input if not using todo lookup
        if (!flags['blob-id'] && !flags['object-id']) {
          // Make the error message more helpful
          this.log(chalk.yellow('⚠️'), 'You must specify either a todo title/ID, Walrus blob ID, or Sui object ID to retrieve');
          this.log(chalk.dim('\nExamples:'));
          this.log(chalk.dim(`  ${this.config.bin} retrieve --todo "My Task" --list ${flags.list}`));
          this.log(chalk.dim(`  ${this.config.bin} retrieve --blob-id <walrus-blob-id> --list ${flags.list}`));
          this.log(chalk.dim(`  ${this.config.bin} retrieve --object-id <sui-object-id> --list ${flags.list}`));
          
          // If the user is in test mode, provide sample test IDs
          if (mockMode) {
            this.log(chalk.blue('\nSince you specified --mock, you can use these test IDs:'));
            this.log(chalk.dim('  --blob-id mock-blob-123'));
            this.log(chalk.dim('  --object-id mock-object-456'));
          }
          
          throw new CLIError('No retrieval identifier specified', 'MISSING_PARAMETER');
        }

        blobId = flags['blob-id'];
        objectId = flags['object-id'];
      }

      // Check deployment status if retrieving from blockchain
      if (objectId && !config?.lastDeployment?.packageId) {
        throw new CLIError(
          'Contract not deployed. Please run "waltodo deploy --network ' + network + '" first.', 
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
        } catch (error) {
          this.stopSpinner(false);
          throw new CLIError(`Unable to connect to network ${network}: ${error instanceof Error ? error.message : String(error)}`, 'NETWORK_ERROR');
        }
      }

      // Initialize and connect to Walrus storage
      this.startSpinner('Connecting to Walrus storage...');
      const walrusStorage = createWalrusStorage('testnet', mockMode);
      try {
        await walrusStorage.connect();
        if (!mockMode && !(await walrusStorage.isConnected())) {
          throw new CLIError('Failed to establish connection with Walrus storage', 'WALRUS_CONNECTION_FAILED');
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
          this.startSpinner(`Retrieving todo from Walrus (blob ID: ${blobId})...`);
          
          try {
            const todo = await walrusStorage.retrieveTodo(blobId);
            
            // Save to local list
            await this.todoService.addTodo(flags.list, {
              ...todo,
              walrusBlobId: blobId
            });

            this.stopSpinner(true, 'Todo retrieved successfully from Walrus');
            this.log(chalk.dim('Details:'));
            this.log(`  Title: ${chalk.bold(todo.title)}`);
            this.log(`  Status: ${todo.completed ? chalk.green('Completed') : chalk.yellow('Pending')}`);
            this.log(`  Priority: ${getColoredPriority(todo.priority)}`);
            this.log(`  List: ${chalk.cyan(flags.list)}`);
            this.log(`  Walrus Blob ID: ${chalk.dim(blobId)}`);

            if (todo.tags?.length) {
              this.log(`  Tags: ${todo.tags.map(tag => chalk.blue(tag)).join(', ')}`);
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
          const suiNftStorage = new SuiNftStorage(
            suiClient,
            signer,
            { address: config.lastDeployment!.packageId, packageId: config.lastDeployment!.packageId, collectionId: '' }
          );

          // Retrieve NFT from blockchain
          this.startSpinner(`Retrieving NFT from blockchain (object ID: ${objectId})...`);
          
          try {
            const nftData = await suiNftStorage.getTodoNft(objectId);

            if (!nftData.walrusBlobId) {
              throw new CLIError(
                'NFT does not contain a valid Walrus blob ID. This might not be a todo NFT.', 
                'INVALID_NFT'
              );
            }

            // Retrieve todo data from Walrus
            this.startSpinner(`Retrieving todo data from Walrus (blob ID: ${nftData.walrusBlobId})...`);
            const todo = await walrusStorage.retrieveTodo(nftData.walrusBlobId).catch(error => {
              if (error.message.includes('not found')) {
                throw new CLIError(
                  `Todo data not found in Walrus storage. The data may have expired or been deleted.`,
                  'DATA_NOT_FOUND'
                );
              }
              throw error;
            });

            // Save to local list
            await this.todoService.addTodo(flags.list, {
              ...todo,
              nftObjectId: objectId,
              walrusBlobId: nftData.walrusBlobId
            });

            this.stopSpinner(true, "Todo retrieved successfully from blockchain and Walrus");
            this.log(chalk.dim("Details:"));
            this.log(`  Title: ${chalk.bold(todo.title)}`);
            this.log(`  Status: ${todo.completed ? chalk.green('Completed') : chalk.yellow('Pending')}`);
            this.log(`  Priority: ${getColoredPriority(todo.priority)}`);
            this.log(`  List: ${chalk.cyan(flags.list)}`);
            this.log(`  NFT Object ID: ${chalk.cyan(objectId)}`);
            this.log(`  Walrus Blob ID: ${chalk.dim(nftData.walrusBlobId)}`);
            
            if (todo.dueDate) {
              this.log(`  Due Date: ${chalk.blue(todo.dueDate)}`);
            }

            if (todo.tags?.length) {
              this.log(`  Tags: ${todo.tags.map(tag => chalk.blue(tag)).join(', ')}`);
            }

            // Add a link to view the NFT on Sui Explorer
            if (!mockMode) {
              this.log(chalk.blue('\nView your NFT on Sui Explorer:'));
              this.log(chalk.cyan(`  https://explorer.sui.io/object/${objectId}?network=${network}`));
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
          console.warn(`Warning: Failed to disconnect from Walrus storage: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
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
