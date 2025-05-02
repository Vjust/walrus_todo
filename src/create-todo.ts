import { TodoService } from './services/todoService';

async function main() {
  const todoService = new TodoService();
  const listName = 'test-list';
  
  // First create or get list
  console.log('Creating/getting todo list...');
  let list = await todoService.getList(listName);
  if (!list) {
    list = await todoService.createList(listName, 'test-user');
    console.log('Created new list:', list);
  } else {
    console.log('Using existing list:', list);
  }

  // Add a todo item
  console.log('\nAdding todo item...');
  const todo = await todoService.addTodo(listName, {
    title: 'Test Todo Item',
    description: 'This is a test todo item',
    priority: 'high',
    tags: ['test', 'demo'],
    private: true
  });
  console.log('Created todo:', todo);
}

main().catch(console.error);