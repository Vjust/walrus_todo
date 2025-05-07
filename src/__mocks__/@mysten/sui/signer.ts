import { Signer } from '@mysten/sui.js/cryptography';
import { TransactionBlock } from '@mysten/sui.js/transactions';

export class SignerWithProvider extends Signer {
  constructor() {
    super();
  }

  async sign(data: Uint8Array): Promise<Uint8Array> {
    return Promise.resolve(new Uint8Array([1, 2, 3]));
  }

  async signPersonalMessage(message: Uint8Array): Promise<{ signature: string; bytes: string }> {
    return Promise.resolve({
      signature: 'mock-signature',
      bytes: 'mock-bytes'
    });
  }

  signWithIntent(message: Uint8Array, intent: any): Promise<{ signature: string; bytes: string }> {
    return Promise.resolve({
      signature: 'mock-signature',
      bytes: 'mock-bytes'
    });
  }

  getKeyScheme(): 'ED25519' | 'Secp256k1' {
    return 'ED25519';
  }

  connect(client: any): SignerWithProvider {
    return this;
  }

  signData(data: Uint8Array): Uint8Array {
    return new Uint8Array([1, 2, 3]);
  }

  signMessage(message: Uint8Array): Promise<{ signature: string; bytes: string }> {
    return Promise.resolve({
      signature: 'mock-signature',
      bytes: 'mock-bytes'
    });
  }

  signTransaction(transaction: Uint8Array): Promise<{ signature: string; bytes: string }> {
    return Promise.resolve({
      signature: 'mock-signature',
      bytes: 'mock-bytes'
    });
  }

  toSuiAddress(): string {
    return 'mock-sui-address';
  }

  getPublicKey(): any {
    return {
      toSuiAddress: () => 'mock-sui-address',
      verify: () => Promise.resolve(true)
    };
  }

  async signAndExecuteTransactionBlock(tx: TransactionBlock): Promise<{ digest: string; effects: any }> {
    return Promise.resolve({
      digest: 'mock-digest',
      effects: {
        status: { status: 'success' },
        created: [{ reference: { objectId: 'mock-object-id' } }]
      }
    });
  }
}