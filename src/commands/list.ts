import chalk from 'chalk';
import { walrusService } from '../services/walrus-service';
import { formatTodoOutput } from '../utils';
import { Todo } from '../types';

interface ListOptions {
  list?: string;
  completed?: boolean;
  pending?: boolean;
}

export async function list(options: ListOptions): Promise<void> {
  try {
    const todoList = options.list 
      ? await walrusService.getTodoList(options.list)
      : null;

    if (!todoList) {
      console.log(chalk.yellow('\nNo todos found. Use `waltodo add` to create one.'));
      return;
    }

    console.log(chalk.blue('Todo List'));
    if (options.list) {
      console.log(chalk.dim('List:'), options.list);
    }

    const todos = todoList.todos.filter(todo => {
      if (options.completed) return todo.completed;
      if (options.pending) return !todo.completed;
      return true;
    });

    if (todos.length === 0) {
      console.log(chalk.yellow('\nNo matching todos found.'));
      return;
    }

    todos.forEach(todo => {
      console.log(formatTodoOutput(todo));
    });

  } catch (error) {
    console.error(chalk.red('Failed to list todos:'), error);
    process.exit(1);
  }
}