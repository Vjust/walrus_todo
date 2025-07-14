/**
 * Filter prompt for list view
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { Priority } from '../../../todos/todo';

/**
 * Filter prompt for list view
 */
export async function promptListFilters(): Promise<{
  status?: 'pending' | 'done';
  priority?: Priority;
  tag?: string;
  searchTerm?: string;
}> {
  const { filterType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'filterType',
      message: 'Filter by:',
      choices: [
        { name: 'No filter', value: 'none' },
        { name: 'Status', value: 'status' },
        { name: 'Priority', value: 'priority' },
        { name: 'Tag', value: 'tag' },
        { name: 'Search', value: 'search' }
      ]
    }
  ]);

  switch (filterType) {
    case 'status':
      const { status } = await inquirer.prompt([
        {
          type: 'list',
          name: 'status',
          message: 'Filter by status:',
          choices: [
            { name: 'Pending', value: 'pending' },
            { name: 'Done', value: 'done' }
          ]
        }
      ]);
      return { status };

    case 'priority':
      const { priority } = await inquirer.prompt([
        {
          type: 'list',
          name: 'priority',
          message: 'Filter by priority:',
          choices: [
            { name: chalk.green('Low'), value: 'low' },
            { name: chalk.yellow('Medium'), value: 'medium' },
            { name: chalk.red('High'), value: 'high' }
          ]
        }
      ]);
      return { priority };

    case 'tag':
      const { tag } = await inquirer.prompt([
        {
          type: 'input',
          name: 'tag',
          message: 'Filter by tag:',
          validate: (input: string) => input.trim().length > 0 || 'Tag cannot be empty'
        }
      ]);
      return { tag: tag.trim() };

    case 'search':
      const { searchTerm } = await inquirer.prompt([
        {
          type: 'input',
          name: 'searchTerm',
          message: 'Search TODOs:',
          validate: (input: string) => input.trim().length > 0 || 'Search term cannot be empty'
        }
      ]);
      return { searchTerm: searchTerm.trim() };

    default:
      return {};
  }
}