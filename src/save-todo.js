#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function saveTodo() {
  try {
    // Get the todo NFT data
    const todoId = '0xf6289fece28c8127f5f09459140bc7c487631eec0dbe1b4882a52c5f5ebc297a';
    console.log(`Getting todo data from blockchain (ID: ${todoId})...`);
    
    const todoData = execSync(`sui client object ${todoId}`, { encoding: 'utf8' });
    
    // Extract owner address from todoData
    const ownerMatch = todoData.match(/AddressOwner.*?(0x[a-fA-F0-9]+)/);
    const ownerAddress = ownerMatch ? ownerMatch[1] : 'unknown';
    
    // Parse the todo data
    const todo = {
      id: todoId,
      title: "Network Test - Sui Test",
      description: "Test Sui blockchain integration\nDue: 2025-05-02",
      completed: false,
      createdAt: new Date().toISOString(),
      imageUrl: "https://raw.githubusercontent.com/Vjust/walrus_todo/main/assets/todo_bottle.jpeg",
      walrusBlobId: "walrus-blob-123",
      metadata: {
        owner: ownerAddress,
        nftPackage: "0xd6c1528aed7624e6d058ff8e5603c0d5ae944da5bdda717a82dd0379d9ad3233",
        nftModule: "todo_nft",
        originalOwner: "0x495ca410a2e2e83fe2e390ec0b8e0a25392a07b5c53e916c210ab050b5d49253",
        storageInfo: {
          walrusNetwork: "testnet",
          walrusBlobId: "walrus-blob-123",
          blobContentType: "application/json",
          storageType: "test-data" // since this is a test todo
        }
      }
    };

    // Save to todos directory with title-based filename
    const safeTitle = todo.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const shortId = todoId.slice(0, 10); // Take first 10 chars of ID
    const filename = `${safeTitle}-${shortId}.json`;
    
    // Ensure Todos directory exists
    const todosDir = 'Todos';
    if (!fs.existsSync(todosDir)) {
      fs.mkdirSync(todosDir);
    }
    
    // Full path to save the file
    const filePath = path.join(todosDir, filename);
    
    // Save the file
    fs.writeFileSync(filePath, JSON.stringify(todo, null, 2));
    
    console.log(`\nTodo saved to ${filePath}:`);
    console.log(JSON.stringify(todo, null, 2));
    
    // Clean up old file if it exists
    const oldFile = `todo-${todoId}.json`;
    if (fs.existsSync(oldFile)) {
      fs.unlinkSync(oldFile);
      console.log(`\nRemoved old file: ${oldFile}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

saveTodo();