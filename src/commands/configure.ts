import { Command, Flags } from '@oclif/core';
import { select, input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
// Removed unused Config import
import { configService } from '../services/config-service';
import { CLIError } from '../types/error';

export default class ConfigureCommand extends Command {
  static description = 'Configure CLI network and wallet settings';

  static examples = [
    '<%= config.bin %> configure',
    '<%= config.bin %> configure --reset',
    '<%= config.bin %> configure --network testnet --wallet-address 0x1234567890abcdef',
    '<%= config.bin %> configure --network local'
  ];

  static flags = {
    reset: Flags.boolean({
      char: 'r',
      description: 'Reset all settings to defaults',
      default: false
    }),
    network: Flags.string({
      description: 'Network to use (mainnet, testnet, devnet, local)',
      options: ['mainnet', 'testnet', 'devnet', 'local']
    }),
    walletAddress: Flags.string({
      description: 'Wallet address for configuration'
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

      let network = flags.network;
      let walletAddress = flags.walletAddress;

      if (!network) {
        network = await select({
          message: 'Select network:',
          choices: [
            { name: 'mainnet', value: 'mainnet' },
            { name: 'testnet', value: 'testnet' },
            { name: 'devnet', value: 'devnet' },
            { name: 'local', value: 'local' }
          ]
        });
      } else if (!['mainnet', 'testnet', 'devnet', 'local'].includes(network)) {
        throw new CLIError('Invalid network specified. Use mainnet, testnet, devnet, or local.', 'INVALID_NETWORK');
      }

      if (!walletAddress) {
        walletAddress = await input({
          message: 'Enter your wallet address (e.g., 0x123...):',
        });
        if (!/^0x[a-fA-F0-9]{40,}$/.test(walletAddress)) {
          throw new CLIError("Invalid wallet address format. Must be a valid hex address starting with 0x.", 'INVALID_WALLET_ADDRESS');  // Changed to double quotes for consistency
        }
      }

      const encryptedStorage = await confirm({
        message: 'Enable encryption for sensitive data?',
        default: true
      });

      await configService.saveConfig({
        network,
        walletAddress,
        encryptedStorage
      });

      this.log(chalk.green('\n✓ Configuration saved successfully'));
      this.log(chalk.dim('Network:'), network);
      this.log(chalk.dim('Wallet Address:'), walletAddress);
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
