#!/usr/bin/env node

const { WalrusClient } = require('@mysten/walrus');
const { SuiClient } = require('@mysten/sui.js/client');
const fs = require('fs');

async function downloadTodo() {
  try {
    // Initialize Sui client
    const suiClient = new SuiClient({ url: 'https://fullnode.testnet.sui.io' });

    // Initialize Walrus client with Sui client
    const walrusClient = new WalrusClient({
      network: 'testnet',
      suiClient,
      storageNodeClientOptions: {
        timeout: 30000,
        onError: (error) => console.error('Walrus storage node error:', error)
      }
    });

    // Todo blob ID from the NFT
    const blobId = 'walrus-blob-123';
    
    try {
      // Retrieve the todo data from Walrus
      console.log(`Reading blob ${blobId} from Walrus...`);
      const blobContent = await walrusClient.readBlob({ blobId });
      
      if (!blobContent) {
        throw new Error(`No content found for blob ID: ${blobId}`);
      }

      // Convert binary data to todo object
      const todoData = new TextDecoder().decode(blobContent);
      const todo = JSON.parse(todoData);
      
      // Save to file
      const filename = `todo-${todo.id}.json`;
      fs.writeFileSync(filename, JSON.stringify(todo, null, 2));
      
      console.log(`\nTodo downloaded and saved to ${filename}:`);
      console.log(JSON.stringify(todo, null, 2));
      
    } catch (error) {
      console.error('Error reading from Walrus:', error.message);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

downloadTodo();