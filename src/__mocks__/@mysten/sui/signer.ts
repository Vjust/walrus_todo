import { IntentScope, Signer } from '@mysten/sui/cryptography';
import { Ed25519PublicKey } from './cryptography/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui/client';
import { SignerAdapter } from '../../../types/adapters/SignerAdapter';
import { SignatureWithBytes } from '../../../types/adapters/SignerAdapter';
import { SuiSDKVersion } from '../../../types/adapters/SignerAdapter';
import { TransactionType } from '../../../types/transaction';
import { toB64 } from '@mysten/sui/utils';

// Define a mock implementation that implements the SignerAdapter interface
// Ensure SignatureWithBytes uses Uint8Array for both signature and bytes properties
export class SignerWithProvider implements Omit<SignerAdapter, 'getClient' | 'getAddress'> {
  #publicKey: Ed25519PublicKey;
  // Add reference to client for connect() method
  private client: SuiClient | null = null;
  private _isDisposed = false;

  constructor() {
    this.#publicKey = new Ed25519PublicKey(new Uint8Array([1, 2, 3, 4]));
  }

  // Implement the adapter interface to access the underlying signer
  getUnderlyingImplementation(): Signer {
    this.checkDisposed();
    return this as unknown as Signer;
  }

  // Alias for backward compatibility
  getUnderlyingSigner(): Signer {
    return this.getUnderlyingImplementation();
  }

  // Implementation matching Signer interface with correct return type
  async signData(_data: Uint8Array): Promise<Uint8Array> {
    this.checkDisposed();
    // Mock implementation returns a fixed signature array
    return new Uint8Array([1, 2, 3, 4, 5]);
  }

  async signTransaction(_transaction: TransactionType): Promise<SignatureWithBytes> {
    this.checkDisposed();
    // Cast to required type - we're in a mock file so this is acceptable

    // Convert to base64 strings as required by SignatureWithBytes interface
    return {
      signature: toB64(new Uint8Array([1, 2, 3, 4, 5])),
      bytes: toB64(new Uint8Array([6, 7, 8, 9, 10]))
    };
  }

  async signPersonalMessage(_message: Uint8Array): Promise<SignatureWithBytes> {
    this.checkDisposed();
    // Convert to base64 strings as required by SignatureWithBytes interface
    return {
      signature: toB64(new Uint8Array([1, 2, 3, 4, 5])),
      bytes: toB64(new Uint8Array([6, 7, 8, 9, 10]))
    };
  }

  async signWithIntent(_message: Uint8Array, _intent: IntentScope): Promise<SignatureWithBytes> {
    this.checkDisposed();
    // Convert to base64 strings as required by SignatureWithBytes interface
    return {
      signature: toB64(new Uint8Array([1, 2, 3, 4, 5])),
      bytes: toB64(new Uint8Array([6, 7, 8, 9, 10]))
    };
  }

  getKeyScheme(): 'ED25519' | 'Secp256k1' | 'Secp256r1' | 'MultiSig' | 'ZkLogin' | 'Passkey' {
    this.checkDisposed();
    return 'ED25519';
  }

  toSuiAddress(): string {
    this.checkDisposed();
    // Return consistent mock address format matching Sui standards
    return '0x1234567890abcdef1234567890abcdef12345678';
  }

  getPublicKey(): Ed25519PublicKey {
    this.checkDisposed();
    return this.#publicKey;
  }

  // Improved connect method with proper typing
  connect(client: SuiClient): unknown {
    this.checkDisposed();
    this.client = client;
    return this;
  }

  // Add missing methods required by the interface
  getClient(): SuiClient {
    if (!this.client) {
      throw new Error('No client connected');
    }
    return this.client;
  }

  async getAddress(): Promise<string> {
    return this.toSuiAddress();
  }

  // Implementation matching extended expectations with correct signature
  async signTransactionBlock(_bytes: Uint8Array): Promise<SignatureWithBytes> {
    this.checkDisposed();
    // Return base64 strings as required by SignatureWithBytes interface
    return {
      signature: toB64(new Uint8Array([1, 2, 3, 4, 5])),
      bytes: toB64(new Uint8Array([6, 7, 8, 9, 10]))
    };
  }

  // This is not part of the core Signer interface but is used in the codebase
  async signAndExecuteTransaction(
    _tx: Transaction,
    _options?: {
      requestType?: 'WaitForLocalExecution';
      showEffects?: boolean;
      showObjectChanges?: boolean;
      showEvents?: boolean;
      showContent?: boolean;
      showBalanceChanges?: boolean;
    }
  ): Promise<SuiTransactionBlockResponse> {
    this.checkDisposed();
    // Cast to the required type

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

  // Get the SDK version
  getSDKVersion(): SuiSDKVersion {
    this.checkDisposed();
    return SuiSDKVersion.VERSION_3; // Mock as the latest version
  }

  // Dispose resources
  async dispose(): Promise<void> {
    if (this._isDisposed) return;

    try {
      // Release any connections
      this.client = null;
      this._isDisposed = true;
    } catch (error) {
      process.stderr.write(`Error disposing SignerWithProvider: ${error}\n`);
    }
  }

  // Check if disposed
  isDisposed(): boolean {
    return this._isDisposed;
  }

  // Utility to check if disposed and throw if needed
  private checkDisposed(): void {
    if (this._isDisposed) {
      throw new Error('Cannot perform operations on a disposed adapter');
    }
  }
}