import { Signer, SignatureScheme, toSerializedSignature } from '@mysten/sui.js/cryptography';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { SuiClient } from '@mysten/sui.js/client';
import { IntentScope } from '@mysten/sui.js/cryptography';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SerializedMessage } from '@mysten/sui.js/cryptography/keystore';

export class MockKeystoreSigner extends Signer {
  private keypair: Ed25519Keypair;
  private _client?: SuiClient;

  constructor(client?: SuiClient) {
    super();
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

  async sign(transaction: TransactionBlock): Promise<string> {
    const bytes = await transaction.serialize();
    const signature = await this.signData(bytes);
    return toSerializedSignature({
      signature,
      signatureScheme: this.getKeyScheme(),
      publicKey: this.getPublicKey()
    });
  }

  getPublicKey(): Ed25519Keypair['publicKey'] {
    return this.keypair.getPublicKey();
  }

  override async signTransaction(bytes: Uint8Array): Promise<string> {
    const signature = await this.signData(bytes);
    return toSerializedSignature({
      signature,
      signatureScheme: this.getKeyScheme(),
      publicKey: this.getPublicKey()
    });
  }

  connect(client: SuiClient): this & { client: SuiClient } {
    this._client = client;
    return this as this & { client: SuiClient };
  }

  override async signMessage(message: SerializedMessage): Promise<string> {
    const signature = await this.signData(message.messageBytes);
    return toSerializedSignature({
      signature,
      signatureScheme: this.getKeyScheme(),
      publicKey: this.getPublicKey()
    });
  }

  override async signPersonalMessage(message: SerializedMessage): Promise<string> {
    return this.signMessage(message);
  }

  override async signWithIntent(message: Uint8Array, intent: IntentScope): Promise<string> {
    return this.signMessage({ messageBytes: message });
  }

  override getKeyScheme(): SignatureScheme {
    return 'ED25519';
  }

  static fromPath(path: string): MockKeystoreSigner {
    return new MockKeystoreSigner();
  }
}