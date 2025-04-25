#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { CLI_CONFIG } from './constants';

const program = new Command();

program
  .name(CLI_CONFIG.APP_NAME)
  .description('A CLI todo application using Sui blockchain and Walrus storage')
  .version(CLI_CONFIG.VERSION);

program
  .command('add')
  .description('Add a new todo item')
  .option('-l, --list <name>', 'name of the todo list')
  .option('-t, --task <description>', 'task description')
  .option('-p, --priority <level>', 'priority level (high|medium|low)')
  .option('-d, --due <date>', 'due date (YYYY-MM-DD)')
  .option('--tags <tags>', 'comma-separated tags')
  .option('--encrypt', 'encrypt this todo item using the Seal protocol')
  .option('--private', 'mark todo as private (stored locally only)')
  .action(async (options) => {
    try {
      const { add } = await import('./commands/add');
      await add(options);
    } catch (error) {
      console.error(chalk.red('Error adding todo:'), error);
    }
  });

program
  .command('list')
  .description('List all todos')
  .option('-l, --list <name>', 'filter by list name')
  .option('--completed', 'show only completed items')
  .option('--pending', 'show only pending items')
  .option('--encrypted', 'show encrypted items (requires authentication)')
  .action(async (options) => {
    try {
      const { list } = await import('./commands/list');
      await list(options);
    } catch (error) {
      console.error(chalk.red('Error listing todos:'), error);
    }
  });

program
  .command('update')
  .description('Update a todo item')
  .requiredOption('-l, --list <name>', 'name of the todo list')
  .requiredOption('-i, --id <id>', 'id of the todo')
  .option('-t, --task <description>', 'new task description')
  .option('-p, --priority <level>', 'new priority level (high|medium|low)')
  .option('-d, --due <date>', 'new due date (YYYY-MM-DD)')
  .option('--tags <tags>', 'new comma-separated tags')
  .action(async (options) => {
    try {
      const { update } = await import('./commands/update');
      await update(options);
    } catch (error) {
      console.error(chalk.red('Error updating todo:'), error);
    }
  });

program
  .command('complete')
  .description('Mark a todo as complete')
  .requiredOption('-l, --list <name>', 'name of the todo list')
  .requiredOption('-i, --id <id>', 'id of the todo')
  .action(async (options) => {
    try {
      const { complete } = await import('./commands/complete');
      await complete(options);
    } catch (error) {
      console.error(chalk.red('Error completing todo:'), error);
    }
  });

program
  .command('delete')
  .description('Delete a todo item')
  .requiredOption('-l, --list <name>', 'name of the todo list')
  .requiredOption('-i, --id <id>', 'id of the todo')
  .option('-f, --force', 'skip confirmation prompt')
  .action(async (options) => {
    try {
      const { deleteTodo } = await import('./commands/delete');
      await deleteTodo(options);
    } catch (error) {
      console.error(chalk.red('Error deleting todo:'), error);
    }
  });

program
  .command('configure')
  .description('Configure blockchain connection and wallet settings')
  .action(async () => {
    try {
      const { configure } = await import('./commands/configure');
      await configure();
    } catch (error) {
      console.error(chalk.red('Error configuring:'), error);
    }
  });

program
  .command('publish')
  .description('Publish list to blockchain')
  .requiredOption('-l, --list <name>', 'name of the todo list')
  .action(async (options) => {
    try {
      const { publish } = await import('./commands/publish');
      await publish(options);
    } catch (error) {
      console.error(chalk.red('Error publishing list:'), error);
    }
  });

program
  .command('sync')
  .description('Sync with blockchain state')
  .requiredOption('-l, --list <name>', 'name of the todo list')
  .action(async (options) => {
    try {
      const { sync } = await import('./commands/sync');
      await sync(options);
    } catch (error) {
      console.error(chalk.red('Error syncing:'), error);
    }
  });

program.parse();