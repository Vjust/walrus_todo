/**
import { Logger } from '../utils/Logger';

const logger = new Logger('adapter-resource-usage');
 * Example demonstrating how to use the ResourceManager with Adapters
 */

import { TransactionBlock } from '@mysten/sui/transactions';
import { TransactionBlockAdapter } from '../types/adapters/TransactionBlockAdapter';
import { 
  getResourceManager, 
  registerAdapter, 
  disposeAllAdapters, 
  // ResourceType imported but not used in example
} from '../utils/ResourceManager';

/**
 * This example demonstrates how to use the ResourceManager with BaseAdapter implementations
 * to ensure proper resource lifecycle management.
 */
async function adapterResourceExample(): Promise<void> {
  logger.info('Starting adapter resource example...');
  
  try {
    // Get the resource manager
    const resourceManager = getResourceManager();
    
    // Create adapters
    logger.info('Creating adapters...');
    const transactionAdapters = [];
    
    // Create and register 5 transaction adapters
    for (let i = 0; i < 5; i++) {
      const txBlock = new TransactionBlock();
      const adapter = new TransactionBlockAdapter(txBlock);
      
      // Register the adapter with the resource manager
      registerAdapter(adapter, {
        description: `Transaction Adapter ${i + 1}`,
        id: `tx-adapter-${i + 1}`
      });
      
      transactionAdapters.push(adapter);
      
      // Set gas budget to simulate some usage
      adapter.setGasBudget(10_000_000);
      logger.info(`Created and registered Transaction Adapter ${i + 1}`);
    }
    
    // Show resource statistics
    logger.info('\nResource Manager Statistics:');
    logger.info(JSON.stringify(resourceManager.getStats(), null, 2));
    
    // Use one of the adapters
    const firstAdapter = transactionAdapters[0];
    logger.info('\nUsing first adapter to create a move call...');
    // result would be used in a real implementation
    const _result = firstAdapter.moveCall({
      target: 'example::module::function',
      arguments: []
    });
    logger.info('Move call result created successfully.');
    
    // Dispose one adapter manually
    logger.info('\nDisposing one adapter manually...');
    await firstAdapter.dispose();
    logger.info('First adapter disposed manually.');
    
    // Show resource statistics again
    logger.info('\nResource Manager Statistics after manual disposal:');
    logger.info(JSON.stringify(resourceManager.getStats(), null, 2));
    
    // Try to use the disposed adapter (should throw an error)
    logger.info('\nTrying to use disposed adapter...');
    try {
      firstAdapter.setGasBudget(20_000_000);
    } catch (_error) {
      logger.info(`Error caught as expected: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Dispose all remaining adapters
    logger.info('\nDisposing all remaining adapters...');
    const count = await disposeAllAdapters({
      continueOnError: true
    });
    logger.info(`Disposed ${count} adapters.`);
    
    // Show final resource statistics
    logger.info('\nFinal Resource Manager Statistics:');
    logger.info(JSON.stringify(resourceManager.getStats(), null, 2));
    
    logger.info('\nExample completed successfully!');
  } catch (_error) {
    logger.error('Error in adapter resource example:', error);
  }
}

/**
 * Run the example
 */
if (require.main === module) {
  adapterResourceExample()
    .then(() => process.exit(0))
    .catch(error => {
      logger.error('Example failed:', error);
      process.exit(1);
    });
}

export default adapterResourceExample;