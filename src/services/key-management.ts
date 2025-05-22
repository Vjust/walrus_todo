import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SecureStorage } from './secure-storage';
import { CLIError } from '../types/error';

/**
 * Service for managing cryptographic keys securely
 * Uses secure storage to protect sensitive key material
 */
export class KeyManagementService {
  private static instance: KeyManagementService;
  private secureStorage: SecureStorage;
  private keypairCache: Ed25519Keypair | null = null;
  
  private constructor() {
    this.secureStorage = new SecureStorage();
  }

  public static getInstance(): KeyManagementService {
    if (!KeyManagementService.instance) {
      KeyManagementService.instance = new KeyManagementService();
    }
    return KeyManagementService.instance;
  }

  async getKeypair(): Promise<Ed25519Keypair> {
    // Return cached keypair if available
    if (this.keypairCache) {
      return this.keypairCache;
    }

    const privateKey = await this.secureStorage.getSecureItem('SUI_PRIVATE_KEY');
    if (!privateKey) {
      throw new CLIError('No private key found. Please configure your wallet first.', 'NO_PRIVATE_KEY');
    }

    try {
      this.keypairCache = Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, 'base64'));
      return this.keypairCache;
    } catch (_error) {
      throw new CLIError(
        `Failed to load keypair: ${error instanceof Error ? error.message : String(error)}`,
        'KEYPAIR_LOAD_FAILED'
      );
    }
  }

  async storeKeypair(privateKey: string): Promise<void> {
    try {
      // Validate the private key format before storing
      const keypair = Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, 'base64'));
      await this.secureStorage.setSecureItem('SUI_PRIVATE_KEY', privateKey);
      this.keypairCache = keypair;
    } catch (_error) {
      throw new CLIError(
        `Invalid private key format: ${error instanceof Error ? error.message : String(error)}`,
        'INVALID_PRIVATE_KEY'
      );
    }
  }

  clearCache(): void {
    this.keypairCache = null;
  }
}

