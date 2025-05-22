/**
 * EnhancedVaultManager.ts
 * 
 * An improved secure storage system for API keys and sensitive credentials
 * with enhanced encryption, key rotation, and security features.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CLIError } from '../types/error';
import { AI_CONFIG } from '../constants';

interface SecretMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  metadata?: Record<string, any>;
  rotationDue?: number;
  rotationCount?: number;
  accessCount?: number;
  lastAccessed?: number;
  verified?: boolean;
}

export class EnhancedVaultManager {
  private readonly vaultDir: string;
  private readonly metadataFile: string;
  private readonly keyFile: string;
  private encryptionKey: Buffer | null = null;
  private metadata: Map<string, SecretMetadata> = new Map();
  private maxFailedAttempts: number = AI_CONFIG.CREDENTIAL_SECURITY.MAX_FAILED_AUTH;
  private failedAttempts: Map<string, number> = new Map();
  private lockoutUntil: Map<string, number> = new Map();
  
  /**
   * Initialize the enhanced vault manager
   * 
   * @param vaultName - Name of the vault for separation of different credential types
   */
  constructor(vaultName: string) {
    // Set up the vault directory in the user's home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const configDir = path.join(homeDir, '.config', 'walrus_todo', 'vaults', vaultName);
    
    this.vaultDir = configDir;
    this.metadataFile = path.join(configDir, '.metadata.enc');
    this.keyFile = path.join(configDir, '.master.key');
    
    // Ensure the vault directory exists with proper permissions
    this.initializeVault();
  }
  
  /**
   * Initialize the vault and security measures
   */
  private initializeVault(): void {
    // Create vault directory with secure permissions if it doesn't exist
    if (!fs.existsSync(this.vaultDir)) {
      fs.mkdirSync(this.vaultDir, { recursive: true });
      
      // Set restrictive permissions on Linux/Mac
      try {
        fs.chmodSync(this.vaultDir, 0o700); // Only owner can read/write/execute
      } catch (_error) {
        console.warn('Could not set restrictive permissions on vault directory');
      }
    }
    
    // Generate or load master encryption key
    this.initializeEncryptionKey();
    
    // Load metadata
    this.loadMetadata();
  }
  
  /**
   * Initialize or load the encryption key
   */
  private initializeEncryptionKey(): void {
    // Check if key file exists
    if (!fs.existsSync(this.keyFile)) {
      // Generate a strong encryption key using CSPRNG
      this.encryptionKey = crypto.randomBytes(AI_CONFIG.CREDENTIAL_ENCRYPTION.KEY_SIZE);
      
      // Write key to file with restricted permissions
      fs.writeFileSync(this.keyFile, this.encryptionKey, { mode: 0o600 }); // Only owner can read/write
    } else {
      try {
        // Load existing key
        this.encryptionKey = fs.readFileSync(this.keyFile);
        
        // Validate key length
        if (this.encryptionKey.length !== AI_CONFIG.CREDENTIAL_ENCRYPTION.KEY_SIZE) {
          throw new CLIError('Invalid encryption key detected', 'ENCRYPTION_KEY_ERROR');
        }
      } catch (_error) {
        throw new CLIError(
          'Failed to read encryption key. Vault may be corrupted.',
          'ENCRYPTION_KEY_ERROR'
        );
      }
    }
  }
  
  /**
   * Load vault metadata
   */
  private loadMetadata(): void {
    if (fs.existsSync(this.metadataFile)) {
      try {
        // Read and decrypt metadata file
        const encryptedData = fs.readFileSync(this.metadataFile);
        const decryptedData = this.decrypt(encryptedData);
        
        if (decryptedData) {
          // Parse metadata
          const metadataObj = JSON.parse(decryptedData.toString());
          this.metadata = new Map(Object.entries(metadataObj));
          
          // Check for and handle expired credentials
          this.checkExpiredSecrets();
        }
      } catch (_error) {
        console.error('Failed to load vault metadata:', _error);
        // Initialize with empty metadata for safety
        this.metadata = new Map();
      }
    }
  }
  
  /**
   * Save vault metadata
   */
  private saveMetadata(): void {
    try {
      // Convert map to object for serialization
      const metadataObj = Object.fromEntries(this.metadata);
      
      // Encrypt and save
      const encryptedData = this.encrypt(JSON.stringify(metadataObj));
      fs.writeFileSync(this.metadataFile, encryptedData, { mode: 0o600 }); // Only owner can read/write
    } catch (_error) {
      throw new CLIError(
        `Failed to save vault metadata: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
        'VAULT_METADATA_ERROR'
      );
    }
  }
  
  /**
   * Check for expired secrets and clean them up
   */
  private checkExpiredSecrets(): void {
    const now = Date.now();
    let needsSave = false;
    
    // Identify expired secrets
    for (const [key, metadata] of this.metadata.entries()) {
      if (metadata.expiresAt && metadata.expiresAt < now) {
        // Delete the secret file
        const secretFile = path.join(this.vaultDir, `${metadata.id}.enc`);
        if (fs.existsSync(secretFile)) {
          fs.unlinkSync(secretFile);
        }
        
        // Remove from metadata
        this.metadata.delete(key);
        needsSave = true;
      }
    }
    
    // Save metadata if changes were made
    if (needsSave) {
      this.saveMetadata();
    }
  }
  
  /**
   * Check for secrets needing rotation
   * 
   * @returns Array of secret names needing rotation
   */
  public checkRotationNeeded(): string[] {
    const now = Date.now();
    const rotationNeeded: string[] = [];
    
    for (const [key, metadata] of this.metadata.entries()) {
      // Check if rotation is due
      if (metadata.rotationDue && metadata.rotationDue < now) {
        rotationNeeded.push(key);
      }
    }
    
    return rotationNeeded;
  }
  
  /**
   * Store a secret securely
   * 
   * @param name - Secret name/identifier
   * @param value - Secret value
   * @param options - Additional options for the secret
   * @returns The ID of the stored secret
   */
  public async storeSecret(
    name: string,
    value: string,
    options: {
      expiryDays?: number;
      rotationDays?: number;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string> {
    // Check for lockout
    this.checkLockout(name);
    
    // Generate a unique ID for the secret
    const secretId = crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    
    // Calculate expiry and rotation times
    const expiryDays = options.expiryDays || (AI_CONFIG.CREDENTIAL_SECURITY.AUTO_ROTATION_DAYS * 2);
    const rotationDays = options.rotationDays || AI_CONFIG.CREDENTIAL_SECURITY.AUTO_ROTATION_DAYS;
    
    const expiresAt = now + (expiryDays * 24 * 60 * 60 * 1000);
    const rotationDue = now + (rotationDays * 24 * 60 * 60 * 1000);
    
    // Create metadata record
    const secretMetadata: SecretMetadata = {
      id: secretId,
      name,
      createdAt: now,
      updatedAt: now,
      expiresAt,
      rotationDue,
      rotationCount: 0,
      accessCount: 0,
      metadata: options.metadata || {}
    };
    
    // Encrypt the secret value
    const encryptedData = this.encrypt(value);
    
    // Save the encrypted secret
    const secretPath = path.join(this.vaultDir, `${secretId}.enc`);
    fs.writeFileSync(secretPath, encryptedData, { mode: 0o600 }); // Only owner can read/write
    
    // Update and save metadata
    this.metadata.set(name, secretMetadata);
    this.saveMetadata();
    
    return secretId;
  }
  
  /**
   * Retrieve a secret
   * 
   * @param name - Secret name/identifier
   * @returns The decrypted secret value
   */
  public async getSecret(name: string): Promise<string> {
    // Check for lockout
    this.checkLockout(name);
    
    // Get metadata for the secret
    const metadata = this.metadata.get(name);
    if (!metadata) {
      // Record failed attempt
      this.recordFailedAttempt(name);
      throw new CLIError(`Secret not found: ${name}`, 'SECRET_NOT_FOUND');
    }
    
    // Check if secret has expired
    if (metadata.expiresAt && metadata.expiresAt < Date.now()) {
      throw new CLIError(`Secret has expired: ${name}`, 'SECRET_EXPIRED');
    }
    
    // Construct path to the secret file
    const secretPath = path.join(this.vaultDir, `${metadata.id}.enc`);
    if (!fs.existsSync(secretPath)) {
      throw new CLIError(`Secret file missing: ${name}`, 'SECRET_FILE_MISSING');
    }
    
    try {
      // Read and decrypt the secret
      const encryptedData = fs.readFileSync(secretPath);
      const decryptedData = this.decrypt(encryptedData);
      
      if (!decryptedData) {
        // Record failed attempt
        this.recordFailedAttempt(name);
        throw new CLIError(`Failed to decrypt secret: ${name}`, 'DECRYPTION_FAILED');
      }
      
      // Update access metadata
      metadata.accessCount = (metadata.accessCount || 0) + 1;
      metadata.lastAccessed = Date.now();
      this.metadata.set(name, metadata);
      this.saveMetadata();
      
      // Reset failed attempts since successful decryption
      this.failedAttempts.delete(name);
      
      return decryptedData.toString();
    } catch (_error) {
      if (_error instanceof CLIError) {
        throw _error;
      }
      
      // Record failed attempt
      this.recordFailedAttempt(name);
      throw new CLIError(
        `Error retrieving secret: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
        'SECRET_READ_ERROR'
      );
    }
  }
  
  /**
   * Check if a secret exists
   * 
   * @param name - Secret name/identifier
   * @returns True if the secret exists and is not expired
   */
  public async hasSecret(name: string): Promise<boolean> {
    const metadata = this.metadata.get(name);
    
    if (!metadata) {
      return false;
    }
    
    // Check if secret has expired
    if (metadata.expiresAt && metadata.expiresAt < Date.now()) {
      return false;
    }
    
    // Check if the secret file exists
    const secretPath = path.join(this.vaultDir, `${metadata.id}.enc`);
    return fs.existsSync(secretPath);
  }
  
  /**
   * List all secret names
   * 
   * @returns Array of secret names
   */
  public async listSecrets(): Promise<string[]> {
    // Filter out expired secrets
    const now = Date.now();
    return Array.from(this.metadata.entries())
      .filter(([_, metadata]) => !metadata.expiresAt || metadata.expiresAt > now)
      .map(([key, _]) => key);
  }
  
  /**
   * Get metadata for a secret
   * 
   * @param name - Secret name/identifier
   * @returns Metadata object without sensitive details
   */
  public async getSecretMetadata(name: string): Promise<Omit<SecretMetadata, 'id'> | null> {
    const metadata = this.metadata.get(name);
    
    if (!metadata) {
      return null;
    }
    
    // Return a copy without the ID (to prevent direct file access)
    const { id: _id, ...metadataCopy } = metadata;
    return metadataCopy;
  }
  
  /**
   * Remove a secret
   * 
   * @param name - Secret name/identifier
   * @returns True if the secret was removed, false if it didn't exist
   */
  public async removeSecret(name: string): Promise<boolean> {
    const metadata = this.metadata.get(name);
    
    if (!metadata) {
      return false;
    }
    
    // Delete the secret file
    const secretPath = path.join(this.vaultDir, `${metadata.id}.enc`);
    if (fs.existsSync(secretPath)) {
      fs.unlinkSync(secretPath);
    }
    
    // Remove from metadata
    this.metadata.delete(name);
    this.saveMetadata();
    
    return true;
  }
  
  /**
   * Mark a secret as verified
   * 
   * @param name - Secret name/identifier
   * @param status - Verification status
   * @returns True if successful
   */
  public async setVerificationStatus(name: string, status: boolean): Promise<boolean> {
    const metadata = this.metadata.get(name);
    
    if (!metadata) {
      return false;
    }
    
    // Update verification status
    metadata.verified = status;
    this.metadata.set(name, metadata);
    this.saveMetadata();
    
    return true;
  }
  
  /**
   * Update a secret's expiry date
   * 
   * @param name - Secret name/identifier
   * @param expiryDays - New expiry in days from now
   * @returns True if successful
   */
  public async updateExpiry(name: string, expiryDays: number): Promise<boolean> {
    const metadata = this.metadata.get(name);
    
    if (!metadata) {
      return false;
    }
    
    // Update expiry date
    metadata.expiresAt = Date.now() + (expiryDays * 24 * 60 * 60 * 1000);
    this.metadata.set(name, metadata);
    this.saveMetadata();
    
    return true;
  }
  
  /**
   * Rotate a secret (update its value)
   * 
   * @param name - Secret name/identifier
   * @param newValue - New secret value
   * @returns True if successful
   */
  public async rotateSecret(name: string, newValue: string): Promise<boolean> {
    const metadata = this.metadata.get(name);
    
    if (!metadata) {
      return false;
    }
    
    // Update rotation metadata
    metadata.rotationCount = (metadata.rotationCount || 0) + 1;
    metadata.updatedAt = Date.now();
    metadata.rotationDue = Date.now() + (AI_CONFIG.CREDENTIAL_SECURITY.AUTO_ROTATION_DAYS * 24 * 60 * 60 * 1000);
    
    // Encrypt and save the new secret value
    const encryptedData = this.encrypt(newValue);
    const secretPath = path.join(this.vaultDir, `${metadata.id}.enc`);
    fs.writeFileSync(secretPath, encryptedData, { mode: 0o600 }); // Only owner can read/write
    
    // Update metadata
    this.metadata.set(name, metadata);
    this.saveMetadata();
    
    return true;
  }
  
  /**
   * Record a failed access attempt
   * 
   * @param name - Secret name/identifier
   */
  private recordFailedAttempt(name: string): void {
    const currentFailures = this.failedAttempts.get(name) || 0;
    const newFailures = currentFailures + 1;
    
    this.failedAttempts.set(name, newFailures);
    
    // Implement lockout if too many failures
    if (newFailures >= this.maxFailedAttempts) {
      // Lock for 30 minutes
      const lockUntil = Date.now() + (30 * 60 * 1000);
      this.lockoutUntil.set(name, lockUntil);
      
      console.warn(`Too many failed attempts for secret "${name}". Locked for 30 minutes.`);
    }
  }
  
  /**
   * Check if a secret is locked out
   * 
   * @param name - Secret name/identifier
   */
  private checkLockout(name: string): void {
    const lockUntil = this.lockoutUntil.get(name);
    
    if (lockUntil && lockUntil > Date.now()) {
      const minutesLeft = Math.ceil((lockUntil - Date.now()) / (60 * 1000));
      throw new CLIError(
        `Access to "${name}" is temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minutes.`,
        'ACCESS_LOCKED'
      );
    }
    
    // Clear expired lockout
    if (lockUntil && lockUntil <= Date.now()) {
      this.lockoutUntil.delete(name);
      this.failedAttempts.delete(name);
    }
  }
  
  /**
   * Encrypt data using AES-256-GCM with the master key
   * Implements authenticated encryption with associated data (AEAD)
   * 
   * @param data - Data to encrypt
   * @returns Encrypted data buffer
   */
  private encrypt(data: string): Buffer {
    if (!this.encryptionKey) {
      throw new CLIError('Encryption key not initialized', 'ENCRYPTION_KEY_ERROR');
    }
    
    try {
      // Generate salt and derive key using PBKDF2
      const salt = crypto.randomBytes(AI_CONFIG.CREDENTIAL_ENCRYPTION.SALT_SIZE);
      const derivedKey = crypto.pbkdf2Sync(
        this.encryptionKey,
        salt,
        AI_CONFIG.CREDENTIAL_ENCRYPTION.KEY_ITERATIONS,
        AI_CONFIG.CREDENTIAL_ENCRYPTION.KEY_SIZE,
        'sha256'
      );
      
      // Generate IV
      const iv = crypto.randomBytes(AI_CONFIG.CREDENTIAL_ENCRYPTION.IV_SIZE);
      
      // Create cipher
      const cipher = crypto.createCipheriv(
        AI_CONFIG.CREDENTIAL_ENCRYPTION.ALGORITHM,
        derivedKey,
        iv
      );
      
      // Associate additional data for integrity
      const aad = Buffer.from('walrus-secure-vault');
      cipher.setAAD(aad);
      
      // Encrypt data
      const encrypted = Buffer.concat([
        cipher.update(Buffer.from(data, 'utf8')),
        cipher.final()
      ]);
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      // Combine components (salt + iv + tag + aad length + aad + encrypted data)
      return Buffer.concat([
        salt,                  // Salt for key derivation
        iv,                    // Initialization vector
        tag,                   // Authentication tag
        Buffer.from([aad.length]), // AAD length (1 byte)
        aad,                   // Associated data
        encrypted              // Encrypted data
      ]);
    } catch (_error) {
      throw new CLIError(
        `Encryption failed: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
        'ENCRYPTION_FAILED'
      );
    }
  }
  
  /**
   * Decrypt data using AES-256-GCM with the master key
   * 
   * @param data - Encrypted data buffer
   * @returns Decrypted data or null if decryption fails
   */
  private decrypt(data: Buffer): Buffer | null {
    if (!this.encryptionKey) {
      throw new CLIError('Encryption key not initialized', 'ENCRYPTION_KEY_ERROR');
    }
    
    try {
      // Extract components
      const salt = data.subarray(0, AI_CONFIG.CREDENTIAL_ENCRYPTION.SALT_SIZE);
      const iv = data.subarray(
        AI_CONFIG.CREDENTIAL_ENCRYPTION.SALT_SIZE,
        AI_CONFIG.CREDENTIAL_ENCRYPTION.SALT_SIZE + AI_CONFIG.CREDENTIAL_ENCRYPTION.IV_SIZE
      );
      const tag = data.subarray(
        AI_CONFIG.CREDENTIAL_ENCRYPTION.SALT_SIZE + AI_CONFIG.CREDENTIAL_ENCRYPTION.IV_SIZE,
        AI_CONFIG.CREDENTIAL_ENCRYPTION.SALT_SIZE + AI_CONFIG.CREDENTIAL_ENCRYPTION.IV_SIZE + 16
      );
      const aadLengthPos = AI_CONFIG.CREDENTIAL_ENCRYPTION.SALT_SIZE + AI_CONFIG.CREDENTIAL_ENCRYPTION.IV_SIZE + 16;
      const aadLength = data.readUInt8(aadLengthPos);
      const aad = data.subarray(aadLengthPos + 1, aadLengthPos + 1 + aadLength);
      const encrypted = data.subarray(aadLengthPos + 1 + aadLength);
      
      // Derive the same key
      const derivedKey = crypto.pbkdf2Sync(
        this.encryptionKey,
        salt,
        AI_CONFIG.CREDENTIAL_ENCRYPTION.KEY_ITERATIONS,
        AI_CONFIG.CREDENTIAL_ENCRYPTION.KEY_SIZE,
        'sha256'
      );
      
      // Create decipher
      const decipher = crypto.createDecipheriv(
        AI_CONFIG.CREDENTIAL_ENCRYPTION.ALGORITHM,
        derivedKey,
        iv
      );
      
      // Set authentication tag and AAD
      decipher.setAuthTag(tag);
      decipher.setAAD(aad);
      
      // Decrypt data
      return Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
    } catch (_error) {
      console.error('Decryption failed:', _error);
      return null;
    }
  }
}