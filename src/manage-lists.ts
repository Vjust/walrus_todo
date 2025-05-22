import { TodoService } from './services/todoService';
import { Todo } from './types/todo';
import { Logger } from './utils/Logger';

async function main() {
  const todoService = new TodoService();

  // List all todo lists
  Logger.getInstance().info('Getting all todo lists...');
  const lists = await todoService.getAllLists();
  Logger.getInstance().info('Existing lists:', { lists });

  // Create a new list with multiple todos
  const newListName = 'work-tasks';
  Logger.getInstance().info(`Creating new list: ${newListName}`);
  
  try {
    await todoService.createList(newListName, 'test-user'); // Removed unused newList variable assignment
    Logger.getInstance().info('New list created');

    // Add multiple todos
    const todos: Partial<Todo>[] = [
      {
        title: 'Write documentation',
        description: 'Document the new features',
        priority: 'high' as const,
        tags: ['docs', 'urgent']
      },
      {
        title: 'Code review',
        description: 'Review pull requests',
        priority: 'medium' as const,
        tags: ['review', 'collaboration']
      },
      {
        title: 'Weekly planning',
        description: 'Plan next week\'s tasks',
        priority: 'low' as const,
        tags: ['planning']
      }
    ];

    Logger.getInstance().info('Adding todos to new list...');
    for (const todo of todos) {
      await todoService.addTodo(newListName, todo);
    }

    // Show all lists with their todos
    Logger.getInstance().info('All todo lists:');
    const allLists = await todoService.getAllLists();
    for (const listName of allLists) {
      const list = await todoService.getList(listName);
      if (!list) {
        Logger.getInstance().info(`${listName}: Not found or inaccessible`);
        continue;
      }

      Logger.getInstance().info(`${list.name} (${list.todos.length} todos):`);
      list.todos.forEach(todo => {
        const status = todo.completed ? '✓' : '☐';
        const priority = todo.priority === 'high' ? '⚠️' : todo.priority === 'medium' ? '•' : '○';
        Logger.getInstance().info(`${status} ${priority} ${todo.title}`);
        Logger.getInstance().info(`   Tags: ${todo.tags.join(', ')}`);
      });
    }
  } catch (_error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      Logger.getInstance().info('List already exists, skipping creation');

      // Show existing list's todos
      const list = await todoService.getList(newListName);
      if (list) {
        Logger.getInstance().info(`${list.name} (${list.todos.length} todos):`);
        list.todos.forEach(todo => {
          const status = todo.completed ? '✓' : '☐';
          const priority = todo.priority === 'high' ? '⚠️' : todo.priority === 'medium' ? '•' : '○';
          Logger.getInstance().info(`${status} ${priority} ${todo.title}`);
          Logger.getInstance().info(`   Tags: ${todo.tags.join(', ')}`);
        });
      }
    } else {
      throw error;
    }
  }
}

main().catch((error) => Logger.getInstance().error('Error in main:', error));