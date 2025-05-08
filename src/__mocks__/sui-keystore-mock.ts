import { Signer, SignatureScheme, IntentScope, SignatureWithBytes, PublicKey } from '@mysten/sui.js/cryptography';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';

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

  signData(data: Uint8Array): Uint8Array {
    // Return a mock signature without async
    return new Uint8Array(64).fill(1);
  }

  // Implement core Signer interface with synchronous return type
  sign(bytes: Uint8Array): Promise<Uint8Array> {
    // Return a Promise that resolves to a Uint8Array
    return Promise.resolve(this.signData(bytes));
  }
  
  // Add signTransaction as an extension method for TransactionBlock objects
  async signTransaction(transaction: TransactionBlock): Promise<SignatureWithBytes> {
    const bytes = await transaction.serialize();
    const signature = this.signData(new Uint8Array(Buffer.from(bytes, 'base64')));
    return {
      signature: Buffer.from(signature).toString('base64'),
      bytes: bytes
    };
  }

  getPublicKey(): PublicKey {
    // Create a function that returns a proper PublicKey implementation
    const createPublicKey = (): PublicKey => {
      return {
        toSuiAddress: () => 'mock-sui-address',
        equals: (other: PublicKey) => false,
        flag: () => 0, // Function that returns number
        toBytes: () => new Uint8Array(32).fill(1),
        toString: () => 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
        verify: async (data: Uint8Array, signature: Uint8Array | string): Promise<boolean> => true,
        verifyWithIntent: async (data: Uint8Array, signature: Uint8Array | string, intent: IntentScope): Promise<boolean> => true,
        // Fix property not assignable to type 'never'
        toSuiPublicKey: (): string => 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE='
      };
    };
    
    return createPublicKey();
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

  // Add signTransactionBlock method to match current Signer interface expectations
  async signTransactionBlock(bytes: Uint8Array): Promise<SignatureWithBytes> {
    const signature = await this.signData(bytes);
    return {
      signature: Buffer.from(signature).toString('base64'),
      bytes: Buffer.from(bytes).toString('base64')
    };
  }

  getKeyScheme(): SignatureScheme {
    return 'ED25519' as SignatureScheme;
  }

  connect(client: SuiClient): this & { client: SuiClient } {
    this._client = client;
    return this as this & { client: SuiClient };
  }

  static fromPath(path: string): MockKeystoreSigner {
    return new MockKeystoreSigner();
  }
}