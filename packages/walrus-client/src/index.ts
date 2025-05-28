/**
 * @waltodo/walrus-client - Unified Walrus Protocol Client
 * 
 * A universal client library for Walrus Protocol that works in both Node.js and browser environments.
 * Consolidates all Walrus functionality from CLI and frontend implementations.
 */

export { WalrusClient } from './client/WalrusClient';
export { WalrusImageStorage } from './client/WalrusImageStorage';
export { WalrusTodoStorage } from './client/WalrusTodoStorage';
export { WalrusConfig } from './config/WalrusConfig';
export { RetryManager } from './utils/RetryManager';
export { ErrorHandler } from './utils/ErrorHandler';

// Types
export * from './types/index';

// Constants
export * from './constants';

// Utils
export { createWalrusClient, createWalrusImageStorage, createWalrusTodoStorage } from './factory';

// Error classes
export {
  WalrusClientError,
  WalrusNetworkError,
  WalrusValidationError,
  WalrusRetryError,
  WalrusStorageError
} from './errors/index';