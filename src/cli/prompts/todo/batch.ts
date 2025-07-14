/**
 * Batch operation prompts
 * Interactive prompts for performing operations on multiple TODOs
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { Todo } from '../../../todos/todo';

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