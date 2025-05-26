import { Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import { TodoService } from '../services/todoService';
import { createWalrusStorage } from '../utils/walrus-storage';
import { SuiNftStorage } from '../utils/sui-nft-storage';
import { NETWORK_URLS, RETRY_CONFIG } from '../constants';
import { CLIError } from '../types/errors/consolidated';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { configService } from '../services/config-service';
import chalk from 'chalk';
import { RetryManager } from '../utils/retry-manager';

/**
 * @class FetchCommand
 * @description This command retrieves todo items directly from blockchain storage (Sui NFT) or Walrus storage using their respective IDs.
 * It allows users to fetch todos that may not be in their local storage and save them to a specified list.
 * The command handles the connection to Walrus for blob data and Sui blockchain for NFT data, ensuring the todo is properly reconstructed and stored locally.
 *
 * @param {string} [blob-id] - The Walrus blob ID of the todo item to retrieve. (Optional flag: --blob-id)
 * @param {string} [object-id] - The NFT object ID on the Sui blockchain to retrieve. (Optional flag: --object-id)
 * @param {string} [list='default'] - The name of the local todo list to save the retrieved todo to. (Optional flag: -l, --list)
 */
export default class FetchCommand extends BaseCommand {
  static description =
    'Fetch todos directly from blockchain or Walrus storage using IDs';

  static examples = [
    '<%= config.bin %> fetch --blob-id QmXyz --list my-todos            # Fetch by blob ID',
    '<%= config.bin %> fetch --object-id 0x123 --list my-todos          # Fetch by NFT object ID',
    '<%= config.bin %> fetch --blob-id abc123 --list work --save        # Fetch and save locally',
    '<%= config.bin %> fetch --object-id 0x456 --network testnet        # Fetch from testnet',
    '<%= config.bin %> fetch --blob-id xyz789 --list personal --verify  # Fetch with verification',
  ];

  static flags = {
    ...BaseCommand.flags,
    'blob-id': Flags.string({
      description: 'Walrus blob ID to retrieve',
      exclusive: ['object-id'],
    }),
    'object-id': Flags.string({
      description: 'NFT object ID to retrieve',
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
  };

  private todoService = new TodoService();
  private walrusStorage = createWalrusStorage('testnet', true); // Use mock mode for testing
  private parsedFlags!: Record<string, unknown>; // Will be populated after parsing

  /**
   * Creates a SuiClient instance for the specified network
   *
   * @param network Network name to connect to (mainnet, testnet, devnet, local)
   * @returns Configured SuiClient instance
   */
  private createSuiClient(network: string): typeof SuiClient {
    // In a proper implementation, this would create a real SuiClient
    // For now, we stub it for testing purposes
    if (this.parsedFlags['dry-run']) {
      return {
        url: NETWORK_URLS[network as keyof typeof NETWORK_URLS],
        core: {} as Record<string, never>,
        jsonRpc: {} as Record<string, never>,
        signAndExecuteTransaction: async () => {},
        getEpochMetrics: async () => null,
        getObject: async () => null,
        getTransactionBlock: async () => null,
      } as unknown as typeof SuiClient;
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
    if (this.parsedFlags['dry-run']) {
      return {} as Record<string, never> as Ed25519Keypair;
    }

    // For actual implementation, this would load a keypair from the keystore
    throw new CLIError(
      'Real signers not supported in this version. Use --dry-run flag.',
      'SIGNER_NOT_SUPPORTED'
    );
  }

  async run(): Promise<void> {
    try {
      const { flags } = await this.parse(FetchCommand);
      this.parsedFlags = flags;

      // Validate input
      if (!flags['blob-id'] && !flags['object-id']) {
        throw new CLIError(
          'Either --blob-id or --object-id must be specified',
          'MISSING_PARAMETER'
        );
      }

      // Get config for Sui client
      const configInner = await configService.getConfig(); // Changed to avoid redeclaration
      if (!configInner?.lastDeployment?.packageId) {
        throw new CLIError(
          'Contract not deployed. Please run "waltodo deploy" first.',
          'NOT_DEPLOYED'
        );
      }

      if (flags['blob-id']) {
        let todo;

        try {
          // Initialize Walrus storage
          await this.walrusStorage.connect();

          // Retrieve todo from Walrus with retry
          this.log(
            chalk.blue(
              `Retrieving todo from Walrus (blob ID: ${flags['blob-id']})...`
            )
          );
          todo = await RetryManager.retry(
            () => this.walrusStorage.retrieveTodo(flags['blob-id']),
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
          await this.todoService.addTodo(flags.list, todo);

          this.log(chalk.green('✓ Todo retrieved successfully'));
          this.log(chalk.dim('Details:'));
          this.log(`  Title: ${todo.title}`);
          this.log(`  Status: ${todo.completed ? 'Completed' : 'Pending'}`);
          this.log(`  Priority: ${todo.priority}`);

          if (todo.tags?.length) {
            this.log(`  Tags: ${todo.tags.join(', ')}`);
          }
        } catch (error) {
          // Make sure we disconnect from Walrus even if there was an error
          try {
            await this.walrusStorage.disconnect();
          } catch (disconnectError) {
            this.debug(`Error during disconnect: ${disconnectError}`);
          }

          throw error;
        }

        // Cleanup
        await this.walrusStorage.disconnect();
      } else if (flags['object-id']) {
        // Initialize Sui client first - in a real implementation, this would use a proper client
        // This is a placeholder that should be replaced with a real implementation or dry-run flag
        const suiClient = this.createSuiClient(configInner.network);

        // Initialize Sui NFT storage
        if (!configInner.lastDeployment) {
          throw new CLIError(
            'Contract not deployed. Please run "waltodo deploy" first.',
            'NOT_DEPLOYED'
          );
        }

        // A proper implementation would load the signer from a keystore
        const signer = await this.getSigner();

        // Use constants for empty strings
        const EMPTY_COLLECTION_ID = '';

        const suiNftStorage = new SuiNftStorage(suiClient, signer, {
          address: configInner.lastDeployment.packageId,
          packageId: configInner.lastDeployment.packageId,
          collectionId: EMPTY_COLLECTION_ID,
        });

        let todo: unknown;
        let nftData: unknown;

        try {
          // Retrieve NFT from blockchain with retry
          this.log(
            chalk.blue(
              `Retrieving NFT from blockchain (object ID: ${flags['object-id']})...`
            )
          );
          nftData = await RetryManager.retry(
            () => suiNftStorage.getTodoNft(flags['object-id']),
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
          await this.walrusStorage.connect();

          // Retrieve todo data from Walrus with retry
          this.log(
            chalk.blue(
              `Retrieving todo data from Walrus (blob ID: ${nftData.walrusBlobId})...`
            )
          );
          todo = await RetryManager.retry(
            () => this.walrusStorage.retrieveTodo(nftData.walrusBlobId),
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
          await this.todoService.addTodo(flags.list, {
            ...todo,
            nftObjectId: flags['object-id'],
            walrusBlobId: nftData.walrusBlobId,
          });

          this.log(
            chalk.green(
              `✓ Todo retrieved successfully from blockchain and Walrus`
            )
          );
          this.log(chalk.dim('Details:'));
          this.log(`  Title: ${todo.title}`);
          this.log(`  Status: ${todo.completed ? 'Completed' : 'Pending'}`);
          this.log(`  Priority: ${todo.priority}`);
          this.log(`  NFT Object ID: ${flags['object-id']}`);
          this.log(`  Walrus Blob ID: ${nftData.walrusBlobId}`);

          if (todo.tags?.length) {
            this.log(`  Tags: ${todo.tags.join(', ')}`);
          }
        } catch (error) {
          // Make sure we disconnect from Walrus even if there was an error
          try {
            await this.walrusStorage.disconnect();
          } catch (disconnectError) {
            this.debug(`Error during disconnect: ${disconnectError}`);
          }

          throw error;
        }

        // Cleanup
        await this.walrusStorage.disconnect();
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
