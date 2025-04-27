/**
 * List Command Module
 * Displays todo items with filtering and formatting options
 * Supports both local and Walrus storage items
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { TodoService } from '../services/todoService';
import { Todo, TodoList } from '../types';

interface ListCommandOptions {
  completed?: boolean;
  pending?: boolean;
}

export function setupListCommand(program: Command) {
  program
    .command('list [listName]')
    .description('List all todos or a specific list')
    .option('--completed', 'Show only completed items')
    .option('--pending', 'Show only pending items')
    .action(handleList);
}

async function handleList(listName?: string, options: ListCommandOptions = {}) {
  const todoService = new TodoService();

  try {
    // If a specific list is requested
    if (listName) {
      const list = await todoService.getList(listName);
      if (!list) {
        console.log(chalk.yellow(`\nNo list found with name: ${listName}`));
        return;
      }
      displayList(list, options);
      return;
    }

    // Show all lists
    const lists = await todoService.getAllLists();
    if (lists.length === 0) {
      console.log(chalk.yellow('\nNo lists found. Create one using: waltodo add -l "list-name" -t "task"'));
      return;
    }

    console.log(chalk.blue('\nAvailable Todo Lists:'));
    
    // Get all lists with their data for sorting
    const listsWithData = await Promise.all(
      lists.map(async (name) => {
        const list = await todoService.getList(name);
        return { name, list };
      })
    );

    // Sort lists by highest priority
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    listsWithData.sort((a, b) => {
      if (!a.list || !b.list) return 0;
      
      const aHighestPriority = a.list.todos.reduce((highest, todo) => {
        const todoPriority = todo.priority?.toLowerCase() || 'low';
        return priorityOrder[todoPriority] < priorityOrder[highest] ? todoPriority : highest;
      }, 'low');
      
      const bHighestPriority = b.list.todos.reduce((highest, todo) => {
        const todoPriority = todo.priority?.toLowerCase() || 'low';
        return priorityOrder[todoPriority] < priorityOrder[highest] ? todoPriority : highest;
      }, 'low');

      return priorityOrder[aHighestPriority] - priorityOrder[bHighestPriority];
    });

    // Display sorted lists
    for (const { name, list } of listsWithData) {
      if (list) {
        const completed = list.todos.filter(t => t.completed).length;
        const highestPriority = list.todos.reduce((highest, todo) => {
          const todoPriority = todo.priority?.toLowerCase() || 'low';
          return priorityOrder[todoPriority] < priorityOrder[highest] ? todoPriority : highest;
        }, 'low');
        
        // Color the list name based on its highest priority
        const priorityColor: Record<string, chalk.ChalkFunction> = {
          high: chalk.red,
          medium: chalk.yellow,
          low: chalk.white
        };
        const color = priorityColor[highestPriority];
        console.log(color(`- ${name} (${completed}/${list.todos.length} completed)`));
      }
    }
    console.log();
  } catch (error) {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}

function displayList(list: TodoList, options: ListCommandOptions) {
  const totalItems = list.todos.length;
  const completedItems = list.todos.filter(item => item.completed).length;

  console.log(chalk.blue('\n📋 Todo List:'), chalk.white.bold(list.name));
  console.log(chalk.dim(`Progress: ${completedItems}/${totalItems} completed (${Math.round((completedItems/totalItems)*100)}%)\n`));

  let items = list.todos;
  if (options.completed) items = items.filter(item => item.completed);
  if (options.pending) items = items.filter(item => !item.completed);

  if (items.length === 0) {
    console.log(chalk.yellow('No items match the current filters'));
    return;
  }

  // Sort items: incomplete items first, then completed items
  items.sort((a, b) => {
    if (a.completed === b.completed) {
      // If both have same completion status, sort by priority if available
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      const aPriority = a.priority?.toLowerCase();
      const bPriority = b.priority?.toLowerCase();
      return (aPriority && bPriority ? priorityOrder[aPriority] - priorityOrder[bPriority] : 0);
    }
    return a.completed ? 1 : -1;
  });

  items.forEach((item: Todo, index: number) => {
    const checkbox = item.completed ? chalk.green('✓') : chalk.yellow('☐');
    const id = chalk.blue(`${index + 1}.`);
    const text = (item as any).description || item.task;
    const status = item.completed ? chalk.green.dim(' [DONE]') : '';
    
    // Main task line with completion status
    console.log(`${id} ${checkbox} ${text}${status}`);
    
    // Indented metadata section
    const metadata = [];
    if (item.priority) {
      const priorityColor: Record<string, chalk.ChalkFunction> = {
        high: chalk.red,
        medium: chalk.yellow,
        low: chalk.green
      };
      const color = priorityColor[item.priority.toLowerCase()] || chalk.white;
      metadata.push(`Priority: ${color(item.priority.toUpperCase())}`);
    }
    
    if (item.dueDate) {
      const date = new Date(item.dueDate);
      const isOverdue = !item.completed && date < new Date();
      const dueDateStr = date.toLocaleDateString();
      metadata.push(`Due: ${isOverdue ? chalk.red(dueDateStr) : chalk.blue(dueDateStr)}`);
    }
    
    if (item.tags && item.tags.length > 0) {
      metadata.push(`Tags: ${item.tags.map(tag => chalk.cyan(`#${tag}`)).join(' ')}`);
    }
    
    if (metadata.length > 0) {
      console.log(`   ${chalk.dim(metadata.join(' • '))}`);
    }
    
    // Add a small spacing between items for better readability
    console.log('');
  });
}