#!/usr/bin/env node
import { Logger } from '../src/utils/Logger';

const logger = new Logger('store-full-list');

/**
 * Script to store an entire list to Walrus storage as a single transaction
 * This stores the list as a complete entity rather than individual todos
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

// Check for list argument
if (process.argv.length < 3) {
  logger.error('Error: Missing list name argument');
  logger.error('Usage: node store-full-list.js <list-name> [--mock]');
  process.exit(1);
}

const listName = process.argv[2];
const mockMode = process.argv.includes('--mock');

// Function to load a full todo list
async function loadTodoList(listName) {
  try {
    const todosDir = process.env.STORAGE_PATH || 'Todos';
    const listFilePath = path.join(process.cwd(), todosDir, `${listName}.json`);
    
    if (!fs.existsSync(listFilePath)) {
      logger.error(`Error: List "${listName}" not found at ${listFilePath}`);
      process.exit(1);
    }
    
    const listData = JSON.parse(fs.readFileSync(listFilePath, 'utf-8'));
    return listData;
  } catch (error) {
    logger.error(`Error loading list: ${error.message}`);
    process.exit(1);
  }
}

// Function to store the entire list to Walrus
async function storeEntireList(listData, listName) {
  try {
    // Create a temporary file with the list data
    const tempFileName = `temp_${listName}_${Date.now()}.json`;
    const tempFilePath = path.join(process.cwd(), tempFileName);
    
    fs.writeFileSync(tempFilePath, JSON.stringify(listData, null, 2));
    logger.info(`Created temporary file: ${tempFilePath}`);
    
    // Build command with options
    const mockFlag = mockMode ? ' --mock' : '';
    const command = `waltodo store-list --file ${tempFilePath}${mockFlag}`;
    
    logger.info(`Storing entire list: ${listName} (${listData.todos.length} todos)`);
    
    try {
      const { stdout, stderr } = await execPromise(command);
      
      if (stderr && !stderr.includes('warning')) {
        logger.error(`Error: ${stderr}`);
        return false;
      }
      
      logger.info(stdout);
      logger.info(`Successfully stored entire list: ${listName}`);
      return true;
    } catch (execError) {
      // If store-list command doesn't exist, suggest alternative
      if (execError.message.includes('command not found') || 
          execError.message.includes('is not recognized')) {
        logger.error(`The 'store-list' command is not available.`);
        logger.info(`\nAlternative approach: Use store-all-list.js to store todos individually:`);
        logger.info(`node scripts/store-all-list.js ${listName}${mockMode ? ' --mock' : ''}`);
        return false;
      }
      
      logger.error(`Command execution failed: ${execError.message}`);
      return false;
    } finally {
      // Clean up the temporary file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        logger.info(`Removed temporary file: ${tempFilePath}`);
      }
    }
  } catch (error) {
    logger.error(`Failed to store list: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  try {
    logger.info(`Loading list: ${listName}`);
    const listData = await loadTodoList(listName);
    
    if (!listData.todos || listData.todos.length === 0) {
      logger.info(`No todos found in list "${listName}"`);
      process.exit(0);
    }
    
    logger.info(`Found ${listData.todos.length} todos in list "${listName}"`);
    
    // Attempt to store the entire list
    const success = await storeEntireList(listData, listName);
    
    // Provide a summary
    logger.info('\nSummary:');
    logger.info(`List name: ${listName}`);
    logger.info(`Total todos: ${listData.todos.length}`);
    logger.info(`Store operation: ${success ? 'Successful' : 'Failed'}`);
    
  } catch (error) {
    logger.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main();