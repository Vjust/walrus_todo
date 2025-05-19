import { BaseCommand } from '../../base-command';
import { CLIError } from '../../utils/error-handler';
import { configService } from '../../services/config-service';

/**
 * @class AccountShowCommand
 * @description This command displays the current active Sui wallet address configured for the CLI.
 * It retrieves the address from the configuration settings and provides feedback if no address is set.
 */
export default class AccountShowCommand extends BaseCommand {
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
