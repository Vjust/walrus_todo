import { Command, Flags } from '@oclif/core';
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

/**
 * Icons used throughout the CLI for consistent appearance
 */
export const ICONS = {
  // Status icons
  SUCCESS: '✓',
  ERROR: '✖',
  WARNING: '⚠',
  INFO: 'ℹ',
  PENDING: '○',
  ACTIVE: '●',
  LOADING: '⏳',
  DEBUG: '🔍',

  // Object icons
  TODO: '📝',
  LIST: '📋',
  LISTS: '📚',
  TAG: '🏷️',
  PRIORITY: '⚡',
  DATE: '📅',
  TIME: '⏱️',

  // Feature icons
  BLOCKCHAIN: '🔗',
  WALRUS: '🧠',
  LOCAL: '💻',
  HYBRID: '🔄',
  AI: '🤖',
  STORAGE: '💾',
  CONFIG: '⚙️',
  USER: '👤',
  SEARCH: '🔎',
  SECURE: '🔒',
  INSECURE: '🔓',

  // UI elements
  BULLET: '•',
  ARROW: '→',
  BOX_V: '│',
  BOX_H: '─',
  BOX_TL: '┌',
  BOX_TR: '┐',
  BOX_BL: '└',
  BOX_BR: '┘',
  LINE: '·'
};

/**
 * Priority-related constants
 */
export const PRIORITY = {
  high: {
    color: chalk.red,
    icon: ICONS.PRIORITY,
    label: 'HIGH',
    value: 3
  },
  medium: {
    color: chalk.yellow,
    icon: ICONS.PRIORITY,
    label: 'MEDIUM',
    value: 2
  },
  low: {
    color: chalk.green,
    icon: ICONS.PRIORITY,
    label: 'LOW',
    value: 1
  }
};

/**
 * Storage-related constants
 */
export const STORAGE = {
  local: {
    color: chalk.green,
    icon: ICONS.LOCAL,
    label: 'Local only'
  },
  blockchain: {
    color: chalk.blue,
    icon: ICONS.BLOCKCHAIN,
    label: 'Blockchain only'
  },
  both: {
    color: chalk.magenta,
    icon: ICONS.HYBRID,
    label: 'Local & Blockchain'
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

  private logger: Logger = Logger.getInstance();
  protected tokenPath = path.join(os.homedir(), '.walrus', 'auth.json');

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
   * Display success message
   */
  protected success(message: string): void {
    if (this.shouldSuppressOutput()) return;
    this.log(chalk.green(`${ICONS.SUCCESS} ${message}`));
  }

  /**
   * Display info message
   */
  protected info(message: string): void {
    if (this.shouldSuppressOutput()) return;
    this.log(chalk.blue(`${ICONS.INFO} ${message}`));
  }

  /**
   * Display warning message
   */
  protected warning(message: string): void {
    if (this.shouldSuppressOutput()) return;
    this.log(chalk.yellow(`${ICONS.WARNING} ${message}`));
  }

  /**
   * Display error message with possible solution
   */
  protected errorWithHelp(title: string, message: string, suggestion?: string): void {
    // Build error message - always show this even in quiet mode
    let output = `\n${chalk.bgRed.white(' ERROR ')} ${chalk.red.bold(title)}\n`;
    output += `${chalk.red(ICONS.ERROR)} ${message}\n`;

    if (suggestion) {
      output += `\n${chalk.yellow(ICONS.INFO)} ${chalk.yellow('Suggestion:')}\n`;
      output += `  ${chalk.cyan(suggestion)}\n`;
    }

    throw new CLIError(message, 'FORMATTED_ERROR');
  }

  /**
   * Display detailed error message with troubleshooting steps
   */
  protected detailedError(title: string, message: string, troubleshooting: string[]): void {
    // Build error message - always show this even in quiet mode
    let output = `\n${chalk.bgRed.white(' ERROR ')} ${chalk.red.bold(title)}\n`;
    output += `${chalk.red(ICONS.ERROR)} ${message}\n`;

    // Add troubleshooting steps
    if (troubleshooting.length > 0) {
      output += `\n${chalk.yellow(ICONS.INFO)} ${chalk.yellow('Troubleshooting:')}\n`;
      troubleshooting.forEach((step, i) => {
        output += `  ${chalk.yellow(i + 1)}. ${step}\n`;
      });
    }

    throw new CLIError(message, 'DETAILED_ERROR');
  }

  /**
   * Display verbose output if verbose flag is set
   * (Named debugLog to avoid conflict with Command.debug property)
   */
  protected debugLog(message: string, data?: any): void {
    if (!this.isVerbose()) return;

    this.log(chalk.dim(`${ICONS.DEBUG} ${message}`));
    if (data) {
      this.log(chalk.dim(JSON.stringify(data, null, 2)));
    }
  }

  /**
   * Draw a titled section with a box around it
   * Creates a visually distinct box with a title bar for structured content display.
   * The box automatically adjusts width based on content.
   *
   * @param title Section title displayed in the box header
   * @param content Content to display inside the box (can be multi-line)
   */
  protected section(title: string, content: string): void {
    if (this.shouldSuppressOutput()) return;

    const lines = content.split('\n');
    const width = Math.max(...lines.map(line => this.stripAnsi(line).length), title.length + 4);

    // Top border with title
    this.log(`${ICONS.BOX_TL}${ICONS.BOX_H}[ ${chalk.bold(title)} ]${ICONS.BOX_H.repeat(width - title.length - 4)}${ICONS.BOX_TR}`);

    // Content
    lines.forEach(line => {
      const rawLine = this.stripAnsi(line);
      const padding = width - rawLine.length;
      this.log(`${ICONS.BOX_V} ${line}${' '.repeat(padding)} ${ICONS.BOX_V}`);
    });

    // Bottom border
    this.log(`${ICONS.BOX_BL}${ICONS.BOX_H.repeat(width + 2)}${ICONS.BOX_BR}`);
  }

  /**
   * Create a simple formatted list with title
   */
  protected simpleList(title: string, items: string[]): void {
    if (this.shouldSuppressOutput()) return;

    this.log(chalk.bold(`\n${title}:`));
    items.forEach(item => this.log(`  ${ICONS.BULLET} ${item}`));
    this.log('');
  }

  /**
   * Format a todo item for display with consistent styling
   * Creates a human-readable string representation of a todo item with:
   * - Status indicator (completed/pending)
   * - Priority indicator with appropriate color
   * - Title
   * - Optional details (due date, tags, privacy status)
   *
   * @param todo Todo item to format
   * @param showDetail Whether to include detailed information (default: true)
   * @returns Formatted string ready for display
   */
  protected formatTodo(todo: any, showDetail: boolean = true): string {
    const status = todo.completed
      ? chalk.green(ICONS.SUCCESS)
      : chalk.yellow(ICONS.PENDING);

    const priority = PRIORITY[todo.priority as keyof typeof PRIORITY]
      || PRIORITY.medium;

    const priorityLabel = priority.color(priority.icon);

    let output = `${status} ${priorityLabel} ${todo.title}`;

    if (showDetail && (todo.dueDate || (todo.tags && todo.tags.length) || todo.private)) {
      const details = [
        todo.dueDate && `${ICONS.DATE} Due: ${todo.dueDate}`,
        todo.tags?.length && `${ICONS.TAG} Tags: ${todo.tags.join(', ')}`,
        todo.private && `${ICONS.SECURE} Private`
      ].filter(Boolean);

      if (details.length) {
        output += `\n   ${chalk.dim(details.join(' | '))}`;
      }
    }

    return output;
  }

  /**
   * Format a storage icon and label
   */
  protected formatStorage(storageType: string): string {
    const storage = STORAGE[storageType as keyof typeof STORAGE] || STORAGE.local;
    return `${storage.icon} ${storage.color(storage.label)}`;
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
    // Simple regex to remove ANSI escape codes
    return text.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, '');
  }

  /**
   * Initialize command
   */
  async init(): Promise<void> {
    await super.init();

    // Handle color disabling - use direct argv checking for initialization
    if (this.isNoColor()) {
      chalk.level = 0;
    }
  }

  /**
   * Handle command errors
   */
  async catch(error: Error): Promise<any> {
    // Log the error
    this.logger.error(`Command error: ${error.message}`, error);

    // If this is a formatted error we've already handled, just let it propagate
    if (error instanceof CLIError &&
        (error.code === 'FORMATTED_ERROR' || error.code === 'DETAILED_ERROR')) {
      return super.catch(error);
    }

    // For other errors, provide a more user-friendly format
    if (error instanceof CLIError) {
      console.error(`\n${chalk.bgRed.white(' ERROR ')} ${chalk.red.bold(error.code || 'Command Failed')}`);
      console.error(`${chalk.red(ICONS.ERROR)} ${error.message}\n`);

      // Don't display the full stack trace to users for cleaner output
      // but still log it for troubleshooting
      this.logger.error('Stack trace:', error);

      // Exit with error code
      process.exit(1);
    }

    // Let the parent handle the display for non-CLIErrors
    return super.catch(error);
  }

  /**
   * Clean up after command finishes
   */
  async finally(error: Error | undefined): Promise<any> {
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
}