import { Command, Flags, Hook } from '@oclif/core';
import { checkPermission } from './middleware/authorization';
import { ResourceType, ActionType } from './types/permissions';
import { authenticationService } from './services/authentication-service';
import { Logger } from './utils/Logger';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ux } from '@oclif/core';
import { CLIError } from './types/error';
import { WalrusError, NetworkError, ValidationError, TransactionError } from './types/errors';
import { withRetry } from './utils/error-handler';
import { commandRegistry, CommandMetadata } from './utils/CommandRegistry';
import { BatchProcessor } from './utils/batch-processor';
import { createCache, PerformanceCache } from './utils/performance-cache';
import { getGlobalLazyLoader } from './utils/lazy-loader';
import { displayFriendlyError, getErrorContext } from './utils/error-messages';
import { 
  SpinnerManager, 
  ProgressBar, 
  MultiProgress,
  createSpinner,
  createProgressBar,
  createMultiProgress,
  withSpinner,
  withProgressBar,
  SpinnerOptions,
  ProgressBarOptions
} from './utils/progress-indicators';
import stripAnsi from 'strip-ansi';
import * as cliProgress from 'cli-progress';
import { 
  SpinnerManager as CLISpinnerManager,
  ErrorHandler,
  FlagValidator,
  RetryManager,
  RetryOptions,
  Logger as CLILogger,
  Formatter
} from './utils/cli-helpers';

/**
 * Icons used throughout the CLI for consistent appearance
 */
export const ICONS = {
  // Status icons - more playful and fun
  SUCCESS: '🎉', // Celebration instead of checkmark
  ERROR: '💥',   // Explosion instead of X
  WARNING: '⚡️', // Lightning instead of warning
  INFO: '💡',    // Lightbulb instead of info
  PENDING: '🕐', // Clock instead of circle
  ACTIVE: '🟢',  // Green circle
  LOADING: '🔄', // Rotating arrows
  DEBUG: '🔮',   // Crystal ball instead of magnifying glass

  // Object icons - more vibrant
  TODO: '✨',    // Sparkles for todos
  LIST: '📋',    // Clipboard
  LISTS: '📚',   // Books
  TAG: '🏷️',     // Tag
  PRIORITY: '🔥', // Fire instead of lightning
  DATE: '📆',    // Calendar
  TIME: '⏰',    // Alarm clock

  // Feature icons - playful alternatives
  BLOCKCHAIN: '⛓️', // Chain
  WALRUS: '🦭',    // Actual walrus emoji
  LOCAL: '🏠',     // House instead of computer
  HYBRID: '🧩',    // Puzzle piece instead of arrows
  AI: '🧠',        // Brain instead of robot
  STORAGE: '📦',   // Box instead of disk
  CONFIG: '🛠️',    // Tools
  USER: '😎',      // Cool face instead of user
  SEARCH: '🔍',    // Magnifying glass
  SECURE: '🔐',    // Locked with key
  INSECURE: '🔓',  // Unlocked

  // UI elements - more unique
  BULLET: '•',
  ARROW: '➜',      // Different arrow
  BOX_V: '│',
  BOX_H: '─',
  BOX_TL: '┌',
  BOX_TR: '┐',
  BOX_BL: '└',
  BOX_BR: '┘',
  LINE: '·'
};

/**
 * Priority-related constants - with more fun styling
 */
export const PRIORITY = {
  high: {
    color: chalk.red.bold,
    icon: '🔥', // Fire for high priority
    label: 'HOT!',
    value: 3
  },
  medium: {
    color: chalk.yellow.bold,
    icon: '⚡', // Lightning for medium priority
    label: 'SOON',
    value: 2
  },
  low: {
    color: chalk.green,
    icon: '🍃', // Leaf for low priority
    label: 'CHILL',
    value: 1
  }
};

/**
 * Storage-related constants - with playful labels
 */
export const STORAGE = {
  local: {
    color: chalk.green.bold,
    icon: ICONS.LOCAL,
    label: 'Home Base'
  },
  blockchain: {
    color: chalk.blue.bold,
    icon: ICONS.BLOCKCHAIN,
    label: 'On Chain'
  },
  both: {
    color: chalk.magenta.bold,
    icon: ICONS.HYBRID,
    label: 'Everywhere!'
  }
};

/**
 * Base command class that all WalTodo CLI commands extend
 *
 * This class provides common functionality used across all commands including:
 * - Standardized flags (help, json, verbose, etc.)
 * - Authentication handling
 * - Permission checking
 * - Consistent UI elements (success/error messages, spinners, formatted output)
 * - JSON output support
 * - Logging utilities
 *
 * Commands should extend this class to ensure a consistent user experience
 * and avoid duplicating common functionality.
 */
export default abstract class BaseCommand extends Command {
  static flags = {
    help: Flags.help({ char: 'h' }),
    json: Flags.boolean({
      description: 'Format output as json',
    }),
    'no-color': Flags.boolean({
      description: 'Disable color output',
    }),
    quiet: Flags.boolean({
      char: 'q',
      description: 'Suppress all output except errors',
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show detailed output',
    }),
  };

  // No global hooks needed - using catch() method for error handling

  private logger: Logger = Logger.getInstance();
  protected tokenPath = path.join(os.homedir(), '.walrus', 'auth.json');
  
  // Performance tools
  protected configCache!: PerformanceCache<any>;
  protected todoListCache!: PerformanceCache<any>;
  protected blockchainQueryCache!: PerformanceCache<any>;
  protected aiResponseCache!: PerformanceCache<any>;
  protected batchProcessor!: BatchProcessor;
  private lazyLoader!: any;

  /**
   * Authenticate current user from stored token
   */
  protected async authenticate(): Promise<any> {
    if (!fs.existsSync(this.tokenPath)) {
      this.errorWithHelp(
        'Authentication required',
        'Not authenticated. Please login first with:',
        `walrus account:auth --login YOUR_USERNAME`
      );
      return null;
    }

    try {
      const data = fs.readFileSync(this.tokenPath, 'utf-8');
      const authInfo = JSON.parse(data);

      // Validate token
      const validation = await authenticationService.validateToken(authInfo.token);
      if (!validation.valid) {
        if (validation.expired) {
          this.errorWithHelp(
            'Session expired',
            'Your session has expired. Please login again with:',
            `walrus account:auth --login YOUR_USERNAME`
          );
        } else {
          this.errorWithHelp(
            'Invalid session',
            'Your session is invalid. Please login again with:',
            `walrus account:auth --login YOUR_USERNAME`
          );
        }
        return null;
      }

      return validation.user;
    } catch (error) {
      this.errorWithHelp(
        'Authentication failed',
        'Authentication failed. Please login again with:',
        `walrus account:auth --login YOUR_USERNAME`
      );
      return null;
    }
  }

  /**
   * Check if current user has permission to perform action on resource
   */
  protected async hasPermission(
    resource: string | ResourceType,
    resourceId: string | undefined,
    action: string | ActionType
  ): Promise<boolean> {
    return checkPermission(resource, resourceId, action);
  }

  /**
   * Display success message with celebration flair
   */
  protected success(message: string): void {
    if (this.shouldSuppressOutput()) return;
    const sparkles = chalk.magenta('✨');
    this.log(`${sparkles} ${chalk.green.bold(`${ICONS.SUCCESS} ${message}`)} ${sparkles}`);
  }

  /**
   * Display info message with lightbulb insight
   */
  protected info(message: string): void {
    if (this.shouldSuppressOutput()) return;
    this.log(chalk.cyan.bold(`${ICONS.INFO} ${message}`));
  }

  /**
   * Display warning message with attention-grabbing style
   */
  protected warning(message: string): void {
    if (this.shouldSuppressOutput()) return;
    this.log(`${chalk.yellow.bold(`${ICONS.WARNING} ${message}`)}`);
  }

  /**
   * Display error message with possible solution - with more personality
   */
  protected errorWithHelp(title: string, message: string, suggestion?: string): void {
    // Create an error to get enhanced messaging
    const error = new CLIError(message, 'CLI_ERROR');
    const context = getErrorContext(this, error);
    context.command = this.id || this.constructor.name.toLowerCase().replace('command', '');
    
    // Use enhanced error messaging system
    const friendlyError = displayFriendlyError(error, context);
    console.error(friendlyError);
    
    throw new CLIError(message, 'FORMATTED_ERROR');
  }

  /**
   * Display detailed error message with troubleshooting steps - with encouragement
   */
  protected detailedError(title: string, message: string, troubleshooting: string[]): void {
    // Create an error to get enhanced messaging
    const error = new CLIError(message, 'CLI_ERROR');
    const context = getErrorContext(this, error);
    context.command = this.id || this.constructor.name.toLowerCase().replace('command', '');
    
    // Use enhanced error messaging system
    const friendlyError = displayFriendlyError(error, context);
    console.error(friendlyError);
    
    throw new CLIError(message, 'DETAILED_ERROR');
  }

  /**
   * Display verbose output if verbose flag is set - with magical flair
   * (Named debugLog to avoid conflict with Command.debug property)
   */
  protected debugLog(message: string, data?: any): void {
    if (!this.isVerbose()) return;

    // A bit of magic and whimsy for debugging
    this.log(chalk.magenta(`${ICONS.DEBUG} ✧ ${message} ✧`));
    if (data) {
      // Add a fun prefix to JSON data
      this.log(chalk.dim(`🔎 Peeking under the hood:`));
      this.log(chalk.cyan(JSON.stringify(data, null, 2)));
    }
  }

  /**
   * Draw a fun titled section with a box around it
   * Creates a vibrant box with a title bar for structured content display.
   * The box automatically adjusts width based on content with playful styling.
   *
   * @param title Section title displayed in the box header
   * @param content Content to display inside the box (can be multi-line)
   */
  protected section(title: string, content: string): void {
    if (this.shouldSuppressOutput()) return;

    const lines = content.split('\n');
    const width = Math.max(...lines.map(line => this.stripAnsi(line).length), title.length + 4);

    // Pick a random fun color for the box
    const boxColors = [chalk.cyan, chalk.magenta, chalk.green, chalk.yellow, chalk.blue];
    const boxColor = boxColors[Math.floor(Math.random() * boxColors.length)];

    // Random decorative emoji for the section title
    const decorations = ['✨', '🌟', '💫', '🚀', '💥', '🔮', '🧩', '🎯'];
    const decoration = decorations[Math.floor(Math.random() * decorations.length)];

    // Top border with title and decoration
    this.log(boxColor(`${ICONS.BOX_TL}${ICONS.BOX_H}[ ${decoration} ${chalk.bold.white(title)} ${decoration} ]${ICONS.BOX_H.repeat(width - title.length - 8)}${ICONS.BOX_TR}`));

    // Content with colorful borders
    lines.forEach(line => {
      const rawLine = this.stripAnsi(line);
      const padding = width - rawLine.length;
      this.log(`${boxColor(ICONS.BOX_V)} ${line}${' '.repeat(padding)} ${boxColor(ICONS.BOX_V)}`);
    });

    // Bottom border
    this.log(boxColor(`${ICONS.BOX_BL}${ICONS.BOX_H.repeat(width + 2)}${ICONS.BOX_BR}`));
  }

  /**
   * Create a fun formatted list with title and varied bullet points
   */
  protected simpleList(title: string, items: string[]): void {
    if (this.shouldSuppressOutput()) return;

    // Fun bullet point variations
    const bullets = ['🔹', '🔸', '💠', '🔻', '🔶', '🔷', '🔸', '🔹'];

    // Title with fun decorations
    this.log(chalk.bold(`\n✧ ${chalk.underline(title)} ✧`));

    // List items with alternating bullets and subtle coloring
    items.forEach((item, index) => {
      const bullet = bullets[index % bullets.length];
      // Alternate text colors for adjacent items
      const itemText = index % 2 === 0
        ? chalk.cyan(item)
        : chalk.white(item);
      this.log(`  ${bullet} ${itemText}`);
    });

    this.log('');
  }

  /**
   * Format a todo item for display with playful styling
   * Creates a fun, visually appealing representation of a todo item with:
   * - Emoji status indicator (celebration for completed, clock for pending)
   * - Cool priority indicator with fun labels
   * - Title with subtle highlighting
   * - Optional details with playful icons and formatting
   *
   * @param todo Todo item to format
   * @param showDetail Whether to include detailed information (default: true)
   * @returns Formatted string ready for display
   */
  protected formatTodo(todo: any, showDetail: boolean = true): string {
    // Status indicators with more personality
    const status = todo.completed
      ? chalk.green.bold(`${ICONS.SUCCESS} `) // Celebration
      : chalk.yellow(`${ICONS.PENDING} `);    // Clock

    // Get priority with our new fun labels
    const priority = PRIORITY[todo.priority as keyof typeof PRIORITY]
      || PRIORITY.medium;

    // Construct the priority badge with the icon and label
    const priorityBadge = priority.color(`${priority.icon} ${priority.label}`);

    // Make the title pop with subtle formatting (but not too much)
    const titleFormatted = todo.completed
      ? chalk.dim.strikethrough(todo.title) // Strikethrough for completed todos
      : chalk.white.bold(todo.title);      // Bold for pending todos

    // Start building a fun output
    let output = `${status}${priorityBadge} ${titleFormatted}`;

    // Add fun details with more personality
    if (showDetail && (todo.dueDate || (todo.tags && todo.tags.length) || todo.private)) {
      const details = [
        todo.dueDate && chalk.blue(`${ICONS.DATE} ${todo.dueDate}`),
        todo.tags?.length && chalk.cyan(`${ICONS.TAG} ${todo.tags.join(', ')}`),
        todo.private && chalk.yellow(`${ICONS.SECURE} Eyes only!`)
      ].filter(Boolean);

      if (details.length) {
        output += `\n   ${details.join(' │ ')}`;
      }
    }

    return output;
  }

  /**
   * Format a storage icon and label with a fun twist
   */
  protected formatStorage(storageType: string): string {
    const storage = STORAGE[storageType as keyof typeof STORAGE] || STORAGE.local;

    // Add a playful animation-like effect with brackets
    return `[${storage.icon}] ${storage.color.bold(storage.label)} [${storage.icon}]`;
  }

  /**
   * Output JSON result if json flag is set
   */
  protected async jsonOutput(data: any): Promise<void> {
    if (await this.isJson()) {
      this.log(JSON.stringify(data, null, 2));
    }
  }

  /**
   * Check if output should be shown as JSON
   */
  protected async isJson(): Promise<boolean> {
    const { flags } = await this.parse(this.constructor as typeof BaseCommand);
    return flags.json as boolean;
  }

  /**
   * Get current flag values synchronously
   * This is safer than direct parsing which requires Promise handling
   */
  protected getCurrentFlags(): any {
    try {
      // Access parsed flags if already available
      return this.constructor.prototype.flags || {};
    } catch (e) {
      return {};
    }
  }

  /**
   * Check if color should be disabled
   */
  protected isNoColor(): boolean {
    // Use synchronous approach for init-time flag checking
    if (this.argv.includes('--no-color')) {
      return true;
    }
    return Boolean(this.getCurrentFlags()['no-color']);
  }

  /**
   * Check if output should be verbose
   */
  protected isVerbose(): boolean {
    if (this.argv.includes('--verbose') || this.argv.includes('-v')) {
      return true;
    }
    return Boolean(this.getCurrentFlags().verbose);
  }

  /**
   * Check if output should be suppressed
   */
  protected shouldSuppressOutput(): boolean {
    if (this.argv.includes('--quiet') || this.argv.includes('-q')) {
      return true;
    }
    return Boolean(this.getCurrentFlags().quiet);
  }

  /**
   * Start a loading spinner with a message
   */
  protected startSpinner(message: string): any {
    if (this.shouldSuppressOutput()) return null;
    return ux.action.start(message);
  }

  /**
   * Stop a loading spinner with a success message
   */
  protected stopSpinnerSuccess(spinner: any, message: string): void {
    if (!spinner) return;
    ux.action.stop(chalk.green(`${ICONS.SUCCESS} ${message}`));
  }

  /**
   * Strip ANSI color codes from a string
   */
  private stripAnsi(text: string): string {
    return stripAnsi(text);
  }

  /**
   * Initialize command
   */
  async init(): Promise<void> {
    await super.init();

    // Force colors to be enabled always, overriding any no-color flag
    // This ensures our playful styling always appears
    process.env.FORCE_COLOR = '1';
    chalk.level > 0 || (chalk.level = 1);

    // Only disable color if explicitly requested and in a non-demo environment
    if (this.isNoColor() && process.env.DEMO_MODE !== 'true') {
      chalk.level = 0;
    }
    
    // Initialize performance tools
    this.initializePerformanceTools();
    this.preloadCommonModules();
  }

  /**
   * Handle command errors
   */
  async catch(error: Error): Promise<any> {
    // Check if this might be a misspelled command
    const args = this.argv;
    if (error.message.includes('command not found') && args.length > 0) {
      const input = args[0];
      const suggestions = commandRegistry.suggestCommands(input, 3);
      
      if (suggestions.length > 0) {
        // Create a custom error with command suggestions
        const notFoundError = new CLIError(`'${input}' is not a valid command`, 'COMMAND_NOT_FOUND');
        const context = getErrorContext(this, notFoundError);
        context.command = input;
        
        // Display with enhanced error messaging
        const friendlyError = displayFriendlyError(notFoundError, context);
        console.error(friendlyError);
        
        throw notFoundError;
      }
    }
    
    // Use the enhanced error handling system
    return this.handleCommandError(error);
  }

  /**
   * Clean up after command finishes
   */
  async finally(error: Error | undefined): Promise<any> {
    // Save performance caches
    if (this.configCache) {
      await this.savePerformanceCaches();
    }
    
    // Any cleanup needed
    return super.finally(error);
  }

  /**
   * Override log method to ensure output is always visible
   * while avoiding duplicate console output
   *
   * This implementation resolves an issue with the base Command class
   * where using both super.log and console.log would cause duplicate output.
   *
   * @param message Message to log
   * @param args Additional arguments
   */
  log(message: string, ...args: any[]): void {
    // Call the original log method only - we don't need both super.log and console.log
    // which creates duplicate output
    super.log(message, ...args);
  }

  /**
   * Enhanced error handling with structured error types
   * Provides specialized handling for different error categories
   */
  protected async handleCommandError(error: Error): Promise<never> {
    this.logger.error(`Command error: ${error.message}`, error);

    // Get error context
    const context = getErrorContext(this, error);
    
    // Handle formatted CLIErrors without re-formatting
    if (error instanceof CLIError &&
        ((error as any).code === 'FORMATTED_ERROR' || (error as any).code === 'DETAILED_ERROR')) {
      throw error;  // Throw to satisfy 'never' return type
    }

    // Display friendly error message using enhanced system
    const friendlyError = displayFriendlyError(error, context);
    console.error(friendlyError);
    
    // Log stack trace if verbose
    if (this.isVerbose() && error.stack) {
      console.error('\nStack trace:');
      console.error(chalk.dim(error.stack));
    }
    
    // Exit with appropriate code
    if (error instanceof CLIError) {
      process.exit((error as any).exitCode || 1);
    } else {
      process.exit(1);
    }
  }

  /**
   * Handle structured WalrusError types with appropriate formatting
   */
  private handleStructuredError(error: WalrusError): never {
    const errorInfo = error.toPublicError();
    
    // Build troubleshooting steps based on error code
    const troubleshooting: string[] = [];
    
    // Ensure this function never returns by throwing
    throw new Error(error.message);
    
    switch (error.code) {
      case 'NETWORK_ERROR':
        troubleshooting.push('Check your internet connection');
        troubleshooting.push('Verify the service is accessible');
        break;
      case 'VALIDATION_ERROR':
        troubleshooting.push('Check input format and values');
        troubleshooting.push('Review command help for requirements');
        break;
      case 'AUTHORIZATION_ERROR':
        troubleshooting.push('Check your authentication status');
        troubleshooting.push('Verify your permissions');
        break;
      default:
        this.logger.warn(`Unrecognized error code: ${error.code}`);
        troubleshooting.push('Review the error message above');
        troubleshooting.push('Try running with --verbose flag');
        troubleshooting.push(`Error code: ${error.code}`);
    }
    
    if (errorInfo.shouldRetry) {
      troubleshooting.push('This operation can be retried');
    }
    
    this.detailedError(
      error.name,
      errorInfo.message,
      troubleshooting
    );
    // The detailedError method throws, so no return needed to satisfy 'never' type
  }

  /**
   * Execute an async operation with retry logic for transient errors
   * 
   * @param operation Function to execute
   * @param options Retry options
   * @returns Result of the operation
   * @throws NetworkError if all retries fail
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      baseDelay?: number;
      retryMessage?: string;
      operationName?: string;
    } = {}
  ): Promise<T> {
    const { 
      maxRetries = 3, 
      baseDelay = 1000, 
      retryMessage = 'Retrying operation...', 
      operationName = 'network_operation' 
    } = options;
    
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Check if error is retryable
        const isRetryable = this.isTransientError(error);
        
        if (!isRetryable || attempt === maxRetries) {
          // Wrap in NetworkError if not already wrapped
          if (!(error instanceof NetworkError)) {
            throw new NetworkError(
              error.message || 'Network operation failed',
              {
                operation: operationName,
                recoverable: isRetryable,
                cause: error
              }
            );
          }
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        this.debugLog(`${retryMessage} (attempt ${attempt}/${maxRetries}) - waiting ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Should never reach here, but for TypeScript
    throw new NetworkError(
      'Operation failed after all retries',
      {
        operation: operationName,
        recoverable: false,
        cause: lastError
      }
    );
  }
  
  /**
   * Check if an error is transient and should be retried
   */
  private isTransientError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    
    const message = (error as Error).message?.toLowerCase() || '';
    const code = (error as any).code?.toLowerCase() || '';
    
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('429') ||
      code.includes('network_error') ||
      code.includes('timeout') ||
      code === 'econnrefused' ||
      code === 'econnreset'
    );
  }

  /**
   * Validate command input with enhanced error messages
   * 
   * @param validator Validation function
   * @param value Value to validate
   * @param errorMessage Error message if validation fails
   * @throws ValidationError if validation fails
   */
  /**
   * Centralized file write method that can be mocked in tests
   * This provides a consistent interface for all file operations
   * and allows test code to mock file operations by replacing this method
   * 
   * @param filePath Path to the file to write
   * @param data Data to write to the file
   * @param options Write options
   */
  protected writeFileSafe(filePath: string, data: string, options?: fs.WriteFileOptions): void {
    // Create directory if it doesn't exist
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write file with proper error handling
    try {
      fs.writeFileSync(filePath, data, options);
    } catch (error) {
      this.warning(`Failed to write file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Get the base configuration directory for storing WalTodo's settings and data
   * This location can be customized via the WALRUS_TODO_CONFIG_DIR environment variable
   * The default location is ~/.waltodo
   * 
   * @returns Absolute path to the configuration directory
   */
  protected getConfigDir(): string {
    return process.env.WALRUS_TODO_CONFIG_DIR || path.join(os.homedir(), '.waltodo');
  }
  
  protected validateInput<T>(
    validator: (value: T) => boolean,
    value: T,
    errorMessage: string,
    field?: string
  ): void {
    if (!validator(value)) {
      throw new ValidationError(errorMessage, {
        field,
        value,
        recoverable: false
      });
    }
  }

  /**
   * Create a transaction context for blockchain operations
   * Provides rollback capability on failure
   * 
   * @param transactionFn Function to execute within transaction
   * @returns Result of transaction
   * @throws TransactionError if transaction fails
   */
  protected async executeTransaction<T>(
    transactionFn: () => Promise<T>,
    options: {
      operation: string;
      rollbackFn?: () => Promise<void>;
    }
  ): Promise<T> {
    const { operation, rollbackFn } = options;
    
    try {
      return await transactionFn();
    } catch (error: any) {
      // Attempt rollback if provided
      if (rollbackFn) {
        try {
          await rollbackFn();
          this.warning('Transaction rolled back successfully');
        } catch (rollbackError: any) {
          this.logger.error('Rollback failed', rollbackError);
          this.warning('Transaction rollback failed - manual intervention may be required');
        }
      }
      
      // Convert to TransactionError for consistent handling
      throw new TransactionError(
        error.message || `Transaction ${operation} failed`,
        {
          operation,
          recoverable: false,
          cause: error
        }
      );
    }
  }

  /**
   * Initialize performance caches and tools
   */
  private initializePerformanceTools(): void {
    const cacheDir = path.join(os.homedir(), '.walrus', 'cache');
    
    // Initialize caches with appropriate strategies
    this.configCache = createCache<any>('config', {
      strategy: 'TTL',
      ttlMs: 3600000, // 1 hour
      persistenceDir: path.join(cacheDir, 'config')
    });
    
    this.todoListCache = createCache<any>('todos', {
      strategy: 'LRU',
      maxSize: 100,
      persistenceDir: path.join(cacheDir, 'todos')
    });
    
    this.blockchainQueryCache = createCache<any>('blockchain', {
      strategy: 'TTL',
      ttlMs: 300000, // 5 minutes
      persistenceDir: path.join(cacheDir, 'blockchain')
    });
    
    this.aiResponseCache = createCache<any>('ai-responses', {
      strategy: 'TTL',
      ttlMs: 3600000, // 1 hour
      maxSize: 50,
      persistenceDir: path.join(cacheDir, 'ai')
    });
    
    // Initialize batch processor with default settings
    this.batchProcessor = new BatchProcessor({
      batchSize: 10,
      concurrencyLimit: 5,
      retryAttempts: 3,
      retryDelayMs: 1000
    });
    
    // Initialize lazy loader
    this.lazyLoader = getGlobalLazyLoader({
      cacheModules: true,
      preloadHints: [
        '@mysten/sui/client',
        '@mysten/walrus',
        'chalk',
        'ora',
        '../services/todoService',
        '../services/ai/aiService'
      ]
    });
  }
  
  /**
   * Preload commonly used modules in the background
   */
  private async preloadCommonModules(): Promise<void> {
    // Only preload essential modules needed by most commands
    setTimeout(async () => {
      try {
        // Only preload todoService which is used by most commands
        await this.lazyLoader.preload([
          '../services/todoService'
        ]);
        
        // Preload other modules based on command type (defer this to command-specific init)
        const cmdName = this.id || '';
        if (cmdName.includes('store') || cmdName.includes('retrieve')) {
          await this.lazyLoader.preload([
            '../utils/walrus-storage',
            '../utils/sui-nft-storage'
          ]);
        }
        
        if (cmdName.includes('ai') || cmdName.includes('suggest')) {
          await this.lazyLoader.preload([
            '../services/ai/AIVerificationService'
          ]);
        }
      } catch (error) {
        this.logger.warn('Failed to preload some modules', error);
      }
    }, 100);
  }
  
  /**
   * Save performance caches to disk
   */
  private async savePerformanceCaches(): Promise<void> {
    try {
      await Promise.all([
        this.configCache.shutdown(),
        this.todoListCache.shutdown(),
        this.blockchainQueryCache.shutdown(),
        this.aiResponseCache.shutdown()
      ]);
    } catch (error) {
      this.logger.warn('Failed to save some caches', error);
    }
  }
  
  /**
   * Get cached configuration or load it
   */
  protected async getCachedConfig<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = await this.configCache.get(key);
    if (cached) {
      this.debugLog(`Config cache hit: ${key}`);
      return cached;
    }
    
    const value = await loader();
    await this.configCache.set(key, value);
    return value;
  }
  
  /**
   * Update cached configuration
   */
  protected async setCachedConfig<T>(key: string, value: T): Promise<void> {
    await this.configCache.set(key, value);
    this.debugLog(`Config cache updated: ${key}`);
  }
  
  /**
   * Get cached todo list or load it
   */
  protected async getCachedTodos<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = await this.todoListCache.get(key);
    if (cached) {
      this.debugLog(`Todo cache hit: ${key}`);
      return cached;
    }
    
    const value = await loader();
    await this.todoListCache.set(key, value);
    return value;
  }
  
  /**
   * Update cached todo list
   */
  protected async setCachedTodos<T>(key: string, value: T): Promise<void> {
    await this.todoListCache.set(key, value);
    this.debugLog(`Todo cache updated: ${key}`);
  }
  
  /**
   * Process operations in batches
   */
  protected async processBatch<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    options?: Partial<{
      batchSize: number;
      concurrencyLimit: number;
      progressCallback?: (progress: any) => void;
    }>
  ): Promise<R[]> {
    const batchOptions = {
      batchSize: options?.batchSize || 10,
      concurrencyLimit: options?.concurrencyLimit || 5,
      progressCallback: options?.progressCallback
    };
    
    const processor_ = new BatchProcessor(batchOptions);
    const result = await processor_.process(items, processor);
    
    if (result.failed.length > 0) {
      this.warning(`Batch processing completed with ${result.failed.length} failures`);
    }
    
    return result.successful;
  }
  
  /**
   * Lazy load heavy dependencies
   */
  protected async lazyLoad<T = any>(modulePath: string): Promise<T> {
    try {
      return await this.lazyLoader.load(modulePath) as T;
    } catch (error) {
      this.logger.error(`Failed to lazy load module: ${modulePath}`, error);
      throw error;
    }
  }

  /**
   * Create a spinner with command defaults
   */
  protected createSpinner(text: string, options: SpinnerOptions = {}): SpinnerManager {
    if (this.shouldSuppressOutput()) {
      // Return a no-op spinner when output is suppressed
      return {
        start: () => this,
        stop: () => this,
        succeed: () => this,
        fail: () => this,
        warn: () => this,
        info: () => this,
        text: () => this,
        color: () => this,
        style: () => this,
        nested: () => this.createSpinner(''),
        removeNested: () => {},
        clear: () => this,
        isSpinning: () => false,
      } as any;
    }

    return createSpinner(text, {
      color: 'cyan',
      style: 'dots',
      ...options
    });
  }

  /**
   * Create a progress bar with command defaults
   */
  protected createProgressBar(options: ProgressBarOptions = {}): ProgressBar {
    if (this.shouldSuppressOutput()) {
      // Return a no-op progress bar when output is suppressed
      return {
        start: () => {},
        update: () => {},
        increment: () => {},
        stop: () => {},
        getProgress: () => 0,
        getETA: () => 0,
        setFormat: () => {},
      } as any;
    }

    return createProgressBar({
      format: ' {spinner} {bar} {percentage}% | ETA: {eta}s | {value}/{total}',
      barCompleteChar: '█',
      barIncompleteChar: '░',
      ...options
    });
  }

  /**
   * Create a multi-progress manager
   */
  protected createMultiProgress(options: ProgressBarOptions = {}): MultiProgress {
    if (this.shouldSuppressOutput()) {
      // Return a no-op multi-progress when output is suppressed
      return {
        create: () => ({} as any),
        update: () => {},
        remove: () => {},
        stop: () => {},
        getBar: () => undefined,
      } as any;
    }

    return createMultiProgress(options);
  }

  /**
   * Run an async operation with a spinner
   */
  protected async withSpinner<T>(
    text: string,
    operation: () => Promise<T>,
    options: SpinnerOptions = {}
  ): Promise<T> {
    if (this.shouldSuppressOutput()) {
      return operation();
    }

    return withSpinner(text, operation, {
      color: 'cyan',
      style: 'dots',
      ...options
    });
  }

  /**
   * Run an async operation with a progress bar
   */
  protected async withProgressBar<T>(
    total: number,
    operation: (progress: ProgressBar) => Promise<T>,
    options: ProgressBarOptions = {}
  ): Promise<T> {
    if (this.shouldSuppressOutput()) {
      const noopProgress = this.createProgressBar();
      return operation(noopProgress);
    }

    return withProgressBar(total, operation, options);
  }

  /**
   * Create a fun animated spinner for special operations
   */
  protected createFunSpinner(
    text: string,
    style: 'walrus' | 'sparkle' | 'moon' | 'star' = 'walrus'
  ): SpinnerManager {
    return this.createSpinner(text, {
      style: style as any,
      color: style === 'walrus' ? 'blue' : style === 'sparkle' ? 'magenta' : 'yellow'
    });
  }

  /**
   * Create a gradient progress bar
   */
  protected createGradientProgressBar(options: ProgressBarOptions = {}): ProgressBar {
    return this.createProgressBar({
      ...options,
      format: ' {spinner} {bar} {percentage}% | ETA: {eta}s | {value}/{total}',
      // The gradient is handled by the formatBar function in ProgressBar
    });
  }

  /**
   * Run multiple operations with a multi-progress display
   */
  protected async runWithMultiProgress<T>(
    operations: Array<{
      name: string;
      total: number;
      operation: (progress: cliProgress.SingleBar) => Promise<T>;
    }>
  ): Promise<T[]> {
    if (this.shouldSuppressOutput()) {
      // Run operations without progress display
      return Promise.all(
        operations.map(({ operation }) => operation({} as any))
      );
    }

    const multiProgress = this.createMultiProgress();
    const results: T[] = [];

    try {
      const promises = operations.map(async ({ name, total, operation }) => {
        const bar = multiProgress.create(name, total);
        const result = await operation(bar);
        multiProgress.remove(name);
        return result;
      });

      const allResults = await Promise.all(promises);
      results.push(...allResults);
    } finally {
      multiProgress.stop();
    }

    return results;
  }

  /**
   * Start a unified spinner with consistent styling
   */
  protected startUnifiedSpinner(message: string): CLISpinnerManager {
    return new CLISpinnerManager(message);
  }

  /**
   * Validate flags using unified validators
   */
  protected validateFlag = {
    positiveNumber: (value: string, name: string) => 
      FlagValidator.validatePositiveNumber(value, name),
    nonEmpty: (value: string, name: string) => 
      FlagValidator.validateNonEmpty(value, name),
    enum: <T extends string>(value: string, validValues: T[], name: string) =>
      FlagValidator.validateEnum(value, validValues, name),
    path: (value: string, name: string) =>
      FlagValidator.validatePath(value, name),
  };

  /**
   * Execute with retry using unified retry manager
   */
  protected async retryOperation<T>(
    operation: () => Promise<T>,
    context: string,
    options?: RetryOptions
  ): Promise<T> {
    try {
      const retryManager = new RetryManager(['testnet'], {
        ...options,
        onRetry: (error: Error, attempt: number, delay: number) => {
          this.warning(`${context}: Retry attempt ${attempt} after error: ${error.message}`);
          if (options?.onRetry) {
            (options.onRetry as any)(error, attempt, delay);
          }
        }
      });
      return await retryManager.execute(
        async (node: any) => operation(),
        context
      );
    } catch (error) {
      ErrorHandler.handle(error, context);  // This throws, so function always returns
      // TypeScript doesn't know ErrorHandler.handle() always throws, so add this
      throw new Error('Should never reach here');
    }
  }

  /**
   * Log messages using unified logger utilities
   */
  protected logUtils = {
    success: (message: string) => CLILogger.success(message),
    error: (message: string) => CLILogger.error(message),
    warning: (message: string) => CLILogger.warning(message),
    info: (message: string) => CLILogger.info(message),
    debug: (message: string) => CLILogger.debug(message),
    step: (step: number, total: number, message: string) => 
      CLILogger.step(step, total, message),
  };

  /**
   * Format output using unified formatters
   */
  protected format = {
    table: (data: Record<string, unknown>) => Formatter.table(data),
    list: (items: string[], bullet?: string) => Formatter.list(items, bullet),
    code: (text: string) => Formatter.code(text),
    highlight: (text: string) => Formatter.highlight(text),
    dim: (text: string) => Formatter.dim(text),
  };

  /**
   * Handle errors consistently across all commands
   */
  protected handleError(error: unknown, context: string): never {
    ErrorHandler.handle(error, context);
  }

  /**
   * Format errors consistently
   */
  protected formatError(error: unknown): string {
    return ErrorHandler.formatError(error);
  }

  /**
   * Flag to indicate if command is running in interactive mode
   */
  protected isInteractiveMode: boolean = false;

  /**
   * Set interactive mode flag
   */
  setInteractiveMode(value: boolean): void {
    this.isInteractiveMode = value;
  }

  /**
   * Get interactive mode flag
   */
  getInteractiveMode(): boolean {
    return this.isInteractiveMode;
  }

  /**
   * Helper method for handling output in interactive mode
   * In interactive mode, we don't want to exit the process
   */
  protected output(message: string, isError: boolean = false): void {
    if (this.isInteractiveMode) {
      if (isError) {
        console.error(message);
      } else {
        console.log(message);
      }
    } else {
      if (isError) {
        this.error(message);
      } else {
        this.log(message);
      }
    }
  }

  /**
   * Override error handling for interactive mode
   * In interactive mode, we don't want to exit the process on errors
   */
  protected async handleInteractiveError(error: Error): Promise<void> {
    if (this.isInteractiveMode) {
      console.error(chalk.red(`Error: ${error.message}`));
      if (this.isVerbose()) {
        console.error(chalk.gray(error.stack || ''));
      }
    } else {
      throw error;
    }
  }
}

// Add named export for commands that use it
export { BaseCommand };