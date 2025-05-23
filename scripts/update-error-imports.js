/**
import { Logger } from '../src/utils/Logger';

const logger = new Logger('update-error-imports');
 * Utility script to update error imports across the codebase
 * 
 * This script:
 * 1. Reads all TypeScript and JavaScript files in the src directory
 * 2. Updates imports from old error paths to the consolidated error framework
 * 3. Updates error instantiation patterns to use the new options-based API
 * 
 * Usage:
 *   node scripts/update-error-imports.js [--dry-run] [--verbose]
 * 
 * Options:
 *   --dry-run   Show changes without applying them
 *   --verbose   Show detailed information about each file processed
 */

const fs = require('fs');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

// Configuration
const SRC_DIR = path.join(process.cwd(), 'src');
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// Import patterns to replace
const IMPORT_REPLACEMENTS = [
  {
    from: /from ['"](.*)\/types\/error['"]/g,
    to: "from '$1/types/errors/consolidated'"
  },
  {
    from: /from ['"](.*)\/types\/errors['"]/g,
    to: "from '$1/types/errors/consolidated'"
  },
  {
    from: /from ['"](.*)\/types\/errors\/BaseError['"]/g,
    to: "from '$1/types/errors/consolidated'"
  },
  {
    from: /from ['"](.*)\/types\/errors\/ValidationError['"]/g,
    to: "from '$1/types/errors/consolidated'"
  },
  {
    from: /from ['"](.*)\/utils\/error-handler['"]/g,
    to: "from '$1/utils/consolidated/error-handler'"
  }
];

// Error instantiation patterns to replace
const ERROR_INSTANTIATION_REPLACEMENTS = [
  // Simple error instantiation: new CLIError(message, code)
  {
    from: /new (\w+Error)\((['"])([^'"]+)(['"])\s*,\s*(['"])([^'"]+)(['"])\)/g,
    to: (match, errorClass, q1, message, q2, q3, code, q4) => 
      `new ${errorClass}(${q1}${message}${q2}, { code: ${q3}${code}${q4} })`
  },
  // Error instantiation with no code: new ValidationError(message)
  {
    from: /new (ValidationError|NetworkError|StorageError|BlockchainError)\((['"])([^'"]+)(['"])\)(?!\s*,)/g,
    to: (match, errorClass, q1, message, q2) => 
      `new ${errorClass}(${q1}${message}${q2}, {})`
  },
  // handleError with two arguments: handleError("context", error)
  {
    from: /handleError\((['"])([^'"]+)(['"])\s*,\s*([^)]+)\)/g,
    to: (match, q1, context, q2, error) => 
      `handleError(${error}, ${q1}${context}${q2})`
  }
];

// Stats for reporting
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  importsUpdated: 0,
  instantiationsUpdated: 0
};

/**
 * Find all TypeScript and JavaScript files in the src directory
 */
async function findSourceFiles() {
  const { stdout } = await exec(`find ${SRC_DIR} -type f -name "*.ts" -o -name "*.js" | grep -v "node_modules" | grep -v "dist"`);
  return stdout.split('\n').filter(Boolean);
}

/**
 * Update imports and error instantiations in a file
 */
function updateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    let fileImportsUpdated = 0;
    let fileInstantiationsUpdated = 0;
    
    // Update imports
    IMPORT_REPLACEMENTS.forEach(({ from, to }) => {
      const originalContent = content;
      content = content.replace(from, to);
      if (content !== originalContent) {
        fileImportsUpdated += (originalContent.match(from) || []).length;
        modified = true;
      }
    });
    
    // Update error instantiations
    ERROR_INSTANTIATION_REPLACEMENTS.forEach(({ from, to }) => {
      const originalContent = content;
      content = content.replace(from, to);
      if (content !== originalContent) {
        fileInstantiationsUpdated += (originalContent.match(from) || []).length;
        modified = true;
      }
    });
    
    // Update file if modified
    if (modified && !DRY_RUN) {
      fs.writeFileSync(filePath, content, 'utf-8');
    }
    
    // Update stats
    stats.filesProcessed++;
    if (modified) {
      stats.filesModified++;
      stats.importsUpdated += fileImportsUpdated;
      stats.instantiationsUpdated += fileInstantiationsUpdated;
      
      if (VERBOSE || DRY_RUN) {
        logger.info(`Updated ${path.relative(process.cwd(), filePath)}`);
        logger.info(`  - ${fileImportsUpdated} imports updated`);
        logger.info(`  - ${fileInstantiationsUpdated} instantiations updated`);
      }
    }
    
    return modified;
  } catch (error) {
    logger.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Run the script
 */
async function main() {
  logger.info(`${DRY_RUN ? '[DRY RUN] ' : ''}Starting error import update...\n`);
  
  const sourceFiles = await findSourceFiles();
  logger.info(`Found ${sourceFiles.length} source files\n`);
  
  // Process files
  for (const filePath of sourceFiles) {
    updateFile(filePath);
  }
  
  // Print summary
  logger.info('\nUpdate Summary:');
  logger.info(`- Files processed: ${stats.filesProcessed}`);
  logger.info(`- Files modified: ${stats.filesModified}`);
  logger.info(`- Imports updated: ${stats.importsUpdated}`);
  logger.info(`- Instantiations updated: ${stats.instantiationsUpdated}`);
  
  if (DRY_RUN) {
    logger.info('\nThis was a dry run. No files were actually modified.');
    logger.info('Run without --dry-run to apply changes.');
  } else {
    logger.info('\nAll files updated successfully!');
  }
}

// Run the script
main().catch(error => {
  logger.error('Error running script:', error);
  process.exit(1);
});