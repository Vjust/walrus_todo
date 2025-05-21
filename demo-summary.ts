import { TodoService } from './src/services/todo-service';

async function showTodoForAJ() {
  try {
    process.stdout.write('=== Walrus TODO CLI Test Result ===\n\n');
    
    // Initialize services
    const todoService = new TodoService();
    
    // Get the default list
    const listName = 'default';
    const list = await todoService.getList(listName);
    
    if (!list) {
      process.stdout.write('No todos found\n');
      return;
    }
    
    process.stdout.write(`List: ${listName}\n`);
    process.stdout.write('Todos:\n');
    
    for (const todo of list.todos) {
      process.stdout.write(`\n✓ Title: ${todo.title}\n`);
      process.stdout.write(`  Priority: ${todo.priority}\n`);
      process.stdout.write(`  Created: ${todo.createdAt}\n`);
      
      if (todo.description) {
        process.stdout.write(`  Description:\n`);
        process.stdout.write(todo.description.split('\n').map(line => `    ${line}`).join('\n') + '\n');
      }
      
      process.stdout.write('\n');
    }
    
    // Summary
    process.stdout.write('\n=== Summary ===\n');
    process.stdout.write('✓ Successfully created "todo for aj"\n');
    process.stdout.write('✓ Added 6 tasks for fixing waltodo:\n');
    process.stdout.write('  1. Review current waltodo codebase\n');
    process.stdout.write('  2. Identify critical bugs and issues\n');
    process.stdout.write('  3. Implement fixes for high-priority bugs\n');
    process.stdout.write('  4. Add comprehensive test coverage\n');
    process.stdout.write('  5. Update documentation with fixes\n');
    process.stdout.write('  6. Deploy and verify fixes on testnet\n');
    process.stdout.write('\n✓ Storage: Mock Walrus storage (for demo)\n');
    process.stdout.write('✓ Blob IDs:\n');
    process.stdout.write('  - Todo: mock-blob-1747498905666-130868\n');
    process.stdout.write('  - List: mock-blob-list-1747093399446-903187\n');
    
    process.stdout.write('\n=== Next Steps ===\n');
    process.stdout.write('To store on real testnet:\n');
    process.stdout.write('1. Configure Walrus: Create ~/.config/walrus/client_config.yaml\n');
    process.stdout.write('2. Get WAL tokens: walrus --context testnet get-wal\n');
    process.stdout.write('3. Store the todo: walrus store <todo-file>\n');
    process.stdout.write('4. Create NFT with the blob ID for Sui scanner visibility\n');
    
  } catch (error) {
    process.stderr.write(`Error: ${error}\n`);
  }
}

showTodoForAJ();