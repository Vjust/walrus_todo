#!/usr/bin/env node

/**
 * Script to store all todos in a list to Walrus storage
 * This is a helper utility that demonstrates how to store all todos in a list
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

// Check for list argument
if (process.argv.length < 3) {
  console.error('Error: Missing list name argument');
  console.error('Usage: node store-all-list.js <list-name>');
  process.exit(1);
}

const listName = process.argv[2];
const mockMode = process.argv.includes('--mock');

// Function to load todos from a list
async function loadTodoList(listName) {
  try {
    const todosDir = process.env.STORAGE_PATH || 'Todos';
    const listFilePath = path.join(process.cwd(), todosDir, `${listName}.json`);
    
    if (!fs.existsSync(listFilePath)) {
      console.error(`Error: List "${listName}" not found at ${listFilePath}`);
      process.exit(1);
    }
    
    const listData = JSON.parse(fs.readFileSync(listFilePath, 'utf-8'));
    return listData.todos || [];
  } catch (error) {
    console.error(`Error loading list: ${error.message}`);
    process.exit(1);
  }
}

// Function to store a todo using the CLI
async function storeTodo(todo, listName) {
  try {
    const mockFlag = mockMode ? ' --mock' : '';
    const command = `waltodo store --todo "${todo.title}" --list ${listName}${mockFlag}`;
    
    console.log(`Storing todo: ${todo.title}`);
    const { stdout, stderr } = await execPromise(command);
    
    if (stderr) {
      console.error(`Error: ${stderr}`);
      return false;
    }
    
    console.log(`Successfully stored: ${todo.title}`);
    return true;
  } catch (error) {
    console.error(`Failed to store todo: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  try {
    console.log(`Loading todos from list: ${listName}`);
    const todos = await loadTodoList(listName);
    
    if (todos.length === 0) {
      console.log(`No todos found in list "${listName}"`);
      process.exit(0);
    }
    
    console.log(`Found ${todos.length} todos in list "${listName}"`);
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const todo of todos) {
      const success = await storeTodo(todo, listName);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    }
    
    console.log('\nSummary:');
    console.log(`Total todos processed: ${todos.length}`);
    console.log(`Successfully stored: ${successCount}`);
    console.log(`Failed to store: ${failureCount}`);
    
  } catch (error) {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main();