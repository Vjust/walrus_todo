import { TodoService } from './src/services/todo-service';
import { ConfigService } from './src/services/config-service';
import { WalrusStorage } from './src/utils/walrus-storage';

async function createTodoForAJ() {
  try {
    console.log('Creating todo for aj...');
    
    // Initialize services
    const todoService = new TodoService();
    const configService = new ConfigService();
    
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
    
    // Store on testnet
    console.log('\nStoring on testnet blockchain...');
    
    // Initialize Walrus storage
    const storage = new WalrusStorage('testnet', false);
    
    // Store the todo on Walrus
    const blobId = await storage.storeTodo(todo);
    console.log('✓ Stored on Walrus with blob ID:', blobId);
    console.log(`View on Walrus scanner: https://walrus-testnet.chainlensexplorer.com/blob/${blobId}`);
    
    // After storing on Walrus, we would typically create an NFT
    // For now, we just have the blob stored
    console.log('\nNote: To view this on Sui scanner, you would need to create an NFT with the blob ID');
    
    console.log('\nTodo "todo for aj" successfully created and stored on testnet!');
    console.log('Blob ID:', blobId);
    
    // Let's also store the entire list for completeness
    const updatedList = await todoService.getList(listName);
    if (updatedList) {
      const listBlobId = await storage.storeList(updatedList);
      console.log('\nAlso stored entire list on Walrus with blob ID:', listBlobId);
      console.log(`View list on Walrus scanner: https://walrus-testnet.chainlensexplorer.com/blob/${listBlobId}`);
    }
    
    // List all todos to verify
    console.log('\nListing all todos...');
    const todoLists = await configService.getAllLists();
    for (const listName of todoLists) {
      const list = await todoService.getList(listName);
      if (list) {
        console.log(`\nList: ${listName}`);
        for (const t of list.todos) {
          console.log(`  - ${t.title} (${t.completed ? '✓' : '○'})`);
          if (t.description) {
            console.log(`    ${t.description.split('\n')[0]}...`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createTodoForAJ();