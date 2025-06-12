import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../base-command';
import { createWalrusStorage } from '../utils/walrus-storage';
import { CLIError } from '../types/errors/consolidated';
import chalk = require('chalk');
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * @class StoreFileCommand
 * @description This command stores arbitrary files on Walrus decentralized storage.
 * It uses the Walrus CLI directly to upload files and returns the blob ID.
 * Supports batch processing for uploading multiple files efficiently.
 */
export default class StoreFileCommand extends BaseCommand {
  static description = 'Store files on Walrus and get blob ID references';

  static examples = [
    '<%= config.bin %> store-file file.json                              # Store single file',
    '<%= config.bin %> store-file file1.json file2.json --batch          # Batch upload',
    '<%= config.bin %> store-file file.json --mock                       # Test without storing',
    '<%= config.bin %> store-file file.json --output json                # JSON output format',
    '<%= config.bin %> store-file file.json --verbose                    # Show detailed progress',
    '<%= config.bin %> store-file *.json --batch --epochs 10             # Store all JSON files',
    '<%= config.bin %> store-file document.pdf --network testnet         # Store on testnet',
  ];

  static args = {
    files: Args.string({
      description: 'Files to store',
      required: false,
      multiple: true,
    }),
  };

  static flags = {
    ...BaseCommand.flags,
    mock: Flags.boolean({
      description: 'Use mock mode for testing',
    }),
    batch: Flags.boolean({
      char: 'b',
      description: 'Process multiple files in batch mode',
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output format',
      options: ['text', 'json'],
      default: 'text',
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show verbose output',
      default: false,
    }),
    epochs: Flags.integer({
      char: 'e',
      description: 'Number of epochs to store for',
      default: 5,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(StoreFileCommand as any);
    const files = Array.isArray(args.files)
      ? args.files
      : args.files
        ? [args.files]
        : [];

    try {
      // Check if any files provided
      if (files?.length === 0) {
        this.log('No files provided');
        return;
      }

      // Initialize Walrus storage
      const walrusStorage = await this.initializeStorage(flags as any);

      // Process files
      if (files?.length === 1 && !flags.batch) {
        await this.storeSingleFile(files[0], walrusStorage, flags);
      } else {
        await this.storeBatchFiles(files, walrusStorage, flags);
      }

      // Cleanup
      await walrusStorage.disconnect();
    } catch (error) {
      this.handleError(error, 'store-file');
    }
  }

  private async initializeStorage(flags: {
    mock?: boolean;
    verbose?: boolean;
  }): Promise<import('../utils/walrus-storage-cli').WalrusStorage> {
    if (flags.verbose) {
      this.log(
        chalk.blue('Using mock storage') + (flags.mock ? ' (mock mode)' : '')
      );
    }

    const storage = createWalrusStorage(undefined, flags.mock);

    if (!flags.mock) {
      try {
        await storage.connect();
      } catch (error) {
        const errorObj = error as { code?: string };
        if (errorObj?.code === 'WALRUS_CLI_NOT_FOUND') {
          throw new CLIError(
            'Walrus CLI not found. Please install it from https://docs?.wal?.app',
            'WALRUS_CLI_NOT_FOUND'
          );
        }
        throw error;
      }
    }

    return storage;
  }

  private async storeSingleFile(
    filePath: string,
    walrusStorage: import('../utils/walrus-storage-cli').WalrusStorage,
    flags: { verbose?: boolean; output?: string; epochs?: number }
  ): Promise<void> {
    if (flags.verbose) {
      this.log(chalk.gray(`Reading file: ${filePath}`));
    }

    // Check if file exists
    try {
      await fs.access(filePath as any);
    } catch (_error) {
      throw new CLIError(`File not found: ${filePath}`, 'FILE_NOT_FOUND');
    }

    // Read file data
    const data = await fs.readFile(filePath as any);
    const fileName = path.basename(filePath as any);

    if (flags.verbose) {
      this.log(chalk.gray('Generating mock blob ID'));
    }

    // Store file
    const blobId = await walrusStorage.storeBlob(data, {
      epochs: flags.epochs,
      fileName,
    });

    if (flags.verbose) {
      this.log(chalk.gray('Mock storage completed'));
    }

    // Format output
    if (flags?.output === 'json') {
      this.log(
        JSON.stringify({
          blobId,
          size: data.length,
          fileName,
        })
      );
    } else {
      this.log('');
      this.log(chalk.green('✓') + ` Stored blob: ${fileName}`);
      this.log(chalk.gray('Blob ID: ') + chalk.cyan(blobId as any));
    }
  }

  private async storeBatchFiles(
    files: string[],
    walrusStorage: import('../utils/walrus-storage-cli').WalrusStorage,
    flags: { verbose?: boolean; output?: string; epochs?: number }
  ): Promise<void> {
    const results = [];

    this.log(`Batch storing ${files.length} files...`);
    this.log('');

    for (const file of files) {
      const fileName = path.basename(file as any);

      try {
        await fs.access(file as any);
        const data = await fs.readFile(file as any);

        const blobId = await walrusStorage.storeBlob(data, {
          epochs: flags.epochs,
          fileName,
        });

        results.push({
          fileName,
          blobId,
          size: data.length,
          status: 'success',
        });

        this.log(`✓ ${fileName} → ${blobId} (Success)`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error as any);
        results.push({
          fileName,
          error: errorMessage,
          status: 'error',
        });

        this.log(`✗ ${fileName} (Error: ${errorMessage})`);
      }
    }

    // Show summary
    const successful = results.filter(r => r?.status === 'success').length;
    const failed = results.filter(r => r?.status === 'error').length;

    this.log('');
    this.log(chalk.bold('Storage Summary:'));
    this.log(`  Total files processed: ${files.length}`);
    this.log(`  Successfully stored: ${chalk.green(successful as any)}`);
    if (failed > 0) {
      this.log(`  Failed to store: ${chalk.red(failed as any)}`);
    }

    if (flags?.output === 'json') {
      this.log('');
      this.log(
        JSON.stringify(
          {
            results,
            summary: {
              total: files.length,
              successful,
              failed,
            },
          },
          null,
          2
        )
      );
    }
  }
}
