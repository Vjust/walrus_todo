import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CLIError } from '../../types/error';
import { CLI_CONFIG } from '../../constants';

/**
 * CredentialManager - Securely manages API credentials for AI providers
 * 
 * This class handles secure storage and retrieval of API credentials using
 * encryption to protect sensitive information. It supports multiple providers
 * and ensures credentials are safely stored on the user's system.
 */
export class CredentialManager {
  private credentialsPath: string;
  private encryptionKey: Buffer;
  private credentials: Record<string, string> = {};
  private initialized: boolean = false;

  constructor() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const configDir = path.join(homeDir, '.config', CLI_CONFIG.APP_NAME);
    
    // Ensure the config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    this.credentialsPath = path.join(configDir, 'credentials.enc');
    
    // Use deterministic but secure key derivation
    // In a production system, consider a more robust key management solution
    const keyPath = path.join(configDir, '.keyfile');
    if (!fs.existsSync(keyPath)) {
      const newKey = crypto.randomBytes(32);
      fs.writeFileSync(keyPath, newKey, { mode: 0o600 }); // Restrict file permissions
    }
    
    this.encryptionKey = fs.readFileSync(keyPath);
    
    // Load credentials if they exist
    this.loadCredentials();
  }

  /**
   * Initialize the credential manager
   */
  private loadCredentials(): void {
    try {
      if (fs.existsSync(this.credentialsPath)) {
        const encryptedData = fs.readFileSync(this.credentialsPath);
        const credentials = this.decrypt(encryptedData);
        if (credentials) {
          this.credentials = JSON.parse(credentials.toString());
        }
      }
      this.initialized = true;
    } catch (_error) {
      console.error('Failed to load credentials:', error);
      // For security, initialize with empty credentials on error
      this.credentials = {};
      this.initialized = true;
    }
  }

  /**
   * Save credentials to disk
   */
  private saveCredentials(): void {
    if (!this.initialized) {
      throw new CLIError('Credential manager not initialized', 'CREDENTIALS_NOT_INITIALIZED');
    }
    
    try {
      const data = JSON.stringify(this.credentials);
      const encryptedData = this.encrypt(data);
      fs.writeFileSync(this.credentialsPath, encryptedData, { mode: 0o600 }); // Restrict file permissions
    } catch (_error) {
      throw new CLIError(
        `Failed to save credentials: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CREDENTIALS_SAVE_FAILED'
      );
    }
  }

  /**
   * Set a credential for a provider
   */
  public setCredential(provider: string, credential: string): void {
    if (!this.initialized) {
      throw new CLIError('Credential manager not initialized', 'CREDENTIALS_NOT_INITIALIZED');
    }
    
    if (!provider || !credential) {
      throw new CLIError('Provider and credential must be provided', 'INVALID_CREDENTIALS');
    }
    
    this.credentials[provider.toLowerCase()] = credential;
    this.saveCredentials();
  }

  /**
   * Get a credential for a provider
   */
  public getCredential(provider: string): string {
    if (!this.initialized) {
      throw new CLIError('Credential manager not initialized', 'CREDENTIALS_NOT_INITIALIZED');
    }
    
    const credential = this.credentials[provider.toLowerCase()];
    if (!credential) {
      // Check environment variables as fallback (format: PROVIDER_API_KEY, e.g., XAI_API_KEY)
      const envKey = `${provider.toUpperCase()}_API_KEY`;
      const envCredential = process.env[envKey];
      
      if (envCredential) {
        return envCredential;
      }
      
      throw new CLIError(`No credential found for provider "${provider}"`, 'CREDENTIAL_NOT_FOUND');
    }
    
    return credential;
  }

  /**
   * Check if a credential exists for a provider
   */
  public hasCredential(provider: string): boolean {
    if (!this.initialized) {
      return false;
    }
    
    // Check stored credentials
    if (this.credentials[provider.toLowerCase()]) {
      return true;
    }
    
    // Check environment variables as fallback
    const envKey = `${provider.toUpperCase()}_API_KEY`;
    return !!process.env[envKey];
  }

  /**
   * List all providers with stored credentials
   */
  public listProviders(): string[] {
    if (!this.initialized) {
      return [];
    }
    
    return Object.keys(this.credentials);
  }

  /**
   * Remove a credential for a provider
   */
  public removeCredential(provider: string): void {
    if (!this.initialized) {
      throw new CLIError('Credential manager not initialized', 'CREDENTIALS_NOT_INITIALIZED');
    }
    
    const providerKey = provider.toLowerCase();
    if (this.credentials[providerKey]) {
      delete this.credentials[providerKey];
      this.saveCredentials();
    }
  }

  /**
   * Encrypt data using the encryption key
   */
  private encrypt(data: string): Buffer {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, encrypted]);
  }

  /**
   * Decrypt data using the encryption key
   */
  private decrypt(data: Buffer): Buffer | null {
    try {
      const iv = data.subarray(0, 16);
      const encrypted = data.subarray(16);
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } catch (_error) {
      console.error('Decryption failed:', error);
      return null;
    }
  }
}

// Singleton instance
export const credentialManager = new CredentialManager();