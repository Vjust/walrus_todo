"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const core_1 = require("@oclif/core");
const SecureCredentialManager_1 = require("../../services/ai/SecureCredentialManager");
const chalk = require("chalk");
const error_1 = require("../../types/error");

/**
 * AI Credential Key Management command
 * 
 * This command provides functionality to manage the encryption keys used for AI credentials:
 * - Rotation: Safely rotate encryption keys while preserving credentials
 * - Validation: Check encryption key integrity
 * - Backup: List, create, and restore from key backups
 */
class AIKeysCommand extends core_1.Command {
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
          await this.restoreFromBackup(flags['backup-id']);
          break;
        default:
          this.error(`Unknown action: ${action}`);
      }
    } catch (error) {
      if (error instanceof error_1.CLIError) {
        this.error(`${error.message} (${error.code})`);
      } else {
        this.error(`Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Rotate the encryption key
   */
  async rotateKey(force) {
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
    const success = await SecureCredentialManager_1.secureCredentialManager.rotateKey();
    
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
  async validateKey() {
    this.log('Validating encryption key integrity...');
    const isValid = SecureCredentialManager_1.secureCredentialManager.validateKeyIntegrity();
    
    if (isValid) {
      this.log(`${chalk.green('✓')} Encryption key integrity verified`);
    } else {
      this.error(`${chalk.red('✗')} Encryption key failed validation. Consider restoring from backup.`);
    }
  }

  /**
   * Create a backup of the current key
   */
  async backupKey() {
    this.log('Creating encryption key backup...');
    
    try {
      // Use the private method via the rotation flow which includes backup
      await SecureCredentialManager_1.secureCredentialManager.rotateKey();
      this.log(`${chalk.green('✓')} Encryption key backup created successfully`);
    } catch (error) {
      this.error(`Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List available key backups
   */
  async listBackups() {
    const backups = SecureCredentialManager_1.secureCredentialManager.listKeyBackups();
    
    if (backups.length === 0) {
      this.log('No key backups found.');
      return;
    }
    
    this.log('Available key backups:');
    backups.forEach((backup, index) => {
      const date = new Date(backup.timestamp).toLocaleString();
      this.log(`${index + 1}. ID: ${chalk.cyan(backup.id)} - Created: ${date} - Version: ${backup.version}`);
    });
  }

  /**
   * Restore from a key backup
   */
  async restoreFromBackup(backupId) {
    if (!backupId) {
      // List available backups first
      const backups = SecureCredentialManager_1.secureCredentialManager.listKeyBackups();
      
      if (backups.length === 0) {
        this.error('No key backups found for restore operation.');
        return;
      }
      
      this.log('Available backups:');
      backups.forEach((backup, index) => {
        const date = new Date(backup.timestamp).toLocaleString();
        this.log(`${index + 1}. ID: ${chalk.cyan(backup.id)} - Created: ${date}`);
      });
      
      // Ask which backup to restore
      const response = await this.prompt({
        type: 'input',
        name: 'backupIndex',
        message: 'Enter the number of the backup to restore:',
        validate: (input) => {
          const num = parseInt(input, 10);
          return (!isNaN(num) && num > 0 && num <= backups.length) 
            ? true 
            : `Please enter a number between 1 and ${backups.length}`;
        }
      });
      
      const selectedIndex = parseInt(response.backupIndex, 10) - 1;
      backupId = backups[selectedIndex].id;
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
    const success = await SecureCredentialManager_1.secureCredentialManager.restoreFromBackup(backupId);
    
    if (success) {
      this.log(`${chalk.green('✓')} Successfully restored from backup`);
    } else {
      this.error('Failed to restore from backup');
    }
  }

  /**
   * Prompt for confirmation
   */
  async confirm(message) {
    const response = await this.prompt({
      type: 'input',
      name: 'confirm',
      message,
    });
    
    return response.confirm.toLowerCase() === 'yes' || response.confirm.toLowerCase() === 'y';
  }

  /**
   * Prompt for input
   */
  async prompt(options) {
    return this.parse(AIKeysCommand);
  }
}

AIKeysCommand.description = 'Manage AI credential encryption keys';

AIKeysCommand.examples = [
  '$ walrus-todo ai keys:rotate',
  '$ walrus-todo ai keys:validate',
  '$ walrus-todo ai keys:backup',
  '$ walrus-todo ai keys:list-backups',
  '$ walrus-todo ai keys:restore --backup-id 12345',
];

AIKeysCommand.flags = {
  help: core_1.Flags.help({ char: 'h' }),
  'backup-id': core_1.Flags.string({
    description: 'ID of the backup to restore',
    required: false,
  }),
  force: core_1.Flags.boolean({
    char: 'f',
    description: 'Force rotation without confirmation',
    required: false,
    default: false,
  }),
};

AIKeysCommand.args = [
  {
    name: 'action',
    description: 'Action to perform: rotate, validate, backup, list-backups, restore',
    required: true,
    options: ['rotate', 'validate', 'backup', 'list-backups', 'restore'],
  },
];

exports.default = AIKeysCommand;