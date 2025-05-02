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

  // Delete the first completed todo
  const completedTodo = list.todos.find(todo => todo.completed);
  if (completedTodo) {
    console.log(`\nDeleting completed todo: ${completedTodo.title}`);
    await todoService.deleteTodo(listName, completedTodo.id);
    console.log('Todo deleted');
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