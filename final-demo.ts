import { TodoService } from './src/services/todo-service';
import { WalrusStorage } from './src/utils/walrus-storage';

async function createAndStoreTodoForAJ() {
  try {
    console.log('=== Creating "todo for aj" and storing on Walrus Testnet ===\n');
    
    // Initialize services
    const todoService = new TodoService();
    
    // Create or get the default list
    const listName = 'default';
    let list = await todoService.getList(listName);
    if (!list) {
      console.log('Creating default list...');
      list = await todoService.createList(listName, 'user');
    }
    
    // Add tasks for fixing waltodo
    const tasks = [
      'Review current waltodo codebase',
      'Identify critical bugs and issues',
      'Implement fixes for high-priority bugs',
      'Add comprehensive test coverage',
      'Update documentation with fixes',
      'Deploy and verify fixes on testnet'
    ];
    
    // Create the main todo with tasks in description
    const todo = await todoService.addTodo(listName, {
      title: 'todo for aj',
      description: `Main todo for fixing waltodo\n\nTasks:\n${tasks.map((t, i) => `${i+1}. ${t}`).join('\n')}`,
      priority: 'high'
    });
    console.log('✓ Created main todo:', todo.title);
    console.log(`✓ Added ${tasks.length} tasks`);
    
    // Store on actual testnet (not mock)
    console.log('\nStoring on Walrus testnet...');
    
    // Initialize Walrus storage (forceMock = false)
    const storage = new WalrusStorage('testnet', false);
    
    // Store the todo on Walrus
    const blobId = await storage.storeTodo(todo);
    console.log('✓ Stored on Walrus with blob ID:', blobId);
    console.log(`View on Walrus scanner: https://walrus-testnet-explorer.com/blob/${blobId}`);
    
    // Also store the entire list
    const updatedList = await todoService.getList(listName);
    if (updatedList) {
      const listBlobId = await storage.storeList(updatedList);
      console.log('\n✓ Also stored entire list on Walrus with blob ID:', listBlobId);
      console.log(`View list on Walrus scanner: https://walrus-testnet-explorer.com/blob/${listBlobId}`);
    }
    
    console.log('\n=== Success! ===');
    console.log('Todo "todo for aj" has been created and stored on Walrus testnet.');
    console.log('You can view the stored blobs using the URLs above.');
    console.log('\nNote: To view on Sui scanner, you would need to create an NFT with the blob ID.');
    
    // Show the created todo
    console.log('\n=== Created Todo Details ===');
    console.log(`Title: ${todo.title}`);
    console.log(`Priority: ${todo.priority}`);
    console.log(`Created: ${todo.createdAt}`);
    console.log('Description:');
    console.log(todo.description.split('\n').map(line => `  ${line}`).join('\n'));
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createAndStoreTodoForAJ();