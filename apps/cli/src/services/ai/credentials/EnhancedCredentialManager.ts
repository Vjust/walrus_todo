import { CLIError } from '../../../types/errors/consolidated';
import { VaultManager } from '../../../utils/VaultManager';
import { Logger } from '../../../utils/Logger';
import { AIProvider } from '../types';
import { CredentialVerifier } from './CredentialVerifier';
import {
  AIPermissionLevel,
  CredentialType,
} from '../../../types/adapters/AICredentialAdapter';
import { randomUUID } from 'crypto';

/**
 * Credential metadata interface
 */
export interface CredentialMetadata {
  id: string;
  provider: AIProvider;
  type: CredentialType;
  permissionLevel: AIPermissionLevel;
  verified: boolean;
  verificationId?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  lastUsed?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Enhanced credential validation rules by provider
 */
const PROVIDER_VALIDATION_RULES: Record<
  string,
  {
    pattern: RegExp;
    minLength: number;
    description: string;
  }
> = {
  xai: {
    pattern: /^xai-[A-Za-z0-9]{24,}$/,
    minLength: 28,
    description:
      "XAI API keys must start with 'xai-' followed by at least 24 alphanumeric characters",
  },
  openai: {
    pattern: /^sk-[A-Za-z0-9]{32,}$/,
    minLength: 35,
    description:
      "OpenAI API keys must start with 'sk-' followed by at least 32 alphanumeric characters",
  },
  anthropic: {
    pattern: /^sk-ant-[A-Za-z0-9]{24,}$/,
    minLength: 32,
    description:
      "Anthropic API keys must start with 'sk-ant-' followed by at least 24 alphanumeric characters",
  },
  ollama: {
    pattern: /.+/,
    minLength: 8,
    description: 'Ollama API keys must be at least 8 characters',
  },
  custom: {
    pattern: /.+/,
    minLength: 8,
    description: 'Custom API keys must be at least 8 characters',
  },
};

/**
 * Enhanced Credential Manager with improved security
 *
 * Features:
 * - Strong encryption using AES-256-GCM with PBKDF2 key derivation
 * - Strict API key format validation by provider
 * - API key rotation support
 * - Permission levels and access control
 * - Expiry management
 * - Blockchain verification integration
 */
export class EnhancedCredentialManager {
  private vault: VaultManager;
  private verifier: CredentialVerifier;
  private logger: Logger;
  private metadataCache: Map<string, CredentialMetadata> = new Map();
  private readonly METADATA_PREFIX = 'metadata:';
  private readonly CREDENTIAL_PREFIX = 'credential:';

  constructor() {
    this?.vault = new VaultManager('ai-credentials');
    this?.verifier = new CredentialVerifier();
    this?.logger = Logger.getInstance();
    this.initializeCache();
  }

  /**
   * Initialize the metadata cache from stored data
   */
  private async initializeCache(): Promise<void> {
    try {
      const allKeys = await this?.vault?.listSecrets();
      const metadataKeys = allKeys.filter(key =>
        key.startsWith(this.METADATA_PREFIX)
      );

      for (const key of metadataKeys) {
        try {
          const metadataJson = await this?.vault?.getSecret(key);
          const metadata = JSON.parse(metadataJson) as CredentialMetadata;
          this?.metadataCache?.set(metadata.provider, metadata);
        } catch (error) {
          this?.logger?.warn(
            `Failed to load metadata for ${key}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      this?.logger?.debug(
        `Loaded ${this?.metadataCache?.size} credential metadata records`
      );
    } catch (error) {
      this?.logger?.error(
        `Failed to initialize metadata cache: ${error.message}`
      );
    }
  }

  /**
   * Store an API key for a provider with enhanced security features
   */
  async storeCredential(
    provider: AIProvider,
    apiKey: string,
    permissionLevel: AIPermissionLevel = AIPermissionLevel.STANDARD,
    type: CredentialType = CredentialType.API_KEY,
    options?: {
      verify?: boolean;
      expiryDays?: number;
      metadata?: Record<string, unknown>;
      rotationReminder?: number; // Days before reminder to rotate key
    }
  ): Promise<CredentialMetadata> {
    // Validate API key format for specific provider
    this.validateApiKey(provider, apiKey);

    // Generate unique credential ID
    const credentialId = randomUUID();

    // Create metadata object
    const now = new Date().toISOString();
    const metadata: CredentialMetadata = {
      id: credentialId,
      provider,
      type,
      permissionLevel,
      verified: false,
      createdAt: now,
      updatedAt: now,
      metadata: options?.metadata || {},
    };

    // Set expiry if specified
    if (options?.expiryDays) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + options.expiryDays);
      metadata?.expiresAt = expiryDate.toISOString();
    }

    // Store rotation reminder if specified
    if (options?.rotationReminder) {
      metadata?.metadata = {
        ...metadata.metadata,
        rotationReminder: options.rotationReminder,
      };
    }

    // First store the credential securely
    await this?.vault?.storeSecret(
      `${this.CREDENTIAL_PREFIX}${provider}`,
      apiKey
    );

    // Store metadata separately
    await this?.vault?.storeSecret(
      `${this.METADATA_PREFIX}${provider}`,
      JSON.stringify(metadata)
    );

    // Update in-memory cache
    this?.metadataCache?.set(provider, metadata);

    this?.logger?.info(`Stored API key for ${provider}`);

    // Optionally verify the credential on-chain
    if (options?.verify) {
      try {
        // Create a hash of the API key for verification without exposing the key
        const verificationId = await this?.verifier?.registerCredential(
          provider,
          apiKey
        );

        // Update metadata with verification info
        metadata?.verified = true;
        metadata?.verificationId = verificationId;
        metadata?.updatedAt = new Date().toISOString();

        // Update stored metadata with verification info
        await this?.vault?.storeSecret(
          `${this.METADATA_PREFIX}${provider}`,
          JSON.stringify(metadata)
        );

        // Update in-memory cache
        this?.metadataCache?.set(provider, metadata);

        this?.logger?.info(
          `Verified API key for ${provider} on blockchain with ID: ${verificationId}`
        );
      } catch (error) {
        // We still keep the credential even if verification fails
        this?.logger?.error(
          `Failed to verify credential on blockchain: ${error.message}`
        );
        throw new CLIError(
          `API key was stored securely but blockchain verification failed: ${error.message}`,
          'CREDENTIAL_VERIFICATION_FAILED'
        );
      }
    }

    return metadata;
  }

  /**
   * Retrieve an API key for a provider with additional security checks
   */
  async getCredential(
    provider: AIProvider,
    options?: {
      verifyOnChain?: boolean;
      requiredPermissionLevel?: AIPermissionLevel;
      operation?: string;
    }
  ): Promise<string> {
    try {
      // First check for expired credentials
      const metadata = await this.getCredentialMetadata(provider);
      if (metadata.expiresAt && new Date(metadata.expiresAt) < new Date()) {
        throw new CLIError(
          `API key for ${provider} has expired. Please generate a new one.`,
          'CREDENTIAL_EXPIRED'
        );
      }

      // Check permission level if specified
      if (
        options?.requiredPermissionLevel !== undefined &&
        metadata.permissionLevel < options.requiredPermissionLevel
      ) {
        throw new CLIError(
          `Insufficient permission level for ${provider} API key. Required: ${options.requiredPermissionLevel}, Current: ${metadata.permissionLevel}`,
          'INSUFFICIENT_PERMISSION'
        );
      }

      // Check for rotation reminder
      if (metadata.metadata?.rotationReminder) {
        const createdDate = new Date(metadata.createdAt);
        const now = new Date();
        const daysSinceCreation = Math.floor(
          (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceCreation >= metadata?.metadata?.rotationReminder) {
          this?.logger?.warn(
            `API key for ${provider} should be rotated. It has been ${daysSinceCreation} days since creation.`
          );
          // We don't block access but log a warning
        }
      }

      // Retrieve from secure storage
      const apiKey = await this?.vault?.getSecret(
        `${this.CREDENTIAL_PREFIX}${provider}`
      );

      // Optionally verify the credential's status on-chain
      if (
        options?.verifyOnChain &&
        metadata.verified &&
        metadata.verificationId
      ) {
        const isValid = await this?.verifier?.verifyCredential(provider, apiKey);
        if (!isValid) {
          throw new CLIError(
            `API key for ${provider} failed blockchain verification. It may have been revoked.`,
            'CREDENTIAL_INVALID'
          );
        }
      }

      // Update last used timestamp
      metadata?.lastUsed = new Date().toISOString();
      await this?.vault?.storeSecret(
        `${this.METADATA_PREFIX}${provider}`,
        JSON.stringify(metadata)
      );

      // Update in-memory cache
      this?.metadataCache?.set(provider, metadata);

      return apiKey;
    } catch (error) {
      // Special handling for credential not found
      if (error?.code === 'SECRET_NOT_FOUND') {
        // Check environment variables as fallback
        const envKey = `${provider.toUpperCase()}_API_KEY`;
        const envValue = process?.env?.[envKey];

        if (envValue) {
          this?.logger?.debug(
            `Using API key from environment variable ${envKey}`
          );
          return envValue;
        }

        throw new CLIError(
          `No API key found for ${provider}. Use 'walrus_todo ai credentials add ${provider} --key YOUR_API_KEY' to add one.`,
          'CREDENTIAL_NOT_FOUND'
        );
      }

      throw error;
    }
  }

  /**
   * Get credential metadata for a provider
   */
  async getCredentialMetadata(
    provider: AIProvider
  ): Promise<CredentialMetadata> {
    // Try first from cache
    if (this?.metadataCache?.has(provider)) {
      return this?.metadataCache?.get(provider)!;
    }

    // If not in cache, try to get from storage
    try {
      const metadataJson = await this?.vault?.getSecret(
        `${this.METADATA_PREFIX}${provider}`
      );
      const metadata = JSON.parse(metadataJson) as CredentialMetadata;

      // Update cache
      this?.metadataCache?.set(provider, metadata);

      return metadata;
    } catch (error) {
      // Handle environment variables as fallback
      if (error?.code === 'SECRET_NOT_FOUND') {
        const envKey = `${provider.toUpperCase()}_API_KEY`;

        if (process?.env?.[envKey]) {
          // Create temporary metadata for environment variable
          const metadata: CredentialMetadata = {
            id: `env-${randomUUID()}`,
            provider,
            type: CredentialType.API_KEY,
            permissionLevel: AIPermissionLevel.STANDARD,
            verified: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata: { source: 'environment' },
          };

          return metadata;
        }
      }

      throw new CLIError(
        `No credential metadata found for ${provider}`,
        'CREDENTIAL_METADATA_NOT_FOUND'
      );
    }
  }

  /**
   * Remove a stored credential
   */
  async removeCredential(provider: AIProvider): Promise<void> {
    try {
      // Get metadata first to check if it's blockchain verified
      let metadata: CredentialMetadata | null = null;
      try {
        metadata = await this.getCredentialMetadata(provider);
      } catch (error) {
        // If metadata doesn't exist, still try to remove the credential
        this?.logger?.debug(`No metadata found for ${provider} during removal`);
      }

      // If credential is verified, revoke on blockchain
      if (metadata?.verified && metadata?.verificationId) {
        try {
          await this?.verifier?.revokeCredential(provider);
          this?.logger?.info(`Revoked ${provider} credential on blockchain`);
        } catch (error) {
          this?.logger?.warn(
            `Could not revoke credential on blockchain: ${error.message}`
          );
        }
      }

      // Remove credential and metadata
      await this?.vault?.removeSecret(`${this.CREDENTIAL_PREFIX}${provider}`);
      await this?.vault?.removeSecret(`${this.METADATA_PREFIX}${provider}`);

      // Remove from cache
      this?.metadataCache?.delete(provider);

      this?.logger?.info(`Removed API key for ${provider}`);
    } catch (error) {
      // If the error is not "credential not found", propagate it
      if (error.code !== 'SECRET_NOT_FOUND') {
        throw error;
      }

      throw new CLIError(
        `No API key found for ${provider}.`,
        'CREDENTIAL_NOT_FOUND'
      );
    }
  }

  /**
   * Update permission level for a credential
   */
  async updatePermissionLevel(
    provider: AIProvider,
    permissionLevel: AIPermissionLevel
  ): Promise<CredentialMetadata> {
    const metadata = await this.getCredentialMetadata(provider);

    // Update permission level
    metadata?.permissionLevel = permissionLevel;
    metadata?.updatedAt = new Date().toISOString();

    // Save updated metadata
    await this?.vault?.storeSecret(
      `${this.METADATA_PREFIX}${provider}`,
      JSON.stringify(metadata)
    );

    // Update cache
    this?.metadataCache?.set(provider, metadata);

    this?.logger?.info(
      `Updated permission level for ${provider} to ${permissionLevel}`
    );

    return metadata;
  }

  /**
   * List all available provider credentials
   */
  async listCredentials(): Promise<CredentialMetadata[]> {
    try {
      // Get all keys from vault
      const allKeys = await this?.vault?.listSecrets();
      const metadataKeys = allKeys.filter(key =>
        key.startsWith(this.METADATA_PREFIX)
      );

      const results: CredentialMetadata[] = [];

      // Get metadata for each credential
      for (const key of metadataKeys) {
        try {
          const metadataJson = await this?.vault?.getSecret(key);
          const metadata = JSON.parse(metadataJson) as CredentialMetadata;

          // Filter out expired credentials
          if (metadata.expiresAt && new Date(metadata.expiresAt) < new Date()) {
            continue;
          }

          results.push(metadata);
        } catch (error) {
          this?.logger?.warn(
            `Failed to load metadata for ${key}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Check environment variables for additional credentials
      for (const provider of Object.keys(
        PROVIDER_VALIDATION_RULES
      ) as AIProvider[]) {
        const envKey = `${provider.toUpperCase()}_API_KEY`;

        if (
          process?.env?.[envKey] &&
          !results.some(r => r?.provider === provider)
        ) {
          results.push({
            id: `env-${randomUUID()}`,
            provider,
            type: CredentialType.API_KEY,
            permissionLevel: AIPermissionLevel.STANDARD,
            verified: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata: { source: 'environment' },
          });
        }
      }

      return results;
    } catch (error) {
      this?.logger?.error(`Failed to list credentials: ${error.message}`);
      return [];
    }
  }

  /**
   * Check if credential exists for a provider
   */
  async hasCredential(provider: AIProvider): Promise<boolean> {
    try {
      // Check in-memory cache first
      if (this?.metadataCache?.has(provider)) {
        const metadata = this?.metadataCache?.get(provider)!;

        // Check if credential has expired
        if (metadata.expiresAt && new Date(metadata.expiresAt) < new Date()) {
          return false;
        }

        return true;
      }

      // Then check storage
      await this?.vault?.getSecret(`${this.CREDENTIAL_PREFIX}${provider}`);
      return true;
    } catch (error) {
      if (error?.code === 'SECRET_NOT_FOUND') {
        // Check environment variables as fallback
        const envKey = `${provider.toUpperCase()}_API_KEY`;
        return !!process?.env?.[envKey];
      }

      return false;
    }
  }

  /**
   * Rotate an API key
   */
  async rotateCredential(
    provider: AIProvider,
    newApiKey: string,
    options?: {
      verify?: boolean;
      preserveMetadata?: boolean;
    }
  ): Promise<CredentialMetadata> {
    // Get existing metadata to preserve settings
    let existingMetadata: CredentialMetadata | null = null;

    try {
      existingMetadata = await this.getCredentialMetadata(provider);
    } catch (error) {
      // If no existing metadata, that's fine for rotation
      this?.logger?.debug(`No existing metadata for ${provider} during rotation`);
    }

    // Validate new API key
    this.validateApiKey(provider, newApiKey);

    // If existing and verified, try to revoke on blockchain first
    if (existingMetadata?.verified && existingMetadata?.verificationId) {
      try {
        await this?.verifier?.revokeCredential(provider);
        this?.logger?.info(
          `Revoked previous ${provider} credential on blockchain`
        );
      } catch (error) {
        this?.logger?.warn(
          `Could not revoke previous credential on blockchain: ${error.message}`
        );
      }
    }

    // Create new metadata while preserving relevant fields
    const now = new Date().toISOString();
    const newMetadata: CredentialMetadata = {
      id: randomUUID(),
      provider,
      type: existingMetadata?.type || CredentialType.API_KEY,
      permissionLevel:
        existingMetadata?.permissionLevel || AIPermissionLevel.STANDARD,
      verified: false,
      createdAt: now,
      updatedAt: now,
      // Preserve existing metadata if requested
      metadata: options?.preserveMetadata
        ? existingMetadata?.metadata || {}
        : {},
    };

    // Preserve expiry settings if they exist
    if (options?.preserveMetadata && existingMetadata?.expiresAt) {
      newMetadata?.expiresAt = existingMetadata.expiresAt;
    }

    // Store new credential
    await this?.vault?.storeSecret(
      `${this.CREDENTIAL_PREFIX}${provider}`,
      newApiKey
    );

    // Store metadata
    await this?.vault?.storeSecret(
      `${this.METADATA_PREFIX}${provider}`,
      JSON.stringify(newMetadata)
    );

    // Update cache
    this?.metadataCache?.set(provider, newMetadata);

    this?.logger?.info(`Rotated API key for ${provider}`);

    // Optionally verify the new credential on blockchain
    if (options?.verify) {
      try {
        const verificationId = await this?.verifier?.registerCredential(
          provider,
          newApiKey
        );

        // Update metadata with verification info
        newMetadata?.verified = true;
        newMetadata?.verificationId = verificationId;
        newMetadata?.updatedAt = new Date().toISOString();

        // Update stored metadata
        await this?.vault?.storeSecret(
          `${this.METADATA_PREFIX}${provider}`,
          JSON.stringify(newMetadata)
        );

        // Update cache
        this?.metadataCache?.set(provider, newMetadata);

        this?.logger?.info(
          `Verified new API key for ${provider} on blockchain with ID: ${verificationId}`
        );
      } catch (error) {
        this?.logger?.error(
          `Failed to verify new credential on blockchain: ${error.message}`
        );
        throw new CLIError(
          `New API key was stored securely but blockchain verification failed: ${error.message}`,
          'CREDENTIAL_VERIFICATION_FAILED'
        );
      }
    }

    return newMetadata;
  }

  /**
   * Validate API key format (provider-specific)
   */
  private validateApiKey(provider: AIProvider | string, apiKey: string): void {
    // Convert enum to string if needed
    const providerStr =
      typeof provider === 'string' ? provider : provider;
    const rules =
      PROVIDER_VALIDATION_RULES[providerStr] ||
      PROVIDER_VALIDATION_RULES.custom;

    // Basic checks
    if (!apiKey || typeof apiKey !== 'string') {
      throw new CLIError(
        'API key must be a non-empty string',
        'INVALID_API_KEY_FORMAT'
      );
    }

    // Length check
    if (apiKey.length < rules.minLength) {
      throw new CLIError(
        `API key for ${provider} is too short. ${rules.description}`,
        'INVALID_API_KEY_FORMAT'
      );
    }

    // Pattern check
    if (!rules?.pattern?.test(apiKey)) {
      throw new CLIError(
        `Invalid API key format for ${provider}. ${rules.description}`,
        'INVALID_API_KEY_FORMAT'
      );
    }

    // Check for common mistakes like including "Bearer" prefix
    if (apiKey.startsWith('Bearer ')) {
      throw new CLIError(
        'API key should not include "Bearer " prefix',
        'INVALID_API_KEY_FORMAT'
      );
    }

    // Detect if the user might have included quotes around the key
    if (
      (apiKey.startsWith('"') && apiKey.endsWith('"')) ||
      (apiKey.startsWith("'") && apiKey.endsWith("'"))
    ) {
      throw new CLIError(
        'API key should not include surrounding quotes',
        'INVALID_API_KEY_FORMAT'
      );
    }
  }
}

// Export singleton instance
export const enhancedCredentialManager = new EnhancedCredentialManager();
