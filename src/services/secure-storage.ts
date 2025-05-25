import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CLIError } from '../types/errors/consolidated';

/**
 * Secure storage implementation for sensitive data
 * Uses encryption to protect stored values
 */
export class SecureStorage {
  private readonly storageDir: string;
  private readonly keyFile: string;
  private encryptionKey: Buffer | null = null;

  constructor() {
    this.storageDir = path.join(os.homedir(), '.walrus', 'secure');
    this.keyFile = path.join(this.storageDir, '.key');
    this.initializeStorage();
  }

  private initializeStorage(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true, mode: 0o700 });
    }

    if (!fs.existsSync(this.keyFile)) {
      const key = crypto.randomBytes(32);
      fs.writeFileSync(this.keyFile, key, { mode: 0o600 });
    }

    // Set secure permissions
    fs.chmodSync(this.storageDir, 0o700);
    fs.chmodSync(this.keyFile, 0o600);
  }

  private getEncryptionKey(): Buffer {
    if (!this.encryptionKey) {
      this.encryptionKey = fs.readFileSync(this.keyFile);
    }
    return this.encryptionKey;
  }

  private getStorageFile(key: string): string {
    return path.join(this.storageDir, `${key}.encrypted`);
  }

  async setSecureItem(key: string, value: string): Promise<void> {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        this.getEncryptionKey(),
        iv
      );

      let encrypted = cipher.update(value, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      const data = JSON.stringify({
        iv: iv.toString('hex'),
        encrypted,
        authTag: authTag.toString('hex'),
      });

      fs.writeFileSync(this.getStorageFile(key), data, { mode: 0o600 });
    } catch (_error) {
      throw new CLIError(
        `Failed to store secure item: ${error instanceof Error ? error.message : String(error)}`,
        'SECURE_STORAGE_ERROR'
      );
    }
  }

  async getSecureItem(key: string): Promise<string | null> {
    const filePath = this.getStorageFile(key);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.getEncryptionKey(),
        Buffer.from(data.iv, 'hex')
      );

      decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
      let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (_error) {
      throw new CLIError(
        `Failed to read secure item: ${error instanceof Error ? error.message : String(error)}`,
        'SECURE_STORAGE_ERROR'
      );
    }
  }

  async removeSecureItem(key: string): Promise<void> {
    const filePath = this.getStorageFile(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
