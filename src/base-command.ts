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
    // Build error message - always show this even in quiet mode
    let output = `\n${chalk.bgRed.white(' OOPS! ')} ${chalk.red.bold(title)}\n`;
    output += `${chalk.red(ICONS.ERROR)} ${message}\n`;

    if (suggestion) {
      output += `\n${chalk.yellow(ICONS.INFO)} ${chalk.yellow('Pro tip:')}\n`;
      output += `  ${chalk.cyan(suggestion)}\n`;
    }

    // Log the output before throwing the error
    console.error(output);
    throw new CLIError(message, 'FORMATTED_ERROR');
  }

  /**
   * Display detailed error message with troubleshooting steps - with encouragement
   */
  protected detailedError(title: string, message: string, troubleshooting: string[]): void {
    // Build error message - always show this even in quiet mode
    let output = `\n${chalk.bgRed.white(' WHOOPS! ')} ${chalk.red.bold(title)}\n`;
    output += `${chalk.red(ICONS.ERROR)} ${message}\n`;

    // Add troubleshooting steps with a more friendly intro
    if (troubleshooting.length > 0) {
      output += `\n${chalk.yellow(ICONS.INFO)} ${chalk.yellow('Let\'s fix this together:')}\n`;
      troubleshooting.forEach((step, i) => {
        output += `  ${chalk.cyan(`${i + 1}.`)} ${chalk.white(step)}\n`;
      });

      // Add an encouraging message at the end
      output += `\n${chalk.green('You\'ve got this! 💪')}\n`;
    }

    // Log the output before throwing the error
    console.error(output);
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
    // Simple regex to remove ANSI escape codes
    return text.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, '');
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