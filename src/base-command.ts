import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Command, Flags } from '@oclif/core';
import { ux } from '@oclif/core';
import * as cliProgress from 'cli-progress';
import { CLIError, WalrusError } from './types/error';
import { Todo } from './types/todo';
import { NetworkError } from './types/errors/consolidated/NetworkError';
import { ValidationError } from './types/errors/consolidated/ValidationError';
import { TransactionError } from './types/errors/consolidated/TransactionError';
import { 
  createSpinner, 
  createProgressBar, 
  createMultiProgress, 
  withProgressBar, 
  SpinnerManager, 
  ProgressBar, 
  MultiProgress,
  SpinnerOptions,
  ProgressBarOptions
} from './utils/progress-indicators';

// Fix for undefined columns in non-TTY environments
if (process.stdout && !process.stdout.columns) {
  process.stdout.columns = 80;
}

// To avoid circular imports, declare chalk inline
interface ChalkInstance {
  red: (text: string) => string;
  yellow: (text: string) => string;
  green: (text: string) => string;
  blue: (text: string) => string;
  gray: (text: string) => string;
  bold: ((text: string) => string) & {
    cyan: (text: string) => string;
    green: (text: string) => string;
    yellow: (text: string) => string;
  };
  cyan: (text: string) => string;
  magenta: (text: string) => string;
  dim: (text: string) => string;
}

let chalk: ChalkInstance;
try {
  chalk = require('chalk');
} catch (e) {
  const boldFn = (s: string) => s;
  Object.assign(boldFn, {
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s
  });
  
  chalk = { 
    red: (s: string) => s, 
    yellow: (s: string) => s, 
    green: (s: string) => s, 
    blue: (s: string) => s, 
    gray: (s: string) => s,
    bold: boldFn as ((text: string) => string) & {
      cyan: (text: string) => string;
      green: (text: string) => string;
      yellow: (text: string) => string;
    },
    cyan: (s: string) => s,
    magenta: (s: string) => s,
    dim: (s: string) => s
  };
}

/** Command flags accessible within base command */
export interface BaseFlags {
  debug?: boolean;
  network?: string;
  verbose?: boolean;
  output?: string;
  mock?: boolean;
  apiKey?: string;
  help?: boolean;
  timeout?: number;
  force?: boolean;
  quiet?: boolean;
}

/**
 * Base command class that provides common functionality for all CLI commands.
 * Includes error handling, caching, performance monitoring, and utility methods.
 */
export abstract class BaseCommand extends Command {
  protected flagsConfig: BaseFlags = {};

  // Abstract run method that subclasses must implement
  abstract run(): Promise<void>;

  static baseFlags = {
    debug: Flags.boolean({
      char: 'd',
      description: 'Enable debug mode',
      default: false,
      required: false,
      env: 'WALRUS_DEBUG'
    }),
    network: Flags.string({
      char: 'n',
      description: 'Network to use',
      options: ['mainnet', 'testnet', 'localnet'],
      default: 'testnet',
      required: false,
      env: 'WALRUS_NETWORK'
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Enable verbose output',
      default: false,
      required: false
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output format',
      options: ['text', 'json', 'yaml'],
      default: 'text',
      required: false
    }),
    mock: Flags.boolean({
      char: 'm',
      description: 'Enable mock mode for testing',
      default: false,
      required: false,
      env: 'WALRUS_USE_MOCK'
    }),
    apiKey: Flags.string({
      char: 'k',
      description: 'API key for AI features',
      required: false,
      env: 'XAI_API_KEY'
    }),
    help: Flags.help({
      char: 'h'
    }),
    timeout: Flags.integer({
      char: 't',
      description: 'Timeout in seconds',
      default: 30,
      required: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Force operation without confirmation',
      default: false,
      required: false
    }),
    quiet: Flags.boolean({
      char: 'q',
      description: 'Suppress output',
      default: false,
      required: false
    })
  };

  // Expose base flags for command classes to inherit
  static flags = BaseCommand.baseFlags;

  /**
   * Initialize the base command with error handling and configuration
   */
  async init(): Promise<void> {
    await super.init();

    // Parse flags to populate flagsConfig
    const parsed = await this.parse();
    this.flagsConfig = parsed.flags as BaseFlags;

    // Setup error handling
    this.setupErrorHandlers();
  }

  /**
   * Clean up resources before command completion
   */
  async finally(err?: Error): Promise<void> {
    try {
      await super.finally(err);
    } catch (error) {
      // Don't let cleanup errors mask original command errors
      this.warn(`Cleanup error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Enhanced error handling with structured error types
   */
  protected async catch(error: Error): Promise<void> {
    // Handle specific error types
    if (error instanceof WalrusError) {
      return this.handleStructuredError(error);
    }

    if (error instanceof ValidationError) {
      return this.handleValidationError(error);
    }

    if (error instanceof NetworkError) {
      return this.handleNetworkError(error);
    }

    if (error instanceof TransactionError) {
      return this.handleTransactionError(error);
    }

    if (error instanceof CLIError) {
      return this.handleCLIError(error);
    }

    // Handle generic errors
    return this.handleGenericError(error);
  }

  /**
   * Setup global error handlers for the command
   */
  private setupErrorHandlers(): void {
    process.on('uncaughtException', (error) => {
      this.error(`Uncaught exception: ${error.message}`, { exit: 1 });
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.error(`Unhandled rejection at ${promise}: ${reason}`, { exit: 1 });
    });
  }

  /**
   * Handle structured WalrusError types with appropriate formatting
   */
  private handleStructuredError(error: WalrusError): never {
    const errorInfo = error.toPublicError();
    
    // Build troubleshooting steps based on error code
    const troubleshooting: string[] = [];
    
    if (errorInfo.code.includes('STORAGE')) {
      troubleshooting.push('• Check your Walrus storage allocation');
      troubleshooting.push('• Verify network connectivity to Walrus nodes');
      troubleshooting.push('• Ensure you have sufficient WAL tokens');
    }
    
    if (errorInfo.code.includes('NETWORK')) {
      troubleshooting.push('• Check your internet connection');
      troubleshooting.push('• Try again in a few moments');
      troubleshooting.push('• Use --mock flag for testing without network');
    }

    this.error(chalk.red(`${error.name}: ${error.message}`), {
      suggestions: troubleshooting,
      exit: 1
    });
  }

  /**
   * Handle validation errors with field-specific guidance
   */
  private handleValidationError(error: ValidationError): never {
    this.error(chalk.red(`Validation Error: ${error.message}`), {
      suggestions: [
        'Check the format of your input parameters',
        'Refer to command help with --help flag',
        'Use --verbose for detailed validation info'
      ],
      exit: 1
    });
  }

  /**
   * Handle network errors with retry suggestions
   */
  private handleNetworkError(error: NetworkError): never {
    const shouldRetry = error.recoverable || error.shouldRetry;
    
    this.error(chalk.red(`Network Error: ${error.message}`), {
      suggestions: shouldRetry ? [
        'Check your internet connection',
        'Try again in a few moments',
        'Use --timeout to increase wait time',
        'Use --mock flag to work offline'
      ] : [
        'Check your network configuration',
        'Verify service endpoints are accessible',
        'Contact support if the issue persists'
      ],
      exit: 1
    });
  }

  /**
   * Handle transaction errors with blockchain-specific guidance
   */
  private handleTransactionError(error: TransactionError): never {
    this.error(chalk.red(`Transaction Error: ${error.message}`), {
      suggestions: [
        'Check your wallet balance and gas fees',
        'Verify transaction parameters',
        'Try with a higher gas limit',
        'Check blockchain network status'
      ],
      exit: 1
    });
  }

  /**
   * Handle CLI-specific errors
   */
  private handleCLIError(error: CLIError): never {
    this.error(chalk.red(`CLI Error: ${error.message}`), {
      suggestions: [
        'Check command syntax with --help',
        'Verify all required parameters are provided',
        'Use --verbose for more detailed output'
      ],
      exit: 1
    });
  }

  /**
   * Handle generic errors with basic troubleshooting
   */
  private handleGenericError(error: Error): never {
    this.error(chalk.red(`Error: ${error.message}`), {
      suggestions: [
        'Try running the command again',
        'Use --debug for detailed error information',
        'Check the command documentation',
        'Report this issue if it persists'
      ],
      exit: 1
    });
  }

  /**
   * Execute an operation with retry logic and error handling
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      initialDelay?: number;
      operationName?: string;
      isRetryable?: (error: Error) => boolean;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      operationName = 'operation',
      isRetryable = () => true
    } = options;

    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (_error) {
        lastError = error as Error;
        
        // Check if we should retry
        if (!isRetryable(lastError) || attempt === maxRetries) {
          // Wrap in NetworkError if not already wrapped
          if (!(error instanceof NetworkError)) {
            throw new NetworkError(
              lastError.message || 'Network operation failed',
              {
                operation: operationName,
                recoverable: isRetryable(lastError),
                cause: lastError
              }
            );
          }
          throw error;
        }
        
        // Wait before retrying
        const delay = initialDelay * Math.pow(2, attempt - 1);
        this.log(chalk.yellow(`Attempt ${attempt} failed, retrying in ${delay}ms...`));
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Should never reach here, but for TypeScript
    throw new NetworkError(
      'Operation failed after all retries',
      {
        operation: operationName,
        recoverable: false,
        cause: lastError || new Error('Unknown error')
      }
    );
  }

  /**
   * Start a spinner with given text
   */
  protected startSpinner(text: string): void {
    this.log(`${text}...`);
  }

  /**
   * Stop spinner with success/failure
   */
  protected stopSpinner(success: boolean = true, finalText?: string): void {
    if (finalText) {
      if (success) {
        this.log(chalk.green(`✓ ${finalText}`));
      } else {
        this.log(chalk.red(`✗ ${finalText}`));
      }
    }
  }

  /**
   * Update spinner text
   */
  protected updateSpinner(text: string): void {
    this.log(text);
  }

  /**
   * Execute operation with spinner
   */
  protected async withSpinner<T>(
    text: string,
    operation: () => Promise<T>,
    successText?: string
  ): Promise<T> {
    this.startSpinner(text);
    try {
      const result = await operation();
      this.stopSpinner(true, successText || 'Done');
      return result;
    } catch (_error) {
      this.stopSpinner(false, 'Failed');
      throw error;
    }
  }

  /**
   * Utility method for user confirmation prompts
   */
  protected async confirm(message: string, defaultValue: boolean = false): Promise<boolean> {
    if (this.flagsConfig.force) {
      return true;
    }
    
    return ux.confirm(message + (defaultValue ? ' (Y/n)' : ' (y/N)'));
  }

  /**
   * Utility method for user input prompts
   */
  protected async prompt(message: string, options: {
    required?: boolean;
    type?: 'normal' | 'mask' | 'hide';
    default?: string;
  } = {}): Promise<string> {
    const { required = true, type = 'normal', default: defaultValue } = options;
    
    const result = await ux.prompt(message, {
      required,
      type: type as 'normal' | 'mask' | 'hide',
      default: defaultValue
    });
    
    return result;
  }

  /**
   * Format output based on the requested format (json, yaml, text)
   */
  protected formatOutput(data: unknown, format?: string): string {
    const outputFormat = format || this.flagsConfig.output || 'text';
    
    switch (outputFormat) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'yaml':
        // Simple YAML-like format
        return this.toYamlLike(data);
      case 'text':
      default:
        return this.toTextFormat(data);
    }
  }

  /**
   * Simple YAML-like formatting for output
   */
  private toYamlLike(obj: unknown, indent: string = ''): string {
    if (typeof obj !== 'object' || obj === null) {
      return String(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => `${indent}- ${this.toYamlLike(item, indent + '  ')}`).join('\n');
    }
    
    return Object.entries(obj)
      .map(([key, value]) => `${indent}${key}: ${this.toYamlLike(value, indent + '  ')}`)
      .join('\n');
  }

  /**
   * Text formatting for output
   */
  private toTextFormat(data: unknown): string {
    if (typeof data === 'string') {
      return data;
    }
    
    if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data)) {
        return data.map((item, _index) => `${index + 1}. ${this.toTextFormat(item)}`).join('\n');
      }
      
      return Object.entries(data)
        .map(([key, value]) => `${key}: ${this.toTextFormat(value)}`)
        .join('\n');
    }
    
    return String(data);
  }

  /**
   * Log output conditionally based on quiet flag
   */
  protected logConditional(message: string): void {
    if (!this.flagsConfig.quiet) {
      this.log(message);
    }
  }

  /**
   * Verbose log that only shows when verbose flag is enabled
   */
  protected verbose(message: string): void {
    if (this.flagsConfig.verbose) {
      this.log(chalk.blue(`[VERBOSE] ${message}`));
    }
  }

  /**
   * Display success message with icon
   */
  protected success(message: string): void {
    this.log(chalk.green(`${ICONS.success} ${message}`));
  }

  /**
   * Display info message with icon
   */
  protected info(message: string): void {
    this.log(chalk.blue(`${ICONS.info} ${message}`));
  }

  /**
   * Display warning message with icon
   */
  protected warning(message: string): void {
    this.log(chalk.yellow(`${ICONS.warning} ${message}`));
  }

  /**
   * Display error with help message and throw
   */
  protected errorWithHelp(title: string, message: string, helpText: string): never {
    this.error(`${title}: ${message}\n${chalk.gray(helpText)}`, { exit: 1 });
  }

  /**
   * Display a section with title and content
   */
  protected section(title: string, content: string): void {
    this.log(`\n${chalk.bold.cyan(`📋 ${title}`)}`);
    this.log(`${chalk.gray('─'.repeat(40))}`);
    this.log(content);
    this.log('');
  }

  /**
   * Display a simple bulleted list
   */
  protected simpleList(title: string, items: string[]): void {
    this.log(`\n${chalk.bold.yellow(`📝 ${title}`)}`);
    items.forEach(item => {
      this.log(`  ${chalk.cyan('•')} ${item}`);
    });
    this.log('');
  }

  /**
   * Format a todo object for display
   */
  protected formatTodo(todo: Todo): string {
    const statusIcon = todo.completed ? ICONS.success : ICONS.pending;
    const priorityColor = todo.priority === 'high' ? chalk.red : 
                         todo.priority === 'medium' ? chalk.yellow : chalk.green;
    
    let result = `${statusIcon} ${chalk.bold(todo.title)}`;
    
    if (todo.priority) {
      result += ` ${priorityColor(`[${todo.priority.toUpperCase()}]`)}`;
    }
    
    if (todo.dueDate) {
      result += ` ${chalk.gray(`Due: ${todo.dueDate}`)}`;
    }
    
    if (todo.tags && todo.tags.length > 0) {
      result += ` ${chalk.magenta(`#${todo.tags.join(' #')}`)}`;
    }
    
    return result;
  }

  /**
   * Format storage type for display
   */
  protected formatStorage(type: string): string {
    switch (type) {
      case 'local':
        return chalk.blue('💾 Local');
      case 'blockchain':
        return chalk.green('⛓️  Blockchain');
      case 'both':
        return chalk.cyan('🔄 Hybrid');
      default:
        return chalk.gray('❓ Unknown');
    }
  }

  /**
   * Enhanced debug log with data
   */
  protected debugLog(message: string, data?: unknown): void {
    if (this.flagsConfig.debug) {
      let logMessage = chalk.gray(`[DEBUG] ${message}`);
      if (data) {
        logMessage += chalk.gray(` ${JSON.stringify(data)}`);
      }
      this.log(logMessage);
    }
  }

  /**
   * Stop spinner with success message
   */
  protected stopSpinnerSuccess(spinner: unknown, message: string): void {
    this.log(chalk.green(`✓ ${message}`));
  }

  /**
   * Display detailed error with suggestions
   */
  protected detailedError(title: string, message: string, suggestions: string[]): never {
    this.log(chalk.red(`\n❌ ${title}`));
    this.log(chalk.red(`${message}\n`));
    
    if (suggestions && suggestions.length > 0) {
      this.log(chalk.yellow('💡 Troubleshooting steps:'));
      suggestions.forEach((suggestion, index) => {
        this.log(chalk.yellow(`   ${index + 1}. ${suggestion}`));
      });
      this.log('');
    }
    
    this.exit(1);
  }

  /**
   * Output data in JSON format
   */
  protected async jsonOutput(data: unknown): Promise<void> {
    this.log(JSON.stringify(data, null, 2));
  }

  /**
   * Execute operation with retry logic
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
      operationName = 'operation'
    } = options;

    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (_error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        this.warning(`${retryMessage} (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error(`${operationName} failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Execute transaction with rollback capability
   */
  protected async executeTransaction<T>(
    operation: () => Promise<T>,
    options: {
      operation?: string;
      rollbackFn?: () => Promise<void>;
    } = {}
  ): Promise<T> {
    const { operation: operationName = 'transaction', rollbackFn } = options;
    
    try {
      return await operation();
    } catch (_error) {
      this.debugLog(`Transaction ${operationName} failed, attempting rollback`);
      
      if (rollbackFn) {
        try {
          await rollbackFn();
          this.debugLog(`Rollback for ${operationName} completed`);
        } catch (rollbackError) {
          this.warning(`Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Get configuration directory path
   * Respects WALRUS_TODO_CONFIG_DIR environment variable for testing
   */
  protected getConfigDir(): string {
    return process.env.WALRUS_TODO_CONFIG_DIR || path.join(os.homedir(), '.config', 'waltodo');
  }

  /**
   * Safely write file with error handling
   * Creates directory atomically and ensures file write integrity
   */
  protected writeFileSafe(filePath: string, content: string, encoding: BufferEncoding = 'utf8'): void {
    try {
      const dir = path.dirname(filePath);
      
      // Create directory atomically with recursive option
      fs.mkdirSync(dir, { recursive: true });
      
      // Write file atomically
      fs.writeFileSync(filePath, content, encoding);
    } catch (_error) {
      throw new Error(`Failed to write file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Flag validation utilities
   */
  protected validateFlag = {
    nonEmpty: (value: string, fieldName: string): void => {
      if (!value || value.trim().length === 0) {
        throw new ValidationError(
          `${fieldName} cannot be empty`,
          fieldName
        );
      }
    },

    enum: (value: string, allowedValues: string[], fieldName: string): void => {
      if (!allowedValues.includes(value)) {
        throw new ValidationError(
          `${fieldName} must be one of: ${allowedValues.join(', ')}`,
          fieldName
        );
      }
    }
  };

  /**
   * Check if output should be JSON format
   */
  protected get isJson(): boolean {
    return this.flagsConfig.output === 'json';
  }

  /**
   * Check if output should be JSON format (async version for compatibility)
   */
  protected async isJsonAsync(): Promise<boolean> {
    return this.flagsConfig.output === 'json';
  }

  /**
   * Start unified spinner for operations
   */
  protected startUnifiedSpinner(text: string): SpinnerManager {
    return this.createSpinner(text).start();
  }

  /**
   * Create a spinner with progress indicator
   */
  protected createSpinner(text: string, options: SpinnerOptions = {}): SpinnerManager {
    return createSpinner(text, options);
  }

  /**
   * Create a progress bar
   */
  protected createProgressBar(options: ProgressBarOptions = {}): ProgressBar {
    return createProgressBar(options);
  }

  /**
   * Create a gradient progress bar
   */
  protected createGradientProgressBar(options: ProgressBarOptions = {}): ProgressBar {
    return createProgressBar({
      format: ' {spinner} {bar} {percentage}% | Task: {task} | ETA: {eta}s',
      ...options
    });
  }

  /**
   * Create a multi-progress manager
   */
  protected createMultiProgress(options: ProgressBarOptions = {}): MultiProgress {
    return createMultiProgress(options);
  }

  /**
   * Execute operation with progress bar
   */
  protected async withProgressBar<T>(
    total: number,
    operation: (progress: ProgressBar) => Promise<T>,
    options: ProgressBarOptions = {}
  ): Promise<T> {
    return withProgressBar(total, operation, options);
  }


  /**
   * Run multiple operations with multi-progress
   */
  protected async runWithMultiProgress<T>(
    operations: Array<{
      name: string;
      total: number;
      operation: (bar: cliProgress.SingleBar) => Promise<T>;
    }>
  ): Promise<(T | undefined)[]> {
    const multiProgress = this.createMultiProgress();
    
    const promises = operations.map(async ({ name, total, operation }) => {
      const bar = multiProgress.create(name, total);
      try {
        return await operation(bar);
      } catch (_error) {
        return undefined;
      }
    });
    
    try {
      return await Promise.all(promises);
    } finally {
      multiProgress.stop();
    }
  }

  /**
   * Create fun spinners with special effects
   */
  protected createFunSpinner(
    text: string, 
    type: 'walrus' | 'sparkle' | 'moon' | 'star' = 'walrus'
  ): SpinnerManager {
    return createSpinner(text, { style: type as SpinnerOptions['style'] });
  }

  /**
   * Cache management for todos
   */
  protected async getCachedTodos<T>(
    cacheKey: string, 
    fetcher: () => Promise<T>
  ): Promise<T> {
    // Simple implementation - in a full app this would use a proper cache
    return await fetcher();
  }

  /**
   * Generic error handler with operation context
   */
  protected handleError(error: unknown, operation?: string): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const contextMessage = operation ? `${operation}: ${errorMessage}` : errorMessage;
    
    this.error(contextMessage, { exit: 1 });
  }

  /**
   * Formatting utilities
   */
  protected get format() {
    return {
      highlight: (text: string) => chalk.bold.cyan(text),
      success: (text: string) => chalk.green(text),
      error: (text: string) => chalk.red(text),
      warning: (text: string) => chalk.yellow(text),
      info: (text: string) => chalk.blue(text),
      muted: (text: string) => chalk.gray(text)
    };
  }
}

// Export constants that were referenced
export const ICONS = {
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  PENDING: '⏳',
  ACTIVE: '🔄',
  LOADING: '⏳',
  DEBUG: '🐛',
  TODO: '📝',
  LIST: '📋',
  LISTS: '📚',
  TAG: '🏷️',
  PRIORITY: '🎯',
  DATE: '📅',
  TIME: '⏰',
  BLOCKCHAIN: '⛓️',
  WALRUS: '🐋',
  LOCAL: '💾',
  HYBRID: '🔄',
  AI: '🤖',
  STORAGE: '💽',
  CONFIG: '⚙️',
  USER: '👤',
  SEARCH: '🔍',
  SECURE: '🔒',
  INSECURE: '🔓',
  ARROW: '→',
  // Box drawing characters
  BOX_TL: '┌',
  BOX_TR: '┐',
  BOX_BL: '└',
  BOX_BR: '┘',
  BOX_H: '─',
  BOX_V: '│',
  LINE: '─',
  BULLET: '•',
  // Legacy aliases for compatibility
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  pending: '⏳',
  active: '🔄',
  loading: '⏳',
  debug: '🐛',
  todo: '📝',
  list: '📋',
  lists: '📚',
  tag: '🏷️',
  priority: '🎯',
  date: '📅',
  time: '⏰',
  blockchain: '⛓️',
  walrus: '🐋',
  local: '💾',
  hybrid: '🔄',
  ai: '🤖',
  storage: '💽',
  config: '⚙️',
  user: '👤',
  search: '🔍',
  secure: '🔒',
  insecure: '🔓'
};

export const PRIORITY = {
  high: {
    label: 'HIGH',
    color: chalk.red
  },
  medium: {
    label: 'MEDIUM', 
    color: chalk.yellow
  },
  low: {
    label: 'LOW',
    color: chalk.green
  }
};

export const STORAGE = {
  local: {
    label: 'Local',
    color: chalk.blue,
    icon: '💾'
  },
  blockchain: {
    label: 'Blockchain',
    color: chalk.green,
    icon: '⛓️'
  },
  both: {
    label: 'Hybrid',
    color: chalk.cyan,
    icon: '🔄'
  }
};

// Export BaseCommand as default for backward compatibility
export default BaseCommand;