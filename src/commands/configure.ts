/**
 * Configure Command Module
 * Handles wallet and blockchain connection setup
 * Manages authentication and encryption settings
 */

import { Command, Flags } from '@oclif/core';
import { select, input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { Config } from '../types';
import { configService } from '../services/config-service';
import { SUPPORTED_NETWORKS } from '../constants';

/**
 * ConfigureCommand class
 * 
 * Handles the configuration of wallet settings, network selection,
 * and encryption preferences for the application.
 * 
 * @class ConfigureCommand
 * @extends {Command}
 */
export default class ConfigureCommand extends Command {
  static description = 'Configure wallet and blockchain settings';

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

  /**
   * Validates wallet address format
   * 
   * @param {string} address - The wallet address to validate
   * @returns {boolean} True if the address is valid
   */
  private validateWalletAddress(address: string): boolean {
    // Basic validation - should be refined based on Sui address format
    return address.trim().length > 0 && address.startsWith('0x');
  }

  /**
   * Main execution method for the configure command
   * 
   * @returns {Promise<void>}
   * @throws Will throw an error if configuration fails
   */
  async run(): Promise<void> {
    const { flags } = await this.parse(ConfigureCommand);

    try {
      if (flags.reset) {
        await configService.saveConfig({
          network: 'testnet',
          walletAddress: '',
          encryptedStorage: false
        });
        this.log(chalk.green('✓ Configuration reset to defaults'));
        return;
      }

      // Network selection
      const network = await select({
        message: 'Select network:',
        choices: SUPPORTED_NETWORKS.map(n => ({ name: n, value: n }))
      });

      // Wallet address input with validation
      let walletAddress = '';
      let isValidAddress = false;
      
      do {
        walletAddress = await input({
          message: 'Enter your wallet address (starts with 0x):',
        });
        
        isValidAddress = this.validateWalletAddress(walletAddress);
        
        if (!isValidAddress) {
          this.log(chalk.yellow('Invalid wallet address format. Address should start with 0x.'));
        }
      } while (!isValidAddress);

      // Encryption preference
      const encryptedStorage = await confirm({
        message: 'Enable encryption for sensitive data?',
        default: true
      });

      // Save the configuration
      try {
        await configService.saveConfig({
          network,
          walletAddress,
          encryptedStorage
        });
      } catch (saveError) {
        const errorMessage = saveError instanceof Error 
          ? saveError.message 
          : 'Unknown error';
        throw new Error(`Failed to save configuration: ${errorMessage}`);
      }

      // Display success message with configuration details
      this.log(chalk.green('\n✓ Configuration saved successfully'));
      this.log(chalk.dim('Network:'), network);
      this.log(chalk.dim('Wallet:'), walletAddress);
      this.log(chalk.dim('Encryption:'), encryptedStorage ? 'Enabled' : 'Disabled');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.error(chalk.red(`Configuration failed: ${errorMessage}`));
      // The this.error() method will handle exit codes automatically
    }
  }
}