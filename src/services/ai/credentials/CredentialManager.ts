import { CLIError } from '../../../types/errors/consolidated';
import { VaultManager } from '../../../utils/VaultManager';
import { Logger } from '../../../utils/Logger';
import { AIProvider } from '../types';
import { CredentialVerifier } from './CredentialVerifier';

/**
 * Manages API credentials for AI providers with secure storage and blockchain verification
 */
export class CredentialManager {
  private vault: VaultManager;
  private verifier: CredentialVerifier;
  private logger: Logger;

  constructor() {
    this.vault = new VaultManager('ai-credentials');
    this.verifier = new CredentialVerifier();
    this.logger = new Logger('CredentialManager');
  }

  /**
   * Store an API key for a provider with optional blockchain verification
   */
  async storeCredential(
    provider: AIProvider,
    apiKey: string,
    verify: boolean = false
  ): Promise<void> {
    this.validateApiKey(apiKey);

    // First store the credential securely
    await this.vault.storeSecret(`${provider}-api-key`, apiKey);
    this.logger.info(`Stored API key for ${provider}`);

    // Optionally verify the credential on-chain
    if (verify) {
      try {
        // Create a hash of the API key for verification without exposing the key
        const verificationId = await this.verifier.registerCredential(
          provider,
          apiKey
        );
        this.logger.info(
          `Verified API key for ${provider} on blockchain with ID: ${verificationId}`
        );
      } catch (_error) {
        // We still keep the credential even if verification fails
        this.logger.error(
          `Failed to verify credential on blockchain: ${_error instanceof Error ? _error.message : String(_error)}`
        );
        throw new CLIError(
          `API key was stored securely but blockchain verification failed: ${_error instanceof Error ? _error.message : String(_error)}`,
          'CREDENTIAL_VERIFICATION_FAILED'
        );
      }
    }
  }

  /**
   * Retrieve an API key for a provider with optional verification check
   */
  async getCredential(
    provider: AIProvider,
    verifyOnChain: boolean = false
  ): Promise<string> {
    try {
      // Retrieve from secure storage
      const apiKey = await this.vault.getSecret(`${provider}-api-key`);

      // Optionally verify the credential's status on-chain
      if (verifyOnChain) {
        const isValid = await this.verifier.verifyCredential(provider, apiKey);
        if (!isValid) {
          throw new CLIError(
            `API key for ${provider} failed blockchain verification. It may have been revoked.`,
            'CREDENTIAL_INVALID'
          );
        }
      }

      return apiKey;
    } catch (_error) {
      if (_error instanceof CLIError && _error.code === 'CREDENTIAL_INVALID') {
        throw _error;
      }
      throw new CLIError(
        `No API key found for ${provider}. Use 'walrus_todo ai credentials add ${provider} --key YOUR_API_KEY' to add one.`,
        'CREDENTIAL_NOT_FOUND'
      );
    }
  }

  /**
   * Remove a stored credential
   */
  async removeCredential(provider: AIProvider): Promise<void> {
    try {
      // First check if credential exists
      await this.vault.getSecret(`${provider}-api-key`);

      // If it exists, remove it
      await this.vault.removeSecret(`${provider}-api-key`);
      this.logger.info(`Removed API key for ${provider}`);

      // Attempt to revoke on-chain if possible
      try {
        await this.verifier.revokeCredential(provider);
        this.logger.info(`Revoked ${provider} credential on blockchain`);
      } catch (_error) {
        this.logger.warn(
          `Could not revoke credential on blockchain: ${_error instanceof Error ? _error.message : String(_error)}`
        );
      }
    } catch (_error) {
      throw new CLIError(
        `No API key found for ${provider}.`,
        'CREDENTIAL_NOT_FOUND'
      );
    }
  }

  /**
   * List all available provider credentials
   */
  async listCredentials(): Promise<
    { provider: AIProvider; verified: boolean }[]
  > {
    const credentialKeys = await this.vault.listSecrets();
    const result = [];

    for (const key of credentialKeys) {
      // Extract provider from key format
      const match = key.match(/^(.+)-api-key$/);
      if (match) {
        const provider = match[1] as AIProvider;
        // apiKey would be used for credential verification
        // const apiKey = await this.vault.getSecret(key);

        // Check if the credential is verified on-chain
        let verified = false;
        try {
          verified = await this.verifier.isRegistered(provider);
        } catch (_error) {
          this.logger.debug(
            `Error checking verification status: ${_error instanceof Error ? _error.message : String(_error)}`
          );
        }

        result.push({ provider, verified });
      }
    }

    return result;
  }

  /**
   * Validate API key format (provider-specific)
   */
  private validateApiKey(apiKey: string): void {
    // Basic validation - should be extended per provider
    if (!apiKey || apiKey.trim().length < 8) {
      throw new CLIError(
        'Invalid API key format. API keys must be at least 8 characters.',
        'INVALID_API_KEY_FORMAT'
      );
    }
  }
}
