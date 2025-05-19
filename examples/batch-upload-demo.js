#!/usr/bin/env node

/**
 * Batch Upload Demo
 * 
 * This example demonstrates the batch upload feature for storing multiple todos on Walrus.
 * It creates a test list with multiple todos and then uploads them all at once.
 */

const { execSync } = require('child_process');
const chalk = require('chalk');

// Helper function to run CLI commands
function runCommand(command) {
  console.log(chalk.blue(`Running: ${command}`));
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    console.log(output);
    return output;
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    if (error.stdout) console.log(error.stdout.toString());
    if (error.stderr) console.log(error.stderr.toString());
    throw error;
  }
}

// Main demo function
async function runBatchUploadDemo() {
  console.log(chalk.green.bold('\n🚀 WalTodo Batch Upload Demo\n'));

  // Create a test list
  console.log(chalk.yellow('Step 1: Creating a test list with multiple todos...'));
  const listName = `batch-test-${Date.now()}`;
  
  // Add multiple todos
  const todos = [
    { title: 'Buy groceries', priority: 'high', tags: 'shopping,urgent' },
    { title: 'Call dentist', priority: 'medium', tags: 'health' },
    { title: 'Finish project report', priority: 'high', tags: 'work' },
    { title: 'Water plants', priority: 'low', tags: 'home' },
    { title: 'Plan vacation', priority: 'medium', tags: 'personal' },
    { title: 'Review budget', priority: 'high', tags: 'finance' },
    { title: 'Update resume', priority: 'low', tags: 'career' },
    { title: 'Clean garage', priority: 'low', tags: 'home,weekend' },
    { title: 'Schedule team meeting', priority: 'high', tags: 'work,urgent' },
    { title: 'Buy birthday gift', priority: 'medium', tags: 'personal,shopping' }
  ];

  console.log(chalk.cyan(`Creating ${todos.length} todos in list "${listName}"...`));
  
  todos.forEach((todo, index) => {
    const cmd = `waltodo add "${todo.title}" -l ${listName} -p ${todo.priority} -g "${todo.tags}"`;
    console.log(chalk.gray(`[${index + 1}/${todos.length}] Adding: ${todo.title}`));
    runCommand(cmd);
  });

  // List the todos
  console.log(chalk.yellow('\nStep 2: Listing todos to verify creation...'));
  runCommand(`waltodo list ${listName}`);

  // Batch upload all todos
  console.log(chalk.yellow('\nStep 3: Batch uploading all todos to Walrus...'));
  console.log(chalk.cyan('Using mock mode for demonstration (no real WAL tokens required)'));
  
  // Run batch upload with custom batch size
  const batchCmd = `waltodo store --all --list ${listName} --batch-size 3 --mock`;
  runCommand(batchCmd);

  // Show final status
  console.log(chalk.yellow('\nStep 4: Checking final status...'));
  runCommand(`waltodo list ${listName} --detailed`);

  console.log(chalk.green.bold('\n✅ Batch Upload Demo Complete!\n'));
  console.log(chalk.white('Key features demonstrated:'));
  console.log(chalk.white('  • Created multiple todos with different attributes'));
  console.log(chalk.white('  • Uploaded all todos in batch with progress tracking'));
  console.log(chalk.white('  • Used custom batch size for concurrent uploads'));
  console.log(chalk.white('  • Showed cache optimization and upload statistics'));
  
  console.log(chalk.cyan('\nTry it yourself:'));
  console.log(chalk.white(`  waltodo store --all --list ${listName} --batch-size 5`));
  console.log(chalk.white(`  waltodo store --all --list ${listName} --network mainnet`));
  console.log(chalk.white(`  waltodo store --all --list ${listName} --epochs 10`));
}

// Run the demo
runBatchUploadDemo().catch(error => {
  console.error(chalk.red('Demo failed:'), error);
  process.exit(1);
});