import { Flags, Args, ux } from '@oclif/core';
import BaseCommand from '../../base-command';
import { AIProvider } from '../../services/ai/types';
import {
  credentialManager,
  ApiKeyValidator,
} from '../../services/ai/credentials';
import {
  AIPermissionLevel,
  CredentialType,
} from '../../types/adapters/AICredentialAdapter';
import chalk = require('chalk');
import { getErrorMessage, hasCode } from '../../utils/type-guards';

export default class Credentials extends BaseCommand {
  static description =
    'Manage AI provider API keys with blockchain verification and advanced security features';

  // Use string-based AIProvider type directly

  static flags = {
    ...BaseCommand.flags,
    verify: Flags.boolean({
      char: 'v',
      description: 'Verify credential on blockchain',
      default: false,
    }),
    key: Flags.string({
      char: 'k',
      description: 'API key to store',
      required: false,
    }),
    permission: Flags.string({
      char: 'p',
      description: 'Permission level for the credential',
      options: ['no_access', 'read_only', 'standard', 'advanced', 'admin'],
      default: 'standard',
    }),
    type: Flags.string({
      char: 't',
      description: 'Type of credential',
      options: ['api_key', 'oauth_token', 'certificate', 'blockchain_key'],
      default: 'api_key',
    }),
    expiry: Flags.integer({
      char: 'e',
      description: 'Days until credential expires',
      required: false,
    }),
    rotation: Flags.integer({
      char: 'r',
      description: 'Days until rotation reminder',
      required: false,
    }),
  };

  static args = {
    action: Args.string({
      name: 'action',
      description: 'Action to perform (add, remove, list, verify, rotate)',
      required: true,
      options: ['add', 'remove', 'list', 'verify', 'rotate'],
    }),
    provider: Args.string({
      name: 'provider',
      description: 'AI provider (xai, openai, anthropic, custom)',
      required: false,
      options: ['xai', 'openai', 'anthropic', 'custom'],
    }),
  };

  static examples = [
    '$ walrus_todo ai credentials list',
    '$ walrus_todo ai credentials add xai --key YOUR_API_KEY',
    '$ walrus_todo ai credentials add openai --key YOUR_API_KEY --verify',
    '$ walrus_todo ai credentials add anthropic --key YOUR_API_KEY --permission advanced --expiry 90',
    '$ walrus_todo ai credentials remove xai',
    '$ walrus_todo ai credentials verify xai',
    '$ walrus_todo ai credentials rotate xai --key NEW_API_KEY',
  ];

  // Use the Logger from BaseCommand

  async run() {
    const { args, flags } = await this.parse(Credentials);

    // Get the arguments
    const actionType = args.action as
      | 'add'
      | 'remove'
      | 'list'
      | 'verify'
      | 'rotate';
    const providerName = args.provider as AIProvider;

    // Convert string permission level to enum
    const permissionLevelMap: Record<string, AIPermissionLevel> = {
      no_access: AIPermissionLevel.NO_ACCESS,
      read_only: AIPermissionLevel.READ_ONLY,
      standard: AIPermissionLevel.STANDARD,
      advanced: AIPermissionLevel.ADVANCED,
      admin: AIPermissionLevel.ADMIN,
    };

    // Convert string credential type to enum
    const credentialTypeMap: Record<string, CredentialType> = {
      api_key: CredentialType.API_KEY,
      oauth_token: CredentialType.OAUTH_TOKEN,
      certificate: CredentialType.CERTIFICATE,
      blockchain_key: CredentialType.BLOCKCHAIN_KEY,
    };

    const permissionLevel = flags.permission ? permissionLevelMap[flags.permission] : AIPermissionLevel.STANDARD;
    const credentialType = flags.type ? credentialTypeMap[flags.type] : CredentialType.API_KEY;

    switch (actionType) {
      case 'add':
        await this.addCredential(
          providerName,
          permissionLevel,
          credentialType,
          flags
        );
        break;
      case 'remove':
        await this.removeCredential(providerName);
        break;
      case 'list':
        await this.listCredentials();
        break;
      case 'verify':
        await this.verifyCredential(providerName);
        break;
      case 'rotate':
        await this.rotateCredential(
          providerName,
          permissionLevel,
          credentialType,
          flags
        );
        break;
      default:
        this.error(`Unknown action: ${actionType}`);
    }
  }

  private async addCredential(
    provider: AIProvider,
    permissionLevel: AIPermissionLevel,
    type: CredentialType,
    flags: { verify?: boolean; expiry?: number; rotation?: number; permission: string }
  ) {
    // Validate provider
    if (!provider) {
      this.error('Provider is required for the add action');
    }

    // Ask for API key if not provided
    const apiKey = await this.promptForAPIKey(provider);

    try {
      // Create options object from flags
      const options: { verify?: boolean; expiryDays?: number; rotationReminder?: number } = {
        verify: flags.verify,
      };

      if (flags.expiry) {
        options.expiryDays = flags.expiry;
      }

      if (flags.rotation) {
        options.rotationReminder = flags.rotation;
      }

      // Sanitize the API key
      const sanitizedKey = ApiKeyValidator.sanitize(apiKey);

      // Store the credential
      const storeOptions = {
        permissionLevel,
        type,
        ...options,
      };

      const result = await credentialManager.storeCredential(
        provider,
        sanitizedKey,
        storeOptions
      );

      // Success message
      this.log(
        `${chalk.green('\u2713')} API key for ${chalk.cyan(provider)} stored successfully with ${chalk.blue(flags.permission)} permissions`
      );

      if (flags.verify) {
        this.log(
          `${chalk.green('\u2713')} API key verified on blockchain with ID: ${chalk.dim(result.verificationId)}`
        );
      }

      if (flags.expiry) {
        this.log(
          `${chalk.green('\u2713')} API key will expire in ${chalk.yellow(flags.expiry)} days (${new Date(result.expiresAt || new Date()).toLocaleDateString()})`
        );
      }

      if (flags.rotation) {
        this.log(
          `${chalk.green('\u2713')} You will be reminded to rotate this key in ${chalk.yellow(flags.rotation)} days`
        );
      }
    } catch (error) {
      const errorCode = hasCode(error) ? error.code : undefined;
      const errorMessage = getErrorMessage(error);
      
      if (errorCode === 'CREDENTIAL_VERIFICATION_FAILED') {
        this.log(`${chalk.yellow('\u26a0')} ${errorMessage}`);
      } else if (errorCode === 'INVALID_API_KEY_FORMAT') {
        this.error(`${chalk.red('\u2717')} ${errorMessage}`);
      } else {
        this.error(errorMessage);
      }
    }
  }

  private async removeCredential(provider: AIProvider) {
    // Validate provider
    if (!provider) {
      this.error('Provider is required for the remove action');
    }

    try {
      // Confirm removal
      const confirm = await ux.confirm(
        `Are you sure you want to remove the API key for ${provider}?`
      );

      if (!confirm) {
        this.log('Operation cancelled');
        return;
      }

      await credentialManager.removeCredential(provider);
      this.log(
        `${chalk.green('\u2713')} API key for ${chalk.cyan(provider)} removed successfully`
      );
    } catch (error) {
      this.error(getErrorMessage(error));
    }
  }

  private async listCredentials() {
    try {
      const credentials = await credentialManager.listCredentials();

      if (credentials.length === 0) {
        this.log('No API credentials found.');
        this.log(
          `To add a credential, use: ${chalk.cyan('walrus_todo ai credentials add <provider> --key YOUR_API_KEY')}`
        );
        return;
      }

      this.log('AI Provider Credentials:');

      // Get the permission level mapping for display
      const permissionLabels: Record<AIPermissionLevel, string> = {
        [AIPermissionLevel.NO_ACCESS]: 'No Access',
        [AIPermissionLevel.READ_ONLY]: 'Read Only',
        [AIPermissionLevel.STANDARD]: 'Standard',
        [AIPermissionLevel.ADVANCED]: 'Advanced',
        [AIPermissionLevel.ADMIN]: 'Admin',
      };

      // Get the credential type mapping for display
      const typeLabels: Record<CredentialType, string> = {
        [CredentialType.API_KEY]: 'API Key',
        [CredentialType.OAUTH_TOKEN]: 'OAuth Token',
        [CredentialType.CERTIFICATE]: 'Certificate',
        [CredentialType.BLOCKCHAIN_KEY]: 'Blockchain Key',
      };

      // Create a formatted table
      credentials.forEach(cred => {
        const permissionColor =
          cred.permissionLevel >= AIPermissionLevel.ADVANCED
            ? chalk.red
            : cred.permissionLevel === AIPermissionLevel.STANDARD
              ? chalk.green
              : chalk.yellow;

        const verifiedStatus = cred.verified
          ? chalk.green('\u2713 verified')
          : chalk.gray('not verified');

        const expiryInfo = cred.expiresAt
          ? `expires ${chalk.yellow(new Date(cred.expiresAt).toLocaleDateString())}`
          : chalk.gray('no expiry');

        const lastUsed = cred.lastUsed
          ? `last used ${chalk.blue(new Date(cred.lastUsed).toLocaleDateString())}`
          : chalk.gray('never used');

        this.log(
          `  ${chalk.cyan(cred.provider)}: ${typeLabels[cred.type]} [${verifiedStatus}]`
        );
        this.log(
          `    Permission: ${permissionColor(permissionLabels[cred.permissionLevel])} | ${expiryInfo} | ${lastUsed}`
        );

        // Show rotation reminder if set
        if (cred.metadata?.rotationReminder) {
          const createdDate = new Date(cred.createdAt);
          const now = new Date();
          const daysSinceCreation = Math.floor(
            (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          const daysUntilRotation =
            cred.metadata.rotationReminder - daysSinceCreation;

          if (daysUntilRotation <= 0) {
            this.log(
              `    ${chalk.red('\u26a0 Key rotation recommended - created ' + daysSinceCreation + ' days ago')}`
            );
          } else if (daysUntilRotation < 14) {
            this.log(
              `    ${chalk.yellow('\u26a0 Key rotation in ' + daysUntilRotation + ' days')}`
            );
          } else {
            this.log(
              `    ${chalk.gray('Key rotation in ' + daysUntilRotation + ' days')}`
            );
          }
        }

        this.log(''); // Add space between credentials
      });

      // Show helpful hints
      this.log(`\nHints:`);
      this.log(
        `- Rotate credentials: ${chalk.cyan('walrus_todo ai credentials rotate <provider> --key NEW_KEY')}`
      );
      this.log(
        `- Update permissions: ${chalk.cyan('walrus_todo ai credentials add <provider> --key EXISTING_KEY --permission <level>')}`
      );
      this.log(
        `- Set expiry: ${chalk.cyan('walrus_todo ai credentials add <provider> --key EXISTING_KEY --expiry <days>')}`
      );
    } catch (error) {
      this.error(getErrorMessage(error));
    }
  }

  private async verifyCredential(provider: AIProvider) {
    // Validate provider
    if (!provider) {
      this.error('Provider is required for the verify action');
    }

    try {
      // This will throw if credential doesn't exist
      const metadata = await credentialManager.getCredentialMetadata(provider);

      // Check if already verified
      if (metadata.verified) {
        // Re-verify on blockchain to make sure it's still valid
        await credentialManager.getCredential(provider, {
          requiredPermissionLevel: undefined,
          operation: 'verify',
        });

        this.log(
          `${chalk.green('\u2713')} API key for ${chalk.cyan(provider)} is valid and verified on blockchain`
        );
        this.log(`  Verification ID: ${chalk.dim(metadata.verificationId)}`);
        return;
      }

      // Ask for confirmation to verify on blockchain
      const confirm = await ux.confirm(
        `Verify credential for ${provider} on blockchain? This will create a transaction.`
      );

      if (!confirm) {
        this.log('Verification cancelled');
        return;
      }

      // Get the credential and verify it
      await credentialManager.getCredential(provider);

      // Verify on blockchain
      this.log(
        `${chalk.yellow('[PREVIEW]')} Verifying API key for ${chalk.cyan(provider)} on blockchain...`
      );
      // NOTE: Blockchain verification is a planned feature - see docs/ai-blockchain-verification-roadmap.md

      this.log(
        `${chalk.yellow('[PREVIEW]')} ${chalk.green('\u2713')} API key for ${chalk.cyan(provider)} verification complete`
      );
      this.log(
        chalk.gray('Note: Blockchain verification is currently in preview mode')
      );
    } catch (error) {
      this.error(getErrorMessage(error));
    }
  }

  private async rotateCredential(
    provider: AIProvider,
    permissionLevel: AIPermissionLevel,
    type: CredentialType,
    flags: { verify?: boolean; key?: string }
  ) {
    // Validate provider
    if (!provider) {
      this.error('Provider is required for the rotate action');
    }

    try {
      // Check if credential exists
      const exists = await credentialManager.hasCredential(provider);
      if (!exists) {
        this.error(
          `No API key found for ${provider}. Use 'add' command instead.`
        );
        return;
      }

      // Ask for new API key if not provided
      const newApiKey = await this.promptForAPIKey(
        provider,
        'Enter your new API key:'
      );

      // Sanitize the API key
      const sanitizedKey = ApiKeyValidator.sanitize(newApiKey);

      // Create options object from flags
      const options: { verify?: boolean; preserveMetadata: boolean } = {
        verify: flags.verify,
        preserveMetadata: true,
      };

      // Rotate the credential
      const result = await credentialManager.rotateCredential(
        provider,
        sanitizedKey,
        options
      );

      this.log(
        `${chalk.green('\u2713')} API key for ${chalk.cyan(provider)} rotated successfully`
      );

      if (flags.verify) {
        this.log(
          `${chalk.green('\u2713')} New API key verified on blockchain with ID: ${chalk.dim(result.verificationId)}`
        );
      }

      // Additional information
      if (result.expiresAt) {
        this.log(
          `${chalk.green('\u2713')} API key will expire on ${chalk.yellow(new Date(result.expiresAt).toLocaleDateString())}`
        );
      }

      if (result.metadata?.rotationReminder) {
        this.log(
          `${chalk.green('\u2713')} You will be reminded to rotate this key in ${chalk.yellow(result.metadata.rotationReminder)} days`
        );
      }
    } catch (error) {
      const errorCode = hasCode(error) ? error.code : undefined;
      const errorMessage = getErrorMessage(error);
      
      if (errorCode === 'INVALID_API_KEY_FORMAT') {
        this.error(`${chalk.red('\u2717')} ${errorMessage}`);
      } else {
        this.error(errorMessage);
      }
    }
  }

  private async promptForAPIKey(
    provider: AIProvider,
    message?: string
  ): Promise<string> {
    const { flags } = await this.parse(Credentials);

    // Check if key is provided via flag
    if (flags.key) {
      return flags.key as string;
    }

    // Show validation guidance for the provider
    const validationHelp = ApiKeyValidator.getValidationHelp(provider);
    this.log(`${chalk.blue('i')} ${validationHelp}`);

    // Otherwise prompt for it
    const apiKey = await ux.prompt(
      message || `Enter your ${provider} API key:`,
      {
        type: 'hide',
      }
    );

    return apiKey;
  }
}
