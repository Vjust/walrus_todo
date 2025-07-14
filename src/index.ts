#!/usr/bin/env node

/**
 * Waltodo CLI - Main entry point
 * Sets up the CLI commander, imports and registers all commands,
 * handles global error catching, and shows version and description
 */

import { Command } from 'commander';
import { 
  addCommand, 
  listCommand, 
  doneCommand, 
  deleteCommand, 
  clearCommand, 
  exportCommand, 
  importCommand, 
  searchCommand, 
  statsCommand, 
  publishCommand,
  listPublishedCommand,
  blobStatusCommand,
  fetchCommand,
  downloadBlobCommand,
  blobStatsCommand,
  deleteBlobCommand,
  discoverCommand,
  completionCommand
} from './cli/commands';
import { runInteractiveMode } from './cli/interactive';
import { error, info } from './cli/ui';
import { logger, LogLevel } from './utils/logger';

const program = new Command();

// Set up the main program
program
  .name('waltodo')
  .description('A decentralized TODO list manager using Walrus storage')
  .version('0.1.0')
  .option('-i, --interactive', 'Start interactive mode')
  .option('--no-sync', 'Disable automatic synchronization')
  .option('--offline', 'Work in offline mode only')
  .option('--debug', 'Enable debug logging')
  .option('--config <path>', 'Use custom config file')
  .option('--data-dir <path>', 'Use custom data directory');

// Register all commands
addCommand(program);
listCommand(program);
doneCommand(program);
deleteCommand(program);
clearCommand(program);
exportCommand(program);
importCommand(program);
searchCommand(program);
statsCommand(program);
publishCommand(program);

// Blob management commands
listPublishedCommand(program);
blobStatusCommand(program);
fetchCommand(program);
downloadBlobCommand(program);
blobStatsCommand(program);
deleteBlobCommand(program);
discoverCommand(program);

// Add shell completion command
completionCommand(program);


/**
 * Setup global options
 */
async function setupGlobalOptions(options: any): Promise<void> {
  // Configure debug logging
  if (options.debug) {
    logger.configure({ level: LogLevel.DEBUG });
    logger.debug('Debug mode enabled');
  }

  // Handle offline mode
  if (options.offline) {
    logger.info('Offline mode enabled');
    // TODO: Set offline flag in configuration
  }

  // Handle no-sync option
  if (options.noSync) {
    logger.info('Auto-sync disabled');
    // TODO: Disable auto-sync in configuration
  }

  // Handle custom config path
  if (options.config) {
    logger.debug(`Using custom config: ${options.config}`);
    // TODO: Load custom config file
  }

  // Handle custom data directory
  if (options.dataDir) {
    logger.debug(`Using custom data directory: ${options.dataDir}`);
    // TODO: Set custom data directory
  }
}

// Global error handler
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  error(`Fatal error: ${err.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason as Error);
  error(`Unhandled error: ${reason}`);
  process.exit(1);
});

// Main execution
async function main(): Promise<void> {
  // Check if no arguments provided before parsing
  if (!process.argv.slice(2).length) {
    showWelcomeMessage();
    return;
  }

  // Parse command line arguments
  program.parse(process.argv);
  const options = program.opts();

  // Setup global options
  await setupGlobalOptions(options);

  // Check for interactive mode
  if (options.interactive) {
    try {
      await runInteractiveMode();
    } catch (err) {
      logger.error('Interactive mode error:', err);
      error(`Interactive mode failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      process.exit(1);
    }
    return;
  }
}

/**
 * Show welcome message with examples and quick start guide
 */
function showWelcomeMessage(): void {
  console.log(program.helpInformation());
  
  console.log('\n📋 Examples:');
  console.log('  waltodo add "Buy groceries" -p high -t shopping,errands');
  console.log('  waltodo add "Review pull request" -d tomorrow -p medium');
  console.log('  waltodo list --status pending --priority high');
  console.log('  waltodo search "meeting"');
  console.log('  waltodo done abc123def');
  console.log('  waltodo delete xyz789abc --force');
  console.log('  waltodo export todos.json --include-done');
  console.log('  waltodo import backup.json --merge');
  console.log('  waltodo stats');
  console.log('  waltodo publish --epochs 10 --deletable');
  console.log('  waltodo discover                             # Discover all your TODO blobs');
  console.log('  waltodo fetch                                # Interactive blob search and fetch');
  console.log('  waltodo blobs --status active                # List active blobs');
  console.log('  waltodo blob-stats                           # Show blob statistics');
  console.log('  waltodo -i                                   # Interactive mode');
  console.log('  waltodo --offline add "Work offline task"    # Offline mode');
  console.log('  waltodo --debug list                         # Debug logging');
  
  console.log('\n🚀 Quick Start:');
  console.log('  1. Start with interactive mode: waltodo -i');
  console.log('  2. Or add your first TODO: waltodo add "My first task"');
  console.log('  3. List your TODOs: waltodo list');
  console.log('  4. Mark as done: waltodo done <id>');
  console.log('  5. Get shell completion: waltodo completion --shell bash');
  
  console.log('\n🔧 Global Options:');
  console.log('  --interactive, -i    Start interactive mode for easy navigation');
  console.log('  --no-sync           Disable automatic synchronization to Walrus');
  console.log('  --offline           Work in offline mode only (no network calls)');
  console.log('  --debug             Enable detailed debug logging');
  console.log('  --config <path>     Use custom configuration file');
  console.log('  --data-dir <path>   Use custom data directory');
  
  console.log('\n💡 Pro Tips:');
  console.log('  • Use tags to organize: -t work,urgent,meeting');
  console.log('  • Set due dates with relative terms: -d tomorrow, "next week"');
  console.log('  • Combine filters: --status pending --priority high');
  console.log('  • Use batch operations in interactive mode for efficiency');
  console.log('  • Export regularly for backups: waltodo export backup.json');
  
  console.log('\n🌐 Decentralized Storage:');
  console.log('  Waltodo stores your TODOs on Walrus, a decentralized storage network.');
  console.log('  Your data is automatically synced across devices and backed up securely.');
  console.log('  Use --offline mode to work without network connectivity.');
}

// Run the main function
main().catch((err) => {
  logger.error('Main execution error:', err);
  error(`Application error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  process.exit(1);
});