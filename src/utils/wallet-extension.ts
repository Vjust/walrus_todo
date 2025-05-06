import { Signer, type SignatureScheme, type IntentScope, type PublicKey } from '@mysten/sui/cryptography';
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

  async sign(_bytes: Uint8Array): Promise<Uint8Array> {
    // Mock implementation
    return new Uint8Array(Buffer.from('demo-signature'));
  }

  async signWithIntent(bytes: Uint8Array, _intent: IntentScope): Promise<{ bytes: string; signature: string }> {
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

  getPublicKey(): PublicKey {
    // Mock implementation
    const mockKey = {
      flag: () => 0,
      schema: 'ED25519',
      toBytes: () => new Uint8Array(32),
      toBase64: () => 'demo-public-key',
      toSuiAddress: () => this.cachedAddress,
      equals: () => false,
      toSuiPublicKey: () => 'demo-sui-public-key',
      verifyWithIntent: () => Promise.resolve(false),
      verifyPersonalMessage: () => Promise.resolve(false),
      verify: () => Promise.resolve(false)
    };
    return mockKey as unknown as PublicKey;
  }
}