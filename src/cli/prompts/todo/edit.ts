/**
 * Edit TODO prompts
 * Interactive prompts for modifying existing TODOs
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { Todo } from '../../../todos/todo';

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