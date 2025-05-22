/**
 * SecureCredentialService.ts
 * 
 * A comprehensive service for securely managing AI provider credentials
 * with enhanced security features including encryption, validation,
 * expiry management, rotation policies, and blockchain verification.
 */

import { AIProvider } from './types';
import { EnhancedVaultManager } from '../../utils/EnhancedVaultManager';
import { validateApiKey, performKeySecurityCheck } from '../../utils/KeyValidator';
import { CLIError } from '../../types/error';
import { Logger } from '../../utils/Logger';
import { AICredentialAdapter, AIPermissionLevel } from '../../types/adapters/AICredentialAdapter';
import { randomUUID } from 'crypto';
import { AI_CONFIG } from '../../constants';

export interface CredentialInfo {
  provider: AIProvider;
  verified: boolean;
  expiresAt?: string;
  createdAt: string;
  rotationDue?: string;
  permissionLevel: AIPermissionLevel;
  isSafeToUse: boolean;
  securityIssues?: string[];
}

interface CredentialMetadata {
  credentialId: string;
  permissionLevel: AIPermissionLevel;
  verified: boolean;
  verificationId?: string;
  verificationDate?: string;
  securityScore?: number;
  lastRotated?: string;
  customMetadata?: Record<string, any>;
}

export class SecureCredentialService {
  private vault: EnhancedVaultManager;
  private logger: Logger;
  private blockchainAdapter?: AICredentialAdapter;
  private credentialCache: Map<string, { value: string, expiry: number }> = new Map();
  private readonly cacheTTL: number = 60 * 1000; // 1 minute
  
  /**
   * Initialize the credential service
   */
  constructor() {
    this.vault = new EnhancedVaultManager('ai-credentials');
    this.logger = Logger.getInstance();
    
    // Check for credentials needing rotation
    this.checkRotationNeeded();
  }
  
  /**
   * Set a blockchain adapter for credential verification
   * 
   * @param adapter - Blockchain adapter instance
   */
  public setBlockchainAdapter(adapter: AICredentialAdapter): void {
    this.blockchainAdapter = adapter;
    this.logger.info('Blockchain adapter set for credential verification');
  }
  
  /**
   * Store an API key securely
   * 
   * @param provider - AI provider name
   * @param apiKey - API key to store
   * @param options - Additional storage options
   * @returns Information about the stored credential
   */
  public async storeCredential(
    provider: AIProvider,
    apiKey: string,
    options: {
      permissionLevel?: AIPermissionLevel;
      expiryDays?: number;
      verifyOnChain?: boolean;
      rotationDays?: number;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<CredentialInfo> {
    // Validate the API key format
    validateApiKey(provider, apiKey);
    
    // Perform security check on the key
    const securityCheck = performKeySecurityCheck(apiKey);
    if (!securityCheck.secure) {
      this.logger.warn(`Security issues detected with ${provider} API key: ${securityCheck.issues.join(', ')}`);
    }
    
    // Create credential ID and metadata
    const credentialId = randomUUID();
    const permissionLevel = options.permissionLevel || AIPermissionLevel.STANDARD;
    const now = Date.now();
    
    const metadata: CredentialMetadata = {
      credentialId,
      permissionLevel,
      verified: false,
      securityScore: securityCheck.secure ? 100 : 50,
      customMetadata: options.metadata || {}
    };
    
    // Store in vault
    await this.vault.storeSecret(
      `${provider}-api-key`,
      apiKey,
      {
        expiryDays: options.expiryDays || AI_CONFIG.CREDENTIAL_SECURITY.AUTO_ROTATION_DAYS * 2,
        rotationDays: options.rotationDays || AI_CONFIG.CREDENTIAL_SECURITY.AUTO_ROTATION_DAYS,
        metadata
      }
    );
    
    // Clear from cache if exists
    this.credentialCache.delete(provider);
    
    let verified = false;
    
    // Verify on blockchain if requested
    if (options.verifyOnChain && this.blockchainAdapter) {
      try {
        const verificationResult = await this.blockchainAdapter.verifyCredential({
          credentialId: metadata.credentialId,
          providerName: provider,
          publicKey: 'placeholder', // Would use a real public key in production
          timestamp: now,
          verifierAddress: 'placeholder', // Would use a real address in production
          metadata: {
            permissionLevel: permissionLevel.toString(),
            provider,
            timestamp: now.toString()
          }
        });
        
        // Update metadata with verification info
        metadata.verified = true;
        metadata.verificationId = verificationResult.verificationId;
        metadata.verificationDate = new Date().toISOString();
        verified = true;
        
        // Update stored metadata
        await this.vault.storeSecret(
          `${provider}-api-key`,
          apiKey,
          {
            expiryDays: options.expiryDays || AI_CONFIG.CREDENTIAL_SECURITY.AUTO_ROTATION_DAYS * 2,
            rotationDays: options.rotationDays || AI_CONFIG.CREDENTIAL_SECURITY.AUTO_ROTATION_DAYS,
            metadata
          }
        );
        
        this.logger.info(`API key for ${provider} verified on blockchain with ID: ${verificationResult.verificationId}`);
      } catch (_error) {
        this.logger.error(`Failed to verify ${provider} credential on blockchain: ${_error instanceof Error ? _error.message : 'Unknown error'}`);
      }
    }
    
    // Get metadata to create response
    const metadataInfo = await this.vault.getSecretMetadata(`${provider}-api-key`);
    
    return {
      provider,
      verified,
      expiresAt: metadataInfo?.expiresAt ? new Date(metadataInfo.expiresAt).toISOString() : undefined,
      createdAt: new Date(metadataInfo?.createdAt || now).toISOString(),
      rotationDue: metadataInfo?.rotationDue ? new Date(metadataInfo.rotationDue).toISOString() : undefined,
      permissionLevel,
      isSafeToUse: securityCheck.secure,
      securityIssues: securityCheck.secure ? undefined : securityCheck.issues
    };
  }
  
  /**
   * Retrieve an API key
   * 
   * @param provider - AI provider name
   * @param options - Retrieval options
   * @returns The API key
   */
  public async getCredential(
    provider: AIProvider,
    options: {
      verifyOnChain?: boolean;
      bypassCache?: boolean;
    } = {}
  ): Promise<string> {
    // Check cache first if not bypassing
    if (!options.bypassCache) {
      const cached = this.credentialCache.get(provider);
      if (cached && cached.expiry > Date.now()) {
        return cached.value;
      }
    }
    
    try {
      // Get from vault
      const apiKey = await this.vault.getSecret(`${provider}-api-key`);
      
      // Get metadata for verification
      const metadataInfo = await this.vault.getSecretMetadata(`${provider}-api-key`);
      const metadata = metadataInfo?.metadata as CredentialMetadata | undefined;
      
      // Verify on blockchain if requested and credential was previously verified
      if (options.verifyOnChain && this.blockchainAdapter && metadata?.verified && metadata?.verificationId) {
        try {
          const isValid = await this.blockchainAdapter.checkVerificationStatus(metadata.verificationId);
          if (!isValid) {
            throw new CLIError(
              `Blockchain verification for ${provider} credential is no longer valid`,
              'VERIFICATION_INVALID'
            );
          }
          this.logger.debug(`Blockchain verification for ${provider} credential is valid`);
        } catch (_error) {
          if (_error instanceof CLIError && _error.code === 'VERIFICATION_INVALID') {
            throw _error;
          }
          this.logger.warn(`Failed to check blockchain verification: ${_error instanceof Error ? _error.message : 'Unknown error'}`);
          // Continue with credential even if verification check fails
        }
      }
      
      // Store in cache
      this.credentialCache.set(provider, {
        value: apiKey,
        expiry: Date.now() + this.cacheTTL
      });
      
      return apiKey;
    } catch (_error) {
      // Check for environment variable as fallback
      const envKey = `${provider.toUpperCase()}_API_KEY`;
      const envValue = process.env[envKey];
      
      if (envValue) {
        this.logger.info(`Using ${provider} API key from environment variable`);
        
        // Validate the key
        try {
          validateApiKey(provider, envValue);
        } catch (validationError) {
          this.logger.warn(`Environment variable ${envKey} contains an invalid API key: ${(validationError as Error).message}`);
        }
        
        return envValue;
      }
      
      throw new CLIError(
        `No API key found for ${provider}. Use 'walrus_todo ai credentials add ${provider} --key YOUR_API_KEY' to add one.`,
        'CREDENTIAL_NOT_FOUND'
      );
    }
  }
  
  /**
   * Get detailed information about a credential
   * 
   * @param provider - AI provider name
   * @returns Credential information
   */
  public async getCredentialInfo(provider: AIProvider): Promise<CredentialInfo> {
    try {
      // Get metadata from vault
      const metadataInfo = await this.vault.getSecretMetadata(`${provider}-api-key`);
      
      if (!metadataInfo) {
        throw new CLIError(`No credential found for ${provider}`, 'CREDENTIAL_NOT_FOUND');
      }
      
      const metadata = metadataInfo.metadata as CredentialMetadata | undefined;
      
      // Construct credential info
      return {
        provider,
        verified: metadata?.verified || false,
        expiresAt: metadataInfo.expiresAt ? new Date(metadataInfo.expiresAt).toISOString() : undefined,
        createdAt: new Date(metadataInfo.createdAt).toISOString(),
        rotationDue: metadataInfo.rotationDue ? new Date(metadataInfo.rotationDue).toISOString() : undefined,
        permissionLevel: metadata?.permissionLevel || AIPermissionLevel.STANDARD,
        isSafeToUse: (metadata?.securityScore || 0) >= 70
      };
    } catch (_error) {
      // Check environment variable as fallback
      const envKey = `${provider.toUpperCase()}_API_KEY`;
      if (process.env[envKey]) {
        return {
          provider,
          verified: false,
          createdAt: new Date().toISOString(),
          permissionLevel: AIPermissionLevel.STANDARD,
          isSafeToUse: true // Assume environment variables are safe
        };
      }
      
      throw new CLIError(
        `No credential information found for ${provider}`,
        'CREDENTIAL_INFO_NOT_FOUND'
      );
    }
  }
  
  /**
   * Check if a credential exists
   *
   * @param provider - AI provider name
   * @returns True if credential exists
   */
  public async hasCredential(provider: AIProvider): Promise<boolean> {
    // Check vault
    const hasInVault = await this.vault.hasSecret(`${provider}-api-key`);
    if (hasInVault) {
      console.log(`Found credential for ${provider} in vault`);
      return true;
    }

    // Check environment variable as fallback
    const envKey = `${provider.toUpperCase()}_API_KEY`;
    const hasEnvKey = !!process.env[envKey];

    console.log(`Checking for ${envKey} in environment: ${hasEnvKey ? 'FOUND' : 'NOT FOUND'}`);
    if (hasEnvKey) {
      console.log(`${envKey} value length: ${process.env[envKey]?.length || 0}`);
    }

    return hasEnvKey;
  }
  
  /**
   * List all credentials
   * 
   * @returns Array of credential information
   */
  public async listCredentials(): Promise<CredentialInfo[]> {
    // Get all secrets from vault
    const secrets = await this.vault.listSecrets();
    const credentials: CredentialInfo[] = [];
    
    // Process vault credentials
    for (const secret of secrets) {
      if (!secret.endsWith('-api-key')) continue;
      
      const provider = secret.replace('-api-key', '') as AIProvider;
      try {
        const info = await this.getCredentialInfo(provider);
        credentials.push(info);
      } catch (_error) {
        this.logger.warn(`Failed to get info for ${provider} credential: ${_error instanceof Error ? _error.message : 'Unknown error'}`);
      }
    }
    
    // Add environment variables
    for (const provider of [AIProvider.XAI, AIProvider.OPENAI, AIProvider.ANTHROPIC]) {
      const isAlreadyListed = credentials.some(c => c.provider === provider);
      if (isAlreadyListed) continue;
      
      const envKey = `${provider.toUpperCase()}_API_KEY`;
      if (process.env[envKey]) {
        credentials.push({
          provider,
          verified: false,
          createdAt: new Date().toISOString(),
          permissionLevel: AIPermissionLevel.STANDARD,
          isSafeToUse: true
        });
      }
    }
    
    return credentials;
  }
  
  /**
   * Remove a credential
   * 
   * @param provider - AI provider name
   * @returns True if successful
   */
  public async removeCredential(provider: AIProvider): Promise<boolean> {
    try {
      // Get metadata for blockchain revocation
      const metadataInfo = await this.vault.getSecretMetadata(`${provider}-api-key`);
      const metadata = metadataInfo?.metadata as CredentialMetadata | undefined;
      
      // Revoke on blockchain if verified
      if (this.blockchainAdapter && metadata?.verified && metadata?.verificationId) {
        try {
          await this.blockchainAdapter.revokeVerification(metadata.verificationId);
          this.logger.info(`Revoked blockchain verification for ${provider} credential`);
        } catch (_error) {
          this.logger.warn(`Failed to revoke blockchain verification: ${_error instanceof Error ? _error.message : 'Unknown error'}`);
        }
      }
      
      // Remove from vault
      const removed = await this.vault.removeSecret(`${provider}-api-key`);
      
      // Remove from cache
      this.credentialCache.delete(provider);
      
      return removed;
    } catch (_error) {
      this.logger.error(`Failed to remove ${provider} credential: ${_error instanceof Error ? _error.message : 'Unknown error'}`);
      return false;
    }
  }
  
  /**
   * Verify a credential on the blockchain
   * 
   * @param provider - AI provider name
   * @returns True if verification succeeded
   */
  public async verifyCredential(provider: AIProvider): Promise<boolean> {
    if (!this.blockchainAdapter) {
      throw new CLIError('Blockchain adapter not configured', 'BLOCKCHAIN_ADAPTER_MISSING');
    }
    
    try {
      // Get API key
      const apiKey = await this.getCredential(provider, { bypassCache: true });
      
      // Get metadata
      const metadataInfo = await this.vault.getSecretMetadata(`${provider}-api-key`);
      if (!metadataInfo) {
        throw new CLIError(`No credential found for ${provider}`, 'CREDENTIAL_NOT_FOUND');
      }
      
      const metadata = (metadataInfo.metadata || {}) as CredentialMetadata;
      
      // Perform verification
      const verificationResult = await this.blockchainAdapter.verifyCredential({
        credentialId: metadata.credentialId || randomUUID(),
        providerName: provider,
        publicKey: 'placeholder', // Would use a real public key in production
        timestamp: Date.now(),
        verifierAddress: 'placeholder', // Would use a real address in production
        metadata: {
          permissionLevel: (metadata.permissionLevel || AIPermissionLevel.STANDARD).toString(),
          provider,
          timestamp: Date.now().toString()
        }
      });
      
      // Update metadata
      metadata.verified = true;
      metadata.verificationId = verificationResult.verificationId;
      metadata.verificationDate = new Date().toISOString();
      
      // Store updated metadata
      await this.vault.storeSecret(
        `${provider}-api-key`,
        apiKey,
        {
          metadata
        }
      );
      
      this.logger.info(`Verified ${provider} credential on blockchain`);
      return true;
    } catch (_error) {
      this.logger.error(`Failed to verify ${provider} credential: ${_error instanceof Error ? _error.message : 'Unknown error'}`);
      throw new CLIError(
        `Failed to verify credential: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
        'VERIFICATION_FAILED'
      );
    }
  }
  
  /**
   * Update credential permissions
   * 
   * @param provider - AI provider name
   * @param permissionLevel - New permission level
   * @returns Updated credential info
   */
  public async updatePermissions(
    provider: AIProvider,
    permissionLevel: AIPermissionLevel
  ): Promise<CredentialInfo> {
    try {
      // Get existing credential and metadata
      const apiKey = await this.getCredential(provider, { bypassCache: true });
      const metadataInfo = await this.vault.getSecretMetadata(`${provider}-api-key`);
      
      if (!metadataInfo) {
        throw new CLIError(`No credential found for ${provider}`, 'CREDENTIAL_NOT_FOUND');
      }
      
      // Update metadata
      const metadata = (metadataInfo.metadata || {}) as CredentialMetadata;
      metadata.permissionLevel = permissionLevel;
      
      // Update blockchain verification if applicable
      if (this.blockchainAdapter && metadata.verified && metadata.verificationId) {
        try {
          // Revoke existing verification
          await this.blockchainAdapter.revokeVerification(metadata.verificationId);
          
          // Create new verification
          const verificationResult = await this.blockchainAdapter.verifyCredential({
            credentialId: metadata.credentialId || randomUUID(),
            providerName: provider,
            publicKey: 'placeholder', // Would use a real public key in production
            timestamp: Date.now(),
            verifierAddress: 'placeholder', // Would use a real address in production
            metadata: {
              permissionLevel: permissionLevel.toString(),
              provider,
              timestamp: Date.now().toString()
            }
          });
          
          metadata.verificationId = verificationResult.verificationId;
          metadata.verificationDate = new Date().toISOString();
        } catch (_error) {
          this.logger.warn(`Failed to update blockchain verification: ${_error instanceof Error ? _error.message : 'Unknown error'}`);
          // Continue without blockchain verification update
        }
      }
      
      // Save updated credential
      await this.vault.storeSecret(
        `${provider}-api-key`,
        apiKey,
        {
          metadata
        }
      );
      
      // Clear cache
      this.credentialCache.delete(provider);
      
      // Return updated info
      return await this.getCredentialInfo(provider);
    } catch (_error) {
      throw new CLIError(
        `Failed to update permissions: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
        'PERMISSION_UPDATE_FAILED'
      );
    }
  }
  
  /**
   * Rotate an API key
   * 
   * @param provider - AI provider name
   * @param newApiKey - New API key
   * @returns Updated credential info
   */
  public async rotateCredential(
    provider: AIProvider,
    newApiKey: string
  ): Promise<CredentialInfo> {
    // Validate the new API key
    validateApiKey(provider, newApiKey);
    
    try {
      // Get existing metadata
      const metadataInfo = await this.vault.getSecretMetadata(`${provider}-api-key`);
      
      if (!metadataInfo) {
        throw new CLIError(`No credential found for ${provider}`, 'CREDENTIAL_NOT_FOUND');
      }
      
      // Perform security check on the new key
      const securityCheck = performKeySecurityCheck(newApiKey);
      if (!securityCheck.secure) {
        this.logger.warn(`Security issues detected with new ${provider} API key: ${securityCheck.issues.join(', ')}`);
      }
      
      // Update metadata
      const metadata = (metadataInfo.metadata || {}) as CredentialMetadata;
      metadata.lastRotated = new Date().toISOString();
      metadata.securityScore = securityCheck.secure ? 100 : 50;
      
      // Update blockchain verification if applicable
      if (this.blockchainAdapter && metadata.verified && metadata.verificationId) {
        try {
          // Revoke existing verification
          await this.blockchainAdapter.revokeVerification(metadata.verificationId);
          
          // Create new verification
          const verificationResult = await this.blockchainAdapter.verifyCredential({
            credentialId: metadata.credentialId || randomUUID(),
            providerName: provider,
            publicKey: 'placeholder', // Would use a real public key in production
            timestamp: Date.now(),
            verifierAddress: 'placeholder', // Would use a real address in production
            metadata: {
              permissionLevel: (metadata.permissionLevel || AIPermissionLevel.STANDARD).toString(),
              provider,
              timestamp: Date.now().toString()
            }
          });
          
          metadata.verificationId = verificationResult.verificationId;
          metadata.verificationDate = new Date().toISOString();
        } catch (_error) {
          this.logger.warn(`Failed to update blockchain verification: ${_error instanceof Error ? _error.message : 'Unknown error'}`);
          metadata.verified = false;
          delete metadata.verificationId;
        }
      }
      
      // Rotate the credential
      await this.vault.rotateSecret(`${provider}-api-key`, newApiKey);
      
      // Update metadata
      await this.vault.storeSecret(
        `${provider}-api-key`,
        newApiKey,
        {
          metadata
        }
      );
      
      // Clear cache
      this.credentialCache.delete(provider);
      
      this.logger.info(`Rotated API key for ${provider}`);
      
      // Return updated info
      return await this.getCredentialInfo(provider);
    } catch (_error) {
      throw new CLIError(
        `Failed to rotate credential: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
        'CREDENTIAL_ROTATION_FAILED'
      );
    }
  }
  
  /**
   * Check for credentials that need rotation
   * 
   * @returns Array of providers needing rotation
   */
  public async checkRotationNeeded(): Promise<string[]> {
    try {
      const rotationNeeded = await this.vault.checkRotationNeeded();
      
      const providers: string[] = [];
      for (const key of rotationNeeded) {
        if (key.endsWith('-api-key')) {
          const provider = key.replace('-api-key', '');
          providers.push(provider);
          this.logger.warn(`API key for ${provider} is due for rotation`);
        }
      }
      
      return providers;
    } catch (_error) {
      this.logger.error(`Failed to check for credentials needing rotation: ${_error instanceof Error ? _error.message : 'Unknown error'}`);
      return [];
    }
  }
}

// Export singleton instance
export const secureCredentialService = new SecureCredentialService();