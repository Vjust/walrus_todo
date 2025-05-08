import { Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import { WalrusStorage } from '../utils/walrus-storage';
import { StorageReuseAnalyzer } from '../utils/storage-reuse-analyzer';
const chalk = require('chalk');
import { SuiClient } from '@mysten/sui.js/client';
import { NETWORK_URLS, CURRENT_NETWORK } from '../constants';

export default class StorageCommand extends BaseCommand {
  static description = 'Manage Walrus storage for todos';

  static flags = {
    ...BaseCommand.flags,
    summary: Flags.boolean({
      char: 's',
      description: 'Show a summary of your storage allocation',
      exclusive: ['detail'],
    }),
    detail: Flags.boolean({
      char: 'd',
      description: 'Show detailed information about your storage allocations',
      exclusive: ['summary'],
    }),
    analyze: Flags.boolean({
      char: 'a',
      description: 'Analyze storage efficiency and suggest optimizations',
    }),
  };

  static examples = [
    '$ walrus-todo storage',
    '$ walrus-todo storage --summary',
    '$ walrus-todo storage --detail',
    '$ walrus-todo storage --analyze',
  ];

  async run() {
    const { flags } = await this.parse(StorageCommand);
    this.log(`${chalk.bold('Walrus Storage Manager')}`);
    
    const walrusStorage = new WalrusStorage();
    await walrusStorage.connect();
    
    if (flags.summary || (!flags.detail && !flags.analyze)) {
      await this.showStorageSummary(walrusStorage);
    }
    
    if (flags.detail) {
      await this.showStorageDetails(walrusStorage);
    }
    
    if (flags.analyze) {
      await this.analyzeStorageEfficiency(walrusStorage);
    }
  }
  
  async showStorageSummary(walrusStorage: WalrusStorage) {
    this.log(`\n${chalk.blue.bold('Storage Summary')}`);
    
    const storageInfo = await walrusStorage.checkExistingStorage();
    if (!storageInfo) {
      this.log(chalk.yellow('No active storage allocations found.'));
      this.log('Use "walrus-todo store" to allocate storage for your todos.');
      return;
    }
    
    const { epoch } = await new SuiClient({ url: NETWORK_URLS[CURRENT_NETWORK] })
      .getLatestSuiSystemState();
    const currentEpoch = Number(epoch);
    
    // Calculate storage metrics
    const totalSize = Number(storageInfo.storage_size);
    const usedSize = Number(storageInfo.used_size);
    const remainingSize = totalSize - usedSize;
    const usagePercentage = (usedSize / totalSize) * 100;
    const remainingEpochs = Number(storageInfo.end_epoch) - currentEpoch;
    
    // Format sizes for display
    const formatBytes = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} bytes`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };
    
    // Display summary
    this.log(`Storage ID: ${chalk.green(storageInfo.id.id)}`);
    this.log(`Total Size: ${chalk.cyan(formatBytes(totalSize))}`);
    this.log(`Used: ${chalk.yellow(formatBytes(usedSize))} (${usagePercentage.toFixed(2)}%)`);
    this.log(`Remaining: ${chalk.green(formatBytes(remainingSize))}`);
    this.log(`Expires in: ${chalk.magenta(remainingEpochs)} epochs (approximately ${Math.floor(remainingEpochs / 7)} weeks)`);
    
    // Add recommendations based on usage
    if (usagePercentage > 80) {
      this.log(chalk.yellow('\nNote: Your storage is over 80% full. Consider allocating more storage.'));
    } else if (usagePercentage < 10 && totalSize > 1024 * 1024) {
      this.log(chalk.blue('\nNote: Your storage usage is low. You might be over-provisioned.'));
    }
    
    if (remainingEpochs < 30) {
      this.log(chalk.red('\nWarning: Your storage will expire in less than 30 epochs. Consider renewing soon.'));
    }
  }
  
  async showStorageDetails(walrusStorage: WalrusStorage) {
    this.log(`\n${chalk.blue.bold('Detailed Storage Information')}`);
    
    try {
      const suiClient = new SuiClient({ url: NETWORK_URLS[CURRENT_NETWORK] });
      const { epoch } = await suiClient.getLatestSuiSystemState();
      const currentEpoch = Number(epoch);
      const address = walrusStorage.getActiveAddress();
      
      // Get all storage objects
      const response = await suiClient.getOwnedObjects({
        owner: address,
        filter: { StructType: '0x2::storage::Storage' },
        options: { showContent: true }
      });
      
      if (response.data.length === 0) {
        this.log(chalk.yellow('No storage objects found for this address.'));
        return;
      }
      
      this.log(`Found ${chalk.green(response.data.length)} storage objects:`);
      
      // Helper function to format bytes
      const formatBytes = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} bytes`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
      };
      
      let totalAllocation = 0;
      let totalUsed = 0;
      let activeCount = 0;
      
      // Process and display each storage object
      for (const item of response.data) {
        if (!item.data?.content || item.data.content.dataType !== 'moveObject') continue;
        
        const fields = (item.data.content as any).fields;
        if (!fields) continue;
        
        const storageSize = Number(fields.storage_size);
        const usedSize = Number(fields.used_size || 0);
        const endEpoch = Number(fields.end_epoch);
        const isActive = endEpoch > currentEpoch;
        
        totalAllocation += storageSize;
        totalUsed += usedSize;
        if (isActive) activeCount++;
        
        const remainingSize = storageSize - usedSize;
        const usagePercentage = (usedSize / storageSize) * 100;
        const remainingEpochs = endEpoch - currentEpoch;
        
        // Status indicator
        let statusIndicator: string;
        if (!isActive) {
          statusIndicator = chalk.red('● EXPIRED');
        } else if (usagePercentage > 90) {
          statusIndicator = chalk.yellow('● ALMOST FULL');
        } else if (remainingEpochs < 20) {
          statusIndicator = chalk.yellow('● EXPIRING SOON');
        } else {
          statusIndicator = chalk.green('● ACTIVE');
        }
        
        this.log('\n--------------------------------------------------------');
        this.log(`${chalk.bold('Storage ID:')} ${chalk.green(item.data.objectId)}`);
        this.log(`${chalk.bold('Status:')} ${statusIndicator}`);
        this.log(`${chalk.bold('Total Size:')} ${formatBytes(storageSize)}`);
        this.log(`${chalk.bold('Used Size:')} ${formatBytes(usedSize)} (${usagePercentage.toFixed(2)}%)`);
        this.log(`${chalk.bold('Remaining Size:')} ${formatBytes(remainingSize)}`);
        this.log(`${chalk.bold('End Epoch:')} ${endEpoch} (current: ${currentEpoch})`);
        this.log(`${chalk.bold('Remaining Time:')} ${remainingEpochs > 0 ? `${remainingEpochs} epochs` : 'Expired'}`);
      }
      
      // Summary
      this.log('\n--------------------------------------------------------');
      this.log(`${chalk.bold('Summary:')}`);
      this.log(`${chalk.bold('Total Storage:')} ${formatBytes(totalAllocation)}`);
      this.log(`${chalk.bold('Total Used:')} ${formatBytes(totalUsed)} (${((totalUsed / totalAllocation) * 100).toFixed(2)}%)`);
      this.log(`${chalk.bold('Total Remaining:')} ${formatBytes(totalAllocation - totalUsed)}`);
      this.log(`${chalk.bold('Active Storage Objects:')} ${activeCount} of ${response.data.length}`);
      
    } catch (error) {
      this.error(`Failed to retrieve storage details: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  async analyzeStorageEfficiency(walrusStorage: WalrusStorage) {
    this.log(`\n${chalk.blue.bold('Storage Efficiency Analysis')}`);
    
    try {
      // Initialize clients
      const suiClient = new SuiClient({ url: NETWORK_URLS[CURRENT_NETWORK] });
      const address = walrusStorage.getActiveAddress();
      
      // Check WAL balance
      const walBalance = await suiClient.getBalance({
        owner: address,
        coinType: 'WAL'
      });
      
      this.log(`Current WAL balance: ${chalk.green(walBalance.totalBalance)} WAL`);
      
      // Connect to walrus
      if (walrusStorage['storageReuseAnalyzer'] === null) {
        this.log('Initializing storage analyzer...');
        // Initialize the managers via private method
        (walrusStorage as any).initializeManagers();
      }
      
      // Get storage analyzer instance
      const analyzer = (walrusStorage as any).storageReuseAnalyzer as StorageReuseAnalyzer;
      
      // Analyze for different storage sizes
      const smallTodoSize = 1024; // 1KB
      const mediumTodoSize = 10 * 1024; // 10KB
      const largeTodoSize = 100 * 1024; // 100KB
      const todoListSize = 50 * 1024; // 50KB
      
      this.log('\nAnalyzing storage efficiency for different data sizes...');
      
      // Function to analyze and display results
      const analyzeAndDisplay = async (size: number, description: string) => {
        const analysis = await analyzer.analyzeStorageEfficiency(size);
        
        this.log(`\n${chalk.bold(description)} (${size} bytes):`);
        this.log(`Recommendation: ${chalk.cyan(analysis.detailedRecommendation)}`);
        
        if (analysis.analysisResult.bestMatch) {
          const match = analysis.analysisResult.bestMatch;
          this.log(`Best storage for reuse: ${chalk.green(match.id)}`);
          this.log(`Remaining after operation: ${(match.remaining - size).toLocaleString()} bytes`);
          this.log(`WAL tokens saved by reusing: ${chalk.green(analysis.costComparison.reuseExistingSavings.toString())} WAL`);
          this.log(`Percentage saved: ${chalk.green(analysis.costComparison.reuseExistingPercentSaved.toString())}%`);
        } else {
          this.log(`New storage cost estimate: ${chalk.yellow(analysis.costComparison.newStorageCost.toString())} WAL`);
        }
      };
      
      // Run analysis for different sizes
      await analyzeAndDisplay(smallTodoSize, 'Small Todo');
      await analyzeAndDisplay(mediumTodoSize, 'Medium Todo');
      await analyzeAndDisplay(largeTodoSize, 'Large Todo');
      await analyzeAndDisplay(todoListSize, 'Todo List');
      
      // Overall recommendations
      this.log('\n--------------------------------------------------------');
      this.log(`${chalk.bold('Overall Recommendations:')}`);
      
      const overallAnalysis = await analyzer.findBestStorageForReuse(0);
      
      if (overallAnalysis.totalStorage === 0) {
        this.log(chalk.yellow('You have no storage allocations. Consider creating storage when storing todos.'));
      } else if (overallAnalysis.activeStorageCount === 0) {
        this.log(chalk.red('All your storage allocations have expired. Create new storage for your todos.'));
      } else if (overallAnalysis.availableStorage < 1024 * 1024) { // Less than 1MB available
        this.log(chalk.yellow('Your available storage is limited. Consider allocating more storage.'));
      } else if (overallAnalysis.availableStorage > 10 * 1024 * 1024 && overallAnalysis.usedStorage < overallAnalysis.totalStorage * 0.1) {
        this.log(chalk.blue('You have significant unused storage. Consider using it efficiently before allocating more.'));
      } else {
        this.log(chalk.green('Your storage allocation appears to be efficient.'));
      }
      
      // Add tips
      this.log('\n--------------------------------------------------------');
      this.log(`${chalk.bold('Storage Optimization Tips:')}`);
      this.log('1. Group multiple todos in a TodoList to save on storage costs');
      this.log('2. Use existing storage when possible instead of allocating new storage');
      this.log('3. Consider using the `--analyze` flag before storing large amounts of data');
      this.log('4. Periodically check your storage allocation with `walrus-todo storage`');
      
    } catch (error) {
      this.error(`Failed to analyze storage efficiency: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}