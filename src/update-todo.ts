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
    console.log(`${status} ${priority} ${todo.title}`);
    console.log(`   Description: ${todo.description}`);
    console.log(`   Tags: ${todo.tags.join(', ')}\n`);
  });

  // Update the first todo
  if (list.todos.length > 0) {
    const todoToUpdate = list.todos[0];
    console.log(`Updating todo: ${todoToUpdate.title}`);
    
    const updatedTodo = await todoService.updateTodo(listName, todoToUpdate.id, {
      title: 'Updated Todo Title',
      description: 'This todo has been updated',
      priority: 'medium',
      tags: ['test', 'demo', 'updated']
    });
    
    console.log('Todo updated');
  }

  // Show updated list
  console.log('\nUpdated todos:');
  const updatedList = await todoService.getList(listName);
  updatedList?.todos.forEach(todo => {
    const status = todo.completed ? '✓' : '☐';
    const priority = todo.priority === 'high' ? '⚠️' : todo.priority === 'medium' ? '•' : '○';
    console.log(`${status} ${priority} ${todo.title}`);
    console.log(`   Description: ${todo.description}`);
    console.log(`   Tags: ${todo.tags.join(', ')}\n`);
  });
}

main().catch(console.error);