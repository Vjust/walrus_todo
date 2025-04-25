import chalk from 'chalk';
import { walrusService } from '../services/walrus-service';
import { Todo } from '../types';

interface CompleteOptions {
  list: string;
  id: string;
}

export async function complete(options: CompleteOptions): Promise<void> {
  try {
    const { list, id } = options;
    const todoList = await walrusService.getTodoList(list);
    
    if (!todoList) {
      console.error(chalk.red(`Todo list '${list}' not found`));
      process.exit(1);
    }

    const todo = todoList.todos.find(t => t.id === id);
    if (!todo) {
      console.error(chalk.red(`Todo with id '${id}' not found`));
      process.exit(1);
    }

    todo.completed = true;
    await walrusService.updateTodo(list, todo);
    
    console.log(chalk.green(`✔ Marked todo ${id} as complete`));
    console.log(chalk.dim('List:'), list);
    console.log(chalk.dim('Task:'), todo.description);

  } catch (error) {
    console.error(chalk.red('Failed to complete todo:'), error);
    process.exit(1);
  }
}