import { Command } from 'commander';
import { TodoService } from '../services/todo-service';
import { handleError } from '../utils/error-handler';

export const createCommand = new Command('create')
  .description('Create a new todo list')
  .argument('<list-name>', 'Name of the new todo list')
  .action(async (listName: string) => {
    try {
      const todoService = new TodoService();
      const listId = await todoService.createList(listName);
      console.log(`✅ Todo list "${listName}" created successfully with ID: ${listId}`);
    } catch (error) {
      handleError(error);
    }
  });
