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
  deleteBlobCommand
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

// Add shell completion command
program
  .command('completion')
  .description('Generate shell completion scripts')
  .option('--shell <shell>', 'Shell type (bash, zsh, fish)', 'bash')
  .action((options) => {
    generateCompletion(options.shell);
  });

/**
 * Generate shell completion script
 */
function generateCompletion(shell: string): void {
  const completions = {
    bash: `
# Waltodo Bash Completion
_waltodo() {
    local cur prev commands
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
    commands="add list ls done delete rm clear export import search find stats publish blobs list-blobs blob-status fetch download blob-stats delete-blob completion -i --interactive --no-sync --offline --debug --help --version"
    
    if [[ \${cur} == -* ]]; then
        COMPREPLY=( \$(compgen -W "--interactive --no-sync --offline --debug --help --version" -- \${cur}) )
        return 0
    fi
    
    COMPREPLY=( \$(compgen -W "\${commands}" -- \${cur}) )
    return 0
}
complete -F _waltodo waltodo
`,
    zsh: `
# Waltodo Zsh Completion
_waltodo() {
    local state
    _arguments \
        '(-i --interactive)'{-i,--interactive}'[Start interactive mode]' \
        '--no-sync[Disable automatic synchronization]' \
        '--offline[Work in offline mode only]' \
        '--debug[Enable debug logging]' \
        '--config[Use custom config file]:path:_files' \
        '--data-dir[Use custom data directory]:path:_directories' \
        '*::command:->commands'
    
    case \$state in
        commands)
            _values 'commands' \
                'add[Add a new TODO item]' \
                'list[List all TODO items]' \
                'ls[List all TODO items]' \
                'done[Mark a TODO item as done]' \
                'delete[Delete a TODO item]' \
                'rm[Delete a TODO item]' \
                'clear[Clear all TODO items]' \
                'export[Export TODOs to a JSON file]' \
                'import[Import TODOs from a JSON file]' \
                'search[Search TODOs by text]' \
                'find[Search TODOs by text]' \
                'stats[Show TODO statistics]' \
                'publish[Publish TODOs to Walrus]' \
                'blobs[List published blobs]' \
                'list-blobs[List published blobs]' \
                'blob-status[Check blob status]' \
                'fetch[Fetch TODOs from Walrus blobs]' \
                'download[Download TODOs from a specific blob]' \
                'blob-stats[Show blob statistics]' \
                'delete-blob[Delete a blob from tracking]' \
                'completion[Generate shell completion scripts]'
            ;;
    esac
}
compdef _waltodo waltodo
`,
    fish: `
# Waltodo Fish Completion
complete -c waltodo -s i -l interactive -d "Start interactive mode"
complete -c waltodo -l no-sync -d "Disable automatic synchronization"
complete -c waltodo -l offline -d "Work in offline mode only"
complete -c waltodo -l debug -d "Enable debug logging"
complete -c waltodo -l config -d "Use custom config file" -r
complete -c waltodo -l data-dir -d "Use custom data directory" -r

complete -c waltodo -f -a "add" -d "Add a new TODO item"
complete -c waltodo -f -a "list" -d "List all TODO items"
complete -c waltodo -f -a "ls" -d "List all TODO items"
complete -c waltodo -f -a "done" -d "Mark a TODO item as done"
complete -c waltodo -f -a "delete" -d "Delete a TODO item"
complete -c waltodo -f -a "rm" -d "Delete a TODO item"
complete -c waltodo -f -a "clear" -d "Clear all TODO items"
complete -c waltodo -f -a "export" -d "Export TODOs to a JSON file"
complete -c waltodo -f -a "import" -d "Import TODOs from a JSON file"
complete -c waltodo -f -a "search" -d "Search TODOs by text"
complete -c waltodo -f -a "find" -d "Search TODOs by text"
complete -c waltodo -f -a "stats" -d "Show TODO statistics"
complete -c waltodo -f -a "publish" -d "Publish TODOs to Walrus"
complete -c waltodo -f -a "blobs" -d "List published blobs"
complete -c waltodo -f -a "list-blobs" -d "List published blobs"
complete -c waltodo -f -a "blob-status" -d "Check blob status"
complete -c waltodo -f -a "fetch" -d "Fetch TODOs from Walrus blobs"
complete -c waltodo -f -a "download" -d "Download TODOs from a specific blob"
complete -c waltodo -f -a "blob-stats" -d "Show blob statistics"
complete -c waltodo -f -a "delete-blob" -d "Delete a blob from tracking"
complete -c waltodo -f -a "completion" -d "Generate shell completion scripts"
`
  };

  const script = completions[shell as keyof typeof completions];
  if (!script) {
    error(`Unsupported shell: ${shell}. Supported shells: bash, zsh, fish`);
    return;
  }

  console.log(script);
  info(`To enable completion, add the above to your shell's configuration file:`);
  info(`  Bash: ~/.bashrc or ~/.bash_profile`);
  info(`  Zsh: ~/.zshrc`);
  info(`  Fish: ~/.config/fish/completions/waltodo.fish`);
}

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