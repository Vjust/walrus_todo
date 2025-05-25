import { WalrusError } from '../types/errors';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { CLIError } from '../types/error';
import { Logger } from './Logger';

const logger = new Logger('VaultManager');

interface VaultConfig {
  name: string;
  maxSize: number;
  allowedTypes: string[];
  retentionPeriod: number;
}

interface VaultMetadata {
  id: string;
  name: string;
  created: string;
  totalFiles: number;
  totalSize: number;
  config: VaultConfig;
}

export interface BlobRecord {
  blobId: string;
  fileName: string;
  size: number;
  mimeType: string;
  checksum: string;
  uploadedAt: string;
  expiresAt: string;
  vaultId: string;
  metadata?: Record<string, any>;
}

export interface Secret {
  id: string;
  value: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export class VaultManager {
  private readonly baseDir: string;
  private readonly vaults: Map<string, VaultMetadata>;
  private readonly recordsFile: string;
  private readonly secretsDir: string;
  private encryptionKey: Buffer | null = null;
  private secretsMap: Map<string, Secret> = new Map();

  constructor(baseDir: string) {
    // Ensure baseDir is absolute
    this.baseDir = path.isAbsolute(baseDir)
      ? baseDir
      : path.join(
          process.env.HOME || process.env.USERPROFILE || '',
          '.config',
          baseDir
        );

    this.recordsFile = path.join(this.baseDir, 'vault-records.json');
    this.secretsDir = path.join(this.baseDir, 'secrets');
    this.vaults = new Map();
    this.initializeVaultSystem();
    this.initializeSecretsSystem();
  }

  private initializeVaultSystem(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }

    if (fs.existsSync(this.recordsFile)) {
      const records = JSON.parse(fs.readFileSync(this.recordsFile, 'utf-8'));
      records.vaults.forEach((vault: VaultMetadata) => {
        this.vaults.set(vault.id, vault);
      });
    } else {
      this.saveVaultRecords();
    }
  }

  private initializeSecretsSystem(): void {
    // Create secrets directory if not exists
    if (!fs.existsSync(this.secretsDir)) {
      fs.mkdirSync(this.secretsDir, { recursive: true });
      // Set restrictive permissions on the secrets directory
      try {
        fs.chmodSync(this.secretsDir, 0o700); // Only owner can read/write/execute
      } catch (error) {
        logger.warn(
          'Could not set restrictive permissions on secrets directory'
        );
      }
    }

    // Generate or load master encryption key
    const keyFile = path.join(this.baseDir, '.master.key');
    if (!fs.existsSync(keyFile)) {
      this.encryptionKey = crypto.randomBytes(32); // 256-bit key
      fs.writeFileSync(keyFile, this.encryptionKey, { mode: 0o600 }); // Only owner can read/write
    } else {
      try {
        this.encryptionKey = fs.readFileSync(keyFile);
      } catch (error) {
        throw new CLIError(
          'Failed to read encryption key',
          'ENCRYPTION_KEY_ERROR'
        );
      }
    }

    // Load existing secrets
    this.loadSecrets();
  }

  private loadSecrets(): void {
    if (!fs.existsSync(this.secretsDir)) return;

    const indexFile = path.join(this.secretsDir, 'index.json');
    if (fs.existsSync(indexFile)) {
      try {
        const encryptedIndex = fs.readFileSync(indexFile);
        const decryptedIndex = this.decrypt(encryptedIndex);
        if (decryptedIndex) {
          const secretsIndex = JSON.parse(decryptedIndex.toString());
          this.secretsMap = new Map(Object.entries(secretsIndex));
        }
      } catch (error) {
        logger.error('Failed to load secrets index:', error);
        // Initialize with empty map on error
        this.secretsMap = new Map();
      }
    }
  }

  private saveSecretIndex(): void {
    // Convert map to object for serialization
    const secretsObject = Object.fromEntries(this.secretsMap);
    const indexJson = JSON.stringify(secretsObject);
    const encryptedIndex = this.encrypt(indexJson);

    const indexFile = path.join(this.secretsDir, 'index.json');
    fs.writeFileSync(indexFile, encryptedIndex, { mode: 0o600 }); // Only owner can read/write
  }

  /**
   * Store a secret in the vault
   */
  async storeSecret(
    key: string,
    value: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.encryptionKey) {
      throw new CLIError(
        'Encryption key not initialized',
        'ENCRYPTION_KEY_ERROR'
      );
    }

    // Create secret record
    const secret: Secret = {
      id: crypto.randomBytes(16).toString('hex'),
      value: value,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata,
    };

    // Encrypt the secret value and store it
    const encryptedValue = this.encrypt(JSON.stringify(secret));

    const secretFile = path.join(this.secretsDir, `${secret.id}.enc`);
    fs.writeFileSync(secretFile, encryptedValue, { mode: 0o600 }); // Only owner can read/write

    // Update the index with the secret metadata (excluding the value)
    this.secretsMap.set(key, {
      ...secret,
      value: '', // Don't store actual value in the index for additional security
    });

    this.saveSecretIndex();
  }

  /**
   * Retrieve a secret from the vault
   */
  async getSecret(key: string): Promise<string> {
    const secretMeta = this.secretsMap.get(key);
    if (!secretMeta) {
      throw new CLIError(`Secret not found: ${key}`, 'SECRET_NOT_FOUND');
    }

    const secretFile = path.join(this.secretsDir, `${secretMeta.id}.enc`);
    if (!fs.existsSync(secretFile)) {
      throw new CLIError(
        `Secret file not found: ${key}`,
        'SECRET_FILE_NOT_FOUND'
      );
    }

    try {
      const encryptedData = fs.readFileSync(secretFile);
      const decryptedData = this.decrypt(encryptedData);
      if (!decryptedData) {
        throw new CLIError(
          `Failed to decrypt secret: ${key}`,
          'SECRET_DECRYPTION_FAILED'
        );
      }

      const secret = JSON.parse(decryptedData.toString()) as Secret;
      return secret.value;
    } catch (error) {
      if (error instanceof CLIError) throw error;
      throw new CLIError(
        `Error retrieving secret: ${key}`,
        'SECRET_READ_ERROR'
      );
    }
  }

  /**
   * Check if a secret exists
   */
  async hasSecret(key: string): Promise<boolean> {
    return this.secretsMap.has(key);
  }

  /**
   * List all secret keys
   */
  async listSecrets(): Promise<string[]> {
    return Array.from(this.secretsMap.keys());
  }

  /**
   * Remove a secret from the vault
   */
  async removeSecret(key: string): Promise<void> {
    const secretMeta = this.secretsMap.get(key);
    if (!secretMeta) {
      throw new CLIError(`Secret not found: ${key}`, 'SECRET_NOT_FOUND');
    }

    const secretFile = path.join(this.secretsDir, `${secretMeta.id}.enc`);
    if (fs.existsSync(secretFile)) {
      fs.unlinkSync(secretFile);
    }

    this.secretsMap.delete(key);
    this.saveSecretIndex();
  }

  /**
   * Encrypt data using AES-256-GCM with the master key
   * This provides authenticated encryption with associated data (AEAD)
   */
  private encrypt(data: string): Buffer {
    if (!this.encryptionKey) {
      throw new CLIError(
        'Encryption key not initialized',
        'ENCRYPTION_KEY_ERROR'
      );
    }

    // Generate a random initialization vector for each encryption
    const iv = crypto.randomBytes(16);

    // Generate a random salt for key derivation
    const salt = crypto.randomBytes(16);

    // Derive an encryption key using PBKDF2
    const key = crypto.pbkdf2Sync(
      this.encryptionKey,
      salt,
      10000,
      32,
      'sha256'
    );

    // Create a cipher using AES-256-GCM mode
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    // Add additional authentication data (AAD) for integrity checks
    const aad = Buffer.from('walrus-secure-credential');
    cipher.setAAD(aad);

    // Encrypt the data
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(data, 'utf-8')),
      cipher.final(),
    ]);

    // Get the authentication tag
    const tag = cipher.getAuthTag();

    // Combine all components (salt + iv + tag + aad length + aad + encrypted data)
    return Buffer.concat([
      salt, // 16 bytes
      iv, // 16 bytes
      tag, // 16 bytes
      Buffer.from([aad.length]), // 1 byte for AAD length
      aad, // Variable length
      encrypted, // Variable length
    ]);
  }

  /**
   * Decrypt data using AES-256-GCM with the master key
   */
  private decrypt(data: Buffer): Buffer | null {
    if (!this.encryptionKey) {
      throw new CLIError(
        'Encryption key not initialized',
        'ENCRYPTION_KEY_ERROR'
      );
    }

    try {
      // Extract components from the combined data
      const salt = data.subarray(0, 16);
      const iv = data.subarray(16, 32);
      const tag = data.subarray(32, 48);
      const aadLength = data.readUInt8(48);
      const aad = data.subarray(49, 49 + aadLength);
      const encrypted = data.subarray(49 + aadLength);

      // Derive the same encryption key using PBKDF2
      const key = crypto.pbkdf2Sync(
        this.encryptionKey,
        salt,
        10000,
        32,
        'sha256'
      );

      // Create a decipher
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);

      // Set the authentication tag and AAD
      decipher.setAuthTag(tag);
      decipher.setAAD(aad);

      // Decrypt the data
      return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } catch (error) {
      logger.error('Decryption failed:', error);
      return null;
    }
  }

  private saveVaultRecords(): void {
    const records = {
      lastUpdated: new Date().toISOString(),
      vaults: Array.from(this.vaults.values()).map(vault => ({
        id: vault.id,
        name: vault.name,
        created: vault.created,
        totalFiles: vault.totalFiles,
        totalSize: vault.totalSize,
        config: vault.config,
      })),
    };
    fs.writeFileSync(this.recordsFile, JSON.stringify(records, null, 2));
  }

  createVault(config: VaultConfig): string {
    const vaultId = crypto.randomBytes(16).toString('hex');
    const vault: VaultMetadata = {
      id: vaultId,
      name: config.name,
      created: new Date().toISOString(),
      totalFiles: 0,
      totalSize: 0,
      config,
    };

    const vaultDir = path.join(this.baseDir, vaultId);
    fs.mkdirSync(vaultDir);
    fs.mkdirSync(path.join(vaultDir, 'metadata'));
    fs.mkdirSync(path.join(vaultDir, 'blobs'));

    this.vaults.set(vaultId, vault);
    this.saveVaultRecords();

    return vaultId;
  }

  saveBlobRecord(record: BlobRecord): void {
    const vault = this.vaults.get(record.vaultId);
    if (!vault) {
      throw new WalrusError(`Vault ${record.vaultId} not found`);
    }

    // Update vault stats
    vault.totalFiles++;
    vault.totalSize += record.size;

    // Save blob metadata
    const metadataPath = path.join(
      this.baseDir,
      record.vaultId,
      'metadata',
      `${record.blobId}.json`
    );
    fs.writeFileSync(metadataPath, JSON.stringify(record, null, 2));

    this.saveVaultRecords();
  }

  getBlobRecord(blobId: string, vaultId: string): BlobRecord {
    const metadataPath = path.join(
      this.baseDir,
      vaultId,
      'metadata',
      `${blobId}.json`
    );

    if (!fs.existsSync(metadataPath)) {
      throw new WalrusError(`Blob record not found: ${blobId}`);
    }

    return JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  }

  getVaultMetadata(vaultId: string): VaultMetadata {
    const vault = this.vaults.get(vaultId);
    if (!vault) {
      throw new WalrusError(`Vault ${vaultId} not found`);
    }
    return { ...vault };
  }

  validateFileForVault(vaultId: string, size: number, mimeType: string): void {
    const vault = this.vaults.get(vaultId);
    if (!vault) {
      throw new WalrusError(`Vault ${vaultId} not found`);
    }

    if (size > vault.config.maxSize) {
      throw new WalrusError(
        `File size ${size} exceeds vault limit of ${vault.config.maxSize}`
      );
    }

    if (!vault.config.allowedTypes.includes(mimeType)) {
      throw new WalrusError(
        `File type ${mimeType} not allowed in vault. Allowed types: ${vault.config.allowedTypes.join(
          ', '
        )}`
      );
    }

    if (vault.totalSize + size > vault.config.maxSize) {
      throw new WalrusError('Vault size limit would be exceeded');
    }
  }

  getExpiringBlobs(withinDays: number): BlobRecord[] {
    const expiringBlobs: BlobRecord[] = [];
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + withinDays);

    for (const vault of Array.from(this.vaults.values())) {
      const metadataDir = path.join(this.baseDir, vault.id, 'metadata');
      if (!fs.existsSync(metadataDir)) continue;

      const files = fs.readdirSync(metadataDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const record: BlobRecord = JSON.parse(
          fs.readFileSync(path.join(metadataDir, file), 'utf-8')
        );

        const expiryDate = new Date(record.expiresAt);
        if (expiryDate <= threshold) {
          expiringBlobs.push(record);
        }
      }
    }

    return expiringBlobs;
  }

  updateBlobExpiry(
    blobId: string,
    vaultId: string,
    newExpiryDate: string
  ): void {
    const record = this.getBlobRecord(blobId, vaultId);
    record.expiresAt = newExpiryDate;

    const metadataPath = path.join(
      this.baseDir,
      vaultId,
      'metadata',
      `${blobId}.json`
    );
    fs.writeFileSync(metadataPath, JSON.stringify(record, null, 2));
  }
}
