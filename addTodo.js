// Load dotenv
require('dotenv').config();
console.log('Dotenv loaded');

// Import TodoService
const { TodoService } = require('./dist/src/services/todoService');
const todoService = new TodoService();

async function main() {
  try {
    // First check if the list exists
    const list = await todoService.getList('default');
    if (!list) {
      console.log('Creating default list...');
      await todoService.createList('default', 'default-owner');
      console.log('List created');
    } else {
      console.log('List exists:', list.name);
    }

    // Add a todo
    const todo = {
      title: 'Test direct todo',
      description: '',
      completed: false,
      priority: 'medium',
      tags: ['test'],
      private: true,
      storageLocation: 'local'
    };
    
    console.log('Adding todo:', todo);
    const addedTodo = await todoService.addTodo('default', todo);
    console.log('Todo added:', addedTodo);
    
    // Read the list again to confirm
    const updatedList = await todoService.getList('default');
    console.log('Updated list todos:', updatedList.todos);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();