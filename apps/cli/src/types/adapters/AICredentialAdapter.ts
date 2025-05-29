/**
 * AICredentialAdapter
 *
 * This file defines the interfaces for the AI credential management system
 * which provides secure and blockchain-verified access to AI providers.
 */

import { SignerAdapter } from './SignerAdapter';
import { WalrusClientAdapter } from './WalrusClientAdapter';
import type { SuiClientType } from '../../utils/adapters/sui-client-adapter';

/**
 * Types of credentials that can be stored
 */
export enum CredentialType {
  API_KEY = 'api_key',
  OAUTH_TOKEN = 'oauth_token',
  CERTIFICATE = 'certificate',
  BLOCKCHAIN_KEY = 'blockchain_key',
}

/**
 * Permission levels for AI operations
 */
export enum AIPermissionLevel {
  NO_ACCESS = 0, // No access to AI operations
  READ_ONLY = 1, // Can only use non-modifying operations (_read, _analyze)
  STANDARD = 2, // Standard access level (most operations)
  ADVANCED = 3, // Advanced access (including training, fine-tuning)
  ADMIN = 4, // Admin level (full access)
}

/**
 * AI Operation permission structure
 */
export interface AIOperationPermission {
  operationName: string;
  actionType: number; // Required field for operation type mapping
  minPermissionLevel: AIPermissionLevel;
  additionalChecks?: string[];
}

/**
 * Rotation policy settings
 */
export interface RotationPolicy {
  autoRotate: boolean;
  intervalDays: number;
  notifyBeforeDays?: number;
  requireVerification?: boolean;
}

/**
 * Credential backup policy
 */
export interface BackupPolicy {
  enabled: boolean;
  location?: string;
  maxBackups?: number;
  encryptBackups?: boolean;
}

/**
 * Credential storage options
 */
export interface CredentialStorageOptions {
  encrypt: boolean;
  expiryDays?: number;
  backupPolicy?: BackupPolicy;
  rotationPolicy?: RotationPolicy;
  validationPolicy?: {
    validateOnUse: boolean;
    validateBlockchain: boolean;
    validatePermissions: boolean;
  };
}

/**
 * AI Provider Credential Interface
 */
export interface AIProviderCredential {
  id: string;
  providerName: string;
  credentialType: CredentialType;
  credentialValue: string;
  metadata: Record<string, unknown>;
  isVerified: boolean;
  verificationProof?: string;
  storageOptions: CredentialStorageOptions;
  createdAt: number;
  expiresAt?: number;
  lastUsed?: number;
  permissionLevel: AIPermissionLevel;
}

/**
 * Credential verification params for blockchain verification
 */
export interface CredentialVerificationParams {
  credentialId: string;
  providerName: string;
  publicKey: string;
  metadata?: Record<string, string>;
  timestamp: number;
  verifierAddress: string;
}

/**
 * Blockchain verification result
 */
export interface CredentialVerificationResult {
  isVerified: boolean;
  verificationId: string;
  timestamp: number;
  verifierAddress: string;
  metadata: Record<string, string>;
  expiryTimestamp?: number;
}

/**
 * AI Credential Adapter interface
 */
export interface AICredentialAdapter {
  /**
   * Store a credential for an AI provider
   */
  storeCredential(_credential: AIProviderCredential): Promise<string>;

  /**
   * Retrieve a credential by ID
   */
  getCredential(_credentialId: string): Promise<AIProviderCredential>;

  /**
   * Retrieve a credential by provider name
   */
  getCredentialByProvider(_providerName: string): Promise<AIProviderCredential>;

  /**
   * List all credentials
   */
  listCredentials(): Promise<AIProviderCredential[]>;

  /**
   * Check if a credential exists for a provider
   */
  hasCredential(_providerName: string): Promise<boolean>;

  /**
   * Delete a credential
   */
  deleteCredential(_credentialId: string): Promise<boolean>;

  /**
   * Verify a credential on the blockchain
   */
  verifyCredential(
    _params: CredentialVerificationParams
  ): Promise<CredentialVerificationResult>;

  /**
   * Check if a credential verification is still valid
   */
  checkVerificationStatus(_verificationId: string): Promise<boolean>;

  /**
   * Generate a shareable proof for a credential
   */
  generateCredentialProof(_credentialId: string): Promise<string>;

  /**
   * Revoke a credential verification
   */
  revokeVerification(_verificationId: string): Promise<boolean>;

  /**
   * Get the signer for this credential adapter
   */
  getSigner(): SignerAdapter;
}

/**
 * Blockchain-based implementation of the AICredentialAdapter
 */
export class SuiAICredentialAdapter implements AICredentialAdapter {
  private client: SuiClientType;
  private signer: SignerAdapter;
  private packageId: string;
  private registryId: string;
  private walrusAdapter?: WalrusClientAdapter;

  constructor(
    client: SuiClientType,
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

  async storeCredential(_credential: AIProviderCredential): Promise<string> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  async getCredential(_credentialId: string): Promise<AIProviderCredential> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  async getCredentialByProvider(
    _providerName: string
  ): Promise<AIProviderCredential> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  async listCredentials(): Promise<AIProviderCredential[]> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  async hasCredential(_providerName: string): Promise<boolean> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  async deleteCredential(_credentialId: string): Promise<boolean> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  async verifyCredential(
    _params: CredentialVerificationParams
  ): Promise<CredentialVerificationResult> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  async checkVerificationStatus(_verificationId: string): Promise<boolean> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  async generateCredentialProof(_credentialId: string): Promise<string> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  async revokeVerification(_verificationId: string): Promise<boolean> {
    // Implementation will be provided in the adapter implementation
    throw new Error('Method not implemented.');
  }

  getSigner(): SignerAdapter {
    return this.signer;
  }
}
