/**
 * Blockchain network types
 */
export type Network = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

/**
 * Sui blockchain types
 */
export interface SuiAddress {
  address: string;
}

export interface SuiTransaction {
  digest: string;
  sender: string;
  gasUsed: {
    computationCost: string;
    storageCost: string;
    storageRebate: string;
  };
  timestampMs?: string;
  status: 'success' | 'failure';
}

export interface SuiObject {
  objectId: string;
  version: string;
  digest: string;
  owner: string | { ObjectOwner: string };
  previousTransaction: string;
  storageRebate: string;
}

/**
 * Todo NFT on-chain structure
 */
export interface TodoNFT extends SuiObject {
  content: {
    dataType: 'moveObject';
    type: string;
    hasPublicTransfer: boolean;
    fields: {
      id: { id: string };
      name: string;
      description: string;
      url: string;
      creator: string;
      todo_id: string;
      walrus_blob_id?: string;
      attributes?: Record<string, string>;
    };
  };
}

/**
 * AI Credential on-chain structure
 */
export interface AICredential extends SuiObject {
  content: {
    dataType: 'moveObject';
    type: string;
    hasPublicTransfer: boolean;
    fields: {
      id: { id: string };
      provider: string;
      credential_type: string;
      encrypted_key: number[];
      owner: string;
      created_at: string;
      expires_at?: string;
    };
  };
}

/**
 * AI Operation Verifier on-chain structure
 */
export interface AIOperationVerifier extends SuiObject {
  content: {
    dataType: 'moveObject';
    type: string;
    fields: {
      id: { id: string };
      operation_count: string;
      last_operation: string;
      verified_operations: string[];
    };
  };
}

/**
 * Smart contract addresses
 */
export interface ContractAddresses {
  todoPackage: string;
  todoNftPackage: string;
  aiCredentialPackage: string;
  aiVerifierPackage: string;
}

/**
 * Transaction building types
 */
export interface TransactionArgument {
  kind: 'Input' | 'GasCoin' | 'Result' | 'NestedResult';
  index?: number;
  resultIndex?: number;
}

export interface MoveCall {
  target: string;
  arguments: (string | TransactionArgument)[];
  typeArguments?: string[];
}

/**
 * Wallet types
 */
export interface WalletAccount {
  address: string;
  publicKey: string;
  label?: string;
}

export interface WalletCapabilities {
  features: Array<{
    name: string;
    version: string;
  }>;
}

/**
 * Gas estimation
 */
export interface GasEstimate {
  computationCost: bigint;
  storageCost: bigint;
  storageRebate: bigint;
  totalCost: bigint;
}

/**
 * Event types
 */
export interface TodoCreatedEvent {
  id: { txDigest: string; eventSeq: string };
  packageId: string;
  transactionModule: string;
  sender: string;
  type: string;
  parsedJson: {
    todo_id: string;
    creator: string;
    title: string;
    created_at: string;
  };
  bcs: string;
  timestampMs?: string;
}

export interface TodoCompletedEvent {
  id: { txDigest: string; eventSeq: string };
  packageId: string;
  transactionModule: string;
  sender: string;
  type: string;
  parsedJson: {
    todo_id: string;
    completed_by: string;
    completed_at: string;
  };
  bcs: string;
  timestampMs?: string;
}

/**
 * Module names for Move contracts
 */
export interface MoveModules {
  todo: 'todo';
  todoNft: 'todo_nft';
  aiCredential: 'ai_credential';
  aiVerifier: 'ai_operation_verifier';
}

/**
 * Transaction status
 */
export interface TransactionStatus {
  status: 'pending' | 'executing' | 'success' | 'failure';
  digest?: string;
  error?: string;
  timestamp: string;
}