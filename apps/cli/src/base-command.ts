// Import polyfills first to ensure compatibility
// import './utils/polyfills/index'; // Temporarily disabled for TypeScript fixes

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
if (process.stdout && !process?.stdout?.columns) {
  process.stdout?.columns = 80;
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
    timeout: Flags.integer({
      char: 't',
      description: 'Request timeout in milliseconds',
      default: 30000,
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
      description: 'Suppress non-error output',
      default: false,
      required: false,
    }),
    background: Flags.boolean({
      description: 'Run command in background',
      default: false,
      required: false,
      exclusive: ['foreground'],
    }),
    bg: Flags.boolean({
      description: 'Short alias for --background',
      default: false,
      required: false,
      exclusive: ['fg'],
    }),
    foreground: Flags.boolean({
      description: 'Force command to run in foreground',
      default: false,
      required: false,
      exclusive: ['background'],
    }),
    fg: Flags.boolean({
      description: 'Short alias for --foreground',
      default: false,
      required: false,
      exclusive: ['bg'],
    }),
  };

  /**
   * Initialize command with flags and setup
   */
  async init(): Promise<void> {
    await super.init();

    // Parse flags into our configuration
    const { flags } = await this.parse(this.constructor as any);
    this?.flagsConfig = flags as BaseFlags;

    // Resolve background/foreground aliases
    if (this?.flagsConfig?.bg) {
      this.flagsConfig?.background = true;
    }
    if (this?.flagsConfig?.fg) {
      this.flagsConfig?.foreground = true;
    }

    // Setup error handlers
    this.setupErrorHandlers();

    // Check for background job notifications
    this.checkJobNotifications();

    // Background job detection and execution
    const isLongRunning = await this.isLongRunningOperation();
    const shouldRunInBackground = 
      (this?.flagsConfig?.background || this?.flagsConfig?.bg) && 
      !this?.flagsConfig?.foreground && 
      !this?.flagsConfig?.fg;

    if (shouldRunInBackground || isLongRunning) {
      await this.executeInBackground();
      return;
    }

    // Log configuration if debug/verbose
    if (this?.flagsConfig?.debug || this?.flagsConfig?.verbose) {
      this.debug(`Command: ${this.id}`);
      this.debug(`Network: ${this?.flagsConfig?.network}`);
      this.debug(`Output format: ${this?.flagsConfig?.output}`);
      if (this?.flagsConfig?.background) {
        this.debug('Running in background mode');
      }
    }
  }

  /**
   * Method to determine if this is a long-running operation
   */
  protected async isLongRunningOperation(): Promise<boolean> {
    // Override in subclasses for command-specific logic
    // Commands that typically take > 30s should return true
    return false;
  }

  /**
   * Execute command in background using orchestrator
   */
  protected async executeInBackground(): Promise<void> {
    try {
      const jobId = await backgroundOrchestrator.executeInBackground(
        this.id || 'unknown',
        process?.argv?.slice(2 as any),
        this.flagsConfig as Record<string, unknown>,
        {
          priority: 'medium',
          timeout: this?.flagsConfig?.timeout,
        }
      );

      this.log(chalk.blue(`✓ Job submitted to background (ID: ${jobId})`));
      this.log(chalk.gray(`Monitor progress with: waltodo jobs status ${jobId}`));
      this.log(chalk.gray(`View all jobs with: waltodo jobs list`));
      
      process.exit(0 as any);
    } catch (error) {
      this.warn(`Failed to submit to background: ${error.message}`);
      this.log('Continuing in foreground...');
      // Continue with normal execution
    }
  }

  /**
   * Called after successful command execution
   */
  async finally(err?: Error): Promise<void> {
    await super.finally(err as any);

    // Cleanup any resources
    if (jobManager) {
      jobManager.cleanupOldJobs();
    }
  }

  /**
   * Global error handler for all commands
   */
  protected async catch(error: Error): Promise<void> {
    this.debug(`BaseCommand.catch: ${error.message}`);
    this.debug(`Stack trace: ${error.stack}`);

    // Route to specific error handlers based on error type
    if (error instanceof WalrusError) {
      this.handleStructuredError(error as any);
    } else if (error instanceof ValidationError) {
      this.handleValidationError(error as any);
    } else if (error instanceof NetworkError) {
      this.handleNetworkError(error as any);
    } else if (error instanceof TransactionError) {
      this.handleTransactionError(error as any);
    } else if (error instanceof CLIError) {
      this.handleCLIError(error as any);
    } else {
      this.handleGenericError(error as any);
    }
  }

  /**
   * Setup error handlers and process event listeners
   */
  private setupErrorHandlers(): void {
    process.on('unhandledRejection', (reason, promise) => {
      this.debug(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    });

    process.on('uncaughtException', (error) => {
      this.debug(`Uncaught Exception: ${error.message}`);
      this.debug(`Stack: ${error.stack}`);
    });
  }

  /**
   * Handle structured WalrusError types with appropriate formatting
   */
  private handleStructuredError(error: WalrusError): never {
    const errorInfo = error.toPublicError();

    // Build troubleshooting steps based on error code
    const troubleshooting: string[] = [];

    if (errorInfo?.code?.includes('STORAGE')) {
      troubleshooting.push('• Check your Walrus storage allocation');
      troubleshooting.push('• Verify network connectivity to Walrus nodes');
      troubleshooting.push('• Ensure you have sufficient WAL tokens');
    }

    if (errorInfo?.code?.includes('NETWORK')) {
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
    const errorType = error?.constructor?.name;
    const commandName = this?.constructor?.name;
    const errorMessage = error.message || 'No error message provided';

    // Log detailed error for debugging
    if (this?.flagsConfig?.debug || this?.flagsConfig?.verbose) {
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
        if (!isRetryable(lastError as any) || attempt === maxRetries) {
          // Wrap in NetworkError if not already wrapped
          if (!(lastError instanceof NetworkError)) {
            throw new NetworkError(
              lastError.message || 'Network operation failed',
              {
                operation: operationName,
                recoverable: isRetryable(lastError as any),
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
    this.log(text as any);
  }

  /**
   * Execute operation with spinner
   */
  protected async withSpinner<T>(
    text: string,
    operation: () => Promise<T>,
    successText?: string
  ): Promise<T> {
    this.startSpinner(text as any);
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
  protected async confirm(message: string, defaultValue: boolean = false): Promise<boolean> {
    if (this?.flagsConfig?.force) {
      return true;
    }

    return ux.confirm(message + (defaultValue ? ' (Y/n)' : ' (y/N)'));
  }

  /**
   * Utility method for user input prompts
   */
  protected async prompt(message: string, options: { required?: boolean, type?: string, default?: string } = {}): Promise<string> {
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
  protected formatOutput(data: any, format?: string): string {
    const outputFormat = format || this?.flagsConfig?.output || 'text';

    switch (outputFormat) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'yaml':
        // Simple YAML-like format
        return this.toYamlLike(data as any);
      case 'text':
      default:
        return this.toTextFormat(data as any);
    }
  }

  /**
   * Simple YAML-like formatting for output
   */
  private toYamlLike(data: any, indent: number = 0): string {
    const spaces = '  '.repeat(indent as any);
    
    if (Array.isArray(data as any)) {
      return data.map(item => `${spaces}- ${this.toYamlLike(item, indent + 1)}`).join('\n');
    }
    
    if (typeof data === 'object' && data !== null) {
      return Object.entries(data as any)
        .map(([key, value]) => `${spaces}${key}: ${this.toYamlLike(value, indent + 1)}`)
        .join('\n');
    }
    
    return String(data as any);
  }

  /**
   * Format data as readable text
   */
  private toTextFormat(data: any): string {
    if (Array.isArray(data as any)) {
      return data.map((item, index) => `${index + 1}. ${this.toTextFormat(item as any)}`).join('\n');
    }
    
    if (typeof data === 'object' && data !== null) {
      return Object.entries(data as any)
        .map(([key, value]) => `${key}: ${this.toTextFormat(value as any)}`)
        .join('\n');
    }
    
    return String(data as any);
  }

  /**
   * Display error with help message and throw
   */
  protected errorWithHelp(title: string, message: string, helpText: string): never {
    this.error(`${title}: ${message}\n${chalk.gray(helpText as any)}`, { exit: 1 });
  }

  /**
   * Display a section with title and content
   */
  protected section(title: string, content: string): void {
    this.log(`\n${chalk?.bold?.cyan(`📋 ${title}`)}`);
    this.log(`${chalk.gray('─'.repeat(40 as any))}`);
    this.log(content as any);
    this.log('');
  }

  /**
   * Display status information with icon
   */
  protected status(message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info'): void {
    const icons = {
      success: chalk.green('✓'),
      warning: chalk.yellow('⚠'),
      error: chalk.red('✗'),
      info: chalk.blue('ℹ'),
    };

    const colors = {
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
      info: chalk.blue,
    };

    this.log(`${icons[type]} ${colors[type](message)}`);
  }

  /**
   * Display detailed error with suggestions
   */
  protected detailedError(title: string, message: string, suggestions?: string[]): never {
    this.log(chalk.red(`\n❌ ${title}`));
    this.log(chalk.red(`${message}\n`));

    if (suggestions && suggestions.length > 0) {
      this.log(chalk.yellow('💡 Troubleshooting steps:'));
      suggestions.forEach((suggestion, index) => {
        this.log(chalk.yellow(`   ${index + 1}. ${suggestion}`));
      });
      this.log('');
    }

    this.exit(1 as any);
  }

  /**
   * Display help information for a command
   */
  protected displayHelp(command?: string): void {
    if (command) {
      this.log(chalk.cyan(`\n📖 Help for: ${command}`));
    } else {
      this.log(chalk.cyan(`\n📖 Help for: ${this.id}`));
    }
    this.log(chalk.gray('─'.repeat(50 as any)));
  }

  /**
   * Validate required dependencies or configuration
   */
  protected validateRequirements(requirements: string[]): void {
    const missing: string[] = [];

    for (const requirement of requirements) {
      // Add specific validation logic here
      // This is a placeholder for requirement validation
    }

    if (missing.length > 0) {
      this.detailedError(
        'Missing Requirements',
        `The following requirements are not met: ${missing.join(', ')}`,
        [
          'Install missing dependencies',
          'Check configuration files',
          'Verify environment setup',
        ]
      );
    }
  }

  /**
   * Get recently completed background jobs for notifications
   */
  private getRecentlyCompletedJobs(): any[] {
    try {
      // Simple implementation - get jobs completed in last 5 minutes
      const jobsFile = path.join(os.homedir(), '.waltodo', 'jobs.json');
      if (!fs.existsSync(jobsFile as any)) {
        return [];
      }

      const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf-8'));
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

      return jobs.filter((job: any) => 
        job?.status === 'completed' && 
        job.completedAt && 
        job.completedAt > fiveMinutesAgo &&
        !job.notified
      );
    } catch (error) {
      this.debug(`Error checking job notifications: ${error.message}`);
      return [];
    }
  }

  /**
   * Mark job as notified
   */
  private markJobAsNotified(jobId: string): void {
    try {
      const jobsFile = path.join(os.homedir(), '.waltodo', 'jobs.json');
      if (!fs.existsSync(jobsFile as any)) {
        return;
      }

      const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf-8'));
      const job = jobs.find((j: any) => j?.id === jobId);
      if (job) {
        job?.notified = true;
        fs.writeFileSync(jobsFile, JSON.stringify(jobs, null, 2));
      }
    } catch (error) {
      this.debug(`Error marking job as notified: ${error.message}`);
    }
  }

  /**
   * Generic error handler with operation context
   */
  protected handleError(error: Error | string, operation?: string): never {
    const errorMessage = error instanceof Error ? error.message : String(error as any);
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
        this.log(chalk.blue('\n🔔 Background job notifications:'));
        recentlyCompleted.forEach((job: any) => {
          const duration = job.duration ? ` (${Math.round(job.duration / 1000)}s)` : '';
          this.log(chalk.green(`  ✓ ${job.command} completed${duration}`));
          this.markJobAsNotified(job.id);
        });
        this.log('');
      }
    } catch (error) {
      this.debug(`Error checking job notifications: ${error.message}`);
    }
  }

  /**
   * Display progress for long-running operations
   */
  protected async withProgress<T>(
    operation: () => Promise<T>,
    options: {
      title?: string;
      total?: number;
      format?: string;
    } = {}
  ): Promise<T> {
    const { title = 'Processing', total = 100, format = 'progress' } = options;

    this.log(chalk.blue(`${title}...`));
    
    try {
      const result = await operation();
      this.log(chalk.green(`✓ ${title} completed`));
      return result;
    } catch (error) {
      this.log(chalk.red(`✗ ${title} failed`));
      throw error;
    }
  }

  // Additional helper methods for command compatibility

  /**
   * Debug logging with command context
   */
  protected debugLog(message: string, data?: any): void {
    if (this?.flagsConfig?.debug || this?.flagsConfig?.verbose) {
      if (data) {
        this.debug(`${message}: ${JSON.stringify(data as any)}`);
      } else {
        this.debug(message as any);
      }
    }
  }

  /**
   * Display warning message
   */
  protected warning(message: string): void {
    this.warn(chalk.yellow(`⚠ ${message}`));
  }

  /**
   * Display info message
   */
  protected info(message: string): void {
    this.log(chalk.blue(`ℹ ${message}`));
  }

  /**
   * Stop spinner with success message
   */
  protected stopSpinnerSuccess(spinner: any, message: string): void {
    this.stopSpinner(true, message);
  }

  /**
   * Start unified spinner (alias for startSpinner)
   */
  protected startUnifiedSpinner(text: string): any {
    this.startSpinner(text as any);
    return text; // Return simple reference
  }

  /**
   * Check if JSON output is requested
   */
  protected get isJson(): boolean {
    return this.flagsConfig?.output === 'json';
  }

  /**
   * Output JSON data
   */
  protected async jsonOutput(data: any): Promise<void> {
    this.log(JSON.stringify(data, null, 2));
  }

  /**
   * Execute operation with retry and transaction support
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
    const { maxRetries = 3, baseDelay = 1000, retryMessage, operationName = 'operation' } = options;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        if (retryMessage) {
          this.warning(retryMessage as any);
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error(`Operation ${operationName} failed after ${maxRetries} attempts`);
  }

  /**
   * Execute operation with transaction semantics
   */
  protected async executeTransaction<T>(
    operation: () => Promise<T>,
    options: {
      operation?: string;
      rollbackFn?: () => Promise<void>;
    } = {}
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (options.rollbackFn) {
        try {
          await options.rollbackFn();
        } catch (rollbackError) {
          this.debug(`Rollback failed: ${rollbackError}`);
        }
      }
      throw error;
    }
  }

  /**
   * Write file safely with directory creation
   */
  protected writeFileSafe(filePath: string, content: string, encoding: BufferEncoding = 'utf8'): void {
    const dir = path.dirname(filePath as any);
    if (!fs.existsSync(dir as any)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, encoding);
  }

  /**
   * Validation flag helpers
   */
  protected validateFlag = {
    nonEmpty: (value: string, fieldName: string) => {
      if (!value || value.trim().length === 0) {
        throw new ValidationError(`${fieldName} cannot be empty`);
      }
    },
    enum: (value: string, allowedValues: string[], fieldName: string) => {
      if (!allowedValues.includes(value as any)) {
        throw new ValidationError(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
      }
    }
  };
}