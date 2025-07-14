/**
 * Blob search prompts for the Waltodo CLI
 */

import inquirer from 'inquirer';

/**
 * Prompt for selecting a blob from search results
 */
export async function promptSelectBlob(blobs: any[]): Promise<string | null> {
  if (blobs.length === 0) {
    return null;
  }

  const choices = blobs.map(blob => ({
    name: `${blob.id.substring(0, 12)}... - ${blob.todoCount} TODOs (${blob.status}) - ${new Date(blob.publishedAt).toLocaleDateString()}`,
    value: blob.id,
    short: blob.id.substring(0, 12)
  }));

  choices.push(new inquirer.Separator(), { name: 'Cancel', value: null });

  const { selectedBlob } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedBlob',
      message: 'Select a blob to fetch TODOs from:',
      choices,
      pageSize: 10
    }
  ]);

  return selectedBlob;
}

/**
 * Prompt for blob search criteria
 */
export async function promptBlobSearch(): Promise<{
  searchTerm?: string;
  status?: string;
  tags?: string[];
  minTodos?: number;
  maxTodos?: number;
}> {
  const { searchType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'searchType',
      message: 'How would you like to search for blobs?',
      choices: [
        { name: 'Show all blobs', value: 'all' },
        { name: 'Search by blob ID or description', value: 'text' },
        { name: 'Filter by status', value: 'status' },
        { name: 'Filter by tags', value: 'tags' },
        { name: 'Filter by TODO count', value: 'todos' },
        { name: 'Advanced search', value: 'advanced' }
      ]
    }
  ]);

  const criteria: any = {};

  switch (searchType) {
    case 'all':
      break;

    case 'text':
      const { searchTerm } = await inquirer.prompt([
        {
          type: 'input',
          name: 'searchTerm',
          message: 'Enter search term (blob ID or description):',
          validate: (input: string) => input.trim().length > 0 || 'Search term cannot be empty'
        }
      ]);
      criteria.searchTerm = searchTerm.trim();
      break;

    case 'status':
      const { status } = await inquirer.prompt([
        {
          type: 'list',
          name: 'status',
          message: 'Filter by status:',
          choices: [
            { name: 'Active', value: 'active' },
            { name: 'Expired', value: 'expired' },
            { name: 'Deleted', value: 'deleted' },
            { name: 'Error', value: 'error' }
          ]
        }
      ]);
      criteria.status = status;
      break;

    case 'tags':
      const { tags } = await inquirer.prompt([
        {
          type: 'input',
          name: 'tags',
          message: 'Enter tags to search for (comma-separated):',
          filter: (input: string) => {
            return input.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
          }
        }
      ]);
      if (tags.length > 0) {
        criteria.tags = tags;
      }
      break;

    case 'todos':
      const todoFilters = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'hasMinTodos',
          message: 'Set minimum TODO count?',
          default: false
        },
        {
          type: 'number',
          name: 'minTodos',
          message: 'Minimum TODOs:',
          when: (answers: any) => answers.hasMinTodos,
          validate: (input: number) => input >= 0 || 'Must be 0 or greater'
        },
        {
          type: 'confirm',
          name: 'hasMaxTodos',
          message: 'Set maximum TODO count?',
          default: false
        },
        {
          type: 'number',
          name: 'maxTodos',
          message: 'Maximum TODOs:',
          when: (answers: any) => answers.hasMaxTodos,
          validate: (input: number, answers: any) => {
            if (input < 0) return 'Must be 0 or greater';
            if (answers.minTodos !== undefined && input < answers.minTodos) {
              return 'Maximum must be greater than minimum';
            }
            return true;
          }
        }
      ]);
      if (todoFilters.minTodos !== undefined) criteria.minTodos = todoFilters.minTodos;
      if (todoFilters.maxTodos !== undefined) criteria.maxTodos = todoFilters.maxTodos;
      break;

    case 'advanced':
      const advanced = await inquirer.prompt([
        {
          type: 'input',
          name: 'searchTerm',
          message: 'Search term (optional):',
        },
        {
          type: 'list',
          name: 'status',
          message: 'Status filter (optional):',
          choices: [
            { name: 'Any status', value: undefined },
            { name: 'Active', value: 'active' },
            { name: 'Expired', value: 'expired' },
            { name: 'Deleted', value: 'deleted' },
            { name: 'Error', value: 'error' }
          ]
        },
        {
          type: 'input',
          name: 'tags',
          message: 'Tags (comma-separated, optional):',
          filter: (input: string) => {
            if (!input) return undefined;
            return input.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
          }
        },
        {
          type: 'number',
          name: 'minTodos',
          message: 'Minimum TODOs (optional):',
          validate: (input: string) => {
            if (!input) return true;
            const num = parseInt(input);
            return num >= 0 || 'Must be 0 or greater';
          },
          filter: (input: string) => input ? parseInt(input) : undefined
        },
        {
          type: 'number',
          name: 'maxTodos',
          message: 'Maximum TODOs (optional):',
          validate: (input: string, answers: any) => {
            if (!input) return true;
            const num = parseInt(input);
            if (num < 0) return 'Must be 0 or greater';
            if (answers.minTodos && num < answers.minTodos) {
              return 'Maximum must be greater than minimum';
            }
            return true;
          },
          filter: (input: string) => input ? parseInt(input) : undefined
        }
      ]);
      
      Object.keys(advanced).forEach(key => {
        if (advanced[key] !== undefined && advanced[key] !== '') {
          criteria[key] = advanced[key];
        }
      });
      break;
  }

  return criteria;
}