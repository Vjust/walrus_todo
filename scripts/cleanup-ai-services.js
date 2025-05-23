#!/usr/bin/env node
import { Logger } from '../src/utils/Logger';

const logger = new Logger('cleanup-ai-services');

/**
 * AI Service Consolidation Script
 * 
 * This script helps clean up duplicated AI service files in the codebase.
 * It removes duplicate AIVerificationService files and updates imports.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Config
const AI_SERVICES_DIR = path.join(__dirname, '../src/services/ai');
const DRY_RUN = process.env.DRY_RUN === 'true';

/**
 * Main function
 */
async function main() {
  logger.info('Starting AI Service consolidation...');
  
  // 1. Remove duplicate AIVerificationService files
  cleanupVerificationServices();
  
  // 2. Update imports in any files that reference the removed files
  updateImports();
  
  logger.info('Consolidation complete!');
}

/**
 * Cleanup duplicate verification service files
 */
function cleanupVerificationServices() {
  logger.info('\nCleaning up duplicate verification service files...');
  
  // Get all AIVerificationService files
  const verificationFiles = fs.readdirSync(AI_SERVICES_DIR)
    .filter(file => file.includes('AIVerificationService') || file.includes('aiVerificationService'))
    .map(file => path.join(AI_SERVICES_DIR, file));
  
  logger.info(`Found ${verificationFiles.length} verification service files:`);
  verificationFiles.forEach(file => logger.info(`  - ${path.basename(file)}`));
  
  // Keep the PascalCase version (AIVerificationService.ts) and remove the rest
  const fileToKeep = path.join(AI_SERVICES_DIR, 'AIVerificationService.ts');
  
  if (!fs.existsSync(fileToKeep)) {
    logger.error(`Error: The file to keep (${fileToKeep}) does not exist!`);
    process.exit(1);
  }
  
  // Remove all other files
  for (const file of verificationFiles) {
    if (file !== fileToKeep) {
      logger.info(`Removing ${path.basename(file)}...`);
      
      if (!DRY_RUN) {
        // Backup the file first
        const backupDir = path.join(__dirname, '../backup/ai');
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const backupFile = path.join(backupDir, path.basename(file));
        fs.copyFileSync(file, backupFile);
        logger.info(`  Backed up to ${backupFile}`);
        
        // Remove the file
        fs.unlinkSync(file);
        logger.info(`  Removed ${path.basename(file)}`);
      } else {
        logger.info(`  DRY RUN: Would remove ${path.basename(file)}`);
      }
    }
  }
}

/**
 * Update imports in files that reference the removed files
 */
function updateImports() {
  logger.info('\nUpdating imports...');
  
  // Find all TypeScript files that import aiVerificationService or AIVerificationService with a version number
  try {
    // Find files that import aiVerificationService
    let grepCommand = `grep -r "from './aiVerificationService'" ${path.join(__dirname, '../src')} --include="*.ts"`;
    let files = execSync(grepCommand, { encoding: 'utf8' }).trim().split('\n');
    
    // Also find files that import AIVerificationService with a version number
    grepCommand = `grep -r "from './AIVerificationService [23]'" ${path.join(__dirname, '../src')} --include="*.ts"`;
    try {
      const moreFiles = execSync(grepCommand, { encoding: 'utf8' }).trim().split('\n');
      if (moreFiles[0] !== '') {
        files = files.concat(moreFiles);
      }
    } catch (error) {
      // No matches
    }
    
    // Skip empty results
    if (files.length === 1 && files[0] === '') {
      logger.info('No imports to update');
      return;
    }
    
    logger.info(`Found ${files.length} files with imports to update:`);
    
    // Update each file
    for (const fileInfo of files) {
      const [filePath] = fileInfo.split(':');
      logger.info(`  Updating imports in ${path.basename(filePath)}...`);
      
      if (!DRY_RUN) {
        // Read the file
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Replace imports
        const updatedContent = content
          .replace(/from ['"]\.\/aiVerificationService['"]/g, 'from \'./AIVerificationService\'')
          .replace(/from ['"]\.\/AIVerificationService [23]['"]/g, 'from \'./AIVerificationService\'');
        
        // Write the file
        fs.writeFileSync(filePath, updatedContent);
        logger.info(`    Updated imports in ${path.basename(filePath)}`);
      } else {
        logger.info(`    DRY RUN: Would update imports in ${path.basename(filePath)}`);
      }
    }
  } catch (error) {
    // No matches
    logger.info('No imports to update');
  }
}

// Run main function
main().catch(error => {
  logger.error('An error occurred:', error);
  process.exit(1);
});