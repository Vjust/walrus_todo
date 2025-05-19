import { Signer, SignatureScheme, IntentScope, PublicKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiClient } from '@mysten/sui/client';
import { TransactionBlock } from '@mysten/sui/transactions';
import { Transaction } from '@mysten/sui/transactions';
import { toB64 } from '@mysten/sui/utils';
import type { SignatureWithBytes } from '../types/adapters/SignerAdapter';

// Define SerializedMessage interface locally to avoid dependency issues
interface SerializedMessage {
  messageBytes: Uint8Array;
}

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

  toSuiAddress(): string {
    return 'mock-sui-address';
  }

  // Implement standard Signer interface methods
  async signData(data: Uint8Array): Promise<Uint8Array> {
    // Return a mock signature
    return new Uint8Array(64).fill(1);
  }

  // Core signing method
  async sign(bytes: Uint8Array): Promise<Uint8Array> {
    return this.signData(bytes);
  }
  
  // Add signTransaction method compatible with the Signer interface
  async signTransaction(bytes: Uint8Array): Promise<SignatureWithBytes> {
    const signature = await this.sign(bytes);
    return {
      signature: toB64(signature),
      bytes: toB64(bytes)
    };
  }

  getPublicKey(): PublicKey {
    // Create a complete PublicKey implementation with all required methods
    return {
      toSuiAddress: () => 'mock-sui-address',
      equals: (other: PublicKey) => false,
      flag: () => 0,
      toBytes: () => new Uint8Array(32).fill(1), 
      toString: () => 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
      toBase64: () => 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
      toSuiPublicKey: () => 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
      toRawBytes: () => new Uint8Array(32).fill(1),
      toSuiBytes: () => new Uint8Array([0, ...new Uint8Array(32).fill(1)]),
      verify: async (data: Uint8Array, signature: Uint8Array | string): Promise<boolean> => true,
      verifyWithIntent: async (data: Uint8Array, signature: Uint8Array | string, intent: IntentScope): Promise<boolean> => true,
      verifyPersonalMessage: async (message: Uint8Array, signature: Uint8Array | string): Promise<boolean> => true,
      verifyTransactionBlock: async (message: Uint8Array, signature: Uint8Array | string): Promise<boolean> => true,
      scheme: 'ED25519'
    } as unknown as PublicKey;
  }

  async signMessage(message: SerializedMessage): Promise<SignatureWithBytes> {
    const signature = await this.sign(message.messageBytes);
    return {
      signature: toB64(signature),
      bytes: toB64(message.messageBytes)
    };
  }

  async signPersonalMessage(bytes: Uint8Array): Promise<SignatureWithBytes> {
    const signature = await this.sign(bytes);
    return {
      signature: toB64(signature),
      bytes: toB64(bytes)
    };
  }

  async signWithIntent(bytes: Uint8Array, intent: IntentScope): Promise<SignatureWithBytes> {
    const signature = await this.sign(bytes);
    return {
      signature: toB64(signature),
      bytes: toB64(bytes)
    };
  }

  // Add signTransactionBlock method to match current Signer interface expectations
  async signTransactionBlock(bytes: Uint8Array): Promise<SignatureWithBytes> {
    const signature = await this.sign(bytes);
    return {
      signature: toB64(signature),
      bytes: toB64(bytes)
    };
  }

  getKeyScheme(): SignatureScheme {
    return 'ED25519' as SignatureScheme;
  }

  connect(client: SuiClient): MockKeystoreSigner {
    this._client = client;
    return this;
  }

  static fromPath(path: string): MockKeystoreSigner {
    return new MockKeystoreSigner();
  }
}