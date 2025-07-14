/**
 * Smart search with suggestions
 */

import inquirer from 'inquirer';
import chalk from 'chalk';

/**
 * Smart search with suggestions
 */
export async function promptSmartSearch(existingTags: string[] = [], recentSearches: string[] = []): Promise<{
  query: string;
  type: 'text' | 'tag' | 'priority' | 'status';
}> {
  const choices = [
    { name: 'Search by text', value: 'text' },
    { name: 'Search by tag', value: 'tag' },
    { name: 'Search by priority', value: 'priority' },
    { name: 'Search by status', value: 'status' }
  ];

  if (recentSearches.length > 0) {
    choices.unshift(
      new inquirer.Separator('Recent searches:'),
      ...recentSearches.slice(0, 5).map(search => ({
        name: `"${search}"`,
        value: `recent:${search}`
      })),
      new inquirer.Separator()
    );
  }

  const { searchType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'searchType',
      message: 'How would you like to search?',
      choices
    }
  ]);

  // Handle recent search selection
  if (searchType.startsWith('recent:')) {
    return {
      query: searchType.substring(7),
      type: 'text'
    };
  }

  let query = '';

  switch (searchType) {
    case 'text':
      const { textQuery } = await inquirer.prompt([
        {
          type: 'input',
          name: 'textQuery',
          message: 'Enter search term:',
          validate: (input: string) => input.trim().length > 0 || 'Search term cannot be empty'
        }
      ]);
      query = textQuery;
      break;

    case 'tag':
      if (existingTags.length > 0) {
        const { selectedTag } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedTag',
            message: 'Select a tag:',
            choices: existingTags.map(tag => ({ name: `#${tag}`, value: tag }))
          }
        ]);
        query = selectedTag;
      } else {
        const { tagQuery } = await inquirer.prompt([
          {
            type: 'input',
            name: 'tagQuery',
            message: 'Enter tag name:',
            validate: (input: string) => input.trim().length > 0 || 'Tag name cannot be empty'
          }
        ]);
        query = tagQuery;
      }
      break;

    case 'priority':
      const { priority } = await inquirer.prompt([
        {
          type: 'list',
          name: 'priority',
          message: 'Select priority:',
          choices: [
            { name: chalk.red('High'), value: 'high' },
            { name: chalk.yellow('Medium'), value: 'medium' },
            { name: chalk.green('Low'), value: 'low' }
          ]
        }
      ]);
      query = priority;
      break;

    case 'status':
      const { status } = await inquirer.prompt([
        {
          type: 'list',
          name: 'status',
          message: 'Select status:',
          choices: [
            { name: 'Pending', value: 'pending' },
            { name: 'Done', value: 'done' }
          ]
        }
      ]);
      query = status;
      break;
  }

  return { query: query.trim(), type: searchType };
}