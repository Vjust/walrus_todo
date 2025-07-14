/**
 * Blob publish prompts for the Waltodo CLI
 */

import inquirer from 'inquirer';

/**
 * Prompt for publish configuration
 */
export async function promptPublishConfig(): Promise<{
  epochs: number;
  deletable: boolean;
  description?: string;
  tags: string[];
}> {
  const answers = await inquirer.prompt([
    {
      type: 'number',
      name: 'epochs',
      message: 'Storage duration (epochs):',
      default: 5,
      validate: (input: number) => input >= 1 || 'Must be at least 1 epoch'
    },
    {
      type: 'confirm',
      name: 'deletable',
      message: 'Allow blob to be deleted before expiration?',
      default: true
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description (optional):',
      filter: (input: string) => input.trim() || undefined
    },
    {
      type: 'input',
      name: 'tags',
      message: 'Additional tags (comma-separated, optional):',
      filter: (input: string) => {
        return input.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      }
    }
  ]);

  return answers;
}