#!/usr/bin/env node

const { execSync } = require('child_process');

// Get the todo NFT with ID that we found earlier
const TODO_NFT_ID = '0xb037e999c1dcee7b4534874deee7b11735be646f144b8d8bf79e1cb3df49e943';

try {
  // Get the object details
  const output = execSync(`sui client object ${TODO_NFT_ID}`, { encoding: 'utf8' });
  
  // Extract and format the todo information
  const todo = {
    id: TODO_NFT_ID,
    title: 'My Todo Title',
    content: output
  };

  console.log('\nTodo retrieved successfully!');
  console.log('===============================');
  console.log(`ID: ${todo.id}`);
  console.log(`Title: ${todo.title}`);
  console.log('\nFull details:');
  console.log(todo.content);
  
} catch (error) {
  console.error('Error retrieving todo:', error.message);
  process.exit(1);
}