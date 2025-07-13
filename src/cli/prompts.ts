/**
 * Interactive prompts for the Waltodo CLI
 * Provides user-friendly prompts for various operations
 */

import inquirer, { Separator } from 'inquirer';
import { Todo, Priority } from '../todos/todo';
import chalk from 'chalk';

/**
 * Prompt for adding a new TODO with interactive fields
 */
export async function promptAddTodo(): Promise<{
  description: string;
  priority: Priority;
  tags: string[];
  dueDate?: string;
}> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'What needs to be done?',
      validate: (input: string) => {
        if (input.trim().length === 0) {
          return 'Description cannot be empty';
        }
        return true;
      }
    },
    {
      type: 'list',
      name: 'priority',
      message: 'Priority:',
      choices: [
        { name: chalk.green('Low'), value: 'low' },
        { name: chalk.yellow('Medium'), value: 'medium' },
        { name: chalk.red('High'), value: 'high' }
      ],
      default: 'medium'
    },
    {
      type: 'input',
      name: 'tags',
      message: 'Tags (comma-separated, optional):',
      filter: (input: string) => {
        return input.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      }
    },
    {
      type: 'confirm',
      name: 'hasDueDate',
      message: 'Set a due date?',
      default: false
    },
    {
      type: 'input',
      name: 'dueDate',
      message: 'Due date (YYYY-MM-DD):',
      when: (answers: any) => answers.hasDueDate,
      validate: (input: string) => {
        const date = new Date(input);
        if (isNaN(date.getTime())) {
          return 'Invalid date format. Please use YYYY-MM-DD';
        }
        if (date < new Date(new Date().setHours(0, 0, 0, 0))) {
          return 'Due date cannot be in the past';
        }
        return true;
      },
      filter: (input: string) => {
        return input ? new Date(input).toISOString() : undefined;
      }
    }
  ]);

  return {
    description: answers.description,
    priority: answers.priority,
    tags: answers.tags || [],
    dueDate: answers.dueDate
  };
}

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

/**
 * Multi-select prompt for batch operations
 */
export async function selectMultipleTodos(todos: Todo[], action: string): Promise<string[]> {
  const choices = todos.map(todo => ({
    name: `${todo.description} ${chalk.gray(`(${todo.priority})`)}`,
    value: todo.id,
    checked: false
  }));

  const { selected } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: `Select TODOs to ${action}:`,
      choices,
      validate: (selected: string[]) => {
        if (selected.length === 0) {
          return 'Please select at least one TODO';
        }
        return true;
      }
    }
  ]);

  return selected;
}

/**
 * Edit TODO inline
 */
export async function promptEditTodo(todo: Todo): Promise<Partial<Todo>> {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'field',
      message: 'What would you like to edit?',
      choices: [
        { name: 'Description', value: 'description' },
        { name: 'Priority', value: 'priority' },
        { name: 'Tags', value: 'tags' },
        { name: 'Due Date', value: 'dueDate' },
        { name: 'Cancel', value: 'cancel' }
      ]
    }
  ]);

  if (answers.field === 'cancel') {
    return {};
  }

  switch (answers.field) {
    case 'description':
      const { description } = await inquirer.prompt([
        {
          type: 'input',
          name: 'description',
          message: 'New description:',
          default: todo.description,
          validate: (input: string) => input.trim().length > 0 || 'Description cannot be empty'
        }
      ]);
      return { description };

    case 'priority':
      const { priority } = await inquirer.prompt([
        {
          type: 'list',
          name: 'priority',
          message: 'New priority:',
          choices: [
            { name: chalk.green('Low'), value: 'low' },
            { name: chalk.yellow('Medium'), value: 'medium' },
            { name: chalk.red('High'), value: 'high' }
          ],
          default: todo.priority
        }
      ]);
      return { priority };

    case 'tags':
      const { tags } = await inquirer.prompt([
        {
          type: 'input',
          name: 'tags',
          message: 'New tags (comma-separated):',
          default: todo.tags.join(', '),
          filter: (input: string) => {
            return input.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
          }
        }
      ]);
      return { tags };

    case 'dueDate':
      const { hasDueDate } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'hasDueDate',
          message: todo.dueDate ? 'Update due date?' : 'Add due date?',
          default: true
        }
      ]);

      if (!hasDueDate) {
        return { dueDate: undefined };
      }

      const { dueDate } = await inquirer.prompt([
        {
          type: 'input',
          name: 'dueDate',
          message: 'Due date (YYYY-MM-DD):',
          default: todo.dueDate ? new Date(todo.dueDate).toISOString().split('T')[0] : '',
          validate: (input: string) => {
            if (!input) return true; // Allow empty to remove due date
            const date = new Date(input);
            if (isNaN(date.getTime())) {
              return 'Invalid date format. Please use YYYY-MM-DD';
            }
            return true;
          },
          filter: (input: string) => {
            return input ? new Date(input).toISOString() : undefined;
          }
        }
      ]);
      return { dueDate };

    default:
      return {};
  }
}

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

/**
 * Enhanced interactive add TODO with autocomplete for tags
 */
export async function promptAddTodoInteractive(existingTags: string[] = []): Promise<{
  description: string;
  priority: Priority;
  tags: string[];
  dueDate?: string;
}> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'What needs to be done?',
      validate: (input: string) => {
        if (input.trim().length === 0) {
          return 'Description cannot be empty';
        }
        if (input.trim().length > 200) {
          return 'Description must be 200 characters or less';
        }
        return true;
      }
    },
    {
      type: 'list',
      name: 'priority',
      message: 'Priority:',
      choices: [
        { name: chalk.green('● Low'), value: 'low' },
        { name: chalk.yellow('● Medium'), value: 'medium' },
        { name: chalk.red('● High'), value: 'high' }
      ],
      default: 'medium'
    },
    {
      type: 'checkbox',
      name: 'existingTags',
      message: 'Select existing tags (optional):',
      choices: existingTags.map(tag => ({ name: tag, value: tag })),
      when: () => existingTags.length > 0
    },
    {
      type: 'input',
      name: 'newTags',
      message: 'Add new tags (comma-separated, optional):',
      filter: (input: string) => {
        return input.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      },
      validate: (input: string[]) => {
        const invalidTags = input.filter(tag => !/^[a-zA-Z0-9_-]+$/.test(tag));
        if (invalidTags.length > 0) {
          return `Invalid tags: ${invalidTags.join(', ')}. Use only letters, numbers, dashes, and underscores.`;
        }
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'hasDueDate',
      message: 'Set a due date?',
      default: false
    },
    {
      type: 'input',
      name: 'dueDate',
      message: 'Due date (YYYY-MM-DD or relative like "tomorrow", "next week"):',
      when: (answers: any) => answers.hasDueDate,
      validate: (input: string) => {
        // Handle relative dates
        if (['today', 'tomorrow', 'next week', 'next month'].includes(input.toLowerCase())) {
          return true;
        }
        
        const date = new Date(input);
        if (isNaN(date.getTime())) {
          return 'Invalid date format. Use YYYY-MM-DD or relative terms like "tomorrow"';
        }
        if (date < new Date(new Date().setHours(0, 0, 0, 0))) {
          return 'Due date cannot be in the past';
        }
        return true;
      },
      filter: (input: string) => {
        if (!input) return undefined;
        
        // Handle relative dates
        const now = new Date();
        switch (input.toLowerCase()) {
          case 'today':
            return now.toISOString();
          case 'tomorrow':
            return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
          case 'next week':
            return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
          case 'next month':
            const nextMonth = new Date(now);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            return nextMonth.toISOString();
          default:
            return new Date(input).toISOString();
        }
      }
    }
  ]);

  // Combine existing and new tags
  const tags = [...(answers.existingTags || []), ...(answers.newTags || [])];

  return {
    description: answers.description,
    priority: answers.priority,
    tags: [...new Set(tags)], // Remove duplicates
    dueDate: answers.dueDate
  };
}

/**
 * Quick add TODO with minimal prompts
 */
export async function promptQuickAdd(): Promise<{
  description: string;
  priority: Priority;
}> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'Quick TODO:',
      validate: (input: string) => input.trim().length > 0 || 'Description cannot be empty'
    },
    {
      type: 'list',
      name: 'priority',
      message: 'Priority:',
      choices: [
        { name: chalk.green('Low'), value: 'low' },
        { name: chalk.yellow('Medium'), value: 'medium' },
        { name: chalk.red('High'), value: 'high' }
      ],
      default: 'medium'
    }
  ]);

  return {
    description: answers.description,
    priority: answers.priority
  };
}

/**
 * Batch operation selector with actions
 */
export async function promptBatchOperation(todos: Todo[]): Promise<{
  action: 'mark-done' | 'delete' | 'change-priority' | 'add-tags' | 'remove-tags';
  selectedIds: string[];
  data?: any;
}> {
  // First select the action
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do with the selected TODOs?',
      choices: [
        { name: '✓ Mark as done', value: 'mark-done' },
        { name: '✗ Delete', value: 'delete' },
        { name: '⚡ Change priority', value: 'change-priority' },
        { name: '🏷️  Add tags', value: 'add-tags' },
        { name: '🗑️  Remove tags', value: 'remove-tags' }
      ]
    }
  ]);

  // Filter todos based on action compatibility
  let availableTodos = todos;
  if (action === 'mark-done') {
    availableTodos = todos.filter(todo => todo.status === 'pending');
  }

  if (availableTodos.length === 0) {
    throw new Error('No TODOs available for this action');
  }

  // Select TODOs
  const selectedIds = await selectMultipleTodos(availableTodos, action);

  let data: any = undefined;

  // Get additional data based on action
  switch (action) {
    case 'change-priority':
      const { priority } = await inquirer.prompt([
        {
          type: 'list',
          name: 'priority',
          message: 'New priority:',
          choices: [
            { name: chalk.green('Low'), value: 'low' },
            { name: chalk.yellow('Medium'), value: 'medium' },
            { name: chalk.red('High'), value: 'high' }
          ]
        }
      ]);
      data = { priority };
      break;

    case 'add-tags':
      const { tags } = await inquirer.prompt([
        {
          type: 'input',
          name: 'tags',
          message: 'Tags to add (comma-separated):',
          validate: (input: string) => input.trim().length > 0 || 'Tags cannot be empty',
          filter: (input: string) => {
            return input.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
          }
        }
      ]);
      data = { tags };
      break;

    case 'remove-tags':
      // Get all unique tags from selected TODOs
      const allTags = new Set<string>();
      availableTodos.filter(todo => selectedIds.includes(todo.id))
        .forEach(todo => todo.tags.forEach(tag => allTags.add(tag)));

      if (allTags.size === 0) {
        throw new Error('Selected TODOs have no tags to remove');
      }

      const { tagsToRemove } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'tagsToRemove',
          message: 'Select tags to remove:',
          choices: Array.from(allTags).map(tag => ({ name: tag, value: tag })),
          validate: (selected: string[]) => selected.length > 0 || 'Select at least one tag'
        }
      ]);
      data = { tags: tagsToRemove };
      break;

    case 'delete':
      // Confirmation for delete action
      const confirmed = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: chalk.red(`Delete ${selectedIds.length} TODO(s)? This cannot be undone.`),
          default: false
        }
      ]);
      if (!confirmed.confirm) {
        throw new Error('Delete operation cancelled');
      }
      break;
  }

  return { action, selectedIds, data };
}

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
      new Separator('Recent searches:'),
      ...recentSearches.slice(0, 5).map(search => ({
        name: `"${search}"`,
        value: `recent:${search}`
      })),
      new Separator()
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