import { Flags, Args } from '@oclif/core';
import { BaseCommand } from '../../base-command';
import { secureCredentialManager } from '../../services/ai/SecureCredentialManager';
import chalk = require('chalk');
import { CLIError } from '../../types/errors/consolidated';
import { getErrorMessage, isError } from '../../utils/type-guards';

/**
 * AI Credential Key Management command
 *
 * This command provides functionality to manage the encryption keys used for AI credentials:
 * - Rotation: Safely rotate encryption keys while preserving credentials
 * - Validation: Check encryption key integrity
 * - Backup: List, create, and restore from key backups
 */
export default class AIKeysCommand extends BaseCommand {
  static description =
    'Rotate, validate and backup encryption keys used for securing AI provider credentials';

  static examples = [
    '<%= config.bin %> ai keys:rotate                          # Rotate encryption keys',
    '<%= config.bin %> ai keys:validate                        # Validate current keys',
    '<%= config.bin %> ai keys:backup                          # Create key backup',
    '<%= config.bin %> ai keys:list-backups                    # List all backups',
    '<%= config.bin %> ai keys:restore --backup-id 12345       # Restore from backup',
    '<%= config.bin %> ai keys:status                          # Check key status',
    '<%= config.bin %> ai keys:export --format pem             # Export keys',
  ];

  static flags = {
    ...BaseCommand.flags,
    'backup-id': Flags.string({
      description: 'ID of the backup to restore',
      required: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Force rotation without confirmation',
      required: false,
      default: false,
    }),
  };

  static args = {
    action: Args.string({
      name: 'action',
      description:
        'Action to perform: rotate, validate, backup, list-backups, restore',
      required: true,
      options: ['rotate', 'validate', 'backup', 'list-backups', 'restore'],
    }),
  };

  async run() {
    const { args, flags } = await this.parse(AIKeysCommand);
    const action = args.action;

    try {
      switch (action) {
        case 'rotate':
          await this.rotateKey(flags.force);
          break;
        case 'validate':
          await this.validateKey();
          break;
        case 'backup':
          await this.backupKey();
          break;
        case 'list-backups':
          await this.listBackups();
          break;
        case 'restore':
          await this.restoreFromBackup(flags?.["backup-id"]);
          break;
        default:
          this.error(`Unknown action: ${action}`);
      }
    } catch (error) {
      if (error instanceof CLIError) {
        this.error(`${error.message} (${error.code})`);
      } else {
        this.error(`Operation failed: ${getErrorMessage(error)}`);
      }
    }
  }

  /**
   * Rotate the encryption key
   */
  private async rotateKey(force: boolean) {
    if (!force) {
      const confirm = await this.confirm(
        `${chalk.yellow('⚠️ Warning:')} Key rotation will re-encrypt all stored credentials. ` +
          'This operation is secure but should be done with caution.\n\n' +
          'Do you want to continue? (yes/no)'
      );

      if (!confirm) {
        this.log('Key rotation cancelled.');
        return;
      }
    }

    this.log('Rotating encryption key...');
    const success = await secureCredentialManager.rotateKey();

    if (success) {
      this.log(`${chalk.green('✓')} Encryption key rotated successfully`);
      this.log('All credentials have been re-encrypted with the new key.');
    } else {
      this.error('Failed to rotate encryption key');
    }
  }

  /**
   * Validate the encryption key integrity
   */
  private async validateKey() {
    this.log('Validating encryption key integrity...');
    const isValid = secureCredentialManager.validateKeyIntegrity();

    if (isValid) {
      this.log(`${chalk.green('✓')} Encryption key integrity verified`);
    } else {
      this.error(
        `${chalk.red('✗')} Encryption key failed validation. Consider restoring from backup.`
      );
    }
  }

  /**
   * Create a backup of the current key
   */
  private async backupKey() {
    this.log('Creating encryption key backup...');

    try {
      // Use the private method via the rotation flow which includes backup
      await secureCredentialManager.rotateKey();
      this.log(
        `${chalk.green('✓')} Encryption key backup created successfully`
      );
    } catch (error) {
      this.error(`Failed to create backup: ${getErrorMessage(error)}`);
    }
  }

  /**
   * List available key backups
   */
  private async listBackups() {
    const backups = secureCredentialManager.listKeyBackups();

    if (backups?.length === 0) {
      this.log('No key backups found.');
      return;
    }

    this.log('Available key backups:');
    backups.forEach((backup, index) => {
      const date = new Date(backup.timestamp).toLocaleString();
      this.log(
        `${index + 1}. ID: ${chalk.cyan(backup.id)} - Created: ${date} - Version: ${backup.version}`
      );
    });
  }

  /**
   * Restore from a key backup
   */
  private async restoreFromBackup(backupId?: string) {
    if (!backupId) {
      // List available backups first
      const backups = secureCredentialManager.listKeyBackups();

      if (backups?.length === 0) {
        this.error('No key backups found for restore operation.');
        return;
      }

      this.log('Available backups:');
      backups.forEach((backup, index) => {
        const date = new Date(backup.timestamp).toLocaleString();
        this.log(
          `${index + 1}. ID: ${chalk.cyan(backup.id)} - Created: ${date}`
        );
      });

      // Ask which backup to restore
      const response = await this.promptInquirer({
        type: 'input',
        name: 'backupIndex',
        message: 'Enter the number of the backup to restore:',
        validate: (input: string) => {
          const num = parseInt(input, 10);
          return !isNaN(num) && num > 0 && num <= backups.length
            ? true
            : `Please enter a number between 1 and ${backups.length}`;
        },
      });

      const selectedIndex = parseInt((response).backupIndex, 10) - 1;
      const selectedBackup = backups[selectedIndex];
      if (!selectedBackup) {
        throw new CLIError('Invalid backup selection', 'VALIDATION_ERROR');
      }
      backupId = selectedBackup.id;
    }

    const confirm = await this.confirm(
      `${chalk.yellow('⚠️ Warning:')} Restoring from backup will replace your current encryption key. ` +
        'This may cause issues accessing recently added credentials.\n\n' +
        'Do you want to continue? (yes/no)'
    );

    if (!confirm) {
      this.log('Restore operation cancelled.');
      return;
    }

    this.log(`Restoring from backup ${chalk.cyan(backupId)}...`);
    const success = await secureCredentialManager.restoreFromBackup(backupId);

    if (success) {
      this.log(`${chalk.green('✓')} Successfully restored from backup`);
    } else {
      this.error('Failed to restore from backup');
    }
  }

  /**
   * Prompt for confirmation - override BaseCommand method
   */
  protected async confirm(
    message: string,
    _defaultValue?: boolean
  ): Promise<boolean> {
    const response = await this.promptInquirer({
      type: 'input',
      name: 'confirm',
      message,
    });

    return (
      (response).confirm.toLowerCase() === 'yes' ||
      (response).confirm.toLowerCase() === 'y'
    );
  }

  /**
   * Prompt for input - override BaseCommand method
   */
  protected async promptInquirer(options: unknown): Promise<unknown> {
    const { default: inquirer } = await import('inquirer');
    return inquirer.prompt(options as Parameters<typeof inquirer.prompt>[0]);
  }
}
