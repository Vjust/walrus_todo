import { Command } from '@oclif/core';
import { CLIError } from '../../utils/error-handler';
import { configService } from '../../services/config-service';

export default class AccountShowCommand extends Command {
  static description = 'Show current active Sui address';

  async run(): Promise<void> {
    try {
      const config = await configService.getConfig();
      if (!config.walletAddress) {
        throw new CLIError('No wallet address configured. Please run "waltodo configure" first.', 'NO_WALLET_ADDRESS');
      }
      this.log(`Current active Sui address: ${config.walletAddress}`);
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        'Failed to get active address. Please ensure wallet is configured.',
        'CLI_ERROR'
      );
    }
  }
}
