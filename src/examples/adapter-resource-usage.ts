/**
 * Example demonstrating how to use the ResourceManager with Adapters
 */

import { TransactionBlock } from '@mysten/sui/transactions';
import { TransactionBlockAdapter } from '../types/adapters/TransactionBlockAdapter';
import { 
  getResourceManager, 
  registerAdapter, 
  disposeAllAdapters, 
  ResourceType 
} from '../utils/ResourceManager';

/**
 * This example demonstrates how to use the ResourceManager with BaseAdapter implementations
 * to ensure proper resource lifecycle management.
 */
async function adapterResourceExample(): Promise<void> {
  console.log('Starting adapter resource example...');
  
  try {
    // Get the resource manager
    const resourceManager = getResourceManager();
    
    // Create adapters
    console.log('Creating adapters...');
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
      console.log(`Created and registered Transaction Adapter ${i + 1}`);
    }
    
    // Show resource statistics
    console.log('\nResource Manager Statistics:');
    console.log(JSON.stringify(resourceManager.getStats(), null, 2));
    
    // Use one of the adapters
    const firstAdapter = transactionAdapters[0];
    console.log('\nUsing first adapter to create a move call...');
    const result = firstAdapter.moveCall({
      target: 'example::module::function',
      arguments: []
    });
    console.log('Move call result created successfully.');
    
    // Dispose one adapter manually
    console.log('\nDisposing one adapter manually...');
    await firstAdapter.dispose();
    console.log('First adapter disposed manually.');
    
    // Show resource statistics again
    console.log('\nResource Manager Statistics after manual disposal:');
    console.log(JSON.stringify(resourceManager.getStats(), null, 2));
    
    // Try to use the disposed adapter (should throw an error)
    console.log('\nTrying to use disposed adapter...');
    try {
      firstAdapter.setGasBudget(20_000_000);
    } catch (error) {
      console.log(`Error caught as expected: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Dispose all remaining adapters
    console.log('\nDisposing all remaining adapters...');
    const count = await disposeAllAdapters({
      continueOnError: true
    });
    console.log(`Disposed ${count} adapters.`);
    
    // Show final resource statistics
    console.log('\nFinal Resource Manager Statistics:');
    console.log(JSON.stringify(resourceManager.getStats(), null, 2));
    
    console.log('\nExample completed successfully!');
  } catch (error) {
    console.error('Error in adapter resource example:', error);
  }
}

/**
 * Run the example
 */
if (require.main === module) {
  adapterResourceExample()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Example failed:', error);
      process.exit(1);
    });
}

export default adapterResourceExample;