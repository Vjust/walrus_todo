import { Command } from 'commander';
import { SuiTestService } from '../services';
import { ConfigService } from '../services/config-service';
import { handleError } from '../utils/error-handler';

export const accountCommand = new Command('account')
  .description('Show current account information and balance')
  .action(async () => {
    try {
      const configService = new ConfigService();
      const config = configService.getConfig();
      
      if (!config || !config.walletAddress) {
        console.log('❌ No account configured. Run "waltodo configure" first.');
        return;
      }
      
      const suiService = new SuiTestService(config);
      const accountInfo = await suiService.getAccountInfo();
      
      console.log('\n📊 Account Information');
      console.log('─────────────────────────');
      console.log(`Address: ${accountInfo.address}`);
      console.log(`Network: ${config.network}`);
      console.log(`Balance: ${accountInfo.balance} SUI`);
      
      if (accountInfo.objects && accountInfo.objects.length > 0) {
        console.log('\n🔶 Owned Objects');
        console.log('─────────────────────────');
        accountInfo.objects.forEach((obj: { objectId: string, type: string }, index: number) => {
          console.log(`${index + 1}. ${obj.objectId} (${obj.type})`);
        });
      }
    } catch (error) {
      handleError(error);
    }
  });
