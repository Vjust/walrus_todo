import { TodoService } from './services/todoService';

async function main() {
  const todoService = new TodoService();
  const listName = 'test-list';
  
  // Get the todo list
  console.log('Getting todo list...');
  const list = await todoService.getList(listName);
  if (!list) {
    console.error('List not found');
    return;
  }

  console.log('\nCurrent todos:');
  list.todos.forEach(todo => {
    const status = todo.completed ? '✓' : '☐';
    const priority = todo.priority === 'high' ? '⚠️' : todo.priority === 'medium' ? '•' : '○';
    console.log(`${status} ${priority} ${todo.title} (${todo.id})`);
  });

  // Complete the first todo
  if (list.todos.length > 0) {
    const firstTodo = list.todos[0];
    console.log(`\nCompleting todo: ${firstTodo.title}`);
    await todoService.toggleItemStatus(listName, firstTodo.id, true);
    console.log('Todo marked as completed');
  }

  // Show updated list
  console.log('\nUpdated todos:');
  const updatedList = await todoService.getList(listName);
  updatedList?.todos.forEach(todo => {
    const status = todo.completed ? '✓' : '☐';
    const priority = todo.priority === 'high' ? '⚠️' : todo.priority === 'medium' ? '•' : '○';
    console.log(`${status} ${priority} ${todo.title} (${todo.id})`);
  });
}

main().catch(console.error);