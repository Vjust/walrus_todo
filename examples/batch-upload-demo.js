import { Logger } from '../src/utils/Logger';

const logger = new Logger('batch-upload-demo');
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
  process.stdout.write(chalk.blue(`Running: ${command}`) + '\n');
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    process.stdout.write(output + '\n');
    return output;
  } catch (error) {
    process.stderr.write(chalk.red(`Error: ${error.message}`) + '\n');
    if (error.stdout) process.stdout.write(error.stdout.toString());
    if (error.stderr) process.stderr.write(error.stderr.toString());
    throw error;
  }
}

// Main demo function
async function runBatchUploadDemo() {
  process.stdout.write(chalk.green.bold('\n🚀 WalTodo Batch Upload Demo\n\n'));

  // Create a test list
  process.stdout.write(chalk.yellow('Step 1: Creating a test list with multiple todos...') + '\n');
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

  process.stdout.write(chalk.cyan(`Creating ${todos.length} todos in list "${listName}"...`) + '\n');
  
  todos.forEach((todo, index) => {
    const cmd = `waltodo add "${todo.title}" -l ${listName} -p ${todo.priority} -g "${todo.tags}"`;
    process.stdout.write(chalk.gray(`[${index + 1}/${todos.length}] Adding: ${todo.title}`) + '\n');
    runCommand(cmd);
  });

  // List the todos
  process.stdout.write(chalk.yellow('\nStep 2: Listing todos to verify creation...') + '\n');
  runCommand(`waltodo list ${listName}`);

  // Batch upload all todos
  process.stdout.write(chalk.yellow('\nStep 3: Batch uploading all todos to Walrus...') + '\n');
  process.stdout.write(chalk.cyan('Using mock mode for demonstration (no real WAL tokens required)') + '\n');
  
  // Run batch upload with custom batch size
  const batchCmd = `waltodo store --all --list ${listName} --batch-size 3 --mock`;
  runCommand(batchCmd);

  // Show final status
  logger.info(chalk.yellow('\nStep 4: Checking final status...'));
  runCommand(`waltodo list ${listName} --detailed`);

  logger.info(chalk.green.bold('\n✅ Batch Upload Demo Complete!\n'));
  logger.info(chalk.white('Key features demonstrated:'));
  logger.info(chalk.white('  • Created multiple todos with different attributes'));
  logger.info(chalk.white('  • Uploaded all todos in batch with progress tracking'));
  logger.info(chalk.white('  • Used custom batch size for concurrent uploads'));
  logger.info(chalk.white('  • Showed cache optimization and upload statistics'));
  
  logger.info(chalk.cyan('\nTry it yourself:'));
  logger.info(chalk.white(`  waltodo store --all --list ${listName} --batch-size 5`));
  logger.info(chalk.white(`  waltodo store --all --list ${listName} --network mainnet`));
  logger.info(chalk.white(`  waltodo store --all --list ${listName} --epochs 10`));
}

// Run the demo
runBatchUploadDemo().catch(error => {
  logger.error(chalk.red('Demo failed:'), error);
  process.exit(1);
});