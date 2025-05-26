/**
 * Module declarations for third-party libraries
 * Enhanced for compatibility between different library versions
 */

// AggregateError polyfill declaration for ES2020 targets
// AggregateError was introduced in ES2021 but we target ES2020
declare global {
  interface AggregateError extends Error {
    errors: Error[];
  }

  interface AggregateErrorConstructor {
    new (errors: Iterable<unknown>, message?: string): AggregateError;
    (errors: Iterable<unknown>, message?: string): AggregateError;
    readonly prototype: AggregateError;
  }

  const AggregateError: AggregateErrorConstructor;

  // Global console interface enhancement
  interface Console {
    error(...args: unknown[]): void;
    log(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    info(...args: unknown[]): void;
    debug(...args: unknown[]): void;
  }

  // Global Error handling interface
  interface Error {
    name: string;
    message: string;
    stack?: string;
    cause?: unknown;
  }

  // Process environment interface
  // Use module augmentation instead of namespace
  interface NodeJSProcessEnv {
    [key: string]: string | undefined;
    NODE_ENV?: 'development' | 'production' | 'test';
    CI?: string;
  }

  // Augment NodeJS process env
  var process: {
    env: NodeJSProcessEnv;
  };
}

// Declare the SerializedMessage from keystore
declare module '@mysten/sui/cryptography/keystore' {
  export interface SerializedMessage {
    messageBytes: Uint8Array;
  }
}

// Enhanced TransactionBlock and Transaction types
declare module '@mysten/sui/transactions' {
  // Signer imported but not used
  import { SuiObjectRef } from '@mysten/sui/client';

  export type TransactionArgument =
    | TransactionObjectArgument
    | TransactionPureArgument;

  export interface TransactionObjectArgument {
    kind: string;
    index: number;
    value?: unknown;
    type?: string;
  }

  export interface TransactionPureArgument {
    kind: string;
    value: unknown;
    type?: string;
  }

  // Unified Transaction interface compatible with both old and new APIs
  export interface Transaction {
    // Core methods for serialization and building
    serialize(): Promise<string> | string;
    build(options?: { client?: unknown }): Promise<Uint8Array>;
    getDigest(): Promise<string>;

    // Core TransactionBlock methods
    pure(value: unknown, type?: string): TransactionArgument;
    object(
      value:
        | string
        | SuiObjectRef
        | {
            objectId: string;
            digest?: string;
            version?: string | number | bigint;
          }
    ): TransactionObjectArgument;
    makeMoveVec(params: {
      objects: (string | TransactionObjectArgument)[];
      type?: string;
    }): TransactionObjectArgument;
    moveCall(params: {
      target: `${string}::${string}::${string}`;
      arguments?: TransactionArgument[];
      typeArguments?: string[];
    }): TransactionObjectArgument;
    transferObjects(
      objects: (string | TransactionObjectArgument)[],
      address: string | TransactionObjectArgument
    ): TransactionObjectArgument;
    setGasBudget(budget: bigint | number): void;
    setGasPrice(price: bigint | number): void;
    setGasOwner(owner: string): void;
    setSender(sender: string): void;
    setSenderIfNotSet?(sender: string): void;

    // Coin handling methods
    splitCoins(
      coin: string | TransactionObjectArgument,
      amounts: (string | number | bigint | TransactionArgument)[]
    ): TransactionObjectArgument;
    mergeCoins(
      destination: string | TransactionObjectArgument,
      sources: (string | TransactionObjectArgument)[]
    ): void;
    gas(objectId?: string): TransactionObjectArgument;

    // Package management methods
    publish(options: {
      modules: string[] | number[][];
      dependencies: string[];
    }): TransactionObjectArgument;
    upgrade(options: {
      modules: string[] | number[][];
      dependencies: string[];
      packageId: string;
      ticket: string | TransactionObjectArgument;
    }): TransactionObjectArgument;
  }

  // Define constructors for both Transaction and TransactionBlock
  export const Transaction: {
    new (): Transaction;
  };

  export type TransactionBlock = Transaction;

  export const TransactionBlock: {
    new (): TransactionBlock;
  };
}

// Enhanced Walrus types with better compatibility support
declare module '@mysten/walrus' {
  import { Transaction, TransactionBlock } from '@mysten/sui/transactions';
  import { Signer } from '@mysten/sui/cryptography';
  import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

  // BlobObject structure with optional fields to accommodate all versions
  export interface BlobObject {
    blob_id: string;
    id?: { id: string };
    registered_epoch?: number;
    storage_cost?: { value: string };
    storage_rebate?: { value: string };
    size?: string;
    deletable?: boolean;
    cert_epoch?: number;
    metadata?: Record<string, unknown>;
    provider_count?: number;
    slivers?: number;
    attributes?: Record<string, string>;
    checksum?: { primary: string; secondary?: string };
  }

  // Complete WalrusClient interface with flexible return types
  export interface WalrusClient {
    // Core info methods
    getConfig(): Promise<{ network: string; version: string; maxSize: number }>;
    getWalBalance(): Promise<string>;
    getStorageUsage(): Promise<{ used: string; total: string }>;

    // Blob management methods
    getBlobInfo(blobId: string): Promise<BlobObject>;
    getBlobObject(params: { blobId: string }): Promise<BlobObject>;
    verifyPoA(params: { blobId: string }): Promise<boolean>;

    // Flexible writeBlob return type to handle different implementations
    writeBlob(params: WriteBlobOptions): Promise<{
      blobId?: string; // Could be optional in some implementations
      blob_id?: string; // Alternative field name in other implementations
      blobObject?: BlobObject;
      digest?: string;
    }>;

    readBlob(params: ReadBlobOptions): Promise<Uint8Array>;
    getBlobMetadata(params: { blobId: string } | ReadBlobOptions): Promise<Record<string, unknown>>;

    // Cost calculation with bigint return type
    storageCost(
      size: number,
      epochs: number
    ): Promise<{
      storageCost: bigint;
      writeCost: bigint;
      totalCost: bigint;
    }>;

    // Transaction methods with flexible parameter types
    executeCreateStorageTransaction(
      options: StorageWithSizeOptions & {
        transaction?: Transaction | TransactionBlock;
        signer: Signer | Ed25519Keypair;
      }
    ): Promise<{
      digest: string;
      storage: {
        id: { id: string };
        start_epoch: number;
        end_epoch: number;
        storage_size: string;
      };
    }>;

    executeCertifyBlobTransaction(
      options: CertifyBlobOptions & {
        transaction?: Transaction | TransactionBlock;
        signer?: Signer | Ed25519Keypair;
      }
    ): Promise<{ digest: string }>;

    executeWriteBlobAttributesTransaction(
      options: WriteBlobAttributesOptions & {
        transaction?: Transaction | TransactionBlock;
        signer?: Signer | Ed25519Keypair;
      }
    ): Promise<{ digest: string }>;

    // More flexible deleteBlob method that can handle multiple signature patterns
    deleteBlob(
      options: DeleteBlobOptions
    ):
      | ((tx: Transaction | TransactionBlock) => Promise<{ digest: string }>)
      | Promise<{ digest: string }>;

    executeRegisterBlobTransaction(
      options: RegisterBlobOptions & {
        transaction?: Transaction | TransactionBlock;
        signer?: Signer | Ed25519Keypair;
      }
    ): Promise<{ blob: BlobObject; digest: string }>;

    getStorageConfirmationFromNode(
      options: GetStorageConfirmationOptions
    ): Promise<{
      confirmed: boolean;
      serializedMessage?: string;
      signature?: string;
    }>;

    // Storage block creation methods
    createStorageBlock(
      size: number,
      epochs: number
    ): Promise<Transaction | TransactionBlock>;
    createStorage(options: StorageWithSizeOptions): (
      tx: Transaction | TransactionBlock
    ) => Promise<{
      digest: string;
      storage: {
        id: { id: string };
        start_epoch: number;
        end_epoch: number;
        storage_size: string;
      };
    }>;

    // Optional experimental methods
    experimental?: {
      getBlobData?: () => Promise<unknown>;
      [key: string]: unknown;
    };
  }

  // Constructor for WalrusClient
  export const WalrusClient: {
    new (config?: WalrusClientConfig): WalrusClient;
  };

  // Comprehensive options interfaces
  export interface WriteBlobOptions {
    blob: Uint8Array;
    signer: Signer | Ed25519Keypair;
    deletable?: boolean;
    epochs?: number;
    attributes?: Record<string, string>;
    transaction?: Transaction | TransactionBlock;
    signal?: AbortSignal;
    timeout?: number;
  }

  export interface ReadBlobOptions {
    blobId: string;
    signal?: AbortSignal;
    timeout?: number;
  }

  export interface StorageWithSizeOptions {
    size: number;
    epochs: number;
    walCoin?: unknown;
  }

  export interface RegisterBlobOptions {
    blobId: string;
    rootHash: Uint8Array;
    deletable: boolean;
    walCoin?: unknown;
    attributes?: Record<string, string>;
    size: number;
    epochs: number;
  }

  export interface CertifyBlobOptions {
    blobObjectId: string;
  }

  export interface WriteBlobAttributesOptions {
    blobObjectId: string;
    attributes: Record<string, string>;
  }

  export interface DeleteBlobOptions {
    blobObjectId: string;
  }

  export interface GetStorageConfirmationOptions {
    blobId: string;
    nodeIndex: number;
    nodeUrl?: string;
    timeout?: number;
  }

  export interface WalrusClientConfig {
    fullnode?: string;
    network?: string;
    customRpcUrl?: string;
    fetchOptions?: RequestInit;
    timeoutMs?: number;
  }

  export interface WriteSliversToNodeOptions {
    nodeUrl: string;
    blobId: string;
    sliver: Uint8Array;
    version: number;
    totalSize: number;
    partSize: number;
    signal?: AbortSignal;
    timeout?: number;
  }

  export interface WriteEncodedBlobToNodesOptions {
    blobId: string;
    sliver: Uint8Array;
    position: number;
    sliverSize: number;
    totalSize: number;
    encodingType: { RedStuff: true };
    signal?: AbortSignal;
    timeout?: number;
  }
}

// Playwright module declarations
declare module '@playwright/test' {
  export function defineConfig(config: unknown): unknown;
  export const devices: Record<string, unknown>;
  export const test: unknown;
  export const expect: unknown;
  export type Page = unknown;
  export type Browser = unknown;
  export type BrowserContext = unknown;
  export type PlaywrightTestConfig = unknown;
}

// Node.js built-in module declarations for better compatibility
declare module 'fs' {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding?: BufferEncoding): string | Buffer;
  export function writeFileSync(path: string, data: string | Buffer, options?: unknown): void;
  export function mkdirSync(path: string, options?: unknown): void;
  export function readdirSync(path: string): string[];
  export function statSync(path: string): { isFile(): boolean; isDirectory(): boolean };
  export const promises: {
    readFile(path: string, encoding?: BufferEncoding): Promise<string | Buffer>;
    writeFile(path: string, data: string | Buffer, options?: unknown): Promise<void>;
    access(path: string): Promise<void>;
    stat(path: string): Promise<{ isFile(): boolean; isDirectory(): boolean }>;
    mkdir(path: string, options?: unknown): Promise<void>;
    readdir(path: string): Promise<string[]>;
    unlink(path: string): Promise<void>;
  };
}

declare module 'path' {
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  export function dirname(path: string): string;
  export function basename(path: string, ext?: string): string;
  export function extname(path: string): string;
  export function isAbsolute(path: string): boolean;
  export const sep: string;
}

declare module 'os' {
  export function platform(): string;
  export function homedir(): string;
  export function tmpdir(): string;
  export function type(): string;
}

// CLI Progress module declaration
declare module 'cli-progress' {
  export class SingleBar {
    constructor(options?: unknown, preset?: unknown);
    start(total: number, startValue?: number, payload?: unknown): void;
    update(current: number, payload?: unknown): void;
    increment(step?: number, payload?: unknown): void;
    stop(): void;
  }
  export const Presets: {
    shades_classic: unknown;
    shades_grey: unknown;
    legacy: unknown;
  };
}
