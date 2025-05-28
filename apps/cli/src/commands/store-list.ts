import { Flags } from '@oclif/core';
import BaseCommand from '../base-command';
// import { SuiClient } from '../utils/adapters/sui-client-adapter';
// Ed25519Keypair imported but not used
import chalk = require('chalk');
import * as fs from 'fs';
import * as path from 'path';
import { configService } from '../services/config-service';
import { CLIError } from '../types/errors/consolidated';
import { createWalrusStorage } from '../utils/walrus-storage';
import { NETWORK_URLS } from '../constants';
import { TodoList } from '../types/todo';

/**
 * @class StoreListCommand
 * @description This command stores an entire todo list on the blockchain using Walrus storage.
 * It handles uploading the full list data as a single transaction, creating a reference in the blockchain,
 * and provides detailed feedback on the storage process.
 */
export default class StoreListCommand extends BaseCommand {
  static description =
    'Store an entire todo list on blockchain with Walrus storage';

  static examples = [
    '<%= config.bin %> store-list --file ./my-list.json                  # Store from file',
    '<%= config.bin %> store-list --file ./my-list.json --mock           # Test without storing',
    '<%= config.bin %> store-list --list my-todos                        # Store existing list',
    '<%= config.bin %> store-list --list my-todos --network testnet      # Use testnet',
    '<%= config.bin %> store-list --list work --epochs 20                # Store for 20 epochs',
    '<%= config.bin %> store-list --file todos.json --create-nft         # Store and create NFT',
  ];

  static flags = {
    ...BaseCommand.flags,
    mock: Flags.boolean({
      description: 'Use mock mode for testing',
      default: false,
    }),
    file: Flags.string({
      char: 'f',
      description: 'Path to a JSON file containing the todo list',
      exclusive: ['list'],
    }),
    list: Flags.string({
      char: 'l',
      description: 'Name of the todo list to store',
      exclusive: ['file'],
    }),
    network: Flags.string({
      char: 'n',
      description: 'Network to use (defaults to configured network)',
      options: ['localnet', 'devnet', 'testnet', 'mainnet'],
    }),
  };

  /**
   * Walrus storage client instance
   * @private
   */
  private walrusStorage = createWalrusStorage('testnet', false);

  /**
   * Start a spinner with the given text message
   * @param text The text to display alongside the spinner
   * @protected
   */
  protected startSpinner(text: string) {
    this.log(chalk.blue(text));
  }

  /**
   * Stop the current spinner and display a success or failure message
   * @param success Whether the operation succeeded
   * @param text Optional message to display
   * @protected
   */
  protected stopSpinner(success = true, text?: string) {
    if (text) {
      this.log(success ? chalk.green(`✓ ${text}`) : chalk.red(`✗ ${text}`));
    }
  }

  /**
   * Main command execution method
   */
  async run(): Promise<void> {
    try {
      const { flags } = await this.parse(StoreListCommand);

      this.startSpinner('Loading configuration...');
      const config = await configService.getConfig();

      const network = flags.network || config.network || 'testnet';
      const mockMode = flags.mock || false;

      this.walrusStorage = createWalrusStorage(network, mockMode);

      // Validate network configuration
      if (!NETWORK_URLS[network as keyof typeof NETWORK_URLS]) {
        throw new CLIError(
          `Invalid network: ${network}. Available networks: ${Object.keys(NETWORK_URLS).join(', ')}`,
          'INVALID_NETWORK'
        );
      }

      // Validate deployment information
      if (!config.lastDeployment?.packageId) {
        throw new CLIError(
          `Contract not deployed on network "${network}". Please run "waltodo deploy --network ${network}" first.`,
          'NOT_DEPLOYED'
        );
      }
      this.stopSpinner(true, 'Configuration validated');

      // Load the list data
      let todoList: TodoList;

      if (flags.file) {
        // Load from file
        const filePath = path.resolve(process.cwd(), flags.file);
        if (!fs.existsSync(filePath)) {
          throw new CLIError(`File not found: ${filePath}`, 'FILE_NOT_FOUND');
        }

        try {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const contentStr = typeof fileContent === 'string' ? fileContent : fileContent.toString('utf-8');
          try {
            todoList = JSON.parse(contentStr);
          } catch (parseError) {
            if (parseError instanceof SyntaxError) {
              throw new CLIError(
                `Invalid JSON format in file ${filePath}: ${parseError.message}`,
                'INVALID_JSON_FORMAT'
              );
            }
            throw parseError;
          }
        } catch (error) {
          if (error instanceof CLIError) {
            throw error; // Re-throw CLIError as-is
          }
          throw new CLIError(
            `Failed to read list file: ${error instanceof Error ? error.message : String(error)}`,
            'FILE_READ_ERROR'
          );
        }
      } else if (flags.list) {
        // Load from local storage
        const listFromStorage = await configService.getLocalTodos(flags.list);
        if (!listFromStorage) {
          throw new CLIError(
            `List "${flags.list}" not found`,
            'LIST_NOT_FOUND'
          );
        }
        todoList = listFromStorage;
      } else {
        throw new CLIError(
          'Either --file or --list must be provided',
          'MISSING_PARAMETER'
        );
      }

      // Validate the list structure
      if (!todoList.name || !Array.isArray(todoList.todos)) {
        throw new CLIError('Invalid todo list format', 'INVALID_FORMAT');
      }

      this.log(chalk.cyan(`\nPreparing to store todo list: ${todoList.name}`));
      this.log(chalk.dim(`Contains ${todoList.todos.length} todos`));

      // Initialize SUI client
      const networkUrl = NETWORK_URLS[network as keyof typeof NETWORK_URLS];

      /**
       * SUI client initialization for blockchain interactions
       * Currently disabled in mock mode
       */
      if (!mockMode) {
        // Real SUI client would be initialized here for production use
        console.log(`Would connect to SUI network at: ${networkUrl}`);
      }

      // Initialize and validate Walrus storage connection
      this.startSpinner('Connecting to Walrus storage...');
      await this.walrusStorage.connect();
      const isConnected = this.walrusStorage.getConnectionStatus();
      if (!isConnected) {
        throw new CLIError(
          'Failed to establish connection with Walrus storage',
          'WALRUS_CONNECTION_FAILED'
        );
      }
      this.stopSpinner(true, 'Connected to Walrus storage');

      // Store list on Walrus
      this.startSpinner(`Storing todo list "${todoList.name}" on Walrus...`);

      try {
        // Pre-upload validation
        this.startSpinner('Validating list data...');
        if (!todoList.name || !Array.isArray(todoList.todos)) {
          throw new CLIError(
            'Invalid list: missing name or todos array',
            'VALIDATION_ERROR'
          );
        }
        this.stopSpinner(true, 'List data validated');

        // Storage verification
        this.startSpinner('Verifying storage capacity...');
        await this.walrusStorage.ensureStorageAllocated(1000000);
        this.stopSpinner(true, 'Storage capacity verified');

        // In a real implementation, we would store the list to Walrus
        // For this example, we'll mock the storage process
        let blobId: string;
        if (mockMode) {
          this.log(chalk.yellow('Using mock mode for storing list'));
          blobId = `mock-list-blob-${Date.now()}`;
        } else {
          // Here we would implement the actual storage
          // This is a placeholder - in a real implementation, we would
          // serialize the list to bytes and upload to Walrus
          throw new CLIError(
            'Full list storage not implemented in this version',
            'NOT_IMPLEMENTED'
          );
        }

        // Display success message
        this.log(
          '\n' + chalk.green.bold('✨ Todo list successfully stored! ✨')
        );
        this.log('\n' + chalk.blue.bold('Storage Summary:'));
        this.log(chalk.dim('----------------------------------------'));
        this.log(chalk.green('✓ List name:'), chalk.cyan(todoList.name));
        this.log(
          chalk.green('✓ Total todos:'),
          chalk.cyan(todoList.todos.length)
        );
        this.log(
          chalk.green('✓ Stored on Walrus with blob ID:'),
          chalk.dim(blobId)
        );
        this.log(chalk.green('✓ Network:'), chalk.cyan(network));

        this.log('\n' + chalk.blue.bold('How to Retrieve:'));
        this.log(chalk.dim('----------------------------------------'));
        this.log(chalk.yellow('1. By blob ID:'));
        this.log(
          chalk.dim(`   ${this.config.bin} retrieve --blob-id ${blobId}`)
        );
      } finally {
        // Cleanup connection
        await this.walrusStorage.disconnect();
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to store list: ${error instanceof Error ? error.message : String(error)}`,
        'STORE_LIST_FAILED'
      );
    }
  }
}
