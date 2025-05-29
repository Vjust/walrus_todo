/**
 * Shared Type Definitions for Mock Data Alignment
 * 
 * This file provides standardized type definitions for mock data across tests,
 * resolving conflicts between different BlobObject definitions and providing
 * common test data structures.
 * 
 * @module MockSharedTypes
 */

import type { Todo, TodoList } from '../todo';

// ============================================================================
// CONSOLIDATED BLOB OBJECT INTERFACE
// ============================================================================

/**
 * Canonical BlobObject interface that combines the best of both definitions
 * from walrus.ts and walrus.d.ts, providing comprehensive compatibility
 */
export interface StandardBlobObject {
  /** Unique blob identifier */
  blob_id: string;
  
  /** Object identifier wrapper (required by some contexts) */
  id: {
    id: string;
  };
  
  /** Epoch when the blob was registered */
  registered_epoch: number;
  
  /** Storage cost details (optional for compatibility) */
  storage_cost?: {
    value: string;
  };
  
  /** Storage rebate details (optional for compatibility) */
  storage_rebate?: {
    value: string;
  };
  
  /** Size of the blob as a string */
  size: string;
  
  /** Encoding type number */
  encoding_type: number;
  
  /** Whether the blob can be deleted */
  deletable: boolean;
  
  /** Certification epoch (optional, varies by context) */
  cert_epoch?: number;
  
  /** Certified epoch (alternative naming) */
  certified_epoch?: number | null;
  
  /** Storage allocation details */
  storage: {
    id: { id: string };
    storage_size: string;
    used_size: string;
    end_epoch: number;
    start_epoch: number;
  };
  
  /** Blob metadata (optional, complex structure) */
  metadata?: StandardBlobMetadata;
  
  /** Provider count (optional) */
  provider_count?: number;
  
  /** Number of slivers (optional) */
  slivers?: number;
  
  /** Additional attributes (optional) */
  attributes?: Record<string, string>;
  
  /** Checksum information (optional) */
  checksum?: {
    primary: string;
    secondary?: string;
  };
}

/**
 * Standardized BlobMetadata interface
 */
export interface StandardBlobMetadata {
  /** Optional blob ID for compatibility */
  blob_id?: string;
  
  /** Main metadata structure */
  V1: {
    $kind: 'V1';
    encoding_type: StandardEncodingType;
    unencoded_length: string;
    hashes: StandardBlobHash[];
  };
  
  /** Metadata kind discriminator */
  $kind: 'V1';
  
  /** Index signature for additional compatibility */
  [key: string]: unknown;
}

/**
 * Standardized encoding type
 */
export interface StandardEncodingType {
  RedStuff: boolean;
  RS2?: boolean;
  $kind: string;
}

/**
 * Standardized blob hash structure
 */
export interface StandardBlobHash {
  primary_hash: {
    Digest: Uint8Array;
    $kind: string;
  };
  secondary_hash: {
    Sha256?: Uint8Array;
    Digest?: Uint8Array;
    $kind: string;
  };
}

/**
 * BlobInfo extends BlobObject with additional certified information
 */
export interface StandardBlobInfo extends StandardBlobObject {
  certified_epoch: number;
  unencoded_length?: string;
  hashes?: StandardBlobHash[];
}

// ============================================================================
// MOCK-SPECIFIC TYPE HELPERS
// ============================================================================

/**
 * Mock blob record for internal test storage simulation
 */
export interface MockBlobRecord {
  blobId: string;
  data: Uint8Array;
  registered_epoch: number;
  certified_epoch?: number;
  size: number;
  attributes?: Record<string, string>;
  contentType?: string;
  owner?: string;
  tags?: string[];
  encoding_type: number;
  metadata: StandardBlobMetadata;
  storage: {
    id: { id: string };
    start_epoch: number;
    end_epoch: number;
    storage_size: string;
    used_size: string;
  };
  certificationInProgress?: boolean;
}

/**
 * Storage confirmation structure for mocks
 */
export interface MockStorageConfirmation {
  primary_verification: boolean;
  secondary_verification?: boolean;
  provider: string;
  signature?: string;
  confirmed?: boolean;
  serializedMessage?: string;
  epoch?: number;
}

/**
 * Mock client configuration options
 */
export interface MockClientConfig {
  network?: string;
  version?: string;
  maxSize?: number;
  defaultCertified?: boolean;
  simulateNetworkErrors?: boolean;
  providerCount?: number;
  currentEpoch?: number;
  customBlobData?: Record<string, Uint8Array>;
}

/**
 * Mock wallet balance information
 */
export interface MockWalletInfo {
  balance: string;
  address?: string;
  network?: string;
}

/**
 * Mock storage usage information
 */
export interface MockStorageUsage {
  used: string;
  total: string;
  available?: string;
  utilization?: number;
}

// ============================================================================
// COMMON TEST DATA STRUCTURES
// ============================================================================

/**
 * Standard test todo data structure
 */
export interface TestTodoData {
  basic: Todo;
  withImage: Todo;
  blockchain: Todo;
  private: Todo;
  completed: Todo;
  highPriority: Todo;
  withDueDate: Todo;
  withTags: Todo;
}

/**
 * Standard test todo list data structure
 */
export interface TestTodoListData {
  empty: TodoList;
  withTodos: TodoList;
  shared: TodoList;
  private: TodoList;
}

/**
 * Standard test blob data structure
 */
export interface TestBlobData {
  small: {
    id: string;
    data: Uint8Array;
    metadata: StandardBlobMetadata;
  };
  medium: {
    id: string;
    data: Uint8Array;
    metadata: StandardBlobMetadata;
  };
  large: {
    id: string;
    data: Uint8Array;
    metadata: StandardBlobMetadata;
  };
  image: {
    id: string;
    data: Uint8Array;
    contentType: string;
    metadata: StandardBlobMetadata;
  };
}

/**
 * Test configuration preset
 */
export interface TestConfigPreset {
  name: string;
  mockClientConfig: MockClientConfig;
  expectedBehavior: {
    shouldCertify: boolean;
    shouldFailSometimes: boolean;
    providerCount: number;
    networkDelay?: number;
  };
}

// ============================================================================
// UTILITY TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if an object is a StandardBlobObject
 */
export function isStandardBlobObject(obj: unknown): obj is StandardBlobObject {
  if (!obj || typeof obj !== 'object') return false;
  const blob = obj as Record<string, unknown>;
  
  return (
    typeof blob.blob_id === 'string' &&
    typeof blob.id === 'object' &&
    blob.id !== null &&
    typeof (blob.id as Record<string, unknown>).id === 'string' &&
    typeof blob.registered_epoch === 'number' &&
    typeof blob.size === 'string' &&
    typeof blob.encoding_type === 'number' &&
    typeof blob.deletable === 'boolean' &&
    typeof blob.storage === 'object'
  );
}

/**
 * Type guard to check if an object is a StandardBlobMetadata
 */
export function isStandardBlobMetadata(obj: unknown): obj is StandardBlobMetadata {
  if (!obj || typeof obj !== 'object') return false;
  const metadata = obj as Record<string, unknown>;
  
  return (
    metadata.$kind === 'V1' &&
    typeof metadata.V1 === 'object' &&
    metadata.V1 !== null
  );
}

/**
 * Type guard to check if an object is a MockBlobRecord
 */
export function isMockBlobRecord(obj: unknown): obj is MockBlobRecord {
  if (!obj || typeof obj !== 'object') return false;
  const record = obj as Record<string, unknown>;
  
  return (
    typeof record.blobId === 'string' &&
    record.data instanceof Uint8Array &&
    typeof record.registered_epoch === 'number' &&
    typeof record.size === 'number' &&
    typeof record.encoding_type === 'number' &&
    typeof record.metadata === 'object' &&
    typeof record.storage === 'object'
  );
}

// ============================================================================
// MOCK DATA FACTORY TYPES
// ============================================================================

/**
 * Factory function type for creating test todos
 */
export type TodoFactory = (overrides?: Partial<Todo>) => Todo;

/**
 * Factory function type for creating test blob objects
 */
export type BlobObjectFactory = (overrides?: Partial<StandardBlobObject>) => StandardBlobObject;

/**
 * Factory function type for creating test blob metadata
 */
export type BlobMetadataFactory = (size?: number) => StandardBlobMetadata;

/**
 * Factory function type for creating mock blob records
 */
export type MockBlobRecordFactory = (
  blobId: string,
  data: Uint8Array,
  overrides?: Partial<MockBlobRecord>
) => MockBlobRecord;

// ============================================================================
// MOCK VALIDATION TYPES
// ============================================================================

/**
 * Validation result for mock data
 */
export interface MockValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validation configuration for mock data
 */
export interface MockValidationConfig {
  strictMode: boolean;
  checkSizes: boolean;
  validateHashes: boolean;
  requireCertification: boolean;
}

// ============================================================================
// EXPORT TYPE UNIONS FOR CONVENIENCE
// ============================================================================

/**
 * Union type for all blob-related objects
 */
export type AnyBlobObject = StandardBlobObject | StandardBlobInfo | MockBlobRecord;

/**
 * Union type for all metadata objects
 */
export type AnyMetadata = StandardBlobMetadata;

/**
 * Union type for all test data structures
 */
export type AnyTestData = TestTodoData | TestTodoListData | TestBlobData;

/**
 * Union type for all mock configuration objects
 */
export type AnyMockConfig = MockClientConfig | MockValidationConfig;

// ============================================================================
// COMPATIBILITY EXPORTS
// ============================================================================

/**
 * Legacy alias for backward compatibility
 * @deprecated Use StandardBlobObject instead
 */
export type BlobObject = StandardBlobObject;

/**
 * Legacy alias for backward compatibility
 * @deprecated Use StandardBlobInfo instead
 */
export type BlobInfo = StandardBlobInfo;

/**
 * Legacy alias for backward compatibility
 * @deprecated Use StandardBlobMetadata instead
 */
export type BlobMetadata = StandardBlobMetadata;