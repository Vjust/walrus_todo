import { SuiClient } from '@mysten/sui/client';
// TransactionBlock imported but not used
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
  createVerification(_params: VerificationParams): Promise<VerificationRecord>;
  verifyRecord(_record: VerificationRecord, request: string, response: string): Promise<boolean>;
  getProviderInfo(_providerAddress: string): Promise<ProviderInfo>;
  listVerifications(userAddress?: string): Promise<VerificationRecord[]>;
  getRegistryAddress(): Promise<string>;
  registerProvider(_params: ProviderRegistrationParams): Promise<string>;
  getVerification(_verificationId: string): Promise<VerificationRecord>;
  getSigner(): SignerAdapter;
  
  // Generate a cryptographic proof for a verification record
  generateProof(_verificationId: string): Promise<string>;
  
  // Export user verification records in the specified format
  exportVerifications(_userAddress: string, format?: 'json' | 'csv'): Promise<string>;
  
  // Enforce data retention policy, deleting records older than the threshold
  enforceRetentionPolicy(retentionDays?: number): Promise<number>;
  
  // Securely destroy data, ensuring it cannot be recovered
  securelyDestroyData(_verificationId: string): Promise<boolean>;
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

  async registerProvider(_params: ProviderRegistrationParams): Promise<string> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  async createVerification(_params: VerificationParams): Promise<VerificationRecord> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  async verifyRecord(
    _record: VerificationRecord,
    _request: string,
    _response: string
  ): Promise<boolean> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  async getProviderInfo(_providerAddress: string): Promise<ProviderInfo> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  async listVerifications(_userAddress?: string): Promise<VerificationRecord[]> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  async getRegistryAddress(): Promise<string> {
    return this.registryId;
  }

  async getVerification(_verificationId: string): Promise<VerificationRecord> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  getSigner(): SignerAdapter {
    return this.signer;
  }
  
  async generateProof(_verificationId: string): Promise<string> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }
  
  async exportVerifications(_userAddress: string, _format?: 'json' | 'csv'): Promise<string> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }
  
  async enforceRetentionPolicy(_retentionDays?: number): Promise<number> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }
  
  async securelyDestroyData(_verificationId: string): Promise<boolean> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }
}