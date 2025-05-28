import { Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import { TodoService } from '../services/todoService';
import { CLIError } from '../types/errors/consolidated';
import chalk = require('chalk');
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * @class StoreSimpleCommand
 * @description This command stores a todo item on Walrus storage using the Walrus CLI.
 * It creates a JSON file with the todo data and uploads it to Walrus, returning the blob ID.
 */
export default class StoreSimpleCommand extends BaseCommand {
  static description = 'Store a todo on Walrus and get blob ID reference';

  static examples = [
    '<%= config.bin %> store-simple --todo 123 --list my-todos',
    '<%= config.bin %> store-simple --todo "Buy groceries" --list my-todos',
    '<%= config.bin %> store-simple --todo 123 --list my-todos --epochs 10',
  ];

  static flags = {
    ...BaseCommand.flags,
    todo: Flags.string({
      char: 't',
      description: 'ID or title of the todo to store',
      required: true,
    }),
    list: Flags.string({
      char: 'l',
      description: 'Todo list name',
      default: 'default',
    }),
    epochs: Flags.integer({
      char: 'e',
      description: 'Number of epochs to store for',
      default: 5,
    }),
    network: Flags.string({
      char: 'n',
      description: 'Network to use',
      options: ['testnet', 'mainnet'],
      default: 'testnet',
    }),
  };

  private todoService = new TodoService();

  async run() {
    const { flags } = await this.parse(StoreSimpleCommand);

    try {
      // Step 1: Find the todo
      this.log(chalk.blue(`Loading configuration...`));
      const list = await this.todoService.getList(flags.list);
      if (!list) {
        throw new CLIError(`List "${flags.list}" not found`, 'LIST_NOT_FOUND');
      }

      const todo = list.todos.find(
        t => t.id === flags.todo || t.title === flags.todo
      );
      if (!todo) {
        throw new CLIError(
          `Todo "${flags.todo}" not found in list "${flags.list}"`,
          'TODO_NOT_FOUND'
        );
      }

      this.log(chalk.green(`✓ Found todo: ${todo.title}`));

      // Step 2: Create a temporary JSON file with the todo data
      const tempDir = path.join(process.cwd(), '.walrus-temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFile = path.join(tempDir, `todo-${todo.id}.json`);
      const todoData = {
        id: todo.id,
        title: todo.title,
        description: todo.description,
        completed: todo.completed,
        priority: todo.priority,
        tags: todo.tags,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt,
        private: todo.private,
        storageLocation: 'walrus',
      };

      fs.writeFileSync(tempFile, JSON.stringify(todoData, null, 2));
      this.log(chalk.green(`✓ Created temporary file`));

      // Step 3: Check Walrus CLI availability
      this.log(chalk.blue(`Checking Walrus CLI...`));
      try {
        await execAsync('~/.local/bin/walrus --version');
        this.log(chalk.green(`✓ Walrus CLI found`));
      } catch (_error) {
        throw new CLIError(
          'Walrus CLI not found. Please install it first.',
          'WALRUS_CLI_NOT_FOUND'
        );
      }

      // Step 4: Store the todo on Walrus
      this.log(chalk.blue(`Storing todo on Walrus ${flags.network}...`));

      const walrusCommand = `~/.local/bin/walrus --context ${flags.network} store --epochs ${flags.epochs} ${tempFile}`;

      try {
        const { stdout } = await execAsync(walrusCommand);

        // Parse the output to extract blob ID and transaction info
        const blobIdMatch = stdout.match(/Blob ID: ([^\n]+)/);
        const suiObjectIdMatch = stdout.match(/Sui object ID: (0x[a-f0-9]+)/);
        const costMatch = stdout.match(/Cost \(excluding gas\): ([0-9.]+) WAL/);

        if (!blobIdMatch || !suiObjectIdMatch) {
          throw new CLIError('Failed to parse Walrus response', 'PARSE_ERROR');
        }

        const blobId = blobIdMatch[1];
        const suiObjectId = suiObjectIdMatch[1];
        const cost = costMatch ? costMatch[1] : 'unknown';

        // Step 5: Update the todo with the blob ID
        await this.todoService.updateTodo(flags.list, todo.id, {
          walrusBlobId: blobId,
          nftObjectId: suiObjectId,
          updatedAt: new Date().toISOString(),
        });

        // Step 6: Display success information
        this.log('');
        this.log(chalk.green.bold('✅ Todo stored successfully on Walrus!'));
        this.log('');
        this.log(chalk.white.bold('Storage Details:'));
        this.log(chalk.white(`  Todo: ${chalk.cyan(todo.title)}`));
        this.log(chalk.white(`  Blob ID: ${chalk.yellow(blobId)}`));
        this.log(chalk.white(`  Sui Object ID: ${chalk.yellow(suiObjectId)}`));
        this.log(chalk.white(`  Network: ${chalk.cyan(flags.network)}`));
        this.log(chalk.white(`  Storage Cost: ${chalk.green(cost + ' WAL')}`));
        this.log(chalk.white(`  Epochs: ${chalk.cyan(flags.epochs)}`));
        this.log('');
        this.log(chalk.white.bold('Access your todo:'));
        this.log(
          chalk.white(
            `  Walrus URL: ${chalk.cyan(`https://blob.wal.app/${blobId}`)}`
          )
        );

        // Get transaction ID by querying the Sui object
        try {
          const { stdout: objectOutput } = await execAsync(
            `sui client object ${suiObjectId}`
          );
          const txIdMatch = objectOutput.match(/prevTx\s*│\s*([^\s]+)/);
          if (txIdMatch) {
            this.log(
              chalk.white(`  Transaction ID: ${chalk.yellow(txIdMatch[1])}`)
            );
          }
        } catch (_error) {
          // Ignore if we can't get the transaction ID
        }
      } catch (error) {
        // Check if it's a WAL balance issue
        if (error.message.includes('could not find WAL coins')) {
          throw new CLIError(
            'Insufficient WAL balance. Run "walrus --context ' +
              flags.network +
              ' get-wal" to acquire WAL tokens.',
            'INSUFFICIENT_WAL'
          );
        }
        throw new CLIError(
          `Failed to store on Walrus: ${error.message}`,
          'WALRUS_STORE_FAILED'
        );
      }

      // Clean up temp file
      fs.unlinkSync(tempFile);
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Store failed: ${error instanceof Error ? error.message : String(error)}`,
        'STORE_FAILED'
      );
    }
  }
}
