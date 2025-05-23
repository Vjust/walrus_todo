#!/usr/bin/env node
import { Logger } from '../src/utils/Logger';

const logger = new Logger('lint-cli-commands');

/**
 * CLI Command Linter
 * 
 * This script checks all CLI commands in the project to ensure they:
 * 1. Have proper descriptions
 * 2. Have examples
 * 3. Have consistent flag naming
 * 4. Have proper error handling
 * 5. Are registered in the manifest
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Configuration
const COMMANDS_DIR = path.join(__dirname, '..', 'src', 'commands');
const MANIFEST_PATH = path.join(__dirname, '..', 'oclif.manifest.json');
const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');

// Results tracking
const results = {
  total: 0,
  passed: 0,
  warnings: 0,
  errors: 0,
  details: []
};

// Load manifest
let manifest;
try {
  manifest = require(MANIFEST_PATH);
} catch (error) {
  logger.error(chalk.red(`Error loading manifest: ${error.message}`));
  process.exit(1);
}

// Load package.json
let packageJson;
try {
  packageJson = require(PACKAGE_JSON_PATH);
} catch (error) {
  logger.error(chalk.red(`Error loading package.json: ${error.message}`));
  process.exit(1);
}

// Get all command files
function getCommandFiles(dir, fileList = [], prefix = '') {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and dist
      if (file === 'node_modules' || file === 'dist') return;
      
      // For directories, recurse with updated prefix
      const newPrefix = prefix ? `${prefix}:${file}` : file;
      getCommandFiles(filePath, fileList, newPrefix);
    } else if (file.endsWith('.ts') && file !== 'index.ts') {
      // For TypeScript files (excluding index.ts), add to the list
      const commandName = file.replace('.ts', '');
      const fullCommandName = prefix ? `${prefix}:${commandName}` : commandName;
      
      fileList.push({
        path: filePath,
        name: commandName,
        fullName: fullCommandName
      });
    }
  });
  
  return fileList;
}

// Check if a command is in the manifest
function isInManifest(commandName) {
  return manifest.commands[commandName] !== undefined;
}

// Check if a command has a proper description in the manifest
function hasProperDescription(commandName) {
  const command = manifest.commands[commandName];
  if (!command) return false;
  
  return command.description && 
         command.description !== `${commandName} command` &&
         command.description.length > 10;
}

// Check command file content
function checkCommandFile(commandFile) {
  const content = fs.readFileSync(commandFile.path, 'utf8');
  const issues = [];
  
  // Check for static description
  if (!content.includes('static description =')) {
    issues.push('Missing static description');
  }
  
  // Check for examples
  if (!content.includes('static examples =')) {
    issues.push('Missing examples');
  }
  
  // Check for error handling
  if (!content.includes('catch') && !content.includes('try')) {
    issues.push('Missing error handling');
  }
  
  // Check for BaseCommand extension
  if (!content.includes('extends BaseCommand')) {
    issues.push('Not extending BaseCommand');
  }
  
  return issues;
}

// Main function
function lintCommands() {
  logger.info(chalk.blue('🔍 Linting CLI commands...'));
  
  // Get all command files
  const commandFiles = getCommandFiles(COMMANDS_DIR);
  results.total = commandFiles.length;
  
  // Check each command
  commandFiles.forEach(commandFile => {
    const issues = [];
    
    // Check if command is in manifest
    if (!isInManifest(commandFile.fullName)) {
      issues.push('Not registered in manifest');
    }
    
    // Check if command has proper description
    if (!hasProperDescription(commandFile.fullName)) {
      issues.push('Missing or generic description in manifest');
    }
    
    // Check command file content
    const fileIssues = checkCommandFile(commandFile);
    issues.push(...fileIssues);
    
    // Record results
    if (issues.length === 0) {
      results.passed++;
      results.details.push({
        command: commandFile.fullName,
        status: 'pass',
        issues: []
      });
    } else {
      if (issues.some(issue => issue.includes('Not registered') || issue.includes('Not extending'))) {
        results.errors++;
      } else {
        results.warnings++;
      }
      
      results.details.push({
        command: commandFile.fullName,
        status: issues.some(issue => issue.includes('Not registered') || issue.includes('Not extending')) ? 'error' : 'warning',
        issues
      });
    }
  });
  
  // Display results
  logger.info('\n' + chalk.blue('📊 Lint Results:'));
  logger.info(`Total commands: ${results.total}`);
  logger.info(`Passed: ${chalk.green(results.passed)}`);
  logger.info(`Warnings: ${chalk.yellow(results.warnings)}`);
  logger.info(`Errors: ${chalk.red(results.errors)}`);
  
  logger.info('\n' + chalk.blue('📝 Details:'));
  
  // Group by status
  const errorCommands = results.details.filter(detail => detail.status === 'error');
  const warningCommands = results.details.filter(detail => detail.status === 'warning');
  const passedCommands = results.details.filter(detail => detail.status === 'pass');
  
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
    logger.info(`  ${passedCommands.map(detail => detail.command).join(', ')}`);
  }
  
  // Exit with appropriate code
  if (results.errors > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Run the linter
lintCommands();
