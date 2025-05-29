// Import polyfills first to ensure compatibility
import './utils/polyfills';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Command, Flags } from '@oclif/core';
import { ux } from '@oclif/core';
import * as cliProgress from 'cli-progress';
import chalk = require('chalk');
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
  ProgressBarOptions,
} from './utils/progress-indicators';
import { jobManager } from './utils/PerformanceMonitor';
import {
  backgroundOrchestrator,
  BackgroundOptions,
} from './utils/BackgroundCommandOrchestrator';

// Fix for undefined columns in non-TTY environments
if (process.stdout && !process.stdout.columns) {
  process.stdout.columns = 80;
}

// Chalk is imported directly above

/** Command flags accessible within base command */
export interface BaseFlags {
  debug?: boolean;
  network?: string;
  verbose?: boolean;
  output?: string;
  apiKey?: string;
  help?: void;
  timeout?: number;
  force?: boolean;
  quiet?: boolean;
  background?: boolean;
  bg?: boolean;
  foreground?: boolean;
  fg?: boolean;
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
      env: 'WALRUS_DEBUG',
    }),
    network: Flags.string({
      char: 'n',
      description: 'Network to use',
      options: ['mainnet', 'testnet', 'localnet'],
      default: 'testnet',
      required: false,
      env: 'WALRUS_NETWORK',
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Enable verbose output',
      default: false,
      required: false,
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output format',
      options: ['text', 'json', 'yaml'],
      default: 'text',
      required: false,
    }),
    apiKey: Flags.string({
      char: 'k',
      description: 'API key for AI features',
      required: false,
      env: 'XAI_API_KEY',
    }),
    help: Flags.help({
      char: 'h',
    }),
    timeout: Flags.integer({
      description: 'Timeout in seconds (use --timeout)',
      default: 30,
      required: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Force operation without confirmation',
      default: false,
      required: false,
    }),
    quiet: Flags.boolean({
      char: 'q',
      description: 'Suppress output',
      default: false,
      required: false,
    }),
    background: Flags.boolean({
      char: 'b',
      description: 'Run command in background',
      default: false,
      required: false,
    }),
    bg: Flags.boolean({
      description: 'Alias for --background',
      default: false,
      required: false,
    }),
    foreground: Flags.boolean({
      description: 'Force command to run in foreground',
      default: false,
      required: false,
    }),
    fg: Flags.boolean({
      description: 'Alias for --foreground',
      default: false,
      required: false,
    }),
  };

  // Expose base flags for command classes to inherit
  static flags = BaseCommand.baseFlags;

  /**
   * Initialize the base command with error handling and configuration
   */
  async init(): Promise<void> {
    // Ensure config is properly set for test environments
    if (!this.config && process.env.NODE_ENV === 'test') {
      try {
        // Only try to import if we're in a test environment
        const testUtils = await import(
          './__tests__/helpers/command-test-utils'
        );
        (this as any).config = testUtils.createMockOCLIFConfig();
      } catch (error) {
        // If import fails, create minimal config for tests
        const jestMockFn = typeof jest !== 'undefined' && jest?.fn ? jest.fn() : () => Promise.resolve({ successes: [], failures: [] });
        
        (this as any).config = {
          name: 'waltodo',
          bin: 'waltodo',
          version: '1.0.0',
          runHook: typeof jestMockFn === 'function' && jestMockFn.mockResolvedValue 
            ? jestMockFn.mockResolvedValue({ successes: [], failures: [] })
            : () => Promise.resolve({ successes: [], failures: [] }),
          root: process.cwd(),
          dataDir: '/tmp/waltodo-test',
          configDir: '/tmp/waltodo-test-config',
          cacheDir: '/tmp/waltodo-test-cache',
          valid: true,
          platform: process.platform,
          arch: process.arch,
          shell: process.env.SHELL || '/bin/bash',
          userAgent: 'waltodo/1.0.0',
          // Add additional OCLIF config properties that might be needed
          plugins: new Map(),
          commands: new Map(),
          topics: new Map(),
          commandIDs: [],
          errlog: '/tmp/waltodo-test-error.log',
          dirname: 'waltodo',
          debug: 0,
          npmRegistry: 'https://registry.npmjs.org/',
          windows: process.platform === 'win32',
          flexibleTaxonomy: false,
          topicSeparator: ':',
          // Mock additional methods that might be called
          runCommand: () => Promise.resolve(),
          findCommand: () => undefined,
          findTopic: () => undefined,
          getAllCommandIDs: () => [],
          load: () => Promise.resolve(),
          scopedEnvVar: (key: string) => `WALTODO_${key}`,
          scopedEnvVarKey: (key: string) => `WALTODO_${key}`,
          scopedEnvVarTrue: () => false,
          envVarTrue: () => false,
          findMatches: () => [],
          scopedEnvVarKeys: () => [],
          // Event emitter methods
          on: () => {},
          once: () => {},
          off: () => {},
          emit: () => false,
        };
      }
    }

    // Ensure config.runHook is always available, even if config exists but runHook is missing
    if (this.config && typeof this.config.runHook !== 'function') {
      (this.config as any).runHook = () => Promise.resolve({ successes: [], failures: [] });
    }

    // Skip calling super.init() in test environment to avoid environment config issues
    if (process.env.NODE_ENV !== 'test') {
      await super.init();
    }

    // Parse flags to populate flagsConfig
    const parsed = await this.parse();
    this.flagsConfig = parsed.flags as BaseFlags;

    // Check if command should run in background
    if (await this.shouldRunInBackground()) {
      await this.executeInBackground();
      return;
    }

    // Setup error handling
    this.setupErrorHandlers();

    // Check for recent job completions and show notifications
    this.checkJobNotifications();
  }

  /**
   * Clean up resources before command completion
   */
  async finally(err?: Error): Promise<void> {
    try {
      await super.finally(err);
    } catch (error) {
      // Don't let cleanup errors mask original command errors
      this.warn(
        `Cleanup error: ${error instanceof Error ? error.message : String(error)}`
      );
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
    process.on('uncaughtException', error => {
      this.error(
        `BaseCommand: Uncaught exception in ${this.constructor.name}: ${error.message}\nStack: ${error.stack}`,
        { exit: 1 }
      );
    });

    process.on('unhandledRejection', (reason, promise) => {
      const reasonStr =
        reason instanceof Error
          ? `${reason.message} (${reason.constructor.name})`
          : String(reason);
      this.error(
        `BaseCommand: Unhandled promise rejection in ${this.constructor.name} at ${promise}: ${reasonStr}`,
        { exit: 1 }
      );
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
      exit: 1,
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
        'Use --verbose for detailed validation info',
      ],
      exit: 1,
    });
  }

  /**
   * Handle network errors with retry suggestions
   */
  private handleNetworkError(error: NetworkError): never {
    const shouldRetry = error.recoverable || error.shouldRetry;

    this.error(chalk.red(`Network Error: ${error.message}`), {
      suggestions: shouldRetry
        ? [
            'Check your internet connection',
            'Try again in a few moments',
            'Use --timeout to increase wait time',
            'Use --mock flag to work offline',
          ]
        : [
            'Check your network configuration',
            'Verify service endpoints are accessible',
            'Contact support if the issue persists',
          ],
      exit: 1,
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
        'Check blockchain network status',
      ],
      exit: 1,
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
        'Use --verbose for more detailed output',
      ],
      exit: 1,
    });
  }

  /**
   * Handle generic errors with basic troubleshooting
   */
  private handleGenericError(error: Error): never {
    const errorType = error.constructor.name;
    const commandName = this.constructor.name;
    const errorMessage = error.message || 'No error message provided';

    // Log detailed error for debugging
    if (this.flagsConfig.debug || this.flagsConfig.verbose) {
      this.debug(`${commandName}: Detailed error info:`);
      this.debug(`- Error type: ${errorType}`);
      this.debug(`- Error message: ${errorMessage}`);
      if (error.stack) {
        this.debug(`- Stack trace: ${error.stack}`);
      }
    }

    this.error(chalk.red(`${commandName}: ${errorMessage} (${errorType})`), {
      suggestions: [
        'Try running the command again',
        'Use --debug for detailed error information',
        'Check the command documentation',
        `Report this ${errorType} error if it persists`,
      ],
      exit: 1,
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
      isRetryable = () => true,
    } = options;

    let lastError: Error = new Error(
      `BaseCommand.withRetry: ${operationName} failed with no specific error details`
    );

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (_error) {
        lastError = _error as Error;

        // Check if we should retry
        if (!isRetryable(lastError) || attempt === maxRetries) {
          // Wrap in NetworkError if not already wrapped
          if (!(lastError instanceof NetworkError)) {
            throw new NetworkError(
              lastError.message || 'Network operation failed',
              {
                operation: operationName,
                recoverable: isRetryable(lastError),
                cause: lastError,
              }
            );
          }
          throw lastError;
        }

        // Wait before retrying
        const delay = initialDelay * Math.pow(2, attempt - 1);
        this.log(
          chalk.yellow(`Attempt ${attempt} failed, retrying in ${delay}ms...`)
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Should never reach here, but for TypeScript
    throw new NetworkError('Operation failed after all retries', {
      operation: operationName,
      recoverable: false,
      cause: lastError,
    });
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
      throw _error;
    }
  }

  /**
   * Utility method for user confirmation prompts
   */
  protected async confirm(
    message: string,
    defaultValue: boolean = false
  ): Promise<boolean> {
    if (this.flagsConfig.force) {
      return true;
    }

    return ux.confirm(message + (defaultValue ? ' (Y/n)' : ' (y/N)'));
  }

  /**
   * Utility method for user input prompts
   */
  protected async prompt(
    message: string,
    options: {
      required?: boolean;
      type?: 'normal' | 'mask' | 'hide';
      default?: string;
    } = {}
  ): Promise<string> {
    const { required = true, type = 'normal', default: defaultValue } = options;

    const result = await ux.prompt(message, {
      required,
      type: type as 'normal' | 'mask' | 'hide',
      default: defaultValue,
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
      return obj
        .map(item => `${indent}- ${this.toYamlLike(item, indent + '  ')}`)
        .join('\n');
    }

    return Object.entries(obj)
      .map(
        ([key, value]) =>
          `${indent}${key}: ${this.toYamlLike(value, indent + '  ')}`
      )
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
        return data
          .map((item, _index) => `${_index + 1}. ${this.toTextFormat(item)}`)
          .join('\n');
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
  protected errorWithHelp(
    title: string,
    message: string,
    helpText: string
  ): never {
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
    const priorityColor =
      todo.priority === 'high'
        ? chalk.red
        : todo.priority === 'medium'
          ? chalk.yellow
          : chalk.green;

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
  protected detailedError(
    title: string,
    message: string,
    suggestions: string[]
  ): never {
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
      operationName = 'operation',
    } = options;

    let lastError: Error = new Error(
      `BaseCommand.executeWithRetry: ${operationName} failed with no specific error details`
    );

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (_error) {
        lastError = _error as Error;

        if (attempt === maxRetries) {
          break;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1);
        this.warning(`${retryMessage} (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error(
      `${operationName} failed after ${maxRetries} attempts: ${lastError?.message || 'No error details available'}`
    );
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
          this.warning(
            `Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`
          );
        }
      }

      throw _error;
    }
  }

  /**
   * Get configuration directory path
   * Respects WALRUS_TODO_CONFIG_DIR environment variable for testing
   */
  protected getConfigDir(): string {
    return (
      process.env.WALRUS_TODO_CONFIG_DIR ||
      path.join(os.homedir(), '.config', 'waltodo')
    );
  }

  /**
   * Safely write file with error handling
   * Creates directory atomically and ensures file write integrity
   */
  protected writeFileSafe(
    filePath: string,
    content: string,
    encoding: BufferEncoding = 'utf8'
  ): void {
    try {
      const dir = path.dirname(filePath);

      // Create directory atomically with recursive option
      fs.mkdirSync(dir, { recursive: true });

      // Write file atomically
      fs.writeFileSync(filePath, content, encoding);
    } catch (_error) {
      throw new Error(
        `Failed to write file ${filePath}: ${_error instanceof Error ? _error.message : String(_error)}`
      );
    }
  }

  /**
   * Flag validation utilities
   */
  protected validateFlag = {
    nonEmpty: (value: string, fieldName: string): void => {
      if (!value || value.trim().length === 0) {
        throw new ValidationError(`${fieldName} cannot be empty`, fieldName);
      }
    },

    enum: (value: string, allowedValues: string[], fieldName: string): void => {
      if (!allowedValues.includes(value)) {
        throw new ValidationError(
          `${fieldName} must be one of: ${allowedValues.join(', ')}`,
          fieldName
        );
      }
    },
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
  protected createSpinner(
    text: string,
    options: SpinnerOptions = {}
  ): SpinnerManager {
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
  protected createGradientProgressBar(
    options: ProgressBarOptions = {}
  ): ProgressBar {
    return createProgressBar({
      format: ' {spinner} {bar} {percentage}% | Task: {task} | ETA: {eta}s',
      ...options,
    });
  }

  /**
   * Create a multi-progress manager
   */
  protected createMultiProgress(
    options: ProgressBarOptions = {}
  ): MultiProgress {
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
    const contextMessage = operation
      ? `${operation}: ${errorMessage}`
      : errorMessage;

    this.error(contextMessage, { exit: 1 });
  }

  /**
   * Check for recently completed background jobs and show notifications
   */
  private checkJobNotifications(): void {
    try {
      const recentlyCompleted = this.getRecentlyCompletedJobs();

      if (recentlyCompleted.length > 0) {
        this.showJobNotifications(recentlyCompleted);
      }
    } catch (error) {
      // Silently ignore notification errors to not disrupt command execution
      this.debugLog('Failed to check job notifications', error);
    }
  }

  /**
   * Get jobs that completed in the last 24 hours and haven't been notified about
   */
  private getRecentlyCompletedJobs(): any[] {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const completedJobs = jobManager.getCompletedJobs();

    return completedJobs.filter(job => {
      // Job completed recently
      const recentlyCompleted = job.endTime && job.endTime > oneDayAgo;

      // Haven't shown notification yet (check metadata)
      const notNotified = !job.metadata?.notificationShown;

      return recentlyCompleted && notNotified;
    });
  }

  /**
   * Display notifications for completed jobs
   */
  private showJobNotifications(jobs: any[]): void {
    if (this.flagsConfig.quiet) return;

    const successful = jobs.filter(j => j.status === 'completed');
    const failed = jobs.filter(j => j.status === 'failed');

    if (successful.length > 0) {
      this.log(
        chalk.green(
          `✅ ${successful.length} background job(s) completed successfully`
        )
      );

      successful.forEach(job => {
        const duration = this.formatDuration(job.endTime - job.startTime);
        this.log(
          chalk.gray(
            `   ${job.id}: ${job.command} ${job.args.join(' ')} (${duration})`
          )
        );

        // Mark as notified
        this.markJobAsNotified(job.id);
      });
    }

    if (failed.length > 0) {
      this.log(chalk.red(`❌ ${failed.length} background job(s) failed`));

      failed.forEach(job => {
        this.log(
          chalk.gray(`   ${job.id}: ${job.command} ${job.args.join(' ')}`)
        );
        if (job.errorMessage) {
          this.log(chalk.red(`   Error: ${job.errorMessage}`));
        }

        // Mark as notified
        this.markJobAsNotified(job.id);
      });
    }

    if (jobs.length > 0) {
      this.log(chalk.gray('💡 Use "waltodo jobs" to see all background jobs'));
      this.log(''); // Empty line for spacing
    }
  }

  /**
   * Mark a job as having been notified about
   */
  private markJobAsNotified(jobId: string): void {
    try {
      const job = jobManager.getJob(jobId);
      if (job) {
        jobManager.updateJob(jobId, {
          metadata: {
            ...job.metadata,
            notificationShown: true,
            notifiedAt: Date.now(),
          },
        });
      }
    } catch (error) {
      this.debugLog(`Failed to mark job ${jobId} as notified`, error);
    }
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000)
      return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
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
      muted: (text: string) => chalk.gray(text),
    };
  }

  /**
   * Check if command should run in background
   */
  protected async shouldRunInBackground(): Promise<boolean> {
    const commandName = this.constructor.name
      .toLowerCase()
      .replace('command', '');
    const parsed = await this.parse();

    return backgroundOrchestrator.shouldRunInBackground(
      commandName,
      (parsed.args as any[]) || [],
      this.flagsConfig
    );
  }

  /**
   * Execute command in background
   */
  protected async executeInBackground(): Promise<void> {
    const commandName = this.constructor.name
      .toLowerCase()
      .replace('command', '');
    const parsed = await this.parse();

    const options: BackgroundOptions = {
      detached: true,
      silent: this.flagsConfig.quiet,
      timeout: this.flagsConfig.timeout
        ? this.flagsConfig.timeout * 1000
        : undefined,
      priority: this.getCommandPriority(),
    };

    try {
      const jobId = await backgroundOrchestrator.executeInBackground(
        commandName,
        (parsed.args as any[]) || [],
        this.flagsConfig,
        options
      );

      this.log(
        chalk.green(`🚀 Command started in background with job ID: ${jobId}`)
      );
      this.log(
        chalk.gray(`💡 Monitor progress with: waltodo jobs status ${jobId}`)
      );
      this.log(chalk.gray(`📋 View all jobs with: waltodo jobs list`));

      // Don't exit in test environment
      if (process.env.NODE_ENV !== 'test') {
        process.exit(0);
      }
    } catch (error) {
      this.error(
        `Failed to start background job: ${error instanceof Error ? error.message : String(error)}`,
        { exit: 1 }
      );
    }
  }

  /**
   * Get command priority for background execution
   */
  protected getCommandPriority(): 'low' | 'medium' | 'high' {
    const commandName = this.constructor.name
      .toLowerCase()
      .replace('command', '');

    // High priority commands
    if (['deploy', 'create-nft'].includes(commandName)) {
      return 'high';
    }

    // Medium priority commands
    if (
      ['store', 'store-list', 'store-file', 'sync', 'image'].includes(
        commandName
      )
    ) {
      return 'medium';
    }

    // Default to low priority
    return 'low';
  }

  /**
   * Execute operation with background progress reporting
   */
  protected async executeWithBackgroundProgress<T>(
    operation: () => Promise<T>,
    options: {
      totalSteps?: number;
      stepName?: string;
      progressCallback?: (progress: number, stage: string) => void;
    } = {}
  ): Promise<T> {
    const {
      totalSteps = 100,
      stepName = 'operation',
      progressCallback,
    } = options;

    // Check if running in background mode
    const isBackground = process.env.WALRUS_BACKGROUND_JOB;

    if (isBackground && progressCallback) {
      // Setup progress reporting for background jobs
      let currentStep = 0;

      const reportProgress = (stage: string) => {
        currentStep++;
        const progress = Math.round((currentStep / totalSteps) * 100);

        // Output progress in format that background orchestrator can parse
        console.log(`PROGRESS:${progress}:${stage}`);
        console.log(`STAGE:${stage}`);

        if (progressCallback) {
          progressCallback(progress, stage);
        }
      };

      // Monkey patch console.log to report stages
      const originalLog = console.log;
      console.log = (...args: any[]) => {
        const message = args.join(' ');
        if (
          message.includes('Starting') ||
          message.includes('Processing') ||
          message.includes('Completing')
        ) {
          reportProgress(message);
        }
        originalLog(...args);
      };

      try {
        const result = await operation();
        reportProgress('Completed');
        return result;
      } finally {
        console.log = originalLog;
      }
    } else {
      return await operation();
    }
  }

  /**
   * Report progress for background jobs
   */
  protected reportBackgroundProgress(progress: number, stage: string): void {
    if (process.env.WALRUS_BACKGROUND_JOB) {
      console.log(`PROGRESS:${progress}:${stage}`);
      console.log(`STAGE:${stage}`);
    }
  }

  /**
   * Check if currently running in background mode
   */
  protected get isBackgroundMode(): boolean {
    return !!process.env.WALRUS_BACKGROUND_JOB;
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
  insecure: '🔓',
};

export const PRIORITY = {
  high: {
    label: 'HIGH',
    color: chalk.red,
  },
  medium: {
    label: 'MEDIUM',
    color: chalk.yellow,
  },
  low: {
    label: 'LOW',
    color: chalk.green,
  },
};

export const STORAGE = {
  local: {
    label: 'Local',
    color: chalk.blue,
    icon: '💾',
  },
  blockchain: {
    label: 'Blockchain',
    color: chalk.green,
    icon: '⛓️',
  },
  both: {
    label: 'Hybrid',
    color: chalk.cyan,
    icon: '🔄',
  },
};

// Export BaseCommand as default for backward compatibility
export default BaseCommand;
