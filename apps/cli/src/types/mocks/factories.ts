/**
 * Mock Data Factories for Shared Test Data Creation
 * 
 * This file provides factory functions for creating standardized mock data
 * that can be used consistently across all test files.
 * 
 * @module MockFactories
 */

import type {
  StandardBlobObject,
  StandardBlobInfo,
  StandardBlobMetadata,
  MockBlobRecord,
  TestTodoData,
  TestTodoListData,
  TestBlobData,
  MockClientConfig,
  MockStorageConfirmation,
  MockWalletInfo,
  MockStorageUsage,
} from './shared-types';
import type { Todo, TodoList } from '../todo';

// ============================================================================
// BLOB OBJECT FACTORIES
// ============================================================================

/**
 * Creates a standardized BlobMetadata structure
 */
export function createMockBlobMetadata(size: number = 1024): StandardBlobMetadata {
  return {
    V1: {
      encoding_type: { RedStuff: true, RS2: false, $kind: 'RedStuff' },
      unencoded_length: size.toString(),
      hashes: [
        {
          primary_hash: {
            Digest: new Uint8Array([1, 2, 3, 4]),
            $kind: 'Digest',
          },
          secondary_hash: {
            Sha256: new Uint8Array([5, 6, 7, 8]),
            $kind: 'Sha256',
          },
        },
      ],
      $kind: 'V1' as const,
    },
    $kind: 'V1' as const,
  };
}

/**
 * Creates a standardized BlobObject
 */
export function createMockBlobObject(
  blobId: string = 'mock-blob-id',
  overrides: Partial<StandardBlobObject> = {}
): StandardBlobObject {
  const size = overrides.size || '1024';
  const metadata = createMockBlobMetadata(parseInt(size));
  
  return {
    blob_id: blobId,
    id: { id: blobId },
    registered_epoch: 100,
    cert_epoch: 150,
    certified_epoch: 150,
    size,
    encoding_type: 0,
    deletable: true,
    storage: {
      id: { id: 'storage1' },
      storage_size: (parseInt(size) * 2).toString(),
      used_size: size,
      end_epoch: 200,
      start_epoch: 100,
    },
    metadata,
    attributes: {},
    ...overrides,
  };
}

/**
 * Creates a standardized BlobInfo (extends BlobObject with additional certified info)
 */
export function createMockBlobInfo(
  blobId: string = 'mock-blob-id',
  overrides: Partial<StandardBlobInfo> = {}
): StandardBlobInfo {
  const blobObject = createMockBlobObject(blobId, overrides);
  
  return {
    ...blobObject,
    certified_epoch: 150,
    unencoded_length: blobObject.size,
    hashes: blobObject.metadata?.V1.hashes || [],
    ...overrides,
  };
}

/**
 * Creates a MockBlobRecord for internal storage simulation
 */
export function createMockBlobRecord(
  blobId: string,
  data: Uint8Array,
  overrides: Partial<MockBlobRecord> = {}
): MockBlobRecord {
  const size = data.length;
  const metadata = createMockBlobMetadata(size);
  const currentEpoch = 100;
  
  return {
    blobId,
    data,
    registered_epoch: currentEpoch,
    certified_epoch: currentEpoch + 50,
    size,
    encoding_type: 0,
    metadata,
    storage: {
      id: { id: 'storage1' },
      start_epoch: currentEpoch,
      end_epoch: currentEpoch + 100,
      storage_size: (size * 2).toString(),
      used_size: size.toString(),
    },
    attributes: {},
    contentType: 'application/octet-stream',
    owner: 'mock-owner',
    tags: [],
    certificationInProgress: false,
    ...overrides,
  };
}

// ============================================================================
// TODO FACTORIES
// ============================================================================

/**
 * Creates a basic todo item for testing
 */
export function createMockTodo(overrides: Partial<Todo> = {}): Todo {
  const now = new Date().toISOString();
  const id = `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id,
    title: 'Mock Todo',
    description: 'A mock todo for testing',
    completed: false,
    priority: 'medium',
    tags: ['test'],
    createdAt: now,
    updatedAt: now,
    private: false,
    ...overrides,
  };
}

/**
 * Creates a todo list for testing
 */
export function createMockTodoList(overrides: Partial<TodoList> = {}): TodoList {
  const now = new Date().toISOString();
  const id = `list-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id,
    name: 'Mock Todo List',
    owner: 'mock-owner',
    todos: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
    collaborators: [],
    ...overrides,
  };
}

// ============================================================================
// TEST DATA COLLECTIONS
// ============================================================================

/**
 * Creates a complete set of test todo data
 */
export function createTestTodoData(): TestTodoData {
  const baseDate = new Date();
  const tomorrow = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  return {
    basic: createMockTodo({
      title: 'Basic Todo',
      description: 'A basic todo item',
    }),
    
    withImage: createMockTodo({
      title: 'Todo with Image',
      imageUrl: 'https://walrus?.example?.com/blob/image-blob-id',
      walrusBlobId: 'image-blob-id',
    }),
    
    blockchain: createMockTodo({
      title: 'Blockchain Todo',
      storageLocation: 'blockchain',
      walrusBlobId: 'blockchain-blob-id',
      nftObjectId: 'nft-object-id',
    }),
    
    private: createMockTodo({
      title: 'Private Todo',
      private: true,
      storageLocation: 'local',
    }),
    
    completed: createMockTodo({
      title: 'Completed Todo',
      completed: true,
      completedAt: new Date().toISOString(),
    }),
    
    highPriority: createMockTodo({
      title: 'High Priority Todo',
      priority: 'high',
      tags: ['urgent', 'important'],
    }),
    
    withDueDate: createMockTodo({
      title: 'Todo with Due Date',
      dueDate: tomorrow,
    }),
    
    withTags: createMockTodo({
      title: 'Todo with Tags',
      tags: ['work', 'project', 'meeting'],
      category: 'work',
    }),
  };
}

/**
 * Creates a complete set of test todo list data
 */
export function createTestTodoListData(): TestTodoListData {
  return {
    empty: createMockTodoList({
      name: 'Empty List',
    }),
    
    withTodos: createMockTodoList({
      name: 'List with Todos',
      todos: [
        createMockTodo({ title: 'First Todo' }),
        createMockTodo({ title: 'Second Todo', completed: true }),
      ],
    }),
    
    shared: createMockTodoList({
      name: 'Shared List',
      collaborators: ['user1', 'user2'],
      permissions: {
        'user1': 'read',
        'user2': 'write',
      },
    }),
    
    private: createMockTodoList({
      name: 'Private List',
      collaborators: [],
    }),
  };
}

/**
 * Creates a complete set of test blob data
 */
export function createTestBlobData(): TestBlobData {
  return {
    small: {
      id: 'small-blob-id',
      data: new Uint8Array([1, 2, 3, 4]),
      metadata: createMockBlobMetadata(4),
    },
    
    medium: {
      id: 'medium-blob-id',
      data: new Uint8Array(1024).fill(42),
      metadata: createMockBlobMetadata(1024),
    },
    
    large: {
      id: 'large-blob-id',
      data: new Uint8Array(10240).fill(255),
      metadata: createMockBlobMetadata(10240),
    },
    
    image: {
      id: 'image-blob-id',
      data: new Uint8Array([0x89, 0x50, 0x4E, 0x47]), // PNG header
      contentType: 'image/png',
      metadata: createMockBlobMetadata(4),
    },
  };
}

// ============================================================================
// MOCK CLIENT CONFIGURATION FACTORIES
// ============================================================================

/**
 * Creates a mock client configuration
 */
export function createMockClientConfig(overrides: Partial<MockClientConfig> = {}): MockClientConfig {
  return {
    network: 'testnet',
    version: '1?.0?.0',
    maxSize: 10485760,
    defaultCertified: true,
    simulateNetworkErrors: false,
    providerCount: 4,
    currentEpoch: 100,
    customBlobData: {},
    ...overrides,
  };
}

/**
 * Creates mock wallet information
 */
export function createMockWalletInfo(overrides: Partial<MockWalletInfo> = {}): MockWalletInfo {
  return {
    balance: '1000',
    address: '0x123456789abcdef',
    network: 'testnet',
    ...overrides,
  };
}

/**
 * Creates mock storage usage information
 */
export function createMockStorageUsage(overrides: Partial<MockStorageUsage> = {}): MockStorageUsage {
  const used = parseInt(overrides.used || '100');
  const total = parseInt(overrides.total || '1000');
  
  return {
    used: used.toString(),
    total: total.toString(),
    available: (total - used).toString(),
    utilization: Math.round((used / total) * 100),
    ...overrides,
  };
}

/**
 * Creates mock storage confirmation
 */
export function createMockStorageConfirmation(
  overrides: Partial<MockStorageConfirmation> = {}
): MockStorageConfirmation {
  return {
    primary_verification: true,
    secondary_verification: true,
    provider: 'mock-provider',
    signature: 'mock-signature',
    confirmed: true,
    epoch: 150,
    ...overrides,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates test data for multiple blobs at once
 */
export function createMultipleBlobData(count: number, baseId: string = 'blob'): Record<string, Uint8Array> {
  const result: Record<string, Uint8Array> = {};
  
  for (let i = 0; i < count; i++) {
    const blobId = `${baseId}-${i}`;
    const size = Math.floor(Math.random() * 1000) + 100; // Random size between 100-1100
    result[blobId] = new Uint8Array(size).fill(i % 256);
  }
  
  return result;
}

/**
 * Creates test data for error simulation scenarios
 */
export function createErrorScenarioConfig(): MockClientConfig {
  return createMockClientConfig({
    simulateNetworkErrors: true,
    providerCount: 2, // Reduced for failure scenarios
    currentEpoch: 50, // Lower epoch for testing epoch-dependent logic
  });
}

/**
 * Creates test data for performance testing scenarios
 */
export function createPerformanceTestConfig(): MockClientConfig {
  return createMockClientConfig({
    maxSize: 104857600, // 100MB
    providerCount: 8, // More providers for performance
    customBlobData: createMultipleBlobData(100, 'perf-blob'),
  });
}

// ============================================================================
// EXPORT COLLECTIONS
// ============================================================================

/**
 * Collection of all factory functions
 */
export const MockFactories = {
  // Blob factories
  createMockBlobMetadata,
  createMockBlobObject,
  createMockBlobInfo,
  createMockBlobRecord,
  
  // Todo factories
  createMockTodo,
  createMockTodoList,
  
  // Test data collections
  createTestTodoData,
  createTestTodoListData,
  createTestBlobData,
  
  // Configuration factories
  createMockClientConfig,
  createMockWalletInfo,
  createMockStorageUsage,
  createMockStorageConfirmation,
  
  // Utility functions
  createMultipleBlobData,
  createErrorScenarioConfig,
  createPerformanceTestConfig,
};

/**
 * Default export for convenience
 */
export default MockFactories;