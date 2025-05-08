/**
 * Module declarations for third-party libraries
 */

// Declare the SerializedMessage from keystore
declare module '@mysten/sui.js/cryptography/keystore' {
  export interface SerializedMessage {
    messageBytes: Uint8Array;
  }
}

// Declare missing types from walrus client
declare module '@mysten/walrus' {
  import { Transaction } from '@mysten/sui.js/transactions';
  import { Signer } from '@mysten/sui.js/cryptography';
  import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';

  // Make WalrusClient both a type and a constructor
  export interface WalrusClient {
    getConfig(): Promise<{ network: string; version: string; maxSize: number }>;
    getWalBalance(): Promise<string>;
    getStorageUsage(): Promise<{ used: string; total: string }>;
    getBlobInfo(blobId: string): Promise<any>;
    getBlobObject(params: { blobId: string }): Promise<any>;
    verifyPoA(params: { blobId: string }): Promise<boolean>;
    writeBlob(params: WriteBlobOptions): Promise<{ blobId: string; blobObject: { blob_id: string } }>;
    readBlob(params: ReadBlobOptions): Promise<Uint8Array>;
    getBlobMetadata(params: { blobId: string }): Promise<any>;
    storageCost(size: number, epochs: number): Promise<{ storageCost: bigint; writeCost: bigint; totalCost: bigint }>;
    executeCreateStorageTransaction(options: StorageWithSizeOptions & { transaction?: Transaction; signer: Signer | Ed25519Keypair }): Promise<any>;
    executeCertifyBlobTransaction(options: CertifyBlobOptions & { transaction?: Transaction; signer: Signer | Ed25519Keypair }): Promise<any>;
    executeWriteBlobAttributesTransaction(options: WriteBlobAttributesOptions & { transaction?: Transaction; signer: Signer | Ed25519Keypair }): Promise<any>;
    deleteBlob(options: DeleteBlobOptions & { transaction?: Transaction; signer: Signer | Ed25519Keypair }): Promise<any>;
    executeRegisterBlobTransaction(options: RegisterBlobOptions & { transaction?: Transaction; signer: Signer | Ed25519Keypair }): Promise<any>;
    getStorageConfirmationFromNode(options: GetStorageConfirmationOptions): Promise<any>;
    createStorageBlock(size: number, epochs: number): Promise<Transaction>;
    createStorage(options: StorageWithSizeOptions): (tx: Transaction) => Promise<any>;
  }

  // Add the constructor function signature
  export const WalrusClient: {
    new(config?: WalrusClientConfig): WalrusClient;
  };

  export interface WriteBlobOptions {
    blob: Uint8Array;
    signer: Signer | Ed25519Keypair;
    deletable?: boolean;
    epochs?: number;
    attributes?: Record<string, string>;
    transaction?: Transaction;
    signal?: AbortSignal;
  }

  export interface ReadBlobOptions {
    blobId: string;
    signal?: AbortSignal;
  }

  export interface StorageWithSizeOptions {
    size: number;
    epochs: number;
    walCoin?: any;
  }

  export interface RegisterBlobOptions {
    blobId: string;
    rootHash: Uint8Array;
    deletable: boolean;
    walCoin?: any;
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
  }

  export interface WalrusClientConfig {
    fullnode?: string;
    network?: string;
    customRpcUrl?: string;
    fetchOptions?: RequestInit;
  }

  // Add missing options types
  export interface WriteSliversToNodeOptions {
    nodeUrl: string;
    blobId: string;
    sliver: Uint8Array;
    version: number;
    totalSize: number;
    partSize: number;
    signal?: AbortSignal;
  }

  export interface WriteEncodedBlobToNodesOptions {
    blobId: string;
    sliver: Uint8Array;
    position: number;
    sliverSize: number;
    totalSize: number;
    encodingType: { RedStuff: true };
    signal?: AbortSignal;
  }

  export interface WriteBlobOptions {
    blob: Uint8Array;
    signer: Signer | Ed25519Keypair;
    deletable?: boolean;
    epochs?: number;
    attributes?: Record<string, string>;
    transaction?: Transaction;
    signal?: AbortSignal;
  }
}

// Declare consistent Transaction interfaces (replacement for TransactionBlock)
declare module '@mysten/sui.js/transactions' {
  import { Signer } from '@mysten/sui.js/cryptography';
  import { SuiObjectRef } from '@mysten/sui.js/client';

  export type TransactionArgument = TransactionObjectArgument | TransactionPureArgument;

  export interface TransactionObjectArgument {
    kind: string;
    index: number;
    value?: any;
    type?: string;
  }

  export interface TransactionPureArgument {
    kind: string;
    value: any;
    type?: string;
  }

  // Transaction type from older package versions, enhanced to match TransactionBlock
  export interface Transaction {
    serialize(): Promise<string>;
    build(): Promise<Uint8Array>;
    getDigest(): Promise<string>;
    
    // Methods from TransactionBlock that need to be available
    pure(value: unknown, type?: string): TransactionArgument;
    object(value: string | SuiObjectRef | { objectId: string, digest?: string, version?: string | number | bigint }): TransactionObjectArgument;
    makeMoveVec(elements: TransactionArgument[], type?: string): TransactionArgument;
    moveCall({ target, arguments: args, typeArguments }: {
      target: string;
      arguments?: TransactionArgument[];
      typeArguments?: string[];
    }): TransactionObjectArgument;
    transferObjects(objects: TransactionObjectArgument[], recipient: TransactionArgument): void;
    setGasBudget(amount: number): void;
    setGasPrice(price: number): void;
    setGasOwner(owner: string): void;
    setSender(sender: string): void;
  }

  // Alias TransactionBlock to Transaction for compatibility
  export type TransactionBlock = Transaction;
}