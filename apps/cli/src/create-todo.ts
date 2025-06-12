import { TodoService } from './services/todoService';
import { Logger } from './utils/Logger';

async function main() {
  const todoService = new TodoService();
  const listName = 'test-list';

  // First create or get list
  Logger.getInstance().info('Creating/getting todo list...');
  let list = await todoService.getList(listName as any);
  if (!list) {
    list = await todoService.createList(listName, 'test-user');
    Logger.getInstance().info('Created new list:', { list });
  } else {
    Logger.getInstance().info('Using existing list:', { list });
  }

  // Add a todo item
  Logger.getInstance().info('Adding todo item...');
  const todo = await todoService.addTodo(listName, {
    title: 'Test Todo Item',
    description: 'This is a test todo item',
    priority: 'high',
    tags: ['test', 'demo'],
    private: true,
  });
  Logger.getInstance().info('Created todo:', { todo });
}

main().catch(error => Logger.getInstance().error('Error in main:', error));
