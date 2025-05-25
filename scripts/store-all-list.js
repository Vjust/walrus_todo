#!/usr/bin/env node
import { Logger } from '../src/utils/Logger';

const logger = new Logger('store-all-list');

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
  logger.error('Error: Missing list name argument');
  logger.error('Usage: node store-all-list.js <list-name>');
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
      logger.error(`Error: List "${listName}" not found at ${listFilePath}`);
      process.exit(1);
    }

    const listData = JSON.parse(fs.readFileSync(listFilePath, 'utf-8'));
    return listData.todos || [];
  } catch (error) {
    logger.error(`Error loading list: ${error.message}`);
    process.exit(1);
  }
}

// Function to store a todo using the CLI
async function storeTodo(todo, listName) {
  try {
    const mockFlag = mockMode ? ' --mock' : '';
    const command = `waltodo store --todo "${todo.title}" --list ${listName}${mockFlag}`;

    logger.info(`Storing todo: ${todo.title}`);
    const { stdout, stderr } = await execPromise(command);

    if (stderr) {
      logger.error(`Error: ${stderr}`);
      return false;
    }

    logger.info(`Successfully stored: ${todo.title}`);
    return true;
  } catch (error) {
    logger.error(`Failed to store todo: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  try {
    logger.info(`Loading todos from list: ${listName}`);
    const todos = await loadTodoList(listName);

    if (todos.length === 0) {
      logger.info(`No todos found in list "${listName}"`);
      process.exit(0);
    }

    logger.info(`Found ${todos.length} todos in list "${listName}"`);

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

    logger.info('\nSummary:');
    logger.info(`Total todos processed: ${todos.length}`);
    logger.info(`Successfully stored: ${successCount}`);
    logger.info(`Failed to store: ${failureCount}`);
  } catch (error) {
    logger.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main();
