/**
 * @fileoverview Walrus Storage Interface - Manages Todo and TodoList data on Walrus decentralized storage platform
 *
 * This module provides a robust interface to interact with Walrus, a decentralized storage platform built on the
 * Sui blockchain. It now uses the Walrus CLI directly for all operations by default, with mock mode
 * available for testing.
 *
 * @module walrus-storage
 */

import {
  WalrusStorage as WalrusStorageCLI,
  createWalrusStorage as createWalrusStorageCLI,
} from './walrus-storage-cli';

// Export the CLI-based implementation as the default
export const WalrusStorage = WalrusStorageCLI;
export const createWalrusStorage = createWalrusStorageCLI;

// Export the type separately for TypeScript usage
export type WalrusStorage = WalrusStorageCLI;

// For backward compatibility, also export specific factory functions
export function createMockWalrusStorage(): WalrusStorage {
  return new WalrusStorage('testnet', true);
}

export function createRealWalrusStorage(
  network: string = 'testnet'
): WalrusStorage {
  return new WalrusStorage(network, false);
}
