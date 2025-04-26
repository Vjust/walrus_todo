/**
 * Configure Command Module
 * Handles wallet and blockchain connection setup
 * Manages authentication and encryption settings
 */

import { select, input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { Config, Network } from '../types';
import { configService } from '../services/config-service';
import { SUPPORTED_NETWORKS } from '../constants';

/**
 * Configures blockchain connection and wallet settings
 * Handles interactive configuration process
 */
export async function configure(): Promise<void> {
  try {
    // Select network
    const network = await select<Network>({
      message: 'Select network:',
      choices: [
        { value: 'testnet', name: 'Testnet' },
        { value: 'mainnet', name: 'Mainnet' }
      ]
    });

    // Get wallet address
    const walletAddress = await input({
      message: 'Enter your Sui wallet address:',
      validate: (input) => input.length > 0
    });

    // Ask if user wants to store private key
    const shouldStoreKey = await confirm({
      message: 'Would you like to store your private key? (Not recommended for production)',
      default: false
    });

    let privateKey: string | undefined;
    if (shouldStoreKey) {
      privateKey = await input({
        message: 'Enter your private key:',
        transformer: (input) => '*'.repeat(input.length)
      });
    }

    // Save configuration
    const config: Config = {
      network,
      walletAddress,
      privateKey
    };

    await configService.saveConfig(config);
    console.log(chalk.green('✔ Configuration saved successfully'));
    console.log(chalk.dim('Network:'), network);
    console.log(chalk.dim('Wallet Address:'), walletAddress);

  } catch (error) {
    console.error(chalk.red('Failed to save configuration:'), error);
    process.exit(1);
  }
}