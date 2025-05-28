import { Flags, Args } from '@oclif/core';
import BaseCommand from '../../base-command';
import { secureCredentialService } from '../../services/ai/SecureCredentialService';
import { AIPermissionLevel } from '../../types/adapters/AICredentialAdapter';
import { validateApiKey } from '../../utils/KeyValidator';
import {
  getProviderEnum,
  getProviderString,
} from '../../utils/adapters/ai-provider-adapter';
import chalk = require('chalk');
import { CLIError } from '../../types/errors/consolidated';

/**
 * Manage API credentials for AI providers
 */
export default class Credentials extends BaseCommand {
  static description =
    'Store, rotate and manage API keys for AI providers with secure encryption';

  static examples = [
    '<%= config.bin %> ai credentials add xai --key YOUR_API_KEY              # Add XAI key',
    '<%= config.bin %> ai credentials list                                    # List all credentials',
    '<%= config.bin %> ai credentials remove openai                           # Remove OpenAI key',
    '<%= config.bin %> ai credentials verify xai                              # Verify XAI key',
    '<%= config.bin %> ai credentials rotate xai --key NEW_API_KEY            # Rotate key',
    '<%= config.bin %> ai credentials add anthropic --key KEY --verify        # Add and verify',
    '<%= config.bin %> ai credentials list --show-status                      # List with status',
    '<%= config.bin %> ai credentials backup                                  # Backup credentials',
  ];

  static flags = {
    ...BaseCommand.flags,
    key: Flags.string({
      char: 'k',
      description: 'API key to add',
      required: false,
    }),
    verify: Flags.boolean({
      char: 'v',
      description: 'Verify credentials on blockchain',
      required: false,
      default: false,
    }),
    permission: Flags.string({
      char: 'p',
      description:
        'Permission level (no_access, read_only, standard, advanced, admin)',
      required: false,
      options: ['no_access', 'read_only', 'standard', 'advanced', 'admin'],
      default: 'standard',
    }),
    expiry: Flags.integer({
      char: 'e',
      description: 'Expiry in days',
      required: false,
    }),
    rotation: Flags.integer({
      char: 'r',
      description: 'Rotation period in days',
      required: false,
    }),
  };

  static args = {
    action: Args.string({
      name: 'action',
      description: 'Action to perform (add, list, remove, verify, rotate)',
      required: true,
      options: ['add', 'list', 'remove', 'verify', 'rotate', 'permissions'],
    }),
    provider: Args.string({
      name: 'provider',
      description: 'AI provider (xai, openai, anthropic)',
      required: false,
      options: ['xai', 'openai', 'anthropic'],
    }),
  };

  async run() {
    const { args, flags } = await this.parse(Credentials);

    switch (args.action) {
      case 'add':
        if (!args.provider) {
          this.error('Provider is required for add action');
        }
        return this.addCredential(args.provider, flags);

      case 'list':
        return this.listCredentials(flags);

      case 'remove':
        if (!args.provider) {
          this.error('Provider is required for remove action');
        }
        return this.removeCredential(args.provider);

      case 'verify':
        if (!args.provider) {
          this.error('Provider is required for verify action');
        }
        return this.verifyCredential(args.provider);

      case 'rotate':
        if (!args.provider) {
          this.error('Provider is required for rotate action');
        }
        return this.rotateCredential(args.provider, flags);

      case 'permissions':
        if (!args.provider) {
          this.error('Provider is required for permissions action');
        }
        return this.updatePermissions(args.provider, flags);

      default:
        this.error(`Unknown action: ${args.action}`);
    }
  }

  /**
   * Add a new credential
   */
  private async addCredential(provider: string, flags: { key?: string; verify?: boolean; permission?: string; expiry?: number; rotation?: number; json?: boolean }) {
    if (!provider) {
      this.error('Provider is required');
    }

    let apiKey = flags.key;
    if (!apiKey) {
      // Prompt for API key securely
      apiKey = await this.securePrompt(`Enter API key for ${provider}:`);
    }

    // Convert permission flag to enum
    const permissionMap: Record<string, AIPermissionLevel> = {
      no_access: AIPermissionLevel.NO_ACCESS,
      read_only: AIPermissionLevel.READ_ONLY,
      standard: AIPermissionLevel.STANDARD,
      advanced: AIPermissionLevel.ADVANCED,
      admin: AIPermissionLevel.ADMIN,
    };

    const permissionLevel =
      (flags.permission && permissionMap[flags.permission]) || AIPermissionLevel.STANDARD;

    try {
      // Convert string provider to AIProvider enum value and back to string
      // This ensures we have a valid AIProvider type from the AI types module
      const providerEnum = getProviderEnum(provider);
      const providerString = getProviderString(providerEnum);

      // The type cast is needed because the AIProvider in SecureCredentialService
      // is different from the AIProvider enum in AIModelAdapter
      const result = await secureCredentialService.storeCredential(
        providerString as 'openai' | 'anthropic' | 'xai',
        apiKey,
        {
          permissionLevel,
          expiryDays: flags.expiry,
          verifyOnChain: flags.verify,
          rotationDays: flags.rotation,
        }
      );

      if (flags.json) {
        this.log(JSON.stringify(result, null, 2));
      } else {
        this.log(`✅ API key for ${chalk.green(provider)} added successfully`);

        if (result.verified) {
          this.log(`${chalk.green('✓')} Verified on blockchain`);
        }

        if (result.expiresAt) {
          this.log(
            `${chalk.yellow('ℹ')} Expires on: ${new Date(result.expiresAt).toLocaleDateString()}`
          );
        }

        if (result.rotationDue) {
          this.log(
            `${chalk.yellow('ℹ')} Rotation due: ${new Date(result.rotationDue).toLocaleDateString()}`
          );
        }

        if (!result.isSafeToUse) {
          this.log(`${chalk.red('⚠')} Security issues detected:`);
          for (const issue of result.securityIssues || []) {
            this.log(`  ${chalk.red('-')} ${issue}`);
          }
        }
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to add credential: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * List all credentials
   */
  private async listCredentials(flags: { json?: boolean }) {
    try {
      // listCredentials doesn't need any type conversion because it returns an array of credentials
      // that already have the correct AIProvider type
      const credentials = await secureCredentialService.listCredentials();

      if (flags.json) {
        this.log(JSON.stringify(credentials, null, 2));
        return;
      }

      if (credentials.length === 0) {
        this.log('No API credentials found.');
        this.log(
          `Use '${chalk.cyan('walrus_todo ai credentials add <provider> --key YOUR_API_KEY')}' to add one.`
        );
        return;
      }

      this.log(chalk.bold('API Credentials:'));

      for (const cred of credentials) {
        const expiry = cred.expiresAt
          ? `expires ${new Date(cred.expiresAt).toLocaleDateString()}`
          : 'no expiry';
        const verified = cred.verified
          ? chalk.green('✓ verified')
          : chalk.gray('not verified');

        // Get permission level name
        const permissionName =
          Object.entries(AIPermissionLevel)
            .find(([_, value]) => value === cred.permissionLevel)?.[0]
            ?.toLowerCase() || 'standard';

        this.log(
          `${chalk.green(cred.provider.padEnd(10))} | ${chalk.yellow(permissionName.padEnd(10))} | ` +
            `${verified.padEnd(15)} | ${chalk.blue(expiry)}`
        );

        if (cred.rotationDue) {
          const now = new Date();
          const rotationDate = new Date(cred.rotationDue);
          const daysToRotation = Math.ceil(
            (rotationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysToRotation <= 0) {
            this.log(`  ${chalk.red('⚠ Rotation overdue')}`);
          } else if (daysToRotation < 7) {
            this.log(
              `  ${chalk.yellow(`⚠ Rotation due in ${daysToRotation} days`)}`
            );
          }
        }
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to list credentials: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Remove a credential
   */
  private async removeCredential(provider: string) {
    if (!provider) {
      this.error('Provider is required');
    }

    try {
      // Convert string provider to AIProvider enum
      const providerEnum = getProviderEnum(provider);

      // First check if credential exists
      const providerString = getProviderString(providerEnum);
      if (
        !(await secureCredentialService.hasCredential(providerString as 'openai' | 'anthropic' | 'xai'))
      ) {
        throw new CLIError(`No credential found for ${provider}`);
      }

      // Confirm removal
      const confirmed = await this.confirm(
        `Are you sure you want to remove the API key for ${provider}?`
      );
      if (!confirmed) {
        this.log('Operation cancelled.');
        return;
      }

      const removed = await secureCredentialService.removeCredential(
        providerString as 'openai' | 'anthropic' | 'xai'
      );

      if (removed) {
        this.log(
          `✅ API key for ${chalk.green(provider)} removed successfully`
        );
      } else {
        this.log(`No API key found for ${provider}`);
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to remove credential: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Verify a credential on the blockchain
   */
  private async verifyCredential(provider: string) {
    if (!provider) {
      this.error('Provider is required');
    }

    try {
      // Convert string provider to AIProvider enum
      const providerEnum = getProviderEnum(provider);
      const providerString = getProviderString(providerEnum);
      const verified = await secureCredentialService.verifyCredential(
        providerString as 'openai' | 'anthropic' | 'xai'
      );

      if (verified) {
        this.log(
          `✅ API key for ${chalk.green(provider)} verified successfully on blockchain`
        );
      } else {
        this.log(`Failed to verify API key for ${provider} on blockchain`);
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Verification failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Rotate a credential
   */
  private async rotateCredential(provider: string, flags: { key?: string; json?: boolean }) {
    if (!provider) {
      this.error('Provider is required');
    }

    let newApiKey = flags.key;
    if (!newApiKey) {
      // Prompt for new API key securely
      newApiKey = await this.securePrompt(`Enter new API key for ${provider}:`);
    }

    try {
      // Validate new key first
      validateApiKey(provider, newApiKey);

      // Convert string provider to AIProvider enum
      const providerEnum = getProviderEnum(provider);
      const providerString = getProviderString(providerEnum);

      // Confirm rotation
      const confirmed = await this.confirm(
        `Are you sure you want to replace the existing API key for ${provider}?`
      );

      if (!confirmed) {
        this.log('Operation cancelled.');
        return;
      }

      const result = await secureCredentialService.rotateCredential(
        providerString as 'openai' | 'anthropic' | 'xai',
        newApiKey
      );

      if (flags.json) {
        this.log(JSON.stringify(result, null, 2));
      } else {
        this.log(
          `✅ API key for ${chalk.green(provider)} rotated successfully`
        );

        if (result.verified) {
          this.log(`${chalk.green('✓')} Verified on blockchain`);
        }

        if (result.expiresAt) {
          this.log(
            `${chalk.yellow('ℹ')} Expires on: ${new Date(result.expiresAt).toLocaleDateString()}`
          );
        }

        if (result.rotationDue) {
          this.log(
            `${chalk.yellow('ℹ')} Next rotation due: ${new Date(result.rotationDue).toLocaleDateString()}`
          );
        }
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to rotate credential: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Update credential permissions
   */
  private async updatePermissions(provider: string, flags: { permission?: string; json?: boolean }) {
    if (!provider) {
      this.error('Provider is required');
    }

    // Convert permission flag to enum
    const permissionMap: Record<string, AIPermissionLevel> = {
      no_access: AIPermissionLevel.NO_ACCESS,
      read_only: AIPermissionLevel.READ_ONLY,
      standard: AIPermissionLevel.STANDARD,
      advanced: AIPermissionLevel.ADVANCED,
      admin: AIPermissionLevel.ADMIN,
    };

    const permissionLevel =
      (flags.permission && permissionMap[flags.permission]) || AIPermissionLevel.STANDARD;

    try {
      // Convert string provider to AIProvider enum
      const providerEnum = getProviderEnum(provider);
      const providerString = getProviderString(providerEnum);
      const result = await secureCredentialService.updatePermissions(
        providerString as 'openai' | 'anthropic' | 'xai',
        permissionLevel
      );

      if (flags.json) {
        this.log(JSON.stringify(result, null, 2));
      } else {
        this.log(
          `✅ Permission level for ${chalk.green(provider)} updated to ${chalk.yellow(flags.permission)}`
        );

        if (result.verified) {
          this.log(`${chalk.green('✓')} Updated on blockchain`);
        }
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to update permissions: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Helper to show a secure password prompt
   */
  private async securePrompt(message: string): Promise<string> {
    const { default: inquirer } = await import('inquirer');
    const { value } = await inquirer.prompt([
      {
        type: 'password',
        name: 'value',
        message,
        mask: '*',
      },
    ]);
    return value;
  }

  /**
   * Helper to show a confirmation prompt
   * Override the inherited confirm method with same signature
   */
  protected async confirm(
    message: string,
    defaultValue?: boolean
  ): Promise<boolean> {
    const { default: inquirer } = await import('inquirer');
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message,
        default: defaultValue || false,
      },
    ]);
    return confirmed;
  }
}
