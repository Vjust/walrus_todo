#!/usr/bin/env node

// Standalone AI todo command - bypasses the CLI framework for more reliable output
require('dotenv').config();
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const { AiService } = require('./dist/src/services/ai/aiService');

// Constants
const TODO_DIR = path.join(process.cwd(), 'todos');
const DEFAULT_LIST = 'default';

// Command line argument parsing
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node ai-todo.js <operation> [options]');
  console.log('Operations: summarize, categorize, prioritize, suggest, analyze');
  process.exit(1);
}

// Parse operation
const operation = args[0];
let listName = DEFAULT_LIST;
let todoId = null;
let apply = false;
let count = 3;
let apiKey = process.env.XAI_API_KEY;

// Parse remaining args
for (let i = 1; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--list' || arg === '-l') {
    listName = args[++i] || DEFAULT_LIST;
  } else if (arg === '--id' || arg === '-i') {
    todoId = args[++i];
  } else if (arg === '--apply' || arg === '-a') {
    apply = true;
  } else if (arg === '--count' || arg === '-c') {
    count = parseInt(args[++i]) || 3;
  } else if (arg === '--apiKey' || arg === '-k') {
    apiKey = args[++i];
  }
}

// Main function
async function main() {
  try {
    // Check for required API key
    if (!apiKey) {
      console.error(chalk.red('Error: XAI API key is required. Set XAI_API_KEY environment variable or use --apiKey flag.'));
      process.exit(1);
    }

    // Verify list exists
    const listFile = path.join(TODO_DIR, `${listName}.json`);
    if (!fs.existsSync(listFile)) {
      console.error(chalk.red(`Error: List "${listName}" not found.`));
      process.exit(1);
    }

    // Read the list
    const listData = JSON.parse(fs.readFileSync(listFile, 'utf8'));
    
    // Initialize AI service
    const aiService = new AiService(apiKey);
    
    // Run the operation
    console.log(chalk.blue(`Applying AI (${operation}) to your todos...`));
    
    switch (operation) {
      case 'summarize':
        await runSummarize(aiService, listData);
        break;
      case 'categorize':
        if (!todoId) {
          console.error(chalk.red('Error: Todo ID or title is required for categorize operation.'));
          process.exit(1);
        }
        await runCategorize(aiService, listData, todoId, apply);
        break;
      case 'prioritize':
        if (!todoId) {
          console.error(chalk.red('Error: Todo ID or title is required for prioritize operation.'));
          process.exit(1);
        }
        await runPrioritize(aiService, listData, todoId, apply);
        break;
      case 'suggest':
        await runSuggest(aiService, listData, count, apply);
        break;
      case 'analyze':
        await runAnalyze(aiService, listData);
        break;
      default:
        console.error(chalk.red(`Error: Unknown operation: ${operation}`));
        process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

// AI operations
async function runSummarize(aiService, list) {
  console.log(chalk.dim('Generating summary...'));
  const summary = await aiService.summarizeTodoList(list);
  
  console.log('\n' + chalk.cyan('📋 Todo List Summary'));
  console.log('──────────────────────');
  console.log(summary);
}

async function runCategorize(aiService, list, todoId, apply) {
  // Find the todo by ID or title (case-insensitive)
  const todo = list.todos.find(t => 
    t.id === todoId || 
    t.title.toLowerCase() === todoId.toLowerCase()
  );
  
  if (!todo) {
    console.error(chalk.red(`Error: Todo "${todoId}" not found in list "${list.name}".`));
    process.exit(1);
  }
  
  console.log(chalk.dim('Generating tag suggestions...'));
  const suggestedTags = await aiService.suggestTags(todo);
  
  console.log('\n' + chalk.cyan('🏷️  Suggested Tags'));
  console.log('──────────────────────');
  suggestedTags.forEach(tag => console.log(`- ${tag}`));
  
  if (apply) {
    // Merge existing and suggested tags, removing duplicates
    const existingTags = todo.tags || [];
    const allTags = [...new Set([...existingTags, ...suggestedTags])];
    
    // Update the todo
    todo.tags = allTags;
    todo.updatedAt = new Date().toISOString();
    
    // Update the list file
    fs.writeFileSync(
      path.join(TODO_DIR, `${list.name}.json`),
      JSON.stringify(list, null, 2)
    );
    
    console.log(chalk.green('\n✓ Tags applied to todo'));
  } else {
    console.log(chalk.yellow('\nTags not applied. Use --apply flag to add these tags automatically.'));
  }
}

async function runPrioritize(aiService, list, todoId, apply) {
  // Find the todo by ID or title (case-insensitive)
  const todo = list.todos.find(t => 
    t.id === todoId || 
    t.title.toLowerCase() === todoId.toLowerCase()
  );
  
  if (!todo) {
    console.error(chalk.red(`Error: Todo "${todoId}" not found in list "${list.name}".`));
    process.exit(1);
  }
  
  console.log(chalk.dim('Generating priority suggestion...'));
  const suggestedPriority = await aiService.suggestPriority(todo);
  
  // Color based on priority
  const priorityColor = {
    high: chalk.red,
    medium: chalk.yellow,
    low: chalk.green
  }[suggestedPriority];
  
  console.log('\n' + chalk.cyan('🔄 Suggested Priority'));
  console.log('──────────────────────');
  console.log(priorityColor(suggestedPriority));
  
  if (apply) {
    // Update the todo
    todo.priority = suggestedPriority;
    todo.updatedAt = new Date().toISOString();
    
    // Update the list file
    fs.writeFileSync(
      path.join(TODO_DIR, `${list.name}.json`),
      JSON.stringify(list, null, 2)
    );
    
    console.log(chalk.green('\n✓ Priority applied to todo'));
  } else {
    console.log(chalk.yellow('\nPriority not applied. Use --apply flag to update priority automatically.'));
  }
}

async function runSuggest(aiService, list, count, apply) {
  console.log(chalk.dim(`Generating ${count} task suggestions...`));
  const suggestedTasks = await aiService.suggestRelatedTasks(list, count);
  
  console.log('\n' + chalk.cyan('✨ Suggested Tasks'));
  console.log('──────────────────────');
  suggestedTasks.forEach((task, i) => console.log(`${i + 1}. ${task}`));
  
  if (apply) {
    console.log(chalk.dim('\nAdding suggested tasks to list...'));
    
    // Add each suggested task
    for (const taskTitle of suggestedTasks) {
      const newTodo = {
        id: Date.now() + '-' + Math.floor(Math.random() * 1000000),
        title: taskTitle,
        description: '',
        completed: false,
        priority: 'medium',
        tags: ['ai-suggested'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        private: true,
        storageLocation: 'local'
      };
      
      list.todos.push(newTodo);
    }
    
    // Update the list file
    list.updatedAt = new Date().toISOString();
    fs.writeFileSync(
      path.join(TODO_DIR, `${list.name}.json`),
      JSON.stringify(list, null, 2)
    );
    
    console.log(chalk.green(`\n✓ Added ${suggestedTasks.length} new todos to list "${list.name}"`));
  } else {
    console.log(chalk.yellow('\nSuggestions not added. Use --apply flag to add these tasks automatically.'));
  }
}

async function runAnalyze(aiService, list) {
  console.log(chalk.dim('Analyzing productivity patterns...'));
  const analysis = await aiService.analyzeProductivity(list);
  
  console.log('\n' + chalk.cyan('📊 Productivity Analysis'));
  console.log('──────────────────────');
  console.log(analysis);
}

// Run the main function
main().catch(err => {
  console.error(chalk.red(`Unhandled error: ${err.message}`));
  process.exit(1);
});