/**
 * Basic Configuration interface
 * @deprecated Use the more detailed types from './config' instead
 */
export interface Config {
  network: string;
  walletAddress: string;
  encryptedStorage: boolean;
  lastDeployment?: {
    packageId: string;
  };
  packageId?: string;
  registryId?: string;
  completedTodos?: Record<
    string,
    { id: string; title: string; completedAt: string }
  >; // Adding missing property
}

// Export specific items from todo to avoid conflicts
export type {
  Todo,
  TodoList,
  CreateTodoInput,
  UpdateTodoInput,
  StorageLocation,
  Priority,
  TodoStatus,
  TodoMetadata,
  TodoFilter,
  SortBy,
  SortOrder,
  OfflineData,
  SyncData,
} from './todo';
export type {
  TransactionResult as TodoTransactionResult,
  NetworkType as TodoNetworkType,
} from './todo';
export {
  createTodo,
  createTodoList,
  validateTodo,
  validateTodoList,
  serializeTodo,
  deserializeTodo,
} from './todo';
// Export only specific items from error to avoid conflicts
export type { ErrorWithMessage } from './error';
export {
  isErrorWithMessage as isErrorWithMessageLegacy,
  toErrorWithMessage as toErrorWithMessageLegacy,
  getErrorMessage as getErrorMessageLegacy,
} from './error';
// Export all from consolidated (this is the new preferred location)
export * from './errors/consolidated';
// Export specific compatibility items to avoid naming conflicts
export {
  WalrusErrorCode,
  toErrorWithMessage as legacyToErrorWithMessage,
} from './errors/compatibility';
export * from './config';
export * from './walrus';
export * from './transaction';
export * from './client';
export * from './adapters';
export * from './network';

// Re-export Express types for better API controller integration
export type { Request, Response, NextFunction } from 'express';

/**
 * Union Type Safety Exports
 *
 * This section exports enhanced union type utilities and discriminated unions
 * for superior type safety throughout the application.
 */

// Re-export discriminated union types from transaction module
export type { TransactionVariant } from './transaction';
export {
  isTransactionVariant,
  isSuiVariant,
  isAdapterVariant,
  isLegacyVariant,
  createSuiVariant,
  createAdapterVariant,
  createLegacyVariant,
  extractTransaction,
  processTransactionVariant,
} from './transaction';

// Re-export signer variant types
export type { SignerVariant } from './adapters/SignerAdapter';
export {
  isSignerVariant,
  isV1SignerVariant,
  isV2SignerVariant,
  isV25SignerVariant,
  isV3SignerVariant,
  createV1SignerVariant,
  createV2SignerVariant,
  createV25SignerVariant,
  createV3SignerVariant,
  processSignerVariant,
  createSignerVariantFromSDK,
} from './adapters/SignerAdapter';

// Union type utilities from utils module
export {
  createDiscriminatedTypeGuard,
  hasProperty,
  hasPropertyOfType,
  safeAccess,
  safeAccessWithDefault,
  isArrayOf,
  exhaustiveCheck,
  match,
  partialMatch,
  reduceUnion,
  filterByKind,
  groupByKind,
  transformUnion,
  mapUnion,
  isOneOf,
  assertUnionType,
  extractOptional,
  mergeUnionSafe,
} from '../utils/union-type-utils';
