import { Signer, type SignatureScheme, type IntentScope } from '@mysten/sui/cryptography';
import { toB64 } from '@mysten/sui/utils';

/**
 * A simplified wallet extension signer that satisfies the Signer interface
 * This is a placeholder implementation - in a real application, you would
 * use the actual wallet adapter implementation
 */
export class WalletExtensionSigner implements Signer {
  private cachedAddress: string;

  constructor() {
    this.cachedAddress = 'demo-address';
  }

  async sign(bytes: Uint8Array): Promise<Uint8Array> {
    // Mock implementation
    return new Uint8Array(Buffer.from('demo-signature'));
  }

  async signWithIntent(bytes: Uint8Array, intent: IntentScope): Promise<{ bytes: string; signature: string }> {
    // Mock implementation
    return {
      bytes: toB64(bytes),
      signature: 'demo-signature'
    };
  }

  async signPersonalMessage(bytes: Uint8Array): Promise<{ bytes: string; signature: string }> {
    // This is just a placeholder implementation
    return this.signWithIntent(bytes, 'PersonalMessage');
  }

  async signTransaction(bytes: Uint8Array): Promise<{ bytes: string; signature: string }> {
    // This is just a placeholder implementation
    return this.signWithIntent(bytes, 'TransactionData');
  }

  async getAddress(): Promise<string> {
    return this.cachedAddress;
  }

  toSuiAddress(): string {
    return this.cachedAddress;
  }

  getKeyScheme(): SignatureScheme {
    return 'ED25519';
  }

  getPublicKey(): any {
    // Mock implementation
    return {
      toBytes: () => new Uint8Array(32),
      toBase64: () => 'demo-public-key',
      toSuiAddress: () => this.cachedAddress
    };
  }
}