/**
 * Sync conflict resolution prompts for the Waltodo CLI
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { Todo } from '../../../todos/todo';

/**
 * Prompt for sync conflict resolution
 */
export async function promptSyncConflict(local: Todo, remote: Todo): Promise<'local' | 'remote' | 'skip'> {
  console.log(chalk.yellow('\nSync conflict detected:'));
  console.log(chalk.blue('Local:'), local.description, chalk.gray(`(modified: ${local.updatedAt})`));
  console.log(chalk.green('Remote:'), remote.description, chalk.gray(`(modified: ${remote.updatedAt})`));

  const { choice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'choice',
      message: 'How would you like to resolve this conflict?',
      choices: [
        { name: 'Keep local version', value: 'local' },
        { name: 'Keep remote version', value: 'remote' },
        { name: 'Skip this item', value: 'skip' }
      ]
    }
  ]);

  return choice;
}