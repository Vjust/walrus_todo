import { IntentScope, Signer } from '@mysten/sui.js/cryptography';
import { Ed25519PublicKey } from './cryptography/ed25519';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { TransactionEffects } from '@mysten/sui.js/client';

export class SignerWithProvider implements Signer {
  #publicKey: Ed25519PublicKey;

  constructor() {
    this.#publicKey = new Ed25519PublicKey(new Uint8Array([1, 2, 3, 4]));
  }

  // @ts-ignore - Interface compatibility issue
  async signData(data: Uint8Array): Promise<{ signature: string; bytes: string }> {
    return {
      signature: Buffer.from([1, 2, 3, 4]).toString('base64'),
      bytes: Buffer.from(data).toString('base64')
    };
  }

  // @ts-ignore - Interface compatibility issue
  async signTransaction(transaction: TransactionBlock): Promise<{ signature: string; bytes: string }> {
    return {
      signature: 'mock-signature',
      bytes: 'mock-serialized-tx-bytes'
    };
  }

  // @ts-ignore - Interface compatibility issue
  async signPersonalMessage(message: Uint8Array): Promise<{ signature: string; bytes: string }> {
    return {
      signature: 'mock-signature',
      bytes: Buffer.from(message).toString('base64')
    };
  }

  // @ts-ignore - Interface compatibility issue
  async signWithIntent(message: Uint8Array, intent: IntentScope): Promise<{ signature: string; bytes: string }> {
    return {
      signature: Buffer.from([1, 2, 3, 4]).toString('base64'),
      bytes: Buffer.from(message).toString('base64')
    };
  }

  getKeyScheme(): 'ED25519' | 'Secp256k1' {
    return 'ED25519';
  }

  toSuiAddress(): string {
    return this.#publicKey.toSuiAddress();
  }

  getPublicKey(): Ed25519PublicKey {
    return this.#publicKey;
  }

  // @ts-ignore - Interface compatibility issue
  connect(client: any): SignerWithProvider {
    return this;
  }
  
  // @ts-ignore - Interface compatibility issue
  async signTransactionBlock(transactionBlock: Uint8Array): Promise<{ signature: string; bytes: string }> {
    return {
      signature: Buffer.from([1, 2, 3, 4]).toString('base64'),
      bytes: Buffer.from(transactionBlock).toString('base64')
    };
  }

  async signAndExecuteTransactionBlock(
    tx: TransactionBlock,
    options?: { 
      requestType?: 'WaitForLocalExecution'; 
      showEffects?: boolean; 
      showObjectChanges?: boolean 
    }
  ): Promise<{
    digest: string;
    effects: TransactionEffects;
    confirmedLocalExecution: boolean;
    timestampMs: null;
    checkpoint: null;
    events: any[];
    objectChanges: any[];
    balanceChanges: any[];
  }> {
    return {
      digest: 'mock-digest',
      effects: {
        messageVersion: 'v1',
        status: { status: 'success' },
        executedEpoch: '0',
        transactionDigest: 'mock-digest',
        created: [{ 
          owner: { AddressOwner: 'mock-address' },
          reference: {
            objectId: 'mock-object-id',
            digest: 'mock-digest',
            version: '1'
          }
        }],
        gasObject: { 
          owner: { AddressOwner: 'mock-address' },
          reference: {
            objectId: 'mock-object-id',
            digest: 'mock-digest',
            version: '1'
          }
        },
        gasUsed: {
          computationCost: '1000',
          storageCost: '1000',
          storageRebate: '0',
          nonRefundableStorageFee: '10'
        },
        dependencies: [],
        sharedObjects: [],
        mutated: [],
        deleted: [],
        unwrapped: [],
        wrapped: [],
        eventsDigest: null
      },
      confirmedLocalExecution: true,
      timestampMs: null,
      checkpoint: null,
      events: [],
      objectChanges: [],
      balanceChanges: []
    };
  }
}