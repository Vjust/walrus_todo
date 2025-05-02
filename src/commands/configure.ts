import { Command, Flags } from '@oclif/core';
import { select, input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { Config } from '../types';
import { configService } from '../services/config-service';
import { CLIError } from '../types/error';

export default class ConfigureCommand extends Command {
  static description = 'Configure CLI settings';

  static examples = [
    '<%= config.bin %> configure',
    '<%= config.bin %> configure --reset'
  ];

  static flags = {
    reset: Flags.boolean({
      char: 'r',
      description: 'Reset all settings to defaults',
      default: false
    })
  };

  private validateUserIdentifier(userId: string): boolean {
    return userId.trim().length > 0;
  }

  async run(): Promise<void> {
    try {
      const { flags } = await this.parse(ConfigureCommand);

      if (flags.reset) {
        await configService.saveConfig({
          network: 'local',
          walletAddress: '',
          encryptedStorage: false
        });
        this.log(chalk.green('✓ Configuration reset to defaults'));
        return;
      }

      const userId = await input({
        message: 'Enter your user identifier:',
      });
      
      if (!this.validateUserIdentifier(userId)) {
        throw new CLIError('Invalid user identifier format', 'INVALID_USER_ID');
      }

      const encryptedStorage = await confirm({
        message: 'Enable encryption for sensitive data?',
        default: true
      });

      await configService.saveConfig({
        network: 'local',
        walletAddress: userId,
        encryptedStorage
      });

      this.log(chalk.green('\n✓ Configuration saved successfully'));
      this.log(chalk.dim('User ID:'), userId);
      this.log(chalk.dim('Encryption:'), encryptedStorage ? 'Enabled' : 'Disabled');

    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Configuration failed: ${error instanceof Error ? error.message : String(error)}`,
        'CONFIG_FAILED'
      );
    }
  }
}