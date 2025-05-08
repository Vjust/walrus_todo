import { Signer, SignatureScheme, toSerializedSignature, IntentScope, SignatureWithBytes, PublicKey } from '@mysten/sui.js/cryptography';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { SuiClient } from '@mysten/sui.js/client';
import { Transaction } from '@mysten/sui.js/transactions';

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

  async signData(data: Uint8Array): Promise<Uint8Array> {
    // Return a mock signature
    return new Uint8Array(64).fill(1);
  }

  // Implement both versions of sign for compatibility
  async sign(bytesOrTransaction: Uint8Array | Transaction): Promise<Uint8Array | SignatureWithBytes> {
    if (bytesOrTransaction instanceof Uint8Array) {
      // Standard Signer interface expects Uint8Array
      return this.signData(bytesOrTransaction);
    } else {
      // TransactionBlock version
      const bytes = await bytesOrTransaction.serialize();
      const signature = await this.signData(new Uint8Array(bytes));
      return {
        signature: Buffer.from(signature).toString('base64'),
        bytes: Buffer.from(bytes).toString('base64')
      };
    }
  }

  getPublicKey(): PublicKey {
    return {
      toSuiAddress: () => 'mock-sui-address',
      equals: () => false,
      flag: 0 as number,
      toBytes: () => new Uint8Array(32).fill(1),
      toBase64: () => 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
      toString: () => 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
      verify: async (_data: Uint8Array, _signature: Uint8Array | string): Promise<boolean> => true,
      verifyWithIntent: async (_data: Uint8Array, _signature: Uint8Array | string, _intent: IntentScope): Promise<boolean> => true,
      toSuiPublicKey: () => 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE='
    };
  }

  async signMessage(message: SerializedMessage): Promise<SignatureWithBytes> {
    const signature = await this.signData(message.messageBytes);
    return {
      signature: Buffer.from(signature).toString('base64'),
      bytes: Buffer.from(message.messageBytes).toString('base64')
    };
  }

  async signPersonalMessage(bytes: Uint8Array): Promise<SignatureWithBytes> {
    const signature = await this.signData(bytes);
    return {
      signature: Buffer.from(signature).toString('base64'),
      bytes: Buffer.from(bytes).toString('base64')
    };
  }

  async signWithIntent(bytes: Uint8Array, intent: IntentScope): Promise<SignatureWithBytes> {
    const signature = await this.signData(bytes);
    return {
      signature: Buffer.from(signature).toString('base64'),
      bytes: Buffer.from(bytes).toString('base64')
    };
  }

  getKeyScheme(): SignatureScheme {
    return 'ED25519';
  }

  connect(client: SuiClient): this & { client: SuiClient } {
    this._client = client;
    return this as this & { client: SuiClient };
  }

  static fromPath(path: string): MockKeystoreSigner {
    return new MockKeystoreSigner();
  }
}