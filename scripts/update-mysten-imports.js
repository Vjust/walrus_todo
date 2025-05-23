#!/usr/bin/env node
import { Logger } from '../src/utils/Logger';

const logger = new Logger('update-mysten-imports');

const fs = require('fs');
const path = require('path');
const { glob } = require('glob'); // Updated for glob v11

function updateImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Replace all @mysten/sui imports with @mysten/sui
    content = content.replace(/@mysten\/sui\.js/g, '@mysten/sui');
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      logger.info(`Updated imports in: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`Error processing ${filePath}:`, error);
    return false;
  }
}

function findAndUpdateFiles() {
  const patterns = [
    'src/**/*.{ts,tsx,js,jsx}',
    'tests/**/*.{ts,tsx,js,jsx}',
    'packages/**/*.{ts,tsx,js,jsx}',
    'scripts/**/*.{ts,tsx,js,jsx}',
  ];
  
  let totalFiles = 0;
  let updatedFiles = 0;
  
  patterns.forEach(async pattern => {
    const files = await glob(pattern, { nodir: true });
    
    files.forEach(file => {
      totalFiles++;
      if (updateImportsInFile(file)) {
        updatedFiles++;
      }
    });
  });
  
  logger.info(`\nProcessed ${totalFiles} files`);
  logger.info(`Updated ${updatedFiles} files`);
}

async function main() {
  logger.info('Updating @mysten/sui imports to @mysten/sui...');
  await findAndUpdateFiles();
  logger.info('Done!');
}

main().catch(console.error);