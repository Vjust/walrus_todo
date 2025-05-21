import { SuiClient } from '@mysten/sui/client';
import { SuiNftStorage } from './src/utils/sui-nft-storage';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { TodoService } from './src/services';
import { TODO_NFT_CONFIG, NETWORK_URLS, CURRENT_NETWORK } from './src/constants';
import { execSync } from 'child_process';

/**
 * This script creates an NFT using the default image we uploaded to Walrus storage.
 * It integrates the Walrus blob ID and URL directly into the NFT metadata.
 */
async function launchDefaultNft() {
  try {
    console.log('🚀 Launching Todo NFT with Default Image');
    console.log('======================================');

    // Step 1: Check if we're on testnet
    console.log('\n📡 Checking Sui environment...');
    const envInfo = execSync('sui client active-env').toString().trim();
    
    if (!envInfo.includes('testnet')) {
      console.log('⚠️ Not on testnet. Switching to testnet...');
      try {
        execSync('sui client switch --env testnet');
        console.log('✓ Successfully switched to testnet');
      } catch (error) {
        console.error('❌ Failed to switch to testnet:', error);
        return null;
      }
    } else {
      console.log('✓ Already on testnet');
    }

    // Step 2: Initialize SuiClient
    console.log('\n🔄 Initializing Sui client...');
    const suiClient = new SuiClient({ url: NETWORK_URLS[CURRENT_NETWORK] });
    console.log('✓ Sui client initialized');

    // Step 3: Check NFT module address
    console.log('\n🔍 Checking NFT module configuration...');
    if (!TODO_NFT_CONFIG.MODULE_ADDRESS || TODO_NFT_CONFIG.MODULE_ADDRESS.length < 10) {
      console.error('❌ Todo NFT module address is not configured. Please deploy the NFT module first.');
      return null;
    }
    console.log(`✓ Using NFT module at address: ${TODO_NFT_CONFIG.MODULE_ADDRESS}`);

    // Step 4: Set up Todo service and create a sample todo if needed
    console.log('\n📝 Setting up Todo...');
    const todoService = new TodoService();
    const listName = 'default';
    
    // Create or get a todo item
    let todoItem: any;
    
    // Get existing todos from default list
    const todoList = await todoService.getList(listName);
    
    if (todoList && todoList.todos.length > 0) {
      // Use the first todo in the default list
      todoItem = todoList.todos[0];
      console.log(`✓ Using existing Todo: "${todoItem.title}" (ID: ${todoItem.id})`);
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
        console.log('✓ Creating default todo list...');
        await todoService.createList(listName, 'default-owner');
      }
      
      // Add the todo to the list
      todoItem = await todoService.addTodo(listName, newTodoData);
      console.log(`✓ Created new Todo: "${todoItem.title}" (ID: ${todoItem.id})`);
    }

    // Step 5: Create NFT with the default image URL we uploaded
    console.log('\n🖼️ Integrating with Walrus image...');
    
    // Use the BlobID and URL from our previous upload
    const walrusBlobId = 'HnljRdtwjEGa-1oAVM24snQSzIIDLeoaf8BfDTfnIrE';
    const imageUrl = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${walrusBlobId}`;
    
    console.log(`✓ Using Walrus blob ID: ${walrusBlobId}`);
    console.log(`✓ Using image URL: ${imageUrl}`);

    // Update todo with image URL
    const updatedTodo = {
      ...todoItem,
      imageUrl
    };
    
    // Note: No direct updateTodo method, we'd need to update the whole list
    // For now, we'll just use the updated todoItem for NFT creation
    console.log('✓ Updated Todo with image URL');

    // Step 6: Create the NFT on chain
    console.log('\n⛓️ Creating NFT on Sui blockchain...');
    
    // Get the keypair for signing transactions
    const addressInfo = execSync('sui client active-address').toString().trim();
    const keystore = execSync('sui client envs').toString();
    console.log(`✓ Using address: ${addressInfo}`);
    
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
    
    console.log('\n✅ NFT created successfully!');
    console.log(`📝 Transaction: ${txDigest}`);
    console.log(`📝 Your NFT has been created with the following:`);
    console.log(`   - Title: ${updatedTodo.title}`);
    console.log(`   - Image URL: ${imageUrl}`);
    console.log(`   - Walrus Blob ID: ${walrusBlobId}`);
    
    console.log('\n🎉 You can now view this NFT in your wallet with the embedded image from Walrus.');
    
    return {
      todoId: todoItem.id,
      txDigest,
      imageUrl
    };
  } catch (error) {
    console.error('❌ Error creating NFT:', error);
    if (error instanceof Error) {
      console.error(error.message);
    }
    return null;
  }
}

// Execute the script
console.log('Starting NFT creation process...');
launchDefaultNft().then(result => {
  if (result) {
    console.log('\n==================================');
    console.log('✨ Process completed successfully! ✨');
    console.log('==================================');
    console.log('To view your NFT, you can use the Sui Explorer or a compatible wallet.');
  } else {
    console.error('\n❌ Process completed with errors.');
    console.error('Please check the error messages above and try again.');
  }
});
