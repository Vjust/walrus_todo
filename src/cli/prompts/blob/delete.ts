/**
 * Blob deletion prompts for the Waltodo CLI
 */

import inquirer from 'inquirer';
import chalk from 'chalk';

/**
 * Confirm blob deletion
 */
export async function confirmBlobDelete(blobId: string, fromWalrus: boolean = false): Promise<boolean> {
  const message = fromWalrus 
    ? `Delete blob ${blobId.substring(0, 12)}... from both local tracking and Walrus network?`
    : `Remove blob ${blobId.substring(0, 12)}... from local tracking only?`;

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: chalk.yellow(message),
      default: false
    }
  ]);

  return confirm;
}