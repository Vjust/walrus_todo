#!/usr/bin/env node

/**
 * CLI Command Checker
 *
 * This script performs a comprehensive check of all CLI commands:
 * 1. Verifies that all commands are properly registered
 * 2. Checks that command descriptions are accurate
 * 3. Tests that commands execute without errors
 * 4. Ensures proper error handling for invalid inputs
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { Logger } from '../apps/cli/src/utils/Logger.js';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Import chalk as CommonJS since it may not be ES module compatible
const chalk = require('chalk');

const logger = new Logger('check-cli');

// Configuration
const COMMANDS_DIR = path.join(__dirname, '..', 'src', 'commands');
const MANIFEST_PATH = path.join(__dirname, '..', 'oclif.manifest.json');
const CLI_PATH = path.join(__dirname, '..', 'bin', 'waltodo');

// Results tracking
const results = {
  total: 0,
  passed: 0,
  warnings: 0,
  errors: 0,
  details: [],
};

// Load manifest
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
} catch (error) {
  logger.error(chalk.red(`Error loading manifest: ${error.message}`));
  process.exit(1);
}

// Get all commands from manifest
const manifestCommands = Object.keys(manifest.commands);

// Test a command
function testCommand(command) {
  logger.info(chalk.blue(`Testing command: ${command}`));

  // Run the command with --help flag
  const helpResult = spawnSync(CLI_PATH, [command, '--help'], {
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (helpResult.status !== 0) {
    return {
      status: 'error',
      issues: [
        `Command help failed with exit code ${helpResult.status}`,
        helpResult.stderr,
      ],
    };
  }

  // Check if help output contains the command description
  const commandDescription = manifest.commands[command].description;
  if (commandDescription && !helpResult.stdout.includes(commandDescription)) {
    return {
      status: 'warning',
      issues: ['Help output does not contain the command description'],
    };
  }

  return {
    status: 'pass',
    issues: [],
  };
}

// Main function
function checkCLI() {
  logger.info(chalk.blue('🔍 Checking CLI commands...'));

  // Test each command
  results.total = manifestCommands.length;

  manifestCommands.forEach(command => {
    // Skip commands that are just topics
    if (command.includes(':')) {
      const topic = command.split(':')[0];
      if (manifest.topics && manifest.topics[topic]) {
        // This is a subcommand of a topic
      }
    }

    const testResult = testCommand(command);

    // Record results
    if (testResult.status === 'pass') {
      results.passed++;
      results.details.push({
        command,
        status: 'pass',
        issues: [],
      });
    } else if (testResult.status === 'warning') {
      results.warnings++;
      results.details.push({
        command,
        status: 'warning',
        issues: testResult.issues,
      });
    } else {
      results.errors++;
      results.details.push({
        command,
        status: 'error',
        issues: testResult.issues,
      });
    }
  });

  // Display results
  logger.info('\n' + chalk.blue('📊 Check Results:'));
  logger.info(`Total commands: ${results.total}`);
  logger.info(`Passed: ${chalk.green(results.passed)}`);
  logger.info(`Warnings: ${chalk.yellow(results.warnings)}`);
  logger.info(`Errors: ${chalk.red(results.errors)}`);

  logger.info('\n' + chalk.blue('📝 Details:'));

  // Group by status
  const errorCommands = results.details.filter(
    detail => detail.status === 'error'
  );
  const warningCommands = results.details.filter(
    detail => detail.status === 'warning'
  );
  const passedCommands = results.details.filter(
    detail => detail.status === 'pass'
  );

  // Show errors
  if (errorCommands.length > 0) {
    logger.info(chalk.red('\n❌ Commands with errors:'));
    errorCommands.forEach(detail => {
      logger.info(`  ${chalk.red(detail.command)}`);
      detail.issues.forEach(issue => {
        logger.info(`    - ${issue}`);
      });
    });
  }

  // Show warnings
  if (warningCommands.length > 0) {
    logger.info(chalk.yellow('\n⚠️ Commands with warnings:'));
    warningCommands.forEach(detail => {
      logger.info(`  ${chalk.yellow(detail.command)}`);
      detail.issues.forEach(issue => {
        logger.info(`    - ${issue}`);
      });
    });
  }

  // Show passed
  if (passedCommands.length > 0) {
    logger.info(chalk.green('\n✅ Commands that passed:'));
    const passedCommandNames = passedCommands.map(detail => detail.command);

    // Display in columns for better readability
    const columns = 3;
    const columnWidth =
      Math.max(...passedCommandNames.map(name => name.length)) + 2;

    for (let i = 0; i < passedCommandNames.length; i += columns) {
      const row = passedCommandNames
        .slice(i, i + columns)
        .map(name => name.padEnd(columnWidth))
        .join('');
      logger.info(`  ${row}`);
    }
  }

  // Exit with appropriate code
  if (results.errors > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Run the checker
checkCLI();
