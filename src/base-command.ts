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

/**
 * Base class for all walrus todo commands
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
      this.error('Not authenticated. Please login first with "walrus account:auth --login USERNAME"');
      return null;
    }
    
    try {
      const data = fs.readFileSync(this.tokenPath, 'utf-8');
      const authInfo = JSON.parse(data);
      
      // Validate token
      const validation = await authenticationService.validateToken(authInfo.token);
      if (!validation.valid) {
        if (validation.expired) {
          this.error('Your session has expired. Please login again.');
        } else {
          this.error('Your session is invalid. Please login again.');
        }
        return null;
      }
      
      return validation.user;
    } catch (error) {
      this.error('Authentication failed. Please login again.');
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
    this.log(chalk.green(`✓ ${message}`));
  }

  /**
   * Display info message
   */
  protected info(message: string): void {
    if (this.shouldSuppressOutput()) return;
    this.log(chalk.blue(`ℹ ${message}`));
  }

  /**
   * Display warning message
   */
  protected warning(message: string): void {
    this.log(chalk.yellow(`⚠ ${message}`));
  }

  /**
   * Display verbose output if verbose flag is set
   * (Named debugLog to avoid conflict with Command.debug property)
   */
  protected debugLog(message: string, data?: any): void {
    if (!this.isVerbose()) return;

    this.log(chalk.dim(`🔍 ${message}`));
    if (data) {
      this.log(chalk.dim(JSON.stringify(data, null, 2)));
    }
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
    
    // Let the parent handle the display
    return super.catch(error);
  }

  /**
   * Clean up after command finishes
   */
  async finally(error: Error | undefined): Promise<any> {
    // Any cleanup needed
    return super.finally(error);
  }
}