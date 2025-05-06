import { TodoService } from './services/todoService';
import { Todo } from './types/todo';

async function main() {
  const todoService = new TodoService();

  // List all todo lists
  console.log('Getting all todo lists...');
  const lists = await todoService.getAllLists();
  console.log('\nExisting lists:', lists);

  // Create a new list with multiple todos
  const newListName = 'work-tasks';
  console.log(`\nCreating new list: ${newListName}`);
  
  try {
    await todoService.createList(newListName, 'test-user'); // Removed unused newList variable assignment
    console.log('New list created');

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

    console.log('\nAdding todos to new list...');
    for (const todo of todos) {
      await todoService.addTodo(newListName, todo);
    }

    // Show all lists with their todos
    console.log('\nAll todo lists:');
    const allLists = await todoService.getAllLists();
    for (const listName of allLists) {
      const list = await todoService.getList(listName);
      if (!list) {
        console.log(`\n${listName}: Not found or inaccessible`);
        continue;
      }

      console.log(`\n${list.name} (${list.todos.length} todos):`);
      list.todos.forEach(todo => {
        const status = todo.completed ? '' : '';
        const priority = todo.priority === 'high' ? 'ù' : todo.priority === 'medium' ? '"' : 'ù';
        console.log(`${status} ${priority} ${todo.title}`);
        console.log(`   Tags: ${todo.tags.join(', ')}`);
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log('List already exists, skipping creation');

      // Show existing list's todos
      const list = await todoService.getList(newListName);
      if (list) {
        console.log(`\n${list.name} (${list.todos.length} todos):`);
        list.todos.forEach(todo => {
          const status = todo.completed ? '' : '';
          const priority = todo.priority === 'high' ? 'ù' : todo.priority === 'medium' ? '"' : 'ù';
          console.log(`${status} ${priority} ${todo.title}`);
          console.log(`   Tags: ${todo.tags.join(', ')}`);
        });
      }
    } else {
      throw error;
    }
  }
}

main().catch(console.error);