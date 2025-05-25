import { TodoService } from './src/services/todo-service';
import { WalrusStorage } from './src/utils/walrus-storage';

async function createAndStoreTodoForAJ() {
  try {
    process.stdout.write(
      '=== Creating "todo for aj" and storing on Walrus Testnet ===\n\n'
    );

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

    // Store on actual testnet (not mock)
    process.stdout.write('\nStoring on Walrus testnet...\n');

    // Initialize Walrus storage (forceMock = false)
    const storage = new WalrusStorage('testnet', false);

    // Store the todo on Walrus
    const blobId = await storage.storeTodo(todo);
    process.stdout.write(`✓ Stored on Walrus with blob ID: ${blobId}\n`);
    process.stdout.write(
      `View on Walrus scanner: https://walrus-testnet-explorer.com/blob/${blobId}\n`
    );

    // Also store the entire list
    const updatedList = await todoService.getList(listName);
    if (updatedList) {
      const listBlobId = await storage.storeList(updatedList);
      process.stdout.write(
        `\n✓ Also stored entire list on Walrus with blob ID: ${listBlobId}\n`
      );
      process.stdout.write(
        `View list on Walrus scanner: https://walrus-testnet-explorer.com/blob/${listBlobId}\n`
      );
    }

    process.stdout.write('\n=== Success! ===\n');
    process.stdout.write(
      'Todo "todo for aj" has been created and stored on Walrus testnet.\n'
    );
    process.stdout.write(
      'You can view the stored blobs using the URLs above.\n'
    );
    process.stdout.write(
      '\nNote: To view on Sui scanner, you would need to create an NFT with the blob ID.\n'
    );

    // Show the created todo
    process.stdout.write('\n=== Created Todo Details ===\n');
    process.stdout.write(`Title: ${todo.title}\n`);
    process.stdout.write(`Priority: ${todo.priority}\n`);
    process.stdout.write(`Created: ${todo.createdAt}\n`);
    process.stdout.write('Description:\n');
    process.stdout.write(
      todo.description
        .split('\n')
        .map(line => `  ${line}`)
        .join('\n') + '\n'
    );
  } catch (error) {
    process.stderr.write(`Error: ${error}\n`);
    process.exit(1);
  }
}

createAndStoreTodoForAJ();
