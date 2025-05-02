#!/usr/bin/env node

const { execSync } = require('child_process');

// Helper to convert string to byte array string
function stringToByteArray(str) {
  return Array.from(Buffer.from(str)).join(', ');
}

// Create a todo NFT for network testing
async function createNetworkTestTodo() {
  try {
    console.log('Creating Network Test todos...');

    // Package info from existing todo NFT
    const packageId = '0xd6c1528aed7624e6d058ff8e5603c0d5ae944da5bdda717a82dd0379d9ad3233';
    
    // Create todo with tasks
    const tasks = [
      {
        title: 'Network Test - Sui Test',
        dueDate: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString().split('T')[0],
        description: 'Test Sui blockchain integration'
      },
      {
        title: 'Network Test - Walrus Test',
        dueDate: new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
        description: 'Test Walrus storage integration'
      },
      {
        title: 'Network Test - Todo Test',
        dueDate: new Date(Date.now() + (3 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
        description: 'Test Todo application functionality'
      }
    ];

    for (const task of tasks) {
      console.log(`\nCreating task: ${task.title} (Due: ${task.dueDate})`);
      
      // Convert strings to byte arrays
      const titleBytes = stringToByteArray(task.title);
      const descriptionBytes = stringToByteArray(`${task.description}\nDue: ${task.dueDate}`);
      const blobIdBytes = stringToByteArray('walrus-blob-123');
      const imageUrlBytes = stringToByteArray('https://raw.githubusercontent.com/Vjust/walrus_todo/main/assets/todo_bottle.jpeg');
      
      // Create command with byte arrays
      const command = `sui client call \
        --package ${packageId} \
        --module todo_nft \
        --function create_todo \
        --args '[${titleBytes}]' '[${descriptionBytes}]' '[${blobIdBytes}]' '[${imageUrlBytes}]' \
        --gas-budget 100000000`;
      
      console.log('\nExecuting command:', command);
      const output = execSync(command, { encoding: 'utf8' });
      console.log('\nOutput:', output);
    }

    console.log('\nNetwork Test todos created successfully!');
    console.log('\nUse the following command to see your todos:');
    console.log('sui client objects');
  } catch (error) {
    console.error('Error:', error.message);
    if (error.stdout) console.error('Stdout:', error.stdout);
    if (error.stderr) console.error('Stderr:', error.stderr);
    process.exit(1);
  }
}

createNetworkTestTodo();