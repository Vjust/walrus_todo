/**
 * Delete Command Module
 * Handles removal of todo items
 * Supports deletion from both local and Walrus storage
 */

import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { walrusService } from '../services/walrus-service';

/**
 * Interface for delete command options
 * @interface DeleteOptions
 */
interface DeleteOptions {
  list: string;
  id: string;
  force?: boolean;
}

/**
 * Deletes a todo item with optional confirmation
 * @param options - Command line options for deleting todo
 */
export async function deleteTodo(options: DeleteOptions): Promise<void> {
  try {
    const { list, id, force } = options;

    if (!force) {
      const shouldDelete = await confirm({
        message: 'Are you sure you want to delete this todo?',
        default: false
      });

      if (!shouldDelete) {
        console.log(chalk.yellow('Operation cancelled'));
        return;
      }
    }

    await walrusService.deleteTodo(list, id);
    console.log(chalk.green('✔ Todo deleted successfully'));
    console.log(chalk.dim('List:'), list);
    console.log(chalk.dim('ID:'), id);

  } catch (error) {
    console.error(chalk.red('Failed to delete todo:'), error);
    process.exit(1);
  }
}