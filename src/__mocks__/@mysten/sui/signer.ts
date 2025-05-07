import { IntentScope, Signer } from '@mysten/sui.js/cryptography';
import { Ed25519PublicKey } from './cryptography/ed25519';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SuiClient, TransactionEffects } from '@mysten/sui.js/client';

// Define a more complete type that better matches what the library expects
export class SignerWithProvider implements Signer {
  #publicKey: Ed25519PublicKey;
  // Add reference to client for connect() method
  private client: SuiClient | null = null;

  constructor() {
    this.#publicKey = new Ed25519PublicKey(new Uint8Array([1, 2, 3, 4]));
  }

  async signData(data: Uint8Array): Promise<Uint8Array> {
    // Mock implementation returns a fixed signature
    return new Uint8Array([1, 2, 3, 4]);
  }

  async signTransaction(transaction: TransactionBlock): Promise<{ signature: string; bytes: string }> {
    return {
      signature: 'mock-signature',
      bytes: 'mock-serialized-tx-bytes'
    };
  }

  async signPersonalMessage(message: Uint8Array): Promise<Uint8Array> {
    // Mock implementation returns a fixed signature
    return new Uint8Array([1, 2, 3, 4]);
  }

  async signWithIntent(message: Uint8Array, intent: IntentScope): Promise<Uint8Array> {
    // Mock implementation returns a fixed signature
    return new Uint8Array([1, 2, 3, 4]);
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

  // Improved connect method with proper typing
  connect(client: SuiClient): SignerWithProvider {
    this.client = client;
    return this;
  }
  
  async signTransactionBlock(transactionBlock: Uint8Array): Promise<Uint8Array> {
    // Mock implementation returns a fixed signature
    return new Uint8Array([1, 2, 3, 4]);
  }

  // Properly typed options parameter
  async signAndExecuteTransactionBlock(
    tx: TransactionBlock,
    options?: { 
      requestType?: 'WaitForLocalExecution'; 
      showEffects?: boolean; 
      showObjectChanges?: boolean;
      showEvents?: boolean;
      showContent?: boolean;
      showBalanceChanges?: boolean;
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