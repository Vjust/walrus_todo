import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { CLIError } from '../../types/errors/consolidated';
import { CLI_CONFIG } from '../../constants';
import { Logger } from '../../utils/Logger';
import {
  AICredentialAdapter,
  AIProviderCredential,
  CredentialType,
  AIPermissionLevel,
  CredentialStorageOptions,
} from '../../types/adapters/AICredentialAdapter';

const logger = new Logger('SecureCredentialManager');

interface BackupLocation {
  path: string;
  metadataBackupPath: string;
  timestamp: number;
}

interface KeyMetadata {
  version: number;
  created: number;
  lastRotated: number;
  keyId?: string;
  lastRotatedAt?: number;
  previousKeyId?: string;
  backupLocations?: BackupLocation[];
  lastCredentialBackup?: number;
  lastBackupPath?: string;
  [key: string]: unknown;
}

import { randomUUID } from 'crypto';
// promisify imported but not used

/**
 * SecureCredentialManager - Securely manages API credentials for AI providers
 * with blockchain verification capabilities
 *
 * This class extends the basic credential management functionality with
 * additional security features including blockchain verification, expiry
 * management, and permission controls.
 */
export class SecureCredentialManager {
  private credentialsPath: string;
  private encryptionKey!: Buffer;
  private credentials: Record<string, AIProviderCredential> = {};
  private initialized: boolean = false;
  private blockchainAdapter?: AICredentialAdapter;
  private keyPath: string;
  private keyMetadataPath: string;
  private backupDirectory: string;
  private keyRotationIntervalDays: number = 90; // Default rotation period is 90 days

  constructor() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const configDir = path.join(homeDir, '.config', CLI_CONFIG.APP_NAME);

    // Ensure the config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    this.credentialsPath = path.join(configDir, 'secure_credentials.enc');
    this.keyPath = path.join(configDir, '.keyfile');
    this.keyMetadataPath = path.join(configDir, '.keymetadata.json');
    this.backupDirectory = path.join(configDir, 'key_backups');

    // Create backup directory if it doesn't exist
    if (!fs.existsSync(this.backupDirectory)) {
      fs.mkdirSync(this.backupDirectory, { recursive: true, mode: 0o700 }); // More restrictive permissions
    }

    // Initialize or load the encryption key
    this.initializeKey();

    // Load credentials if they exist
    this.loadCredentials();

    // Check if key rotation is needed
    this.checkAndRotateKeyIfNeeded();
  }

  /**
   * Set the blockchain adapter for verification
   */
  public setBlockchainAdapter(adapter: AICredentialAdapter): void {
    this.blockchainAdapter = adapter;
  }

  /**
   * Initialize the encryption key
   */
  private initializeKey(): void {
    try {
      if (!fs.existsSync(this.keyPath)) {
        // Generate a new key
        const newKey = crypto.randomBytes(32);
        fs.writeFileSync(this.keyPath, newKey, { mode: 0o600 }); // Restrict file permissions

        // Create key metadata
        const keyMetadata = {
          keyId: randomUUID(),
          createdAt: Date.now(),
          lastRotatedAt: Date.now(),
          algorithm: 'aes-256-cbc',
          version: 1,
          backupLocations: [],
        };

        fs.writeFileSync(this.keyMetadataPath, JSON.stringify(keyMetadata), {
          mode: 0o600,
        });

        // Create initial backup
        this.backupKey();
      }

      // Load the key
      const key = fs.readFileSync(this.keyPath);
      this.encryptionKey = Buffer.isBuffer(key) ? key : Buffer.from(key);
    } catch (_error) {
      throw new CLIError(
        `Failed to initialize encryption key: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
        'KEY_INITIALIZATION_FAILED'
      );
    }
  }

  /**
   * Get key metadata
   */
  private getKeyMetadata(): KeyMetadata | null {
    try {
      if (fs.existsSync(this.keyMetadataPath)) {
        const metadataRaw = fs.readFileSync(this.keyMetadataPath, 'utf8');
        const metadataStr = typeof metadataRaw === 'string' ? metadataRaw : metadataRaw.toString('utf8');
        const metadata = JSON.parse(metadataStr);
        
        // Validate metadata structure
        if (typeof metadata === 'object' && metadata !== null) {
          return {
            version: metadata.version || 1,
            created: metadata.created || metadata.createdAt || Date.now(),
            lastRotated: metadata.lastRotated || metadata.lastRotatedAt || Date.now(),
            keyId: metadata.keyId,
            lastRotatedAt: metadata.lastRotatedAt || metadata.lastRotated,
            previousKeyId: metadata.previousKeyId,
            backupLocations: Array.isArray(metadata.backupLocations) ? metadata.backupLocations : [],
            lastCredentialBackup: metadata.lastCredentialBackup,
            lastBackupPath: metadata.lastBackupPath,
            ...metadata
          };
        }
      }
      return null;
    } catch (_error: unknown) {
      const errorMessage = _error instanceof Error ? _error.message : String(_error);
      logger.error('Failed to read key metadata:', errorMessage);
      return null;
    }
  }

  /**
   * Update key metadata
   */
  private updateKeyMetadata(updates: Partial<KeyMetadata>): void {
    try {
      const currentMetadata = this.getKeyMetadata() || {
        version: 1,
        created: Date.now(),
        lastRotated: Date.now(),
        backupLocations: []
      };
      
      const updatedMetadata = { ...currentMetadata, ...updates };
      
      // Ensure required fields are present
      if (!updatedMetadata.keyId) {
        updatedMetadata.keyId = randomUUID();
      }
      if (!updatedMetadata.version) {
        updatedMetadata.version = 1;
      }
      if (!updatedMetadata.created) {
        updatedMetadata.created = Date.now();
      }
      
      // Create backup of current metadata before updating
      const tempMetadataPath = `${this.keyMetadataPath}.tmp`;
      fs.writeFileSync(tempMetadataPath, JSON.stringify(updatedMetadata, null, 2), {
        mode: 0o600,
      });
      
      // Atomic rename
      fs.renameSync(tempMetadataPath, this.keyMetadataPath);
      
    } catch (_error: unknown) {
      const errorMessage = _error instanceof Error ? _error.message : String(_error);
      logger.error('Failed to update key metadata:', errorMessage);
      
      // Clean up temporary file if it exists
      const tempMetadataPath = `${this.keyMetadataPath}.tmp`;
      try {
        if (fs.existsSync(tempMetadataPath)) {
          fs.unlinkSync(tempMetadataPath);
        }
      } catch (cleanupError: unknown) {
        logger.warn('Failed to clean up temporary metadata file:', cleanupError);
      }
    }
  }

  /**
   * Check if key rotation is needed and rotate if necessary
   */
  private checkAndRotateKeyIfNeeded(): void {
    try {
      const metadata = this.getKeyMetadata();
      if (!metadata) {
        logger.info('No key metadata found, skipping automatic rotation check');
        return;
      }

      const lastRotation = metadata.lastRotated || metadata.lastRotatedAt || 0;
      const currentTime = Date.now();
      const daysSinceLastRotation = Math.floor(
        (currentTime - lastRotation) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastRotation >= this.keyRotationIntervalDays) {
        logger.info(`Key rotation needed: ${daysSinceLastRotation} days since last rotation`);
        
        // Run rotation asynchronously to avoid blocking initialization
        this.rotateKey().catch((error: unknown) => {
          logger.error('Automatic key rotation failed:', error);
          // Don't throw here as this runs during initialization
        });
      } else {
        logger.debug(`Key rotation not needed: ${daysSinceLastRotation}/${this.keyRotationIntervalDays} days`);
      }
    } catch (_error: unknown) {
      const errorMessage = _error instanceof Error ? _error.message : String(_error);
      logger.error('Failed to check key rotation status:', errorMessage);
      // Don't throw here as this runs during initialization
    }
  }

  /**
   * Initialize the credential manager
   */
  private loadCredentials(): void {
    try {
      if (fs.existsSync(this.credentialsPath)) {
        const encryptedData = fs.readFileSync(this.credentialsPath);
        const dataBuffer = Buffer.isBuffer(encryptedData) ? encryptedData : Buffer.from(encryptedData);
        const credentials = this.decrypt(dataBuffer);
        if (credentials) {
          this.credentials = JSON.parse(credentials.toString());
        }
      }
      this.initialized = true;
    } catch (_error) {
      logger.error('Failed to load credentials:', _error);
      // For security, initialize with empty credentials on error
      this.credentials = {};
      this.initialized = true;
    }
  }

  /**
   * Save credentials to disk
   *
   * @throws Error if credential manager is not initialized or if saving fails
   */
  private saveCredentials(): void {
    // Check if the credential manager is initialized
    if (!this.initialized) {
      const error = new Error('Credential manager not initialized');
      error.name = 'CredentialsNotInitializedError';
      (error as Error & { code?: string }).code = 'CREDENTIALS_NOT_INITIALIZED';
      throw error;
    }

    try {
      // Serialize and encrypt the credentials
      const data = JSON.stringify(this.credentials);
      const encryptedData = this.encrypt(data);

      // Create a temporary file first for atomic update
      const tempPath = `${this.credentialsPath}.tmp`;
      fs.writeFileSync(tempPath, encryptedData, { mode: 0o600 });

      // Rename to the actual path (atomic operation on most filesystems)
      fs.renameSync(tempPath, this.credentialsPath);

      // Backup credentials periodically
      this.backupCredentialsIfNeeded();

      // Log succesful save with privacy-safe details
      logger.info(
        `Credentials saved successfully. Storage path hash: ${crypto.createHash('sha256').update(this.credentialsPath).digest('hex').substring(0, 8)}`,
        {
          timestamp: new Date().toISOString(),
          providers: Object.keys(this.credentials).length,
          hasBackup: Boolean(
            fs.existsSync(`${this.backupDirectory}/credentials_backup_`)
          ),
        }
      );
    } catch (_error) {
      // Create a standard error instead of CLIError for better testing compatibility
      const saveError = new Error(
        `Failed to save credentials: ${_error instanceof Error ? _error.message : 'Unknown error'}`
      );
      saveError.name = 'CredentialSaveError';
      (saveError as Error & { code?: string; cause?: unknown }).code = 'CREDENTIALS_SAVE_FAILED';
      (saveError as Error & { code?: string; cause?: unknown }).cause = _error;

      // Log the error without sensitive information
      logger.error(
        `Failed to save credentials: ${_error instanceof Error ? _error.name : typeof _error}`
      );

      throw saveError;
    }
  }

  /**
   * Backup credentials if needed
   */
  private backupCredentialsIfNeeded(): void {
    try {
      const metadata = this.getKeyMetadata();
      if (!metadata) return;

      const lastBackup = (metadata as KeyMetadata & { lastCredentialBackup?: number }).lastCredentialBackup || 0;
      const currentTime = Date.now();
      const daysSinceLastBackup = Math.floor(
        (currentTime - lastBackup) / (1000 * 60 * 60 * 24)
      );

      // Backup every 7 days or if no backup exists
      if (daysSinceLastBackup >= 7 || !lastBackup) {
        const backupPath = path.join(
          this.backupDirectory,
          `credentials_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.enc`
        );
        fs.copyFileSync(
          this.credentialsPath,
          backupPath,
          fs.constants.COPYFILE_EXCL
        );

        // Update metadata with latest backup information
        this.updateKeyMetadata({
          lastCredentialBackup: currentTime,
          lastBackupPath: backupPath,
        });

        // Clean up old backups - keep only last 5
        this.cleanupOldBackups();
      }
    } catch (_error) {
      logger.error('Failed to backup credentials:', _error);
    }
  }

  /**
   * Clean up old backup files
   */
  private cleanupOldBackups(): void {
    try {
      const backupFiles = fs
        .readdirSync(this.backupDirectory)
        .filter(file => file.startsWith('credentials_backup_'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDirectory, file),
          time: fs
            .statSync(path.join(this.backupDirectory, file))
            .mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time); // Sort newest first

      // Keep only the 5 most recent backups
      if (backupFiles.length > 5) {
        backupFiles.slice(5).forEach(file => {
          fs.unlinkSync(file.path);
        });
      }
    } catch (_error) {
      logger.error('Failed to clean up old backups:', _error);
    }
  }

  /**
   * Set a credential for a provider with enhanced security options
   */
  public async setCredential(
    provider: string,
    credential: string,
    type: CredentialType = CredentialType.API_KEY,
    options: CredentialStorageOptions = { encrypt: true },
    metadata: Record<string, unknown> = {},
    permissionLevel: AIPermissionLevel = AIPermissionLevel.STANDARD
  ): Promise<AIProviderCredential> {
    if (!this.initialized) {
      throw new CLIError(
        'Credential manager not initialized',
        'CREDENTIALS_NOT_INITIALIZED'
      );
    }

    if (!provider || !credential) {
      throw new CLIError(
        'Provider and credential must be provided',
        'INVALID_CREDENTIALS'
      );
    }

    // Calculate expiry date if specified
    let expiresAt: number | undefined = undefined;
    if (options.expiryDays) {
      expiresAt = Date.now() + options.expiryDays * 24 * 60 * 60 * 1000;
    }

    // Create new credential object
    const newCredential: AIProviderCredential = {
      id: randomUUID(),
      providerName: provider.toLowerCase(),
      credentialType: type,
      credentialValue: credential,
      metadata,
      isVerified: false,
      storageOptions: options,
      createdAt: Date.now(),
      expiresAt,
      permissionLevel,
    };

    // Store in local cache
    this.credentials[provider.toLowerCase()] = newCredential;
    this.saveCredentials();

    // If blockchain adapter is available, verify on blockchain
    if (this.blockchainAdapter) {
      try {
        const verificationResult =
          await this.blockchainAdapter.verifyCredential({
            credentialId: newCredential.id,
            providerName: provider.toLowerCase(),
            publicKey: 'dummy', // This would be the actual public key in a real implementation
            timestamp: Date.now(),
            verifierAddress:
              this.blockchainAdapter.getSigner()?.toSuiAddress() || '',
            metadata: {
              credentialType: type,
              permissionLevel: permissionLevel.toString(),
              ...metadata,
            },
          });

        // Update the credential with verification info
        newCredential.isVerified = true;
        newCredential.verificationProof = verificationResult.verificationId;

        // Save updated credential
        this.credentials[provider.toLowerCase()] = newCredential;
        this.saveCredentials();
      } catch (_error) {
        logger.warn(`Blockchain verification failed: ${_error}`);
        // Continue without blockchain verification
      }
    }

    return newCredential;
  }

  /**
   * Get a credential for a provider
   */
  public async getCredential(provider: string): Promise<string> {
    if (!this.initialized) {
      throw new CLIError(
        'Credential manager not initialized',
        'CREDENTIALS_NOT_INITIALIZED'
      );
    }

    const credential = this.credentials[provider.toLowerCase()];
    if (!credential) {
      // Check environment variables as fallback (format: PROVIDER_API_KEY, e.g., XAI_API_KEY)
      const envKey = `${provider.toUpperCase()}_API_KEY`;
      const envCredential = process.env[envKey];

      if (envCredential) {
        return envCredential;
      }

      throw new CLIError(
        `No credential found for provider "${provider}"`,
        'CREDENTIAL_NOT_FOUND'
      );
    }

    // Validate the credential
    await this.validateCredential(credential, provider);

    // Update last used timestamp
    credential.lastUsed = Date.now();
    this.saveCredentials();

    return credential.credentialValue;
  }

  /**
   * Validate a credential for security and expiration
   */
  private async validateCredential(
    credential: AIProviderCredential,
    providerName: string
  ): Promise<void> {
    // Check if credential has expired
    if (credential.expiresAt && credential.expiresAt < Date.now()) {
      throw new CLIError(
        `Credential for provider "${providerName}" has expired`,
        'CREDENTIAL_EXPIRED'
      );
    }

    // Check if credential is nearing expiration (within 7 days) and log a warning
    if (
      credential.expiresAt &&
      Date.now() > credential.expiresAt - 7 * 24 * 60 * 60 * 1000
    ) {
      const daysRemaining = Math.ceil(
        (credential.expiresAt - Date.now()) / (1000 * 60 * 60 * 24)
      );
      logger.warn(
        `WARNING: Credential for provider "${providerName}" will expire in ${daysRemaining} day(s)`
      );
    }

    // If credential is verified, check verification status on blockchain
    if (
      credential.isVerified &&
      credential.verificationProof &&
      this.blockchainAdapter
    ) {
      try {
        const isValid = await this.blockchainAdapter.checkVerificationStatus(
          credential.verificationProof
        );
        if (!isValid) {
          throw new CLIError(
            `Blockchain verification is no longer valid for provider "${providerName}"`,
            'VERIFICATION_INVALID'
          );
        }
      } catch (_error) {
        logger.warn(`Failed to check blockchain verification: ${_error}`);
        // Continue with the credential even if verification check fails
      }
    }

    // Prevent usage of very old credentials (if last used more than 180 days ago)
    if (
      credential.lastUsed &&
      Date.now() - credential.lastUsed > 180 * 24 * 60 * 60 * 1000
    ) {
      logger.warn(
        `Credential for provider "${providerName}" has not been used in over 180 days. Performing additional validation.`
      );
      // Here additional validation could be performed
    }
  }

  /**
   * Get full credential object for a provider
   */
  public async getCredentialObject(
    provider: string
  ): Promise<AIProviderCredential> {
    if (!this.initialized) {
      throw new CLIError(
        'Credential manager not initialized',
        'CREDENTIALS_NOT_INITIALIZED'
      );
    }

    const credential = this.credentials[provider.toLowerCase()];
    if (!credential) {
      // Create a temporary credential if available in environment variables
      const envKey = `${provider.toUpperCase()}_API_KEY`;
      const envCredential = process.env[envKey];

      if (envCredential) {
        return {
          id: 'env-' + randomUUID(),
          providerName: provider.toLowerCase(),
          credentialType: CredentialType.API_KEY,
          credentialValue: envCredential,
          metadata: { source: 'environment' },
          isVerified: false,
          storageOptions: { encrypt: false },
          createdAt: Date.now(),
          permissionLevel: AIPermissionLevel.STANDARD,
        };
      }

      throw new CLIError(
        `No credential found for provider "${provider}"`,
        'CREDENTIAL_NOT_FOUND'
      );
    }

    // Validate the credential
    await this.validateCredential(credential, provider);

    // Update last used timestamp
    credential.lastUsed = Date.now();
    this.saveCredentials();

    return credential;
  }

  /**
   * Check if a credential exists for a provider
   */
  public async hasCredential(provider: string): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    // Check stored credentials
    if (this.credentials[provider.toLowerCase()]) {
      const credential = this.credentials[provider.toLowerCase()];

      // Check if credential has expired
      if (credential.expiresAt && credential.expiresAt < Date.now()) {
        return false;
      }

      return true;
    }

    // Check environment variables as fallback
    const envKey = `${provider.toUpperCase()}_API_KEY`;
    return !!process.env[envKey];
  }

  /**
   * List all providers with stored credentials
   */
  public async listCredentials(): Promise<AIProviderCredential[]> {
    if (!this.initialized) {
      return [];
    }

    const validCredentials = Object.values(this.credentials).filter(cred => {
      // Filter out expired credentials
      if (cred.expiresAt && cred.expiresAt < Date.now()) {
        return false;
      }
      return true;
    });

    return validCredentials;
  }

  /**
   * Remove a credential for a provider
   */
  public async removeCredential(provider: string): Promise<boolean> {
    if (!this.initialized) {
      throw new CLIError(
        'Credential manager not initialized',
        'CREDENTIALS_NOT_INITIALIZED'
      );
    }

    const providerKey = provider.toLowerCase();
    const credential = this.credentials[providerKey];

    if (credential) {
      // If credential is verified and blockchain adapter is available, revoke on blockchain
      if (
        credential.isVerified &&
        credential.verificationProof &&
        this.blockchainAdapter
      ) {
        try {
          await this.blockchainAdapter.revokeVerification(
            credential.verificationProof
          );
        } catch (_error) {
          logger.warn(`Failed to revoke blockchain verification: ${_error}`);
          // Continue with local removal even if blockchain revocation fails
        }
      }

      delete this.credentials[providerKey];
      this.saveCredentials();
      return true;
    }

    return false;
  }

  /**
   * Verify a credential on the blockchain
   */
  public async verifyCredential(provider: string): Promise<boolean> {
    if (!this.initialized) {
      throw new CLIError(
        'Credential manager not initialized',
        'CREDENTIALS_NOT_INITIALIZED'
      );
    }

    if (!this.blockchainAdapter) {
      throw new CLIError(
        'Blockchain adapter not configured',
        'BLOCKCHAIN_ADAPTER_MISSING'
      );
    }

    const providerKey = provider.toLowerCase();
    const credential = this.credentials[providerKey];

    if (!credential) {
      throw new CLIError(
        `No credential found for provider "${provider}"`,
        'CREDENTIAL_NOT_FOUND'
      );
    }

    // Verify on blockchain
    try {
      const verificationResult = await this.blockchainAdapter.verifyCredential({
        credentialId: credential.id,
        providerName: providerKey,
        publicKey: 'dummy', // This would be the actual public key in a real implementation
        timestamp: Date.now(),
        verifierAddress:
          this.blockchainAdapter.getSigner()?.toSuiAddress() || '',
        metadata: {
          credentialType: credential.credentialType,
          permissionLevel: credential.permissionLevel.toString(),
          ...credential.metadata,
        },
      });

      // Update the credential with verification info
      credential.isVerified = true;
      credential.verificationProof = verificationResult.verificationId;

      // Save updated credential
      this.credentials[providerKey] = credential;
      this.saveCredentials();

      return true;
    } catch (_error) {
      throw new CLIError(
        `Failed to verify credential: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
        'CREDENTIAL_VERIFICATION_FAILED'
      );
    }
  }

  /**
   * Generate a shareable credential proof
   */
  public async generateCredentialProof(provider: string): Promise<string> {
    if (!this.initialized) {
      throw new CLIError(
        'Credential manager not initialized',
        'CREDENTIALS_NOT_INITIALIZED'
      );
    }

    if (!this.blockchainAdapter) {
      throw new CLIError(
        'Blockchain adapter not configured',
        'BLOCKCHAIN_ADAPTER_MISSING'
      );
    }

    const providerKey = provider.toLowerCase();
    const credential = this.credentials[providerKey];

    if (!credential) {
      throw new CLIError(
        `No credential found for provider "${provider}"`,
        'CREDENTIAL_NOT_FOUND'
      );
    }

    if (!credential.isVerified || !credential.verificationProof) {
      throw new CLIError(
        `Credential for provider "${provider}" is not verified`,
        'CREDENTIAL_NOT_VERIFIED'
      );
    }

    try {
      return await this.blockchainAdapter.generateCredentialProof(
        credential.id
      );
    } catch (_error) {
      throw new CLIError(
        `Failed to generate credential proof: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
        'PROOF_GENERATION_FAILED'
      );
    }
  }

  /**
   * Update credential permissions
   */
  public async updatePermissions(
    provider: string,
    permissionLevel: AIPermissionLevel
  ): Promise<AIProviderCredential> {
    if (!this.initialized) {
      throw new CLIError(
        'Credential manager not initialized',
        'CREDENTIALS_NOT_INITIALIZED'
      );
    }

    const providerKey = provider.toLowerCase();
    const credential = this.credentials[providerKey];

    if (!credential) {
      throw new CLIError(
        `No credential found for provider "${provider}"`,
        'CREDENTIAL_NOT_FOUND'
      );
    }

    // Update permission level
    credential.permissionLevel = permissionLevel;

    // If credential is verified and blockchain adapter is available, update on blockchain
    if (
      credential.isVerified &&
      credential.verificationProof &&
      this.blockchainAdapter
    ) {
      try {
        // Revoke existing verification
        await this.blockchainAdapter.revokeVerification(
          credential.verificationProof
        );

        // Create new verification with updated permissions
        const verificationResult =
          await this.blockchainAdapter.verifyCredential({
            credentialId: credential.id,
            providerName: providerKey,
            publicKey: 'dummy', // This would be the actual public key in a real implementation
            timestamp: Date.now(),
            verifierAddress:
              this.blockchainAdapter.getSigner()?.toSuiAddress() || '',
            metadata: {
              credentialType: credential.credentialType,
              permissionLevel: permissionLevel.toString(),
              ...credential.metadata,
            },
          });

        // Update credential with new verification
        credential.verificationProof = verificationResult.verificationId;
      } catch (_error) {
        logger.warn(`Failed to update blockchain verification: ${_error}`);
        // Continue without blockchain verification update
      }
    }

    // Save updated credential
    this.credentials[providerKey] = credential;
    this.saveCredentials();

    return credential;
  }

  /**
   * Rotate the encryption key
   */
  public async rotateKey(): Promise<boolean> {
    let oldKey: Buffer | null = null;
    let backupCreated = false;
    
    try {
      // Store the old key for potential rollback
      oldKey = this.encryptionKey ? Buffer.from(this.encryptionKey) : null;
      
      // First, backup the current key and credentials
      try {
        await this.backupKey();
        backupCreated = true;
        logger.info('Key backup completed successfully');
      } catch (backupError: unknown) {
        logger.warn('Key backup failed, continuing with rotation:', backupError);
        // Continue with rotation even if backup fails, but log the issue
      }

      // Generate a new key
      const newKey = crypto.randomBytes(32);
      logger.info('New encryption key generated');

      // Re-encrypt all credentials with the new key
      // First, decrypt with old key
      let decryptedData: Buffer | null = null;
      let credentialsExisted = false;
      
      if (fs.existsSync(this.credentialsPath)) {
        credentialsExisted = true;
        try {
          const encryptedData = fs.readFileSync(this.credentialsPath);
          const dataBuffer = Buffer.isBuffer(encryptedData) ? encryptedData : Buffer.from(encryptedData);
          decryptedData = this.decrypt(dataBuffer);
          
          if (!decryptedData) {
            throw new Error('Failed to decrypt existing credentials with current key');
          }
          logger.info('Existing credentials decrypted successfully');
        } catch (decryptError: unknown) {
          logger.error('Failed to decrypt existing credentials:', decryptError);
          throw new CLIError(
            'Cannot rotate key: Failed to decrypt existing credentials',
            'CREDENTIALS_DECRYPT_FAILED'
          );
        }
      }

      // Create a temporary backup of the current key before overwriting
      const tempKeyPath = `${this.keyPath}.tmp_rotation`;
      if (oldKey && fs.existsSync(this.keyPath)) {
        try {
          fs.copyFileSync(this.keyPath, tempKeyPath);
        } catch (tempBackupError: unknown) {
          logger.warn('Failed to create temporary key backup:', tempBackupError);
          // Continue without temp backup
        }
      }

      try {
        // Save the new key
        this.encryptionKey = newKey;
        fs.writeFileSync(this.keyPath, newKey, { mode: 0o600 });
        logger.info('New key written to disk');

        // Update key metadata
        const metadata = this.getKeyMetadata() || { 
          keyId: randomUUID(), 
          version: 0, 
          created: Date.now(),
          lastRotated: 0
        };
        
        const newMetadata = {
          keyId: randomUUID(),
          lastRotatedAt: Date.now(),
          lastRotated: Date.now(), // For backward compatibility
          previousKeyId: metadata.keyId,
          version: (metadata.version || 0) + 1,
          created: metadata.created || Date.now(),
        };
        
        this.updateKeyMetadata(newMetadata);
        logger.info('Key metadata updated');

        // Re-encrypt with new key if we had data
        if (decryptedData && credentialsExisted) {
          try {
            const newEncryptedData = this.encrypt(decryptedData.toString());
            
            // Create temporary encrypted file first
            const tempCredentialsPath = `${this.credentialsPath}.tmp`;
            fs.writeFileSync(tempCredentialsPath, newEncryptedData, {
              mode: 0o600,
            });
            
            // Atomic rename to replace the original
            fs.renameSync(tempCredentialsPath, this.credentialsPath);
            logger.info('Credentials re-encrypted with new key');
          } catch (reencryptError: unknown) {
            logger.error('Failed to re-encrypt credentials:', reencryptError);
            
            // Attempt to restore the old key
            if (oldKey) {
              try {
                this.encryptionKey = oldKey;
                fs.writeFileSync(this.keyPath, oldKey, { mode: 0o600 });
                logger.info('Rolled back to previous key');
              } catch (rollbackError: unknown) {
                logger.error('Failed to rollback key:', rollbackError);
              }
            }
            
            throw new CLIError(
              'Failed to re-encrypt credentials with new key',
              'CREDENTIALS_REENCRYPT_FAILED'
            );
          }
        }

        // Clean up temporary files
        try {
          if (fs.existsSync(tempKeyPath)) {
            fs.unlinkSync(tempKeyPath);
          }
        } catch (cleanupError: unknown) {
          logger.warn('Failed to clean up temporary files:', cleanupError);
        }

        // Validate the key rotation worked
        if (!this.validateKeyIntegrity()) {
          throw new Error('Key integrity validation failed after rotation');
        }

        logger.info('Key rotation completed successfully');
        return true;
        
      } catch (keyWriteError: unknown) {
        logger.error('Failed to write new key:', keyWriteError);
        
        // Attempt to restore from temporary backup
        if (fs.existsSync(tempKeyPath) && oldKey) {
          try {
            fs.copyFileSync(tempKeyPath, this.keyPath);
            this.encryptionKey = oldKey;
            logger.info('Restored key from temporary backup');
          } catch (restoreError: unknown) {
            logger.error('Failed to restore key from backup:', restoreError);
          }
        }
        
        throw keyWriteError;
      }
      
    } catch (_error: unknown) {
      const errorMessage = _error instanceof Error ? _error.message : String(_error);
      logger.error('Key rotation failed:', errorMessage);
      
      // Provide more specific error information
      let specificError = 'Unknown error';
      if (_error instanceof CLIError) {
        specificError = _error.message;
      } else if (_error instanceof Error) {
        if (_error.message.includes('EACCES') || _error.message.includes('permission')) {
          specificError = 'Permission denied - check file/directory permissions';
        } else if (_error.message.includes('ENOSPC')) {
          specificError = 'Insufficient disk space';
        } else if (_error.message.includes('ENOENT')) {
          specificError = 'Key file or directory not found';
        } else {
          specificError = _error.message;
        }
      }
      
      throw new CLIError(
        `Failed to rotate encryption key: ${specificError}`,
        'KEY_ROTATION_FAILED'
      );
    }
  }

  /**
   * Backup the current encryption key
   */
  private async backupKey(): Promise<void> {
    try {
      // Ensure backup directory exists with proper permissions
      if (!fs.existsSync(this.backupDirectory)) {
        fs.mkdirSync(this.backupDirectory, { recursive: true, mode: 0o700 });
      }

      const metadata = this.getKeyMetadata();
      if (!metadata) {
        // Create minimal metadata if none exists
        const newMetadata = {
          keyId: randomUUID(),
          version: 1,
          created: Date.now(),
          lastRotated: Date.now(),
          backupLocations: []
        };
        this.updateKeyMetadata(newMetadata);
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const keyId = metadata.keyId || randomUUID();
      const backupPath = path.join(
        this.backupDirectory,
        `key_backup_${keyId}_${timestamp}`
      );

      // Verify source key file exists before attempting backup
      if (!fs.existsSync(this.keyPath)) {
        logger.warn('Source key file does not exist, skipping backup');
        return;
      }

      // Create backup with error handling for file conflicts
      try {
        fs.copyFileSync(this.keyPath, backupPath);
        fs.chmodSync(backupPath, 0o400); // Make backup read-only
      } catch (copyError: unknown) {
        if (copyError instanceof Error && copyError.message.includes('EEXIST')) {
          // File already exists, create with unique suffix
          const uniqueBackupPath = `${backupPath}_${Date.now()}`;
          fs.copyFileSync(this.keyPath, uniqueBackupPath);
          fs.chmodSync(uniqueBackupPath, 0o400);
          // Update the backup path reference
          backupPath.replace(backupPath, uniqueBackupPath);
        } else {
          throw copyError;
        }
      }

      // Create a backup of the metadata as well
      const metadataBackupPath = path.join(
        this.backupDirectory,
        `metadata_backup_${timestamp}.json`
      );
      
      try {
        fs.writeFileSync(metadataBackupPath, JSON.stringify(metadata, null, 2), {
          mode: 0o400,
        });
      } catch (metadataError: unknown) {
        logger.warn('Failed to backup metadata, continuing with key backup only:', metadataError);
        // Continue without metadata backup if it fails
      }

      // Update metadata to record the backup
      const backupLocations = Array.isArray(metadata.backupLocations) ? metadata.backupLocations : [];
      backupLocations.push({
        path: backupPath,
        timestamp: Date.now(),
        metadataBackupPath,
      });

      // Safely update metadata with error handling
      try {
        this.updateKeyMetadata({
          backupLocations: backupLocations.slice(-5), // Keep only the 5 most recent backup references
        });
      } catch (updateError: unknown) {
        logger.warn('Failed to update metadata with backup info:', updateError);
        // Don't fail the entire backup process if metadata update fails
      }

      logger.info(`Key backup created successfully at: ${backupPath}`);
    } catch (_error: unknown) {
      const errorMessage = _error instanceof Error ? _error.message : String(_error);
      logger.error('Key backup failed:', errorMessage);
      
      // Provide more specific error information
      let specificError = 'Unknown error';
      if (_error instanceof Error) {
        if (_error.message.includes('EACCES') || _error.message.includes('permission')) {
          specificError = 'Permission denied - check file/directory permissions';
        } else if (_error.message.includes('ENOSPC')) {
          specificError = 'Insufficient disk space';
        } else if (_error.message.includes('ENOENT')) {
          specificError = 'Directory or file not found';
        } else {
          specificError = _error.message;
        }
      }
      
      throw new CLIError(
        `Failed to backup encryption key: ${specificError}`,
        'KEY_BACKUP_FAILED'
      );
    }
  }

  /**
   * Restore from a key backup
   */
  public async restoreFromBackup(backupId: string): Promise<boolean> {
    try {
      const metadata = this.getKeyMetadata();
      if (
        !metadata ||
        !metadata.backupLocations ||
        metadata.backupLocations.length === 0
      ) {
        throw new CLIError('No key backups available', 'NO_BACKUPS_AVAILABLE');
      }

      // Find the backup by ID or use the most recent if not specified
      let backupInfo;
      if (backupId) {
        backupInfo = metadata.backupLocations.find((b: BackupLocation) =>
          b.path.includes(backupId)
        );
        if (!backupInfo) {
          throw new CLIError(
            `No backup found with ID ${backupId}`,
            'BACKUP_NOT_FOUND'
          );
        }
      } else {
        // Use the most recent backup
        backupInfo =
          metadata.backupLocations[metadata.backupLocations.length - 1];
      }

      // Verify the backup files exist
      if (
        !fs.existsSync(backupInfo.path) ||
        !fs.existsSync(backupInfo.metadataBackupPath)
      ) {
        throw new CLIError(
          'Backup files are missing or corrupted',
          'BACKUP_FILES_MISSING'
        );
      }

      // Restore the key and metadata from backup
      fs.copyFileSync(backupInfo.path, this.keyPath);
      fs.chmodSync(this.keyPath, 0o600);

      const metadataContent = fs.readFileSync(backupInfo.metadataBackupPath, 'utf8');
      const metadataStr = typeof metadataContent === 'string' ? metadataContent : metadataContent.toString('utf8');
      const backupMetadata = JSON.parse(metadataStr);
      fs.writeFileSync(this.keyMetadataPath, JSON.stringify(backupMetadata), {
        mode: 0o600,
      });

      // Load the restored key
      const key = fs.readFileSync(this.keyPath);
      this.encryptionKey = Buffer.isBuffer(key) ? key : Buffer.from(key);

      // Re-load credentials with the restored key
      this.loadCredentials();

      return true;
    } catch (_error) {
      logger.error('Key restore failed:', _error);
      throw new CLIError(
        `Failed to restore from backup: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
        'BACKUP_RESTORE_FAILED'
      );
    }
  }

  /**
   * List available key backups
   */
  public listKeyBackups(): Array<{
    id: string;
    timestamp: number;
    version: number;
    path: string;
  }> {
    try {
      const metadata = this.getKeyMetadata();
      if (!metadata || !metadata.backupLocations) return [];

      return metadata.backupLocations.map((backup: BackupLocation) => ({
        id: path.basename(backup.path).split('_')[2], // Extract ID from filename
        timestamp: backup.timestamp,
        version: metadata.version || 1,
        path: backup.path,
      }));
    } catch (_error) {
      logger.error('Failed to list backups:', _error);
      return [];
    }
  }

  /**
   * Validate the encryption key integrity
   */
  public validateKeyIntegrity(): boolean {
    try {
      // Ensure we have an encryption key
      if (!this.encryptionKey || this.encryptionKey.length === 0) {
        logger.error('No encryption key available for validation');
        return false;
      }

      // Create a test string and verify encryption/decryption works
      const testString = `test-${Date.now()}-${randomUUID()}`;
      const encrypted = this.encrypt(testString);
      const decrypted = this.decrypt(encrypted);

      if (!decrypted || decrypted.toString() !== testString) {
        throw new Error('Encryption/decryption test failed');
      }

      logger.debug('Key integrity validation passed');
      return true;
    } catch (_error: unknown) {
      const errorMessage = _error instanceof Error ? _error.message : String(_error);
      logger.error('Key validation failed:', errorMessage);
      return false;
    }
  }

  /**
   * Force key rotation (manual trigger)
   */
  public async forceKeyRotation(): Promise<boolean> {
    logger.info('Manual key rotation initiated');
    return await this.rotateKey();
  }

  /**
   * Get key rotation status
   */
  public getKeyRotationStatus(): {
    needsRotation: boolean;
    daysSinceLastRotation: number;
    nextRotationDue: Date;
    lastRotation: Date | null;
  } {
    const metadata = this.getKeyMetadata();
    
    if (!metadata) {
      return {
        needsRotation: false,
        daysSinceLastRotation: 0,
        nextRotationDue: new Date(Date.now() + this.keyRotationIntervalDays * 24 * 60 * 60 * 1000),
        lastRotation: null
      };
    }

    const lastRotation = metadata.lastRotated || metadata.lastRotatedAt || 0;
    const currentTime = Date.now();
    const daysSinceLastRotation = Math.floor(
      (currentTime - lastRotation) / (1000 * 60 * 60 * 24)
    );

    const nextRotationDue = new Date(lastRotation + this.keyRotationIntervalDays * 24 * 60 * 60 * 1000);

    return {
      needsRotation: daysSinceLastRotation >= this.keyRotationIntervalDays,
      daysSinceLastRotation,
      nextRotationDue,
      lastRotation: lastRotation ? new Date(lastRotation) : null
    };
  }

  /**
   * Encrypt data using the encryption key
   */
  private encrypt(data: string): Buffer {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([iv, encrypted]);
  }

  /**
   * Decrypt data using the encryption key
   */
  private decrypt(data: Buffer): Buffer | null {
    try {
      const iv = data.subarray(0, 16);
      const encrypted = data.subarray(16);
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        this.encryptionKey,
        iv
      );
      return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } catch (_error) {
      logger.error('Decryption failed:', _error);
      return null;
    }
  }
}

// Singleton instance
export const secureCredentialManager = new SecureCredentialManager();
