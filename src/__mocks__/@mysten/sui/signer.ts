import { IntentScope, Signer, SignatureWithBytes } from '@mysten/sui.js/cryptography';
import { Ed25519PublicKey } from './cryptography/ed25519';
import { Transaction } from '@mysten/sui.js/transactions';
import { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui.js/client';
import { SignerAdapter } from '../../../utils/adapters/signer-adapter';
import type { TransactionBlockAdapter } from '../../../utils/adapters/transaction-adapter';

// Define a mock implementation that implements the SignerAdapter interface
// Ensure SignatureWithBytes uses Uint8Array for both signature and bytes properties
export class SignerWithProvider implements SignerAdapter {
  #publicKey: Ed25519PublicKey;
  // Add reference to client for connect() method
  private client: SuiClient | null = null;

  constructor() {
    this.#publicKey = new Ed25519PublicKey(new Uint8Array([1, 2, 3, 4]));
  }

  // Implement the adapter interface to access the underlying signer
  getUnderlyingSigner(): Signer {
    return this as unknown as Signer;
  }

  // Implementation matching Signer interface with correct return type
  async signData(data: Uint8Array): Promise<Uint8Array> {
    // Mock implementation returns a fixed signature array
    return new Uint8Array([1, 2, 3, 4, 5]);
  }

  async signTransaction(transaction: Transaction): Promise<SignatureWithBytes> {
    // Cast to required type - we're in a mock file so this is acceptable
    let txBlock = transaction;
      
    // Use string format as required by SignatureWithBytes interface
    return {
      signature: "mock-signature",
      bytes: "mock-bytes"
    };
  }

  async signPersonalMessage(message: Uint8Array): Promise<SignatureWithBytes> {
    // Use string format as required by SignatureWithBytes interface
    return {
      signature: "mock-signature",
      bytes: "mock-bytes"
    };
  }

  async signWithIntent(message: Uint8Array, intent: IntentScope | string): Promise<SignatureWithBytes> {
    // Use string format as required by SignatureWithBytes interface
    return {
      signature: "mock-signature",
      bytes: "mock-bytes"
    };
  }

  getKeyScheme(): 'ED25519' | 'Secp256k1' {
    return 'ED25519';
  }

  toSuiAddress(): string {
    // Return consistent mock address format matching Sui standards
    return '0x1234567890abcdef1234567890abcdef12345678';
  }

  getPublicKey(): Ed25519PublicKey {
    return this.#publicKey;
  }

  // Improved connect method with proper typing
  connect(client: SuiClient): SignerAdapter {
    this.client = client;
    return this;
  }
  
  // Implementation matching extended expectations with correct signature
  async signTransactionBlock(bytes: Uint8Array): Promise<SignatureWithBytes> {
    // Use string format as required by SignatureWithBytes interface
    return {
      signature: "mock-signature",
      bytes: "mock-bytes"
    };
  }

  // This is not part of the core Signer interface but is used in the codebase
  async signAndExecuteTransactionBlock(
    tx: Transaction,
    options?: { 
      requestType?: 'WaitForLocalExecution'; 
      showEffects?: boolean; 
      showObjectChanges?: boolean;
      showEvents?: boolean;
      showContent?: boolean;
      showBalanceChanges?: boolean;
    }
  ): Promise<SuiTransactionBlockResponse> {
    // Cast to the required type
    const txBlock = tx;
      
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