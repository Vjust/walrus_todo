#!/usr/bin/env node

/**
 * Fix Command Descriptions
 * 
 * This script updates the command descriptions in the manifest file
 * by extracting them from the command source files.
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Configuration
const COMMANDS_DIR = path.join(__dirname, '..', 'src', 'commands');
const MANIFEST_PATH = path.join(__dirname, '..', 'oclif.manifest.json');

// Load manifest
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
} catch (error) {
  console.error(chalk.red(`Error loading manifest: ${error.message}`));
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

// Extract description from command file
function extractDescription(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Look for static description
    const descriptionMatch = content.match(/static description\s*=\s*['"](.+?)['"]/);
    if (descriptionMatch && descriptionMatch[1]) {
      return descriptionMatch[1];
    }
    
    // Look for class JSDoc description
    const jsdocMatch = content.match(/@description\s+(.+?)(\n\s*\*\/|\n\s*\*\s+@)/);
    if (jsdocMatch && jsdocMatch[1]) {
      return jsdocMatch[1].trim();
    }
    
    return null;
  } catch (error) {
    console.error(chalk.yellow(`Warning: Could not read file ${filePath}: ${error.message}`));
    return null;
  }
}

// Main function
function fixCommandDescriptions() {
  console.log(chalk.blue('🔧 Fixing command descriptions in manifest...'));
  
  // Get all command files
  const commandFiles = getCommandFiles(COMMANDS_DIR);
  let updatedCount = 0;
  
  // Process each command
  commandFiles.forEach(commandFile => {
    // Skip if command is not in manifest
    if (!manifest.commands[commandFile.fullName]) {
      console.log(chalk.yellow(`Warning: Command ${commandFile.fullName} not found in manifest`));
      return;
    }
    
    // Extract description from command file
    const description = extractDescription(commandFile.path);
    if (!description) {
      console.log(chalk.yellow(`Warning: Could not extract description for ${commandFile.fullName}`));
      return;
    }
    
    // Update manifest if description is different
    const currentDescription = manifest.commands[commandFile.fullName].description;
    if (currentDescription !== description && 
        (currentDescription === `${commandFile.fullName} command` || 
         !currentDescription || 
         currentDescription.length < 10)) {
      manifest.commands[commandFile.fullName].description = description;
      updatedCount++;
      console.log(chalk.green(`Updated description for ${commandFile.fullName}`));
    }
  });
  
  // Save manifest if changes were made
  if (updatedCount > 0) {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    console.log(chalk.green(`✅ Updated ${updatedCount} command descriptions in manifest`));
  } else {
    console.log(chalk.blue('ℹ️ No command descriptions needed updating'));
  }
}

// Run the fixer
fixCommandDescriptions();
