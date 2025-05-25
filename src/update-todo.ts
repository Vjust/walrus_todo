import { TodoService } from './services/todoService';
import { Logger } from './utils/Logger';

const logger = new Logger('update-todo');

async function main() {
  const todoService = new TodoService();
  const listName = 'test-list';

  // Get the todo list
  logger.info('Getting todo list...');
  const list = await todoService.getList(listName);
  if (!list) {
    logger.error('List not found');
    return;
  }

  logger.info('\nCurrent todos:');
  list.todos.forEach(todo => {
    const status = todo.completed ? '✓' : '☐';
    const priority =
      todo.priority === 'high' ? '⚠️' : todo.priority === 'medium' ? '•' : '○';
    logger.info(`${status} ${priority} ${todo.title}`);
    logger.info(`   Description: ${todo.description}`);
    logger.info(`   Tags: ${todo.tags.join(', ')}\n`);
  });

  // Update the first todo
  if (list.todos.length > 0) {
    const todoToUpdate = list.todos[0];
    logger.info(`Updating todo: ${todoToUpdate.title}`);

    await todoService.updateTodo(listName, todoToUpdate.id, {
      // Removed unused updatedTodo variable assignment
      title: 'Updated Todo Title',
      description: 'This todo has been updated',
      priority: 'medium',
      tags: ['test', 'demo', 'updated'],
    });

    logger.info('Todo updated');
  }

  // Show updated list
  logger.info('\nUpdated todos:');
  const updatedList = await todoService.getList(listName);
  updatedList?.todos.forEach(todo => {
    const status = todo.completed ? '✓' : '☐';
    const priority =
      todo.priority === 'high' ? '⚠️' : todo.priority === 'medium' ? '•' : '○';
    logger.info(`${status} ${priority} ${todo.title}`);
    logger.info(`   Description: ${todo.description}`);
    logger.info(`   Tags: ${todo.tags.join(', ')}\n`);
  });
}

main().catch(console.error);
