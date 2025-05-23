import { Flags, ux } from '@oclif/core';
import BaseCommand from '../../base-command';
import { authenticationService } from '../../services/authentication-service';
import { UserRole } from '../../types/permissions';
import { CLIError } from '../../types/errors/consolidated';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Manage authentication and user accounts
 */
export default class AuthCommand extends BaseCommand {
  static description = 'Handle user authentication including login, logout, registration and API key management';

  static examples = [
    '$ walrus account:auth --register username',
    '$ walrus account:auth --login username',
    '$ walrus account:auth --create-apikey "My API Key"',
    '$ walrus account:auth --logout',
    '$ walrus account:auth --status',
    '$ walrus account:auth --change-password',
  ];

  // Initialize ux from @oclif/core
  protected ux = ux;

  static flags = {
    ...BaseCommand.flags,
    register: Flags.string({
      description: 'Register a new user',
      exclusive: ['login', 'logout', 'status', 'change-password', 'create-apikey', 'revoke-apikey', 'list-apikeys'],
    }),
    login: Flags.string({
      description: 'Login with username',
      exclusive: ['register', 'logout', 'change-password', 'create-apikey', 'revoke-apikey', 'list-apikeys'],
    }),
    'create-apikey': Flags.string({
      description: 'Create a new API key with the given name',
      exclusive: ['register', 'login', 'logout', 'status', 'change-password', 'revoke-apikey'],
    }),
    'revoke-apikey': Flags.string({
      description: 'Revoke an API key',
      exclusive: ['register', 'login', 'logout', 'status', 'change-password', 'create-apikey', 'list-apikeys'],
    }),
    'list-apikeys': Flags.boolean({
      description: 'List all API keys for the current user',
      exclusive: ['register', 'login', 'logout', 'change-password', 'create-apikey', 'revoke-apikey'],
    }),
    role: Flags.string({
      description: 'Role for the new user',
      options: Object.values(UserRole),
      dependsOn: ['register'],
      default: UserRole.USER,
    }),
    password: Flags.string({
      description: 'Password (if not provided, will prompt)',
      dependsOn: ['register', 'login', 'change-password'],
    }),
    'new-password': Flags.string({
      description: 'New password (if not provided, will prompt)',
      dependsOn: ['change-password'],
    }),
    address: Flags.string({
      description: 'Blockchain wallet address for the user',
      dependsOn: ['register'],
    }),
    logout: Flags.boolean({
      description: 'Logout current user',
      exclusive: ['register', 'login', 'change-password', 'create-apikey', 'revoke-apikey', 'list-apikeys'],
    }),
    status: Flags.boolean({
      description: 'Show current authentication status',
      exclusive: ['register', 'login', 'logout', 'change-password', 'create-apikey', 'revoke-apikey', 'list-apikeys'],
    }),
    'change-password': Flags.boolean({
      description: 'Change password for current user',
      exclusive: ['register', 'login', 'logout', 'status', 'create-apikey', 'revoke-apikey', 'list-apikeys'],
    }),
    expiry: Flags.integer({
      description: 'Expiry in days for API key',
      dependsOn: ['create-apikey'],
      default: 365,
    }),
  };

  // Store the auth token filepath
  private authTokenFilePath = path.join(os.homedir(), '.walrus', 'auth.json');

  async run(): Promise<void> {
    const { flags } = await this.parse(AuthCommand);

    // Create the .walrus directory if it doesn't exist
    const walrusDir = path.dirname(this.authTokenFilePath);
    if (!fs.existsSync(walrusDir)) {
      fs.mkdirSync(walrusDir, { recursive: true });
    }

    if (flags.register) {
      await this.registerUser(flags.register, flags.password, flags.role as UserRole, flags.address);
    } else if (flags.login) {
      await this.login(flags.login, flags.password);
    } else if (flags.logout) {
      await this.logout();
    } else if (flags.status) {
      await this.showStatus();
    } else if (flags['change-password']) {
      await this.changePassword(flags.password, flags['new-password']);
    } else if (flags['create-apikey']) {
      await this.createApiKey(flags['create-apikey'], flags.expiry);
    } else if (flags['revoke-apikey']) {
      await this.revokeApiKey(flags['revoke-apikey']);
    } else if (flags['list-apikeys']) {
      await this.listApiKeys();
    } else {
      this.log('Please specify an action to perform. See --help for details.');
    }
  }

  /**
   * Register a new user
   */
  private async registerUser(username: string, password?: string, role: UserRole = UserRole.USER, address?: string): Promise<void> {
    try {
      // Prompt for password if not provided
      if (!password) {
        password = await this.ux.prompt('Enter password', { type: 'hide' });
        const confirm = await this.ux.prompt('Confirm password', { type: 'hide' });
        if (password !== confirm) {
          this.error('Passwords do not match');
          return;
        }
      }

      // Create user
      const user = await authenticationService.createUserAccount(username, password, address, [role]);

      this.log(chalk.green(`User ${username} created successfully`));
      this.log(`User ID: ${user.id}`);
      this.log(`Role: ${user.roles.join(', ')}`);
      if (address) {
        this.log(`Wallet Address: ${address}`);
      }
    } catch (error) {
      if (error instanceof CLIError) {
        this.error(error.message);
      } else {
        this.error(`Failed to register user: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Login with username and password
   */
  private async login(username: string, password?: string): Promise<void> {
    try {
      // Prompt for password if not provided
      if (!password) {
        password = await this.ux.prompt('Enter password', { type: 'hide' });
      }

      // Login
      const authResult = await authenticationService.authenticateWithCredentials(username, password);

      // Store token
      this.saveAuthToken(authResult.token, authResult.refreshToken, authResult.expiresAt);

      this.log(chalk.green(`Logged in as ${username}`));
      this.log(`Roles: ${authResult.user.roles.join(', ')}`);
      this.log(`Session expires at: ${new Date(authResult.expiresAt).toLocaleString()}`);
    } catch (error) {
      if (error instanceof CLIError) {
        this.error(error.message);
      } else {
        this.error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Logout current user
   */
  private async logout(): Promise<void> {
    try {
      const authInfo = this.getAuthToken();
      if (!authInfo) {
        this.log('Not currently logged in');
        return;
      }

      // Invalidate session
      await authenticationService.invalidateSession(authInfo.token);

      // Remove token file
      fs.unlinkSync(this.authTokenFilePath);

      this.log(chalk.green('Logged out successfully'));
    } catch (error) {
      this.error(`Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Show current authentication status
   */
  private async showStatus(): Promise<void> {
    const authInfo = this.getAuthToken();
    if (!authInfo) {
      this.log('Not currently logged in');
      return;
    }

    try {
      // Validate token
      const validation = await authenticationService.validateToken(authInfo.token);

      if (!validation.valid) {
        if (validation.expired) {
          this.log(chalk.yellow('Your session has expired. Please login again.'));
        } else {
          this.log(chalk.red('Your session is invalid. Please login again.'));
        }
        return;
      }

      const user = validation.user;
      this.log(chalk.green(`Logged in as ${user.username}`));
      this.log(`User ID: ${user.id}`);
      this.log(`Roles: ${user.roles.join(', ')}`);
      if (user.address) {
        this.log(`Wallet Address: ${user.address}`);
      }
      this.log(`Session expires at: ${new Date(authInfo.expiresAt).toLocaleString()}`);
    } catch (error) {
      this.error(`Failed to check status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Change password for current user
   */
  private async changePassword(currentPassword?: string, newPassword?: string): Promise<void> {
    const authInfo = this.getAuthToken();
    if (!authInfo) {
      this.error('You must be logged in to change your password');
      return;
    }

    try {
      // Validate token
      const validation = await authenticationService.validateToken(authInfo.token);

      if (!validation.valid) {
        if (validation.expired) {
          this.error('Your session has expired. Please login again.');
        } else {
          this.error('Your session is invalid. Please login again.');
        }
        return;
      }

      // Prompt for current password if not provided
      if (!currentPassword) {
        currentPassword = await this.ux.prompt('Enter current password', { type: 'hide' });
      }

      // Prompt for new password if not provided
      if (!newPassword) {
        newPassword = await this.ux.prompt('Enter new password', { type: 'hide' });
        const confirm = await this.ux.prompt('Confirm new password', { type: 'hide' });
        if (newPassword !== confirm) {
          this.error('Passwords do not match');
          return;
        }
      }

      // Change password
      await authenticationService.changePassword(validation.user.id, currentPassword, newPassword);

      // Remove token since all sessions are invalidated
      fs.unlinkSync(this.authTokenFilePath);

      this.log(chalk.green('Password changed successfully. Please login again with your new password.'));
    } catch (error) {
      if (error instanceof CLIError) {
        this.error(error.message);
      } else {
        this.error(`Failed to change password: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Create a new API key
   */
  private async createApiKey(name: string, expiryDays: number): Promise<void> {
    const authInfo = this.getAuthToken();
    if (!authInfo) {
      this.error('You must be logged in to create an API key');
      return;
    }

    try {
      // Validate token
      const validation = await authenticationService.validateToken(authInfo.token);

      if (!validation.valid) {
        if (validation.expired) {
          this.error('Your session has expired. Please login again.');
        } else {
          this.error('Your session is invalid. Please login again.');
        }
        return;
      }

      // Create API key
      const apiKey = await authenticationService.createApiKey(validation.user.id, name, expiryDays);

      this.log(chalk.green(`API key created successfully`));
      this.log(`Key: ${apiKey}`);
      this.log(`Name: ${name}`);
      this.log(`Expiry: ${expiryDays === 0 ? 'Never' : `${expiryDays} days`}`);
      this.log(chalk.yellow('Please save this key now, it will not be shown again!'));
    } catch (error) {
      if (error instanceof CLIError) {
        this.error(error.message);
      } else {
        this.error(`Failed to create API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Revoke an API key
   */
  private async revokeApiKey(apiKey: string): Promise<void> {
    const authInfo = this.getAuthToken();
    if (!authInfo) {
      this.error('You must be logged in to revoke an API key');
      return;
    }

    try {
      // Validate token
      const validation = await authenticationService.validateToken(authInfo.token);

      if (!validation.valid) {
        if (validation.expired) {
          this.error('Your session has expired. Please login again.');
        } else {
          this.error('Your session is invalid. Please login again.');
        }
        return;
      }

      // Revoke API key
      await authenticationService.revokeApiKey(apiKey);

      this.log(chalk.green(`API key revoked successfully`));
    } catch (error) {
      if (error instanceof CLIError) {
        this.error(error.message);
      } else {
        this.error(`Failed to revoke API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * List all API keys for the current user
   */
  private async listApiKeys(): Promise<void> {
    // This function is a placeholder since we don't have actual API key listing functionality
    // implemented in the authentication service
    this.log(chalk.yellow('API key listing is not currently implemented'));
  }

  /**
   * Save authentication token to file
   */
  private saveAuthToken(token: string, refreshToken: string, expiresAt: number): void {
    const authInfo = {
      token,
      refreshToken,
      expiresAt
    };

    fs.writeFileSync(this.authTokenFilePath, JSON.stringify(authInfo, null, 2));
    fs.chmodSync(this.authTokenFilePath, 0o600); // Secure file permissions
  }

  /**
   * Get authentication token from file
   */
  private getAuthToken(): { token: string; refreshToken: string; expiresAt: number } | null {
    if (!fs.existsSync(this.authTokenFilePath)) {
      return null;
    }

    try {
      const data = fs.readFileSync(this.authTokenFilePath, 'utf-8');
      return JSON.parse(data);
    } catch (_error) {
      return null;
    }
  }
}