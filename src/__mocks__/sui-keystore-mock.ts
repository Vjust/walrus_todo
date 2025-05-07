import { Signer } from '@mysten/sui/cryptography';
import type { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { toSerializedSignature } from '@mysten/sui/cryptography';
import type { SignatureWithBytes } from '@mysten/sui/cryptography';

export class MockKeystoreSigner implements Signer {
  private keypair: Ed25519Keypair;
  private _client?: SuiClient;

  constructor(client?: SuiClient) {
    this._client = client;
    // Initialize with empty key bytes for mock
    const keypairData = {
      publicKey: new Uint8Array(32).fill(1),
      secretKey: new Uint8Array(64).fill(1)
    };
    this.keypair = new Ed25519Keypair(keypairData);
  }

  get client(): SuiClient | undefined {
    return this._client;
  }

  async getAddress(): Promise<string> {
    return 'mock-sui-address';
  }

  async signData(data: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(64).fill(1);
  }

  async sign(transaction: Transaction): Promise<SignatureWithBytes> {
    const bytes = await transaction.serialize();
    return this.signTransaction(bytes);
  }

  get publicKey(): Ed25519Keypair['publicKey'] {
    return this.keypair.getPublicKey();
  }

  getPublicKey(): Ed25519Keypair['publicKey'] {
    return this.keypair.getPublicKey();
  }

  async signTransaction(bytes: Uint8Array): Promise<SignatureWithBytes> {
    const signature = await this.signData(bytes);
    return {
      signature: toSerializedSignature({
        signature,
        signatureScheme: this.getKeyScheme(),
        publicKey: this.getPublicKey()
      }),
      bytes: Buffer.from(bytes).toString('base64')
    };
  }

  connect(client: SuiClient): Signer & { client: SuiClient } {
    return new MockKeystoreSigner(client) as Signer & { client: SuiClient };
  }

  async signMessage(message: Uint8Array): Promise<SignatureWithBytes> {
    const signature = await this.signData(message);
    return {
      signature: toSerializedSignature({
        signature,
        signatureScheme: this.getKeyScheme(),
        publicKey: this.getPublicKey()
      }),
      bytes: Buffer.from(message).toString('base64')
    };
  }

  async signPersonalMessage(message: Uint8Array): Promise<SignatureWithBytes> {
    return this.signMessage(message);
  }

  async signWithIntent(message: Uint8Array, intent: string): Promise<SignatureWithBytes> {
    return this.signMessage(message);
  }

  getKeyScheme(): 'ED25519' | 'Secp256k1' {
    return 'ED25519';
  }

  static fromPath(path: string): MockKeystoreSigner {
    return new MockKeystoreSigner();
  }
}