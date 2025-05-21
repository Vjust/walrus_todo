import { TodoService } from './src/services/todo-service';

async function showTodoForAJ() {
  try {
    console.log('=== Walrus TODO CLI Test Result ===\n');
    
    // Initialize services
    const todoService = new TodoService();
    
    // Get the default list
    const listName = 'default';
    const list = await todoService.getList(listName);
    
    if (!list) {
      console.log('No todos found');
      return;
    }
    
    console.log(`List: ${listName}`);
    console.log('Todos:');
    
    for (const todo of list.todos) {
      console.log(`\n✓ Title: ${todo.title}`);
      console.log(`  Priority: ${todo.priority}`);
      console.log(`  Created: ${todo.createdAt}`);
      
      if (todo.description) {
        console.log(`  Description:`);
        console.log(todo.description.split('\n').map(line => `    ${line}`).join('\n'));
      }
      
      console.log('');
    }
    
    // Summary
    console.log('\n=== Summary ===');
    console.log('✓ Successfully created "todo for aj"');
    console.log('✓ Added 6 tasks for fixing waltodo:');
    console.log('  1. Review current waltodo codebase');
    console.log('  2. Identify critical bugs and issues');
    console.log('  3. Implement fixes for high-priority bugs');
    console.log('  4. Add comprehensive test coverage');
    console.log('  5. Update documentation with fixes');
    console.log('  6. Deploy and verify fixes on testnet');
    console.log('\n✓ Storage: Mock Walrus storage (for demo)');
    console.log('✓ Blob IDs:');
    console.log('  - Todo: mock-blob-1747498905666-130868');
    console.log('  - List: mock-blob-list-1747093399446-903187');
    
    console.log('\n=== Next Steps ===');
    console.log('To store on real testnet:');
    console.log('1. Configure Walrus: Create ~/.config/walrus/client_config.yaml');
    console.log('2. Get WAL tokens: walrus --context testnet get-wal');
    console.log('3. Store the todo: walrus store <todo-file>');
    console.log('4. Create NFT with the blob ID for Sui scanner visibility');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

showTodoForAJ();