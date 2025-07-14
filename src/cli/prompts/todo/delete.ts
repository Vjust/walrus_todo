/**
 * Delete TODO prompts
 * Confirmation prompts for removing TODOs
 */

import inquirer from 'inquirer';
import chalk from 'chalk';

/**
 * Confirm deletion prompt
 */
export async function confirmDelete(itemDescription: string): Promise<boolean> {
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete "${chalk.yellow(itemDescription)}"?`,
      default: false
    }
  ]);
  return confirm;
}

/**
 * Confirm clear all TODOs
 */
export async function confirmClearAll(count: number): Promise<boolean> {
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: chalk.red(`This will permanently delete all ${count} TODO(s). Are you sure?`),
      default: false
    }
  ]);
  
  if (confirm) {
    // Double confirmation for destructive action
    const { confirmAgain } = await inquirer.prompt([
      {
        type: 'input',
        name: 'confirmAgain',
        message: `Type "DELETE ALL" to confirm:`,
        validate: (input: string) => {
          return input === 'DELETE ALL' || 'Type exactly "DELETE ALL" to confirm';
        }
      }
    ]);
    return confirmAgain === 'DELETE ALL';
  }
  
  return false;
}