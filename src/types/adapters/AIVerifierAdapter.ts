import { SuiClient } from '@mysten/sui/client';
import { TransactionBlock } from '@mysten/sui/transactions';
import { SignerAdapter } from './SignerAdapter';
import { WalrusClientAdapter } from './WalrusClientAdapter';

export enum AIActionType {
  SUMMARIZE = 0,
  CATEGORIZE = 1,
  PRIORITIZE = 2,
  SUGGEST = 3,
  ANALYZE = 4
}

export enum AIPrivacyLevel {
  PUBLIC = 'public',     // Full request/response on-chain
  HASH_ONLY = 'hash_only', // Only hashes on-chain, content on Walrus
  PRIVATE = 'private'    // Only verification record on-chain, encrypted content
}

export interface VerificationParams {
  actionType: AIActionType;
  request: string;
  response: string;
  provider?: string;
  metadata?: Record<string, string>;
  privacyLevel?: AIPrivacyLevel;
}

export interface ProviderRegistrationParams {
  name: string;
  publicKey: string;
  metadata?: Record<string, string>;
}

export interface ProviderInfo {
  name: string;
  publicKey: string;
  verificationCount: number;
  isActive: boolean;
  metadata?: Record<string, string>;
}

export interface VerificationRecord {
  id: string;
  requestHash: string;
  responseHash: string;
  user: string;
  provider: string;
  timestamp: number;
  verificationType: AIActionType;
  metadata: Record<string, string>;
}

export interface AIVerifierAdapter {
  createVerification(params: VerificationParams): Promise<VerificationRecord>;
  verifyRecord(record: VerificationRecord, request: string, response: string): Promise<boolean>;
  getProviderInfo(providerAddress: string): Promise<ProviderInfo>;
  listVerifications(userAddress?: string): Promise<VerificationRecord[]>;
  getRegistryAddress(): Promise<string>;
  registerProvider(params: ProviderRegistrationParams): Promise<string>;
  getVerification(verificationId: string): Promise<VerificationRecord>;
  getSigner(): SignerAdapter;
}

export class SuiAIVerifierAdapter implements AIVerifierAdapter {
  private client: SuiClient;
  private signer: SignerAdapter;
  private packageId: string;
  private registryId: string;
  private walrusAdapter?: WalrusClientAdapter;

  constructor(
    client: SuiClient,
    signer: SignerAdapter,
    packageId: string,
    registryId: string,
    walrusAdapter?: WalrusClientAdapter
  ) {
    this.client = client;
    this.signer = signer;
    this.packageId = packageId;
    this.registryId = registryId;
    this.walrusAdapter = walrusAdapter;
  }

  async registerProvider(params: ProviderRegistrationParams): Promise<string> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  async createVerification(params: VerificationParams): Promise<VerificationRecord> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  async verifyRecord(
    record: VerificationRecord,
    request: string,
    response: string
  ): Promise<boolean> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  async getProviderInfo(providerAddress: string): Promise<ProviderInfo> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  async listVerifications(userAddress?: string): Promise<VerificationRecord[]> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  async getRegistryAddress(): Promise<string> {
    return this.registryId;
  }

  async getVerification(verificationId: string): Promise<VerificationRecord> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  getSigner(): SignerAdapter {
    return this.signer;
  }
}