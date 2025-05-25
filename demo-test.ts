import { TodoService } from './src/services/todo-service';
import { configService } from './src/services/config-service';
import { WalrusStorage } from './src/utils/walrus-storage';

async function createTodoForAJ() {
  try {
    process.stdout.write('Creating todo for aj...\n');

    // Initialize services
    const todoService = new TodoService();

    // Create or get the default list
    const listName = 'default';
    let list = await todoService.getList(listName);
    if (!list) {
      process.stdout.write('Creating default list...\n');
      list = await todoService.createList(listName, 'user');
    }

    // Add tasks for fixing waltodo
    const tasks = [
      'Review current waltodo codebase',
      'Identify critical bugs and issues',
      'Implement fixes for high-priority bugs',
      'Add comprehensive test coverage',
      'Update documentation with fixes',
      'Deploy and verify fixes on testnet',
    ];

    // Create the main todo with tasks in description
    const todo = await todoService.addTodo(listName, {
      title: 'todo for aj',
      description: `Main todo for fixing waltodo\n\nTasks:\n${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}`,
      priority: 'high',
    });
    process.stdout.write(`✓ Created main todo: ${todo.title}\n`);
    process.stdout.write(`✓ Added ${tasks.length} tasks\n`);

    // Store on testnet
    process.stdout.write('\nStoring on testnet blockchain...\n');

    // Initialize Walrus storage
    const storage = new WalrusStorage('testnet', false);

    // Store the todo on Walrus
    const blobId = await storage.storeTodo(todo);
    process.stdout.write(`✓ Stored on Walrus with blob ID: ${blobId}\n`);
    process.stdout.write(
      `View on Walrus scanner: https://walrus-testnet.chainlensexplorer.com/blob/${blobId}\n`
    );

    // After storing on Walrus, we would typically create an NFT
    // For now, we just have the blob stored
    process.stdout.write(
      '\nNote: To view this on Sui scanner, you would need to create an NFT with the blob ID\n'
    );

    process.stdout.write(
      '\nTodo "todo for aj" successfully created and stored on testnet!\n'
    );
    process.stdout.write(`Blob ID: ${blobId}\n`);

    // Let's also store the entire list for completeness
    const updatedList = await todoService.getList(listName);
    if (updatedList) {
      const listBlobId = await storage.storeList(updatedList);
      process.stdout.write(
        `\nAlso stored entire list on Walrus with blob ID: ${listBlobId}\n`
      );
      process.stdout.write(
        `View list on Walrus scanner: https://walrus-testnet.chainlensexplorer.com/blob/${listBlobId}\n`
      );
    }

    // List all todos to verify
    process.stdout.write('\nListing all todos...\n');
    const todoLists = await configService.getAllLists();
    for (const listName of todoLists) {
      const list = await todoService.getList(listName);
      if (list) {
        process.stdout.write(`\nList: ${listName}\n`);
        for (const t of list.todos) {
          process.stdout.write(`  - ${t.title} (${t.completed ? '✓' : '○'})\n`);
          if (t.description) {
            process.stdout.write(`    ${t.description.split('\n')[0]}...\n`);
          }
        }
      }
    }
  } catch (error) {
    process.stderr.write(`Error: ${error}\n`);
    process.exit(1);
  }
}

createTodoForAJ();
