/**
 * Migration script for transitioning to the consolidated error handling framework
 * 
 * This script:
 * 1. Analyzes the codebase for error-related imports and usage
 * 2. Creates a report of files that need to be updated
 * 3. Optionally applies automated migrations for simple cases
 */

const fs = require('fs');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

// Configuration
const SRC_DIR = path.join(process.cwd(), 'src');
const OLD_ERROR_IMPORTS = [
  // Old import patterns to search for
  'from \'../types/error\'',
  'from \'../../types/error\'',
  'from \'../../../types/error\'',
  'from \'../../../../types/error\'',
  'from \'../types/errors\'',
  'from \'../../types/errors\'',
  'from \'../../../types/errors\'',
  'from \'../../../../types/errors\'',
  'from \'../types/errors/BaseError\'',
  'from \'../../types/errors/BaseError\'',
  'from \'../../../types/errors/BaseError\'',
  'from \'../types/errors/ValidationError\'',
  'from \'../../types/errors/ValidationError\'',
  'from \'../types/errors/PathValidationError\'',
  'from \'../utils/error-handler\'',
  'from \'../../utils/error-handler\'',
  'from \'../../../utils/error-handler\'',
];

// Report structure
const migrationReport = {
  filesToUpdate: [],
  errorUsage: {
    CLIError: new Set(),
    ValidationError: new Set(),
    WalrusError: new Set(),
    BaseError: new Set(),
    handleError: new Set(),
    withRetry: new Set(),
    // Other error types
  }
};

/**
 * Find files with old error imports
 */
async function findFilesWithOldErrorImports() {
  console.log('Searching for files with old error imports...');
  
  const filesWithImports = new Set();
  
  for (const importPattern of OLD_ERROR_IMPORTS) {
    try {
      const { stdout } = await exec(`grep -r "${importPattern}" ${SRC_DIR} --include="*.ts" --include="*.js"`);
      
      // Extract file paths from grep output
      stdout.split('\n')
        .filter(line => line.trim())
        .forEach(line => {
          const filePath = line.split(':')[0];
          filesWithImports.add(filePath);
        });
    } catch (error) {
      // grep returns non-zero exit code when no matches are found
      if (error.stderr) {
        console.error(`Error searching for pattern ${importPattern}:`, error.stderr);
      }
    }
  }
  
  return Array.from(filesWithImports);
}

/**
 * Find error class usage in files
 */
async function findErrorClassUsage() {
  console.log('Analyzing error class usage...');
  
  // Error classes to search for
  const errorClasses = [
    'CLIError',
    'ValidationError',
    'WalrusError',
    'BaseError',
    'BlockchainError',
    'StorageError',
    'NetworkError',
    'TransactionError',
    'handleError',
    'withRetry'
  ];
  
  for (const errorClass of errorClasses) {
    try {
      const { stdout } = await exec(`grep -r "\\b${errorClass}\\b" ${SRC_DIR} --include="*.ts" --include="*.js"`);
      
      // Extract file paths from grep output
      stdout.split('\n')
        .filter(line => line.trim())
        .forEach(line => {
          const filePath = line.split(':')[0];
          
          // Skip error definition files
          if (
            filePath.includes('/types/error.ts') ||
            filePath.includes('/types/errors.ts') ||
            filePath.includes('/types/errors/') ||
            filePath.includes('/utils/error-handler.ts')
          ) {
            return;
          }
          
          if (migrationReport.errorUsage[errorClass]) {
            migrationReport.errorUsage[errorClass].add(filePath);
          } else {
            migrationReport.errorUsage[errorClass] = new Set([filePath]);
          }
          
          // Add to overall files to update
          migrationReport.filesToUpdate.push(filePath);
        });
    } catch (error) {
      // grep returns non-zero exit code when no matches are found
      if (error.stderr) {
        console.error(`Error searching for class ${errorClass}:`, error.stderr);
      }
    }
  }
  
  // Deduplicate files to update
  migrationReport.filesToUpdate = [...new Set(migrationReport.filesToUpdate)];
}

/**
 * Generate migration report
 */
function generateMigrationReport() {
  console.log('\nError Handling Migration Report:');
  console.log('===============================\n');
  
  console.log(`Total files to update: ${migrationReport.filesToUpdate.length}`);
  
  console.log('\nError Class Usage:');
  for (const [errorClass, files] of Object.entries(migrationReport.errorUsage)) {
    if (files.size > 0) {
      console.log(`- ${errorClass}: ${files.size} files`);
    }
  }
  
  console.log('\nFiles to Update:');
  migrationReport.filesToUpdate.forEach(file => {
    console.log(`- ${file}`);
  });
  
  console.log('\nMigration Steps:');
  console.log('1. Update imports to use the consolidated error framework');
  console.log('   Change: import { CLIError } from "../types/error"');
  console.log('   To:     import { CLIError } from "../types/errors/consolidated"');
  console.log('2. Update error handling to use the consolidated error handler');
  console.log('   Change: handleError("Failed to do something", error)');
  console.log('   To:     handleError(error, "Failed to do something")');
  console.log('3. Update error instantiation to use the new options-based approach');
  console.log('   Change: new CLIError("message", "ERROR_CODE")');
  console.log('   To:     new CLIError("message", { code: "ERROR_CODE" })');
  
  // Save report to file
  fs.writeFileSync(
    'error-migration-report.json', 
    JSON.stringify({
      filesToUpdate: migrationReport.filesToUpdate,
      errorUsage: Object.fromEntries(
        Object.entries(migrationReport.errorUsage).map(
          ([key, value]) => [key, Array.from(value)]
        )
      )
    }, null, 2)
  );
  
  console.log('\nReport saved to error-migration-report.json');
}

/**
 * Run the migration script
 */
async function main() {
  console.log('Starting migration analysis for consolidated error handling...');
  
  // Find files with old error imports
  const filesWithOldImports = await findFilesWithOldErrorImports();
  migrationReport.filesToUpdate.push(...filesWithOldImports);
  
  // Find error class usage
  await findErrorClassUsage();
  
  // Generate migration report
  generateMigrationReport();
}

// Run the script
main().catch(error => {
  console.error('Error running migration script:', error);
  process.exit(1);
});