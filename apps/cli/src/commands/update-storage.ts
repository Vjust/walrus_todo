import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import { confirm } from '@inquirer/prompts';
import { TodoService } from '../services/todoService';
import { Todo, StorageLocation } from '../types/todo';
import { CLIError } from '../types/errors/consolidated';
import { createWalrusStorage } from '../utils/walrus-storage';
import { BaseCommand } from '../base-command';

// Define ICONS and STORAGE locally since they're not exported from base-command
const ICONS = {
  SUCCESS: '✓',
  ERROR: '✗',
  WARNING: '⚠',
  INFO: 'ℹ',
  storage: '💾',
  transfer: '📦',
};

const STORAGE = {
  local: 'local',
  blockchain: 'blockchain',
  both: 'both',
};

/**
 * @class UpdateStorageCommand
 * @description This command allows updating the storage location of existing todos.
 * It handles validation, migration between storage locations, and ensures data integrity
 * during the transition process.
 */
export default class UpdateStorageCommand extends BaseCommand {
  static description = 'Update storage location for existing todos';

  static examples = [
    '<%= config.bin %> update-storage my-list --id task-123 --storage blockchain  # Move to blockchain',
    '<%= config.bin %> update-storage my-list --id "Buy groceries" --storage both  # Local + blockchain',
    '<%= config.bin %> update-storage my-list --all --storage local                # Move all to local',
    '<%= config.bin %> update-storage work --id todo-456 --storage walrus          # Move to Walrus',
    '<%= config.bin %> update-storage personal --all --storage blockchain --force  # Force update all',
  ];

  static flags = {
    ...BaseCommand.flags,
    id: Flags.string({
      char: 'i',
      description: 'Todo ID or title to update',
      exclusive: ['all'],
    }),
    all: Flags.boolean({
      char: 'a',
      description: 'Update all todos in the list',
      exclusive: ['id'],
    }),
    storage: Flags.string({
      char: 's',
      description: 'New storage location',
      options: ['local', 'blockchain', 'both'],
      required: true,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Force storage update without confirmation',
      default: false,
    }),
  };

  static args = {
    listName: Args.string({
      description: 'Name of the todo list',
      required: true,
    }),
  };

  private todoService = new TodoService();
  private walrusStorage = createWalrusStorage('testnet', false);

  async run(): Promise<void> {
    const { args, flags } = await this.parse(UpdateStorageCommand as any);

    try {
      const list = await this?.todoService?.getList(args.listName);
      if (!list) {
        throw new CLIError(
          `List "${args.listName}" not found`,
          'LIST_NOT_FOUND'
        );
      }

      let todosToUpdate: Todo[] = [];

      if (flags.all) {
        todosToUpdate = list.todos;
      } else if (flags.id) {
        const todo = await this?.todoService?.findTodoByIdOrTitle(
          flags.id,
          args.listName
        );
        if (!todo) {
          throw new CLIError(`Todo "${flags.id}" not found`, 'TODO_NOT_FOUND');
        }
        todosToUpdate = [todo];
      } else {
        throw new CLIError(
          'Either --id or --all flag is required',
          'INVALID_FLAGS'
        );
      }

      const newStorage = flags.storage as StorageLocation;

      // Validate storage transition for each todo
      const validationResults = await this.validateStorageTransitions(
        todosToUpdate,
        newStorage
      );

      if (validationResults?.errors?.length > 0) {
        this.displayValidationErrors(validationResults.errors);
        if (!flags.force) {
          throw new CLIError('Storage validation failed', 'VALIDATION_FAILED');
        }
        this.warning('Forcing storage update despite validation errors');
      }

      // Show confirmation unless forced
      if (!flags.force && validationResults?.warnings?.length > 0) {
        this.displayWarnings(validationResults.warnings);
        const shouldContinue = await confirm({
          message: 'Continue with storage update?',
          default: false,
        });
        if (!shouldContinue) {
          this.log(chalk.yellow('Storage update cancelled'));
          return;
        }
      }

      // Perform storage updates
      await this.performStorageUpdates(
        todosToUpdate,
        newStorage,
        args.listName
      );
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to update storage: ${error instanceof Error ? error.message : String(error as any)}`,
        'UPDATE_STORAGE_FAILED'
      );
    }
  }

  private async validateStorageTransitions(
    todos: Todo[],
    newStorage: StorageLocation
  ): Promise<{ warnings: string[]; errors: string[] }> {
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const todo of todos) {
      const currentStorage = todo.storageLocation;

      // Check for invalid transitions
      if (currentStorage === newStorage) {
        warnings.push(
          `Todo "${todo.title}" is already in ${newStorage} storage`
        );
        continue;
      }

      // Validate blockchain to local transition
      if (currentStorage === 'blockchain' && newStorage === 'local') {
        warnings.push(
          `Moving "${todo.title}" from blockchain to local will not remove blockchain data`
        );
      }

      // Validate blockchain storage requirements
      if (
        (newStorage === 'blockchain' || newStorage === 'both') &&
        !todo.walrusBlobId &&
        currentStorage === 'local'
      ) {
        // This is a new blockchain storage, check connectivity
        try {
          await this?.walrusStorage?.connect();
          await this?.walrusStorage?.disconnect();
        } catch (_error) {
          errors.push(
            `Cannot store "${todo.title}" on blockchain: ${_error.message}`
          );
        }
      }

      // Check for data integrity issues
      if (
        todo.walrusBlobId &&
        (newStorage === 'local' || newStorage === 'both')
      ) {
        try {
          await this?.walrusStorage?.connect();
          const blockchainTodo = await this?.walrusStorage?.retrieveTodo(
            todo.walrusBlobId
          );
          if (blockchainTodo.updatedAt > todo.updatedAt) {
            warnings.push(
              `Blockchain version of "${todo.title}" is newer than local version`
            );
          }
          await this?.walrusStorage?.disconnect();
        } catch (_error) {
          errors.push(
            `Cannot verify blockchain data for "${todo.title}": ${_error.message}`
          );
        }
      }
    }

    return { warnings, errors };
  }

  private displayValidationErrors(errors: string[]): void {
    this.section(
      'Validation Errors',
      errors.map(e => chalk.red(`${ICONS.ERROR} ${e}`)).join('\n')
    );
  }

  private displayWarnings(warnings: string[]): void {
    this.section(
      'Warnings',
      warnings.map(w => chalk.yellow(`${ICONS.WARNING} ${w}`)).join('\n')
    );
  }

  private async performStorageUpdates(
    todos: Todo[],
    newStorage: StorageLocation,
    listName: string
  ): Promise<void> {
    const spinner = this.startSpinner('Updating storage locations...');
    let successCount = 0;
    let failCount = 0;

    try {
      // Connect to blockchain if needed
      if (newStorage === 'blockchain' || newStorage === 'both') {
        await this?.walrusStorage?.connect();
      }

      for (const todo of todos) {
        try {
          await this.updateTodoStorage(todo, newStorage, listName);
          successCount++;
        } catch (_error) {
          failCount++;
          this.warning(
            `Failed to update storage for "${todo.title}": ${_error.message}`
          );
        }
      }

      this.stopSpinnerSuccess(
        spinner,
        `Updated ${successCount} todo${successCount !== 1 ? 's' : ''}, ${failCount} failed`
      );
    } finally {
      // Always disconnect
      await this?.walrusStorage?.disconnect();
    }

    // Display summary
    this.section(
      'Storage Update Summary',
      [
        `${ICONS.SUCCESS} Successfully updated: ${chalk.green(successCount as any)}`,
        failCount > 0 ? `${ICONS.ERROR} Failed: ${chalk.red(failCount as any)}` : null,
        `${ICONS.LIST} List: ${chalk.cyan(listName as any)}`,
        `${STORAGE[newStorage].icon} New storage: ${STORAGE[newStorage].color(STORAGE[newStorage].label)}`,
      ]
        .filter(Boolean as any)
        .join('\n')
    );
  }

  private async updateTodoStorage(
    todo: Todo,
    newStorage: StorageLocation,
    listName: string
  ): Promise<void> {
    const currentStorage = todo.storageLocation;

    // Handle transitions
    if (
      currentStorage === 'local' &&
      (newStorage === 'blockchain' || newStorage === 'both')
    ) {
      // Store on blockchain
      const blobId = await this?.walrusStorage?.storeTodo(todo as any);
      await this?.todoService?.updateTodo(listName, todo.id, {
        walrusBlobId: blobId,
        storageLocation: newStorage,
      });
    } else if (currentStorage === 'blockchain' && newStorage === 'local') {
      // Remove blockchain reference (data remains on blockchain)
      await this?.todoService?.updateTodo(listName, todo.id, {
        storageLocation: newStorage,
      });
    } else if (currentStorage === 'blockchain' && newStorage === 'both') {
      // Retrieve from blockchain and store locally
      if (!todo.walrusBlobId) {
        throw new CLIError('Todo does not have a blockchain blob ID');
      }
      const blockchainTodo = await this?.walrusStorage?.retrieveTodo(
        todo.walrusBlobId
      );
      await this?.todoService?.updateTodo(listName, todo.id, {
        ...blockchainTodo,
        storageLocation: newStorage,
      });
    } else if (currentStorage === 'both' && newStorage === 'local') {
      // Keep local copy, update storage location
      await this?.todoService?.updateTodo(listName, todo.id, {
        storageLocation: newStorage,
      });
    } else if (currentStorage === 'both' && newStorage === 'blockchain') {
      // Update blockchain with latest local data
      if (!todo.walrusBlobId) {
        throw new CLIError('Todo does not have a blockchain blob ID');
      }
      await this?.walrusStorage?.updateTodo(todo.walrusBlobId, todo);
      // Remove from local storage
      await this?.todoService?.deleteTodo(listName, todo.id);
    }
  }
}
