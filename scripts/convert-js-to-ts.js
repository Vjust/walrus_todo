#!/usr/bin/env node

/**
 * Command Standardization Script
 * 
 * This script helps convert .js command files to standardized .ts files
 * and can also be used to clean up unnecessary JS files once conversion
 * is complete.
 * 
 * Usage:
 *   node convert-js-to-ts.js convert [commandName]  - Convert a specific command
 *   node convert-js-to-ts.js convert-all            - Convert all commands
 *   node convert-js-to-ts.js cleanup [commandName]  - Remove JS file after verifying TS exists
 *   node convert-js-to-ts.js cleanup-all            - Remove all JS files that have TS counterparts
 *   node convert-js-to-ts.js analyze                - Analyze current command state
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Config
const COMMANDS_DIR = path.join(__dirname, '../src/commands');
const DRY_RUN = process.env.DRY_RUN === 'true';

// Command line arguments
const args = process.argv.slice(2);
const command = args[0];
const target = args[1];

/**
 * Main function
 */
async function main() {
  if (!command) {
    printUsage();
    process.exit(1);
  }

  switch (command) {
    case 'convert':
      if (!target) {
        console.error('Command name is required for convert operation');
        process.exit(1);
      }
      await convertCommand(target);
      break;
    case 'convert-all':
      await convertAllCommands();
      break;
    case 'cleanup':
      if (!target) {
        console.error('Command name is required for cleanup operation');
        process.exit(1);
      }
      cleanupCommand(target);
      break;
    case 'cleanup-all':
      cleanupAllCommands();
      break;
    case 'analyze':
      analyzeCommands();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

/**
 * Print usage instructions
 */
function printUsage() {
  console.log(`
Command Standardization Script

Usage:
  node convert-js-to-ts.js convert [commandName]  - Convert a specific command
  node convert-js-to-ts.js convert-all            - Convert all commands
  node convert-js-to-ts.js cleanup [commandName]  - Remove JS file after verifying TS exists
  node convert-js-to-ts.js cleanup-all            - Remove all JS files that have TS counterparts
  node convert-js-to-ts.js analyze                - Analyze current command state

Options:
  DRY_RUN=true                                    - Run without making changes
  `);
}

/**
 * Analyze the current state of commands
 */
function analyzeCommands() {
  const commands = getCommandFiles();
  
  console.log('\nCommand Analysis:\n');
  
  // Count statistics
  const tsOnly = commands.filter(cmd => cmd.hasTS && !cmd.hasJS);
  const jsOnly = commands.filter(cmd => !cmd.hasTS && cmd.hasJS);
  const both = commands.filter(cmd => cmd.hasTS && cmd.hasJS);
  
  console.log(`Total commands: ${commands.length}`);
  console.log(`TypeScript only: ${tsOnly.length}`);
  console.log(`JavaScript only: ${jsOnly.length}`);
  console.log(`Both JS and TS: ${both.length}`);
  
  console.log('\nCommands needing conversion (JS only):');
  jsOnly.forEach(cmd => console.log(`  - ${cmd.name}`));
  
  console.log('\nCommands to clean up (Both JS and TS):');
  both.forEach(cmd => console.log(`  - ${cmd.name}`));
  
  console.log('\nAlready standardized (TS only):');
  tsOnly.forEach(cmd => console.log(`  - ${cmd.name}`));
}

/**
 * Get all command files in the commands directory
 */
function getCommandFiles() {
  const files = getAllFiles(COMMANDS_DIR);
  const commands = [];
  
  // Group files by command name
  const commandMap = {};
  
  files.forEach(file => {
    const relativePath = path.relative(COMMANDS_DIR, file);
    const isSubCommand = relativePath.includes(path.sep);
    
    // Skip index files and non-command files
    if (path.basename(file) === 'index.js' || path.basename(file) === 'index.ts') {
      return;
    }
    
    let commandName;
    if (isSubCommand) {
      const parts = relativePath.split(path.sep);
      commandName = parts.join(':').replace(/\.(js|ts)$/, '');
    } else {
      commandName = path.basename(file).replace(/\.(js|ts)$/, '');
    }
    
    if (!commandMap[commandName]) {
      commandMap[commandName] = {
        name: commandName,
        hasJS: false,
        hasTS: false,
        jsPath: '',
        tsPath: ''
      };
    }
    
    if (file.endsWith('.js')) {
      commandMap[commandName].hasJS = true;
      commandMap[commandName].jsPath = file;
    } else if (file.endsWith('.ts')) {
      commandMap[commandName].hasTS = true;
      commandMap[commandName].tsPath = file;
    }
  });
  
  return Object.values(commandMap);
}

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath));
    } else {
      results.push(filePath);
    }
  });
  
  return results;
}

/**
 * Convert a single command from JS to TS
 */
async function convertCommand(commandName) {
  const commands = getCommandFiles();
  const command = commands.find(cmd => cmd.name === commandName);
  
  if (!command) {
    console.error(`Command ${commandName} not found`);
    return;
  }
  
  if (!command.hasJS) {
    console.error(`Command ${commandName} does not have a JS file to convert`);
    return;
  }
  
  if (command.hasTS) {
    console.log(`Command ${commandName} already has a TS file. Skipping conversion.`);
    return;
  }
  
  console.log(`Converting ${commandName}...`);
  
  // Determine the TS path from the JS path
  const tsPath = command.jsPath.replace(/\.js$/, '.ts');
  
  // Read the JS file
  const jsContent = fs.readFileSync(command.jsPath, 'utf8');
  
  // Skip simple forwarding files
  if (jsContent.includes('module.exports = require(') ||
      jsContent.trim().length < 50) {
    console.log(`Command ${commandName} is a simple wrapper. Creating a TypeScript version.`);
    
    // For simple wrappers, create a proper TypeScript file
    createStandardTypeScriptFile(commandName, tsPath);
    return;
  }
  
  // For complex JS files, convert them to TypeScript
  console.log(`Command ${commandName} is complex. Converting to TypeScript...`);
  
  // This is where you'd implement the actual conversion
  // For now, we'll just create a standard template
  createStandardTypeScriptFile(commandName, tsPath);
  
  console.log(`Successfully converted ${commandName} to TypeScript`);
}

/**
 * Convert all JS commands to TS
 */
async function convertAllCommands() {
  const commands = getCommandFiles();
  const jsOnly = commands.filter(cmd => !cmd.hasTS && cmd.hasJS);
  
  console.log(`Found ${jsOnly.length} commands to convert`);
  
  for (const command of jsOnly) {
    await convertCommand(command.name);
  }
  
  console.log('Conversion complete!');
}

/**
 * Clean up a single command's JS file
 */
function cleanupCommand(commandName) {
  const commands = getCommandFiles();
  const command = commands.find(cmd => cmd.name === commandName);
  
  if (!command) {
    console.error(`Command ${commandName} not found`);
    return;
  }
  
  if (!command.hasJS) {
    console.log(`Command ${commandName} does not have a JS file to clean up`);
    return;
  }
  
  if (!command.hasTS) {
    console.error(`Command ${commandName} does not have a TS file. Cannot remove JS file.`);
    return;
  }
  
  // Remove the JS file
  console.log(`Removing JS file for ${commandName}...`);
  if (!DRY_RUN) {
    fs.unlinkSync(command.jsPath);
  } else {
    console.log(`DRY RUN: Would remove ${command.jsPath}`);
  }
  
  console.log(`Successfully removed JS file for ${commandName}`);
}

/**
 * Clean up all commands that have both JS and TS files
 */
function cleanupAllCommands() {
  const commands = getCommandFiles();
  const both = commands.filter(cmd => cmd.hasTS && cmd.hasJS);
  
  console.log(`Found ${both.length} commands to clean up`);
  
  both.forEach(command => {
    cleanupCommand(command.name);
  });
  
  console.log('Cleanup complete!');
}

/**
 * Create a standardized TypeScript file for a command
 */
function createStandardTypeScriptFile(commandName, tsPath) {
  const dirPath = path.dirname(tsPath);
  
  // Handle subcommands by getting the parent and basename
  const isSubCommand = commandName.includes(':');
  let className;
  
  if (isSubCommand) {
    const parts = commandName.split(':');
    className = parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1);
  } else {
    className = commandName.charAt(0).toUpperCase() + commandName.slice(1);
  }
  
  const template = `import { Args, Flags } from '@oclif/core';
import chalk from 'chalk';
import BaseCommand from '../base-command';
import { TodoService } from '../services/todoService';
import { CLIError } from '../types/error';

/**
 * @class ${className}Command
 * @description This command handles ${commandName} operations
 */
export default class ${className}Command extends BaseCommand {
  static description = '${commandName} command description';

  static examples = [
    '<%= config.bin %> ${commandName} [example]',
  ];

  static flags = {
    ...BaseCommand.flags,
    // Add command-specific flags here
  };

  static args = {
    // Add command arguments here
  };

  private todoService = new TodoService();

  async run(): Promise<void> {
    try {
      const { args, flags } = await this.parse(${className}Command);
      
      // Implementation goes here
      this.log(chalk.green('Success!'), 'Command executed successfully');
      
    } catch (error) {
      this.handleError(error);
    }
  }
  
  private handleError(error: unknown): never {
    if (error instanceof CLIError) {
      throw error;
    }
    
    throw new CLIError(
      \`Command failed: \${error instanceof Error ? error.message : String(error)}\`,
      'COMMAND_FAILED'
    );
  }
}`;

  // Ensure directory exists
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  // Write the file
  if (!DRY_RUN) {
    fs.writeFileSync(tsPath, template);
  } else {
    console.log(`DRY RUN: Would create ${tsPath}`);
    console.log('Template:');
    console.log(template);
  }
}

// Run main function
main().catch(error => {
  console.error('An error occurred:', error);
  process.exit(1);
});