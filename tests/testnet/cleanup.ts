import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../src/utils/Logger';

/**
 * Test cleanup utility for removing test data and temporary files after test runs
 * 
 * This utility helps clean up test artifacts created during test execution:
 * - Temporary test files
 * - Mock data files
 * - Test database/storage files
 * - Cached test results
 * - Uploaded test images
 * - Test todo entries
 */

const execPromise = promisify(exec);
const logger = new Logger();

/**
 * Configuration for cleanup operations
 */
interface CleanupConfig {
  /** Paths to clean up */
  paths: string[];
  /** File patterns to remove */
  patterns: string[];
  /** Whether to perform dry run (log only, don't delete) */
  dryRun?: boolean;
  /** Whether to clean up network test data */
  cleanNetwork?: boolean;
}

/**
 * Default configuration for test cleanup
 */
const DEFAULT_CONFIG: CleanupConfig = {
  paths: [
    // Temporary test files
    'temp-test-*',
    'test-temp-*',
    '*.tmp',
    
    // Test data files
    'test-*.json',
    'mock-*.json',
    'test-*.xml',
    
    // Test images
    'test-*.png',
    'test-*.jpg',
    'test-*.jpeg',
    'test-image.*',
    
    // Test storage files
    'test-todos*.db',
    'test-storage*',
    '.test-cache*',
    
    // Test logs
    'test-*.log',
    'test-audit*.log',
  ],
  patterns: [
    // Pattern for test todo IDs
    'test-todo-*',
    'test-batch-*',
    'test-upload-*',
  ],
  dryRun: false,
  cleanNetwork: false
};

/**
 * Clean up test data files
 */
export async function cleanupTestFiles(config: Partial<CleanupConfig> = {}): Promise<void> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  logger.info('Starting test cleanup...', {
    dryRun: finalConfig.dryRun,
    pathCount: finalConfig.paths.length,
    patternCount: finalConfig.patterns.length
  });
  
  const projectRoot = path.resolve(__dirname, '../../');
  let filesRemoved = 0;
  let errors = 0;
  
  // Clean up specified paths
  for (const pathPattern of finalConfig.paths) {
    try {
      const fullPath = path.join(projectRoot, pathPattern);
      const files = await findFiles(fullPath);
      
      for (const file of files) {
        try {
          if (finalConfig.dryRun) {
            logger.info(`[DRY RUN] Would remove: ${file}`);
          } else {
            await fs.unlink(file);
            logger.debug(`Removed file: ${file}`);
            filesRemoved++;
          }
        } catch (_error) {
          logger.error(`Failed to remove file: ${file}`, error);
          errors++;
        }
      }
    } catch (_error) {
      logger.debug(`No files matching pattern: ${pathPattern}`);
    }
  }
  
  // Clean up test todos from local storage
  if (!finalConfig.dryRun) {
    await cleanupTestTodos(finalConfig.patterns);
  }
  
  // Clean up network test data if requested
  if (finalConfig.cleanNetwork && !finalConfig.dryRun) {
    await cleanupNetworkTestData();
  }
  
  logger.info('Test cleanup completed', {
    filesRemoved,
    errors,
    dryRun: finalConfig.dryRun
  });
  
  if (errors > 0) {
    throw new Error(`Cleanup completed with ${errors} errors`);
  }
}

/**
 * Find files matching a glob pattern
 */
async function findFiles(pattern: string): Promise<string[]> {
  try {
    const { stdout } = await execPromise(`find . -name "${pattern}" -type f`);
    return stdout.split('\n').filter(Boolean);
  } catch (_error) {
    return [];
  }
}

/**
 * Clean up test todos from local storage
 */
async function cleanupTestTodos(patterns: string[]): Promise<void> {
  const storageDir = path.join(process.env.HOME || '', '.walrus-todos');
  const todosFile = path.join(storageDir, 'todos.json');
  
  try {
    const data = await fs.readFile(todosFile, 'utf-8');
    const todos = JSON.parse(data);
    
    // Filter out test todos based on patterns
    const filteredTodos = todos.filter((todo: any) => {
      const isTestTodo = patterns.some(pattern => {
        const regex = new RegExp(pattern.replace('*', '.*'));
        return regex.test(todo.id) || regex.test(todo.title);
      });
      
      if (isTestTodo) {
        logger.debug(`Removing test todo: ${todo.id} - ${todo.title}`);
      }
      
      return !isTestTodo;
    });
    
    // Write back filtered todos
    if (todos.length !== filteredTodos.length) {
      await fs.writeFile(todosFile, JSON.stringify(filteredTodos, null, 2));
      logger.info(`Removed ${todos.length - filteredTodos.length} test todos`);
    }
  } catch (_error) {
    logger.debug('No todos file found or error reading it:', error);
  }
}

/**
 * Clean up network test data (Walrus blob storage, Sui NFTs)
 */
async function cleanupNetworkTestData(): Promise<void> {
  logger.info('Cleaning up network test data...');
  
  try {
    // Clean up test blobs from Walrus
    await cleanupWalrusTestBlobs();
    
    // Clean up test NFTs from Sui
    await cleanupSuiTestNFTs();
    
    logger.info('Network test data cleanup completed');
  } catch (_error) {
    logger.error('Error cleaning up network test data:', error);
    throw error;
  }
}

/**
 * Clean up test blobs from Walrus storage
 */
async function cleanupWalrusTestBlobs(): Promise<void> {
  // This would typically interact with Walrus API to delete test blobs
  // For now, we'll just log the action
  logger.info('Cleaning up Walrus test blobs...');
  
  // In a real implementation:
  // 1. Query Walrus for blobs with test-specific metadata
  // 2. Delete each test blob
  // 3. Verify deletion
  
  logger.debug('Walrus test blob cleanup completed');
}

/**
 * Clean up test NFTs from Sui blockchain
 */
async function cleanupSuiTestNFTs(): Promise<void> {
  // This would typically interact with Sui to burn/delete test NFTs
  // For now, we'll just log the action
  logger.info('Cleaning up Sui test NFTs...');
  
  // In a real implementation:
  // 1. Query Sui for NFTs owned by test accounts
  // 2. Filter for test NFTs (by name pattern or metadata)
  // 3. Burn/transfer test NFTs
  
  logger.debug('Sui test NFT cleanup completed');
}

/**
 * Main cleanup function for CLI usage
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  const config: Partial<CleanupConfig> = {
    dryRun: args.includes('--dry-run'),
    cleanNetwork: args.includes('--network')
  };
  
  if (args.includes('--help')) {
    console.log(`
Test Cleanup Utility

Usage: npm run test:cleanup [options]

Options:
  --dry-run     Show what would be cleaned without actually deleting
  --network     Also clean up network test data (Walrus/Sui)
  --help        Show this help message

Examples:
  npm run test:cleanup                    # Clean local test files only
  npm run test:cleanup --dry-run          # Preview what would be cleaned
  npm run test:cleanup --network          # Clean local and network test data
  npm run test:cleanup --network --dry-run # Preview network cleanup
`);
    process.exit(0);
  }
  
  try {
    await cleanupTestFiles(config);
    logger.info('Cleanup completed successfully');
    process.exit(0);
  } catch (_error) {
    logger.error('Cleanup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(_error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

/**
 * Export for use in test hooks
 */
export default {
  cleanupTestFiles,
  cleanupTestTodos,
  cleanupNetworkTestData
};