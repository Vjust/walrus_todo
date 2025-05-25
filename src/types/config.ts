/**
 * Configuration type definitions
 * This file defines types related to application configuration
 * and provides compatibility utilities for handling type differences
 * across library versions.
 */

import type { Transaction, TransactionBlock } from '@mysten/sui/transactions';
import type { Signer } from '@mysten/sui/cryptography';
import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { SignerAdapter } from './adapters/SignerAdapter';
import type { TransactionBlockAdapter } from './adapters/TransactionBlockAdapter';
import type { WalrusClientAdapter } from './adapters/WalrusClientAdapter';

/**
 * NetworkConfig defines the configuration for a blockchain network
 */
export interface NetworkConfig {
  name: string;
  fullnode: string;
  faucet?: string;
  walrusUrl?: string;
  customRpcUrl?: string;
}

/**
 * AccountConfig defines the configuration for a blockchain account
 */
export interface AccountConfig {
  address: string;
  privateKey?: string;
  keystore?: {
    path: string;
    password?: string;
  };
  publicKey?: string;
  nickname?: string;
}

/**
 * StorageConfig defines the configuration for storage operations
 */
export interface StorageConfig {
  defaultSize: number;
  defaultEpochs: number;
  replicationFactor: number;
  directory: string;
  temporaryDirectory: string;
  maxRetries: number;
  retryDelay: number;
}

/**
 * TodoConfig defines the configuration specific to todo operations
 */
export interface TodoConfig {
  localStoragePath: string;
  defaultCategories: string[];
  defaultPriority: 'high' | 'medium' | 'low';
  maxTitleLength: number;
  maxDescriptionLength: number;
  defaultDueDateOffsetDays: number;
  expiryCheckInterval: number;
}

/**
 * WalrusConfig defines the configuration for Walrus operations
 */
export interface WalrusConfig {
  fullnode?: string;
  network?: string;
  customRpcUrl?: string;
  fetchOptions?: RequestInit;
  temporaryStorage?: string;
  maxUploadSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  // Added for newer client versions
  timeoutMs?: number;
}

/**
 * CliConfig defines the general configuration for the CLI
 */
export interface CliConfig {
  configPath: string;
  defaultNetwork: string;
  defaultAccount: string;
  networks: Record<string, NetworkConfig>;
  accounts: Record<string, AccountConfig>;
  storage: StorageConfig;
  todo: TodoConfig;
  walrus: WalrusConfig;
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
    console: boolean;
  };
}

/**
 * AppConfig represents the in-memory application configuration
 */
export interface AppConfig {
  activeNetwork: NetworkConfig;
  activeAccount: AccountConfig;
  storage: StorageConfig;
  todo: TodoConfig;
  walrus: WalrusConfig;
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
    console: boolean;
  };
  completedTodos?: {
    count: number;
    lastCompleted: string | null;
    history: Array<{
      id: string;
      title: string;
      completedAt: string;
      listName?: string;
      category?: string;
    }>;
    byCategory: Record<string, number>;
  };
}

/**
 * ConfigOptions for initializing configuration
 */
export interface ConfigOptions {
  configPath?: string;
  network?: string;
  account?: string;
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
    console?: boolean;
  };
}

/**
 * LibraryVersionConfig provides compatibility information for different
 * library versions and how they should interact.
 */
export interface LibraryVersionConfig {
  '@mysten/sui': {
    version: string;
    compatibleWith: string[];
    adapterStrategy: 'direct' | 'wrapped';
  };
  '@mysten/walrus': {
    version: string;
    compatibleWith: string[];
    adapterStrategy: 'direct' | 'wrapped';
  };
}

/**
 * LibraryAdapterOptions for configuring library compatibility adapters
 * Note: Renamed from AdapterOptions to avoid naming conflicts with other modules
 */
export interface LibraryAdapterOptions {
  useMockImplementations?: boolean;
  strictTypeChecking?: boolean;
  adapterFactory?: {
    signer?: (signer: Signer | Ed25519Keypair) => SignerAdapter;
    transaction?: (
      tx: Transaction | TransactionBlock
    ) => TransactionBlockAdapter;
    walrusClient?: (client: unknown) => WalrusClientAdapter;
  };
}

/**
 * TransactionAdapterOptions for the transaction adapter
 */
export interface TransactionAdapterOptions {
  skipTypeValidation?: boolean;
  handleDeprecatedMethods?: boolean;
}

/**
 * SignerAdapterOptions for the signer adapter
 */
export interface SignerAdapterOptions {
  skipTypeValidation?: boolean;
  allowFallbacks?: boolean;
}

/**
 * WalrusClientAdapterOptions for the walrus client adapter
 */
export interface WalrusClientAdapterOptions {
  skipTypeValidation?: boolean;
  handleReturnTypeDifferences?: boolean;
  responseNormalization?: boolean;
}

// Type assertion utilities for better error handling
/**
 * Assert that a value is defined as a certain type
 * @param value The value to check
 * @param message Optional error message
 * @returns The value cast to the specified type
 */
export function assertDefined<T>(
  value: T | undefined | null,
  message?: string
): T {
  if (value === undefined || value === null) {
    throw new Error(message || 'Value is undefined or null');
  }
  return value;
}

/**
 * Assert that a value is of a specific type
 * @param value The value to check
 * @param typeGuard Function that checks if value is of type T
 * @param message Optional error message
 * @returns The value cast to the specified type
 */
export function assertType<T>(
  value: unknown,
  typeGuard: (val: unknown) => boolean,
  message?: string
): T {
  if (!typeGuard(value)) {
    throw new Error(message || `Value is not of expected type`);
  }
  return value as T;
}

/**
 * Assert that a property exists on an object
 * @param obj The object to check
 * @param prop The property name
 * @param message Optional error message
 * @returns The original object (for chaining)
 */
export function assertHasProperty<T extends object, K extends string>(
  obj: T,
  prop: K,
  message?: string
): T & Record<K, unknown> {
  if (!(prop in obj)) {
    throw new Error(message || `Object does not have property ${prop}`);
  }
  return obj as T & Record<K, unknown>;
}

/**
 * Optional chaining replacement that's compatible with older TypeScript
 * @param obj Object to access property from
 * @param property Property to access
 * @param defaultValue Default value if property doesn't exist
 * @returns Property value or default
 */
export function safeGet<T, K extends keyof T>(
  obj: T | null | undefined,
  property: K,
  defaultValue: T[K]
): T[K] {
  if (obj == null) {
    return defaultValue;
  }
  return obj[property] !== undefined ? obj[property] : defaultValue;
}

/**
 * Type compatibility checker for runtime type validation
 */
export function isCompatibleType<T>(
  value: unknown,
  properties: (keyof T)[],
  typeGuard?: (val: unknown) => boolean
): value is T {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (typeGuard && !typeGuard(value)) {
    return false;
  }

  return properties.every(prop => prop in value);
}

/**
 * Apply a transformation function only if a value is defined
 */
export function applyIfDefined<T, R>(
  value: T | undefined | null,
  fn: (val: T) => R
): R | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return fn(value);
}

/**
 * Convert a possibly bigint/number/string value to bigint safely
 */
export function toBigInt(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return BigInt(value);
  }
  if (typeof value === 'string') {
    return BigInt(value);
  }
  return BigInt(0);
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch (error: unknown) {
    return fallback;
  }
}
