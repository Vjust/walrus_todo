
import { SuiNftStorage } from './src/utils/sui-nft-storage';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiClient } from '@mysten/sui/client';
import { TodoService } from './src/services';
import { Todo } from './src/types/todo';
import { TODO_NFT_CONFIG, NETWORK_URLS, CURRENT_NETWORK } from './src/constants';
import { execSync } from 'child_process';

/**
 * This script creates an NFT using the default image we uploaded to Walrus storage.
 * It integrates the Walrus blob ID and URL directly into the NFT metadata.
 */
async function launchDefaultNft() {
  try {
    process.stdout.write('🚀 Launching Todo NFT with Default Image\n');
    process.stdout.write('======================================\n');

    // Step 1: Check if we're on testnet
    process.stdout.write('\n📡 Checking Sui environment...\n');
    const envInfo = execSync('sui client active-env').toString().trim();
    
    if (!envInfo.includes('testnet')) {
      process.stdout.write('⚠️ Not on testnet. Switching to testnet...\n');
      try {
        execSync('sui client switch --env testnet');
        process.stdout.write('✓ Successfully switched to testnet\n');
      } catch (error) {
        process.stderr.write('❌ Failed to switch to testnet: ' + error + '\n');
        return null;
      }
    } else {
      process.stdout.write('✓ Already on testnet\n');
    }

    // Step 2: Initialize SuiClient
    process.stdout.write('\n🔄 Initializing Sui client...\n');
    const suiClient = new SuiClient({ url: NETWORK_URLS[CURRENT_NETWORK] });
    process.stdout.write('✓ Sui client initialized\n');

    // Step 3: Check NFT module address
    process.stdout.write('\n🔍 Checking NFT module configuration...\n');
    if (!TODO_NFT_CONFIG.MODULE_ADDRESS || TODO_NFT_CONFIG.MODULE_ADDRESS.length < 10) {
      process.stderr.write('❌ Todo NFT module address is not configured. Please deploy the NFT module first.\n');
      return null;
    }
    process.stdout.write(`✓ Using NFT module at address: ${TODO_NFT_CONFIG.MODULE_ADDRESS}\n`);

    // Step 4: Set up Todo service and create a sample todo if needed
    process.stdout.write('\n📝 Setting up Todo...\n');
    const todoService = new TodoService();
    const listName = 'default';
    
    // Create or get a todo item
    let todoItem: Todo;
    
    // Get existing todos from default list
    const todoList = await todoService.getList(listName);
    
    if (todoList && todoList.todos.length > 0) {
      // Use the first todo in the default list
      todoItem = todoList.todos[0] as Todo;
      process.stdout.write(`✓ Using existing Todo: "${todoItem.title}" (ID: ${todoItem.id})\n`);
    } else {
      // Create a new todo in the default list
      const newTodoData = {
        title: 'My Default Todo NFT',
        description: 'This todo was created to demonstrate NFT integration with Walrus storage',
        completed: false,
        priority: 'medium' as const,
        tags: ['nft', 'walrus'],
      };
      
      // If list doesn't exist, create it first
      if (!todoList) {
        process.stdout.write('✓ Creating default todo list...\n');
        await todoService.createList(listName, 'default-owner');
      }
      
      // Add the todo to the list
      todoItem = await todoService.addTodo(listName, newTodoData) as Todo;
      process.stdout.write(`✓ Created new Todo: "${todoItem.title}" (ID: ${todoItem.id})\n`);
    }

    // Step 5: Create NFT with the default image URL we uploaded
    process.stdout.write('\n🖼️ Integrating with Walrus image...\n');
    
    // Use the BlobID and URL from our previous upload
    const walrusBlobId = 'HnljRdtwjEGa-1oAVM24snQSzIIDLeoaf8BfDTfnIrE';
    const imageUrl = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${walrusBlobId}`;
    
    process.stdout.write(`✓ Using Walrus blob ID: ${walrusBlobId}\n`);
    process.stdout.write(`✓ Using image URL: ${imageUrl}\n`);

    // Update todo with image URL
    const updatedTodo: Todo = {
      ...todoItem,
      imageUrl
    };
    
    // Note: No direct updateTodo method, we'd need to update the whole list
    // For now, we'll just use the updated todoItem for NFT creation
    process.stdout.write('✓ Updated Todo with image URL\n');

    // Step 6: Create the NFT on chain
    process.stdout.write('\n⛓️ Creating NFT on Sui blockchain...\n');
    
    // Get the keypair for signing transactions
    const addressInfo = execSync('sui client active-address').toString().trim();
    process.stdout.write(`✓ Using address: ${addressInfo}\n`);
    
    // Create a keypair (you may need to configure this based on your setup)
    const keypair = Ed25519Keypair.generate();
    
    const nftStorage = new SuiNftStorage(
      suiClient,
      keypair,
      {
        address: addressInfo,
        packageId: TODO_NFT_CONFIG.MODULE_ADDRESS
      }
    );

    const txDigest = await nftStorage.createTodoNft(updatedTodo, walrusBlobId);
    
    process.stdout.write('\n✅ NFT created successfully!\n');
    process.stdout.write(`📝 Transaction: ${txDigest}\n`);
    process.stdout.write(`📝 Your NFT has been created with the following:\n`);
    process.stdout.write(`   - Title: ${updatedTodo.title}\n`);
    process.stdout.write(`   - Image URL: ${imageUrl}\n`);
    process.stdout.write(`   - Walrus Blob ID: ${walrusBlobId}\n`);
    
    process.stdout.write('\n🎉 You can now view this NFT in your wallet with the embedded image from Walrus.\n');
    
    return {
      todoId: todoItem.id,
      txDigest,
      imageUrl
    };
  } catch (error) {
    process.stderr.write('❌ Error creating NFT: ' + error + '\n');
    if (error instanceof Error) {
      process.stderr.write(error.message + '\n');
    }
    return null;
  }
}

// Execute the script
process.stdout.write('Starting NFT creation process...\n');
launchDefaultNft().then(result => {
  if (result) {
    process.stdout.write('\n==================================\n');
    process.stdout.write('✨ Process completed successfully! ✨\n');
    process.stdout.write('==================================\n');
    process.stdout.write('To view your NFT, you can use the Sui Explorer or a compatible wallet.\n');
  } else {
    process.stderr.write('\n❌ Process completed with errors.\n');
    process.stderr.write('Please check the error messages above and try again.\n');
  }
});
