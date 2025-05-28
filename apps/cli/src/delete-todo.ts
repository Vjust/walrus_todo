import { TodoService } from './services/todoService';
import { Logger } from './utils/Logger';

async function main() {
  const todoService = new TodoService();
  const listName = 'test-list';

  // Get the todo list
  Logger.getInstance().info('Getting todo list...');
  const list = await todoService.getList(listName);
  if (!list) {
    Logger.getInstance().error('List not found');
    return;
  }

  Logger.getInstance().info('Current todos:');
  list.todos.forEach(todo => {
    const status = todo.completed ? '✓' : '☐';
    const priority =
      todo.priority === 'high' ? '⚠️' : todo.priority === 'medium' ? '•' : '○';
    Logger.getInstance().info(
      `${status} ${priority} ${todo.title} (${todo.id})`
    );
  });

  // Delete the first completed todo
  const completedTodo = list.todos.find(todo => todo.completed);
  if (completedTodo) {
    Logger.getInstance().info(
      `Deleting completed todo: ${completedTodo.title}`
    );
    await todoService.deleteTodo(listName, completedTodo.id);
    Logger.getInstance().info('Todo deleted');
  }

  // Show updated list
  Logger.getInstance().info('Updated todos:');
  const updatedList = await todoService.getList(listName);
  updatedList?.todos.forEach(todo => {
    const status = todo.completed ? '✓' : '☐';
    const priority =
      todo.priority === 'high' ? '⚠️' : todo.priority === 'medium' ? '•' : '○';
    Logger.getInstance().info(
      `${status} ${priority} ${todo.title} (${todo.id})`
    );
  });
}

main().catch(error => Logger.getInstance().error('Error in main:', error));
