/**
 * Example: Publishing TODOs to Walrus
 * 
 * This example demonstrates how to use the enhanced Walrus integration
 * for publishing TODO data with cost estimation, batch processing,
 * and metadata management.
 */

import { 
  WalrusClient, 
  TodoPublisher,
  exportForWalrus,
  exportAndPublishToWalrus,
  validateTodosForWalrus,
  createTodo as createTodoOperation,
  getTodos
} from '../src/index.js';

async function demonstrateWalrusPublishing() {
  console.log('🦭 Walrus TODO Publishing Demo\n');

  try {
    // 1. Create a WalrusClient instance
    const walrusClient = new WalrusClient({
      cliPath: 'walrus', // Path to Walrus CLI
      timeout: 30000,
      maxRetries: 3
    });

    // 2. Create some sample TODOs
    console.log('📝 Creating sample TODOs...');
    await createTodoOperation('Learn about Walrus decentralized storage', {
      priority: 'high',
      tags: ['learning', 'blockchain']
    });
    
    await createTodoOperation('Set up TODO publishing pipeline', {
      priority: 'medium',
      tags: ['development', 'walrus']
    });
    
    await createTodoOperation('Write documentation for Walrus integration', {
      priority: 'medium',
      tags: ['documentation', 'walrus']
    });

    // 3. Get all TODOs
    const todos = await getTodos();
    console.log(`✅ Created ${todos.length} sample TODOs\n`);

    // 4. Validate TODOs for Walrus publishing
    console.log('🔍 Validating TODOs for Walrus publishing...');
    const validation = await validateTodosForWalrus(todos);
    
    console.log(`Validation Result: ${validation.isValid ? '✅ Valid' : '❌ Invalid'}`);
    console.log(`- Total TODOs: ${validation.stats.totalTodos}`);
    console.log(`- Valid TODOs: ${validation.stats.validTodos}`);
    console.log(`- Invalid TODOs: ${validation.stats.invalidTodos}`);
    console.log(`- Estimated Size: ${Math.round(validation.stats.estimatedSize / 1024)} KB`);
    
    if (validation.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      validation.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
    
    if (!validation.isValid) {
      console.log('❌ Errors:');
      validation.errors.forEach(error => console.log(`  - ${error}`));
      return;
    }
    console.log('');

    // 5. Export TODOs for Walrus with metadata
    console.log('📦 Exporting TODOs for Walrus publishing...');
    const exportData = await exportForWalrus({
      includeStats: true,
      includeMetadata: true,
      validateData: true,
      sortBy: 'priority',
      ascending: false
    });

    console.log('Export completed:');
    console.log(`- TODO Count: ${exportData.todos.length}`);
    console.log(`- Data Type: ${exportData.metadata.dataType}`);
    console.log(`- Schema: ${exportData.metadata.schema}`);
    console.log(`- Exported At: ${exportData.exportInfo.exportedAt}`);
    
    if (exportData.statistics) {
      console.log('📊 Statistics:');
      console.log(`  - Total: ${exportData.statistics.total}`);
      console.log(`  - Pending: ${exportData.statistics.pending}`);
      console.log(`  - Done: ${exportData.statistics.done}`);
      console.log(`  - High Priority: ${exportData.statistics.highPriority}`);
    }
    console.log('');

    // 6. Create TodoPublisher and estimate costs
    console.log('💰 Estimating publishing costs...');
    const publisher = new TodoPublisher(walrusClient, {
      includeStats: true,
      estimateCost: true,
      batchSize: 50,
      retryAttempts: 3
    });

    const costEstimate = await publisher.estimatePublishCost(todos);
    console.log(`Cost Estimate:`);
    console.log(`- Estimated Size: ${Math.round(costEstimate.estimatedSize / 1024)} KB`);
    console.log(`- Estimated Cost: ${costEstimate.estimatedCost.toFixed(6)} SUI`);
    
    if (costEstimate.warning) {
      console.log(`⚠️  Warning: ${costEstimate.warning}`);
    }
    console.log('');

    // 7. Demonstrate single publish (without actually publishing)
    console.log('🚀 Single Publish Example (simulation)...');
    console.log('This would publish all TODOs as a single blob to Walrus:');
    console.log(`- Method: publisher.publishSingle(todos, options)`);
    console.log(`- Result: Single blob with all ${todos.length} TODOs`);
    console.log('');

    // 8. Demonstrate batch publish (without actually publishing)
    console.log('📦 Batch Publish Example (simulation)...');
    console.log('This would publish TODOs in batches to Walrus:');
    console.log(`- Method: publisher.publishBatch(todos, options)`);
    console.log(`- Batch Size: 50 TODOs per batch`);
    console.log(`- Estimated Batches: ${Math.ceil(todos.length / 50)}`);
    console.log('');

    // 9. Show direct Walrus client JSON storage (simulation)
    console.log('🗂️  Direct JSON Storage Example (simulation)...');
    console.log('Using WalrusClient.storeJson() for custom data:');
    const customData = {
      todoSummary: {
        count: todos.length,
        priorities: {
          high: todos.filter(t => t.priority === 'high').length,
          medium: todos.filter(t => t.priority === 'medium').length,
          low: todos.filter(t => t.priority === 'low').length,
        },
        tags: [...new Set(todos.flatMap(t => t.tags || []))]
      }
    };

    console.log('Custom metadata would include:');
    console.log(`- Data Type: todo-summary`);
    console.log(`- Schema: todo-summary-v1`);
    console.log(`- Timestamp: ${new Date().toISOString()}`);
    console.log(`- App: waltodo v1.0.0`);
    console.log('');

    // 10. Show publishing history features
    console.log('📈 Publishing History Features:');
    console.log('- Track all publish attempts (success/failure)');
    console.log('- Store metadata for each publish');
    console.log('- Calculate statistics (total cost, success rate, etc.)');
    console.log('- Support for batch tracking');
    console.log('- Automatic cleanup of old history entries');
    console.log('');

    console.log('✨ Demo completed! All features demonstrated.');
    console.log('');
    console.log('💡 To actually publish to Walrus:');
    console.log('1. Ensure Walrus CLI is installed and configured');
    console.log('2. Replace simulation calls with actual publish methods');
    console.log('3. Handle the returned blob IDs for retrieval');
    console.log('4. Monitor costs and implement appropriate limits');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    // Cleanup
    try {
      console.log('\n🧹 Cleaning up...');
      await clearAllTodos();
      console.log('✅ Cleanup completed');
    } catch (cleanupError) {
      console.error('⚠️  Cleanup warning:', cleanupError);
    }
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateWalrusPublishing()
    .then(() => {
      console.log('\n🎉 Demo finished successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Demo failed:', error);
      process.exit(1);
    });
}

export { demonstrateWalrusPublishing };

// Additional examples for specific use cases

/**
 * Example: Publishing large TODO datasets with batching
 */
export async function publishLargeTodoDataset() {
  const walrusClient = new WalrusClient();
  const publisher = new TodoPublisher(walrusClient, {
    batchSize: 100, // Process 100 TODOs per batch
    estimateCost: true,
    retryAttempts: 3
  });

  const todos = await getTodos();
  
  if (todos.length > 100) {
    // Use batch publishing for large datasets
    const result = await publisher.publishBatch(todos);
    
    console.log(`Published ${todos.length} TODOs in ${result.results.length} batches`);
    console.log(`Total cost: ${result.totalCost} SUI`);
    console.log(`Success rate: ${result.successCount}/${result.successCount + result.failureCount}`);
    
    return result;
  } else {
    // Use single publish for smaller datasets
    const result = await publisher.publishSingle(todos);
    console.log(`Published ${todos.length} TODOs in single blob: ${result.blobId}`);
    return result;
  }
}

/**
 * Example: Cost-aware publishing with limits
 */
export async function publishWithCostLimits(maxCostSUI: number = 1.0) {
  const walrusClient = new WalrusClient();
  const publisher = new TodoPublisher(walrusClient);
  
  const todos = await getTodos();
  const estimate = await publisher.estimatePublishCost(todos);
  
  if (estimate.estimatedCost > maxCostSUI) {
    throw new Error(`Estimated cost (${estimate.estimatedCost} SUI) exceeds limit (${maxCostSUI} SUI)`);
  }
  
  return await publisher.publishSingle(todos, {
    estimateCost: true,
    includeStats: true
  });
}

/**
 * Example: Filtered publishing with specific criteria
 */
export async function publishFilteredTodos() {
  // Export only high-priority pending TODOs
  const exportData = await exportForWalrus({
    filter: {
      status: 'pending',
      priority: 'high'
    },
    sortBy: 'due',
    ascending: true,
    includeStats: true
  });

  console.log(`Exporting ${exportData.todos.length} high-priority pending TODOs`);
  
  // The export data can then be published using TodoPublisher
  return exportData;
}