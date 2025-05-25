/**
import { Logger } from '../src/utils/Logger';

const logger = new Logger('update-ai-service-imports');
 * Update AI Service Imports Script
 * 
 * This script updates any imports in the codebase that still reference
 * the old aiService.ts or AIService.ts files to use the new
 * consolidated implementation instead.
 */

const fs = require('fs');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

// Find all TypeScript and JavaScript files that import the old AI service files
async function findFilesWithOldImports() {
  logger.info('Searching for files with old AI service imports...');

  try {
    // Find files importing aiService.ts
    const { stdout: aiServiceFiles } = await exec(
      'grep -r "from .*aiService" --include="*.ts" --include="*.js" --exclude-dir="node_modules" --exclude-dir="dist" .'
    );

    // Find files importing AIService.ts
    const { stdout: enhancedServiceFiles } = await exec(
      'grep -r "from .*AIService" --include="*.ts" --include="*.js" --exclude-dir="node_modules" --exclude-dir="dist" .'
    );

    // Process and deduplicate results
    const allFiles = new Set();

    // Extract file paths from grep results
    const processGrepOutput = output => {
      return output
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.split(':')[0])
        .filter(filePath => !filePath.includes('AIService.consolidated.ts'));
    };

    processGrepOutput(aiServiceFiles).forEach(file => allFiles.add(file));
    processGrepOutput(enhancedServiceFiles).forEach(file => allFiles.add(file));

    return Array.from(allFiles);
  } catch (error) {
    if (error.stderr) {
      // grep returns error when no matches found, which is fine
      return [];
    }
    throw error;
  }
}

// Update imports in a file
function updateImports(filePath) {
  logger.info(`Updating imports in ${filePath}...`);

  let content = fs.readFileSync(filePath, 'utf8');
  let updated = false;

  // Replace import patterns for aiService.ts
  const aiServicePattern = /from ['"](.*)aiService['"]/g;
  content = content.replace(aiServicePattern, (match, prefix) => {
    if (match.includes('AIService.consolidated')) return match;
    updated = true;
    return `from '${prefix}AIService.consolidated'`;
  });

  // Replace import patterns for AIService.ts
  const enhancedPattern = /from ['"](.*)AIService['"]/g;
  content = content.replace(enhancedPattern, (match, prefix) => {
    if (match.includes('AIService.consolidated')) return match;
    updated = true;
    return `from '${prefix}AIService.consolidated'`;
  });

  // Update AIService class references to AIService
  if (content.includes('AIService')) {
    content = content.replace(/AIService/g, 'AIService');
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(filePath, content);
    return true;
  }

  return false;
}

// Main function
async function main() {
  logger.info('Starting update of AI Service imports...');

  try {
    // Find files with old imports
    const filesToUpdate = await findFilesWithOldImports();

    if (filesToUpdate.length === 0) {
      logger.info('No files found with old AI Service imports.');
      return;
    }

    logger.info(`Found ${filesToUpdate.length} files to update:`);
    filesToUpdate.forEach(file => logger.info(`  - ${file}`));

    // Update each file
    let updatedCount = 0;
    for (const file of filesToUpdate) {
      if (updateImports(file)) {
        updatedCount++;
      }
    }

    logger.info(`\nUpdated imports in ${updatedCount} files.`);
    logger.info('\nNext steps:');
    logger.info('1. Run the typechecker to verify the changes');
    logger.info('2. Run tests to ensure functionality is maintained');
  } catch (error) {
    logger.error('Error updating imports:', error);
    process.exit(1);
  }
}

// Run the script
main();
