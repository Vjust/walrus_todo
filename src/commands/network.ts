import { Command } from 'commander';
import { ConfigService } from '../services';
import { handleError } from '../utils/error-handler';
import { NETWORK_URLS } from '../constants';

export const networkCommand = new Command('network')
  .description('Switch between devnet, testnet, and mainnet')
  .argument('[name]', 'Network name (devnet, testnet, mainnet)')
  .action(async (networkName) => {
    try {
      const configService = new ConfigService();
      
      // If no network name provided, show current network
      if (!networkName) {
        const config = configService.getConfig();
        console.log(`Current network: ${config?.network || 'Not configured'}`);
        console.log('\nAvailable networks:');
        Object.keys(NETWORK_URLS).forEach(name => {
          console.log(`- ${name}`);
        });
        return;
      }
      
      // Validate network name
      if (!Object.keys(NETWORK_URLS).includes(networkName)) {
        throw new Error(`Invalid network name. Choose from: ${Object.keys(NETWORK_URLS).join(', ')}`);
      }
      
      // Update config with new network
      await configService.saveConfig({ network: networkName });
      console.log(`✅ Switched to ${networkName}`);
    } catch (error) {
      handleError(error);
    }
  });
