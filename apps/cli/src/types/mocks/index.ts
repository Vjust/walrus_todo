/**
 * Mock Types and Factories - Main Export
 * 
 * This file provides a single import point for all mock-related types and utilities.
 * 
 * @module MocksIndex
 */

// Re-export all shared types
export * from './shared-types';

// Re-export all factory functions
export * from './factories';

// Re-export for backward compatibility
export {
  // Legacy type aliases
  type StandardBlobObject as BlobObject,
  type StandardBlobInfo as BlobInfo,
  type StandardBlobMetadata as BlobMetadata,
  
  // Type guards
  isStandardBlobObject,
  isStandardBlobMetadata,
  isMockBlobRecord,
} from './shared-types';

// Default export with organized structure
export default {
  // Types
  types: {
    // Core types are available through direct imports
  },
  
  // Factory functions
  factories: {
    blob: {
      createMockBlobMetadata: require('./factories').createMockBlobMetadata,
      createMockBlobObject: require('./factories').createMockBlobObject,
      createMockBlobInfo: require('./factories').createMockBlobInfo,
      createMockBlobRecord: require('./factories').createMockBlobRecord,
    },
    
    todo: {
      createMockTodo: require('./factories').createMockTodo,
      createMockTodoList: require('./factories').createMockTodoList,
    },
    
    testData: {
      createTestTodoData: require('./factories').createTestTodoData,
      createTestTodoListData: require('./factories').createTestTodoListData,
      createTestBlobData: require('./factories').createTestBlobData,
    },
    
    config: {
      createMockClientConfig: require('./factories').createMockClientConfig,
      createMockWalletInfo: require('./factories').createMockWalletInfo,
      createMockStorageUsage: require('./factories').createMockStorageUsage,
      createMockStorageConfirmation: require('./factories').createMockStorageConfirmation,
    },
    
    utils: {
      createMultipleBlobData: require('./factories').createMultipleBlobData,
      createErrorScenarioConfig: require('./factories').createErrorScenarioConfig,
      createPerformanceTestConfig: require('./factories').createPerformanceTestConfig,
    },
  },
};