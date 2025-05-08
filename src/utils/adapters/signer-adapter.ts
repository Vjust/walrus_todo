import { IntentScope, Signer, SignatureWithBytes } from '@mysten/sui.js/cryptography';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui.js/client';
import { TransactionBlockAdapter, createTransactionBlockAdapter } from './transaction-adapter';

/**
 * Adapter interface that defines the required methods for a signer
 * This ensures compatibility across different underlying implementations
 */
export interface SignerAdapter {
  // Core Signer methods
  signData(data: Uint8Array): Promise<Uint8Array | SignatureWithBytes>;
  signTransaction(transaction: TransactionBlock | TransactionBlockAdapter): Promise<SignatureWithBytes>;
  signPersonalMessage(message: Uint8Array): Promise<SignatureWithBytes>;
  signWithIntent(message: Uint8Array, intent: IntentScope | string): Promise<SignatureWithBytes>;
  getKeyScheme(): 'ED25519' | 'Secp256k1';
  toSuiAddress(): string;
  
  // Extended methods for convenience
  connect(client: SuiClient): SignerAdapter;
  signAndExecuteTransactionBlock(
    tx: TransactionBlock | TransactionBlockAdapter,
    options?: { 
      requestType?: 'WaitForLocalExecution'; 
      showEffects?: boolean; 
      showObjectChanges?: boolean;
      showEvents?: boolean;
      showContent?: boolean;
      showBalanceChanges?: boolean;
    }
  ): Promise<SuiTransactionBlockResponse>;
  
  // Access to the underlying signer
  getUnderlyingSigner(): Signer;
}

/**
 * Implementation of the SignerAdapter that wraps a real Signer
 * This handles any necessary conversions between interfaces
 */
export class SignerAdapterImpl implements SignerAdapter {
  private signer: Signer;
  private suiClient: SuiClient | null = null;

  constructor(signer: Signer) {
    this.signer = signer;
  }

  getUnderlyingSigner(): Signer {
    return this.signer;
  }

  async signData(data: Uint8Array): Promise<Uint8Array | SignatureWithBytes> {
    return this.signer.signData(data);
  }

  async signTransaction(transaction: TransactionBlock | TransactionBlockAdapter): Promise<SignatureWithBytes> {
    // Handle either direct TransactionBlock or our adapter
    const txBlock = transaction instanceof TransactionBlock 
      ? transaction 
      : (transaction as TransactionBlockAdapter).getUnderlyingBlock();
    
    return this.signer.signTransaction(txBlock);
  }

  async signPersonalMessage(message: Uint8Array): Promise<SignatureWithBytes> {
    return this.signer.signPersonalMessage(message);
  }

  async signWithIntent(message: Uint8Array, intent: IntentScope | string): Promise<SignatureWithBytes> {
    return this.signer.signWithIntent(message, intent);
  }

  getKeyScheme(): 'ED25519' | 'Secp256k1' {
    return this.signer.getKeyScheme();
  }

  toSuiAddress(): string {
    return this.signer.toSuiAddress();
  }

  connect(client: SuiClient): SignerAdapter {
    this.suiClient = client;
    // If the underlying signer has a connect method, call it
    if ('connect' in this.signer && typeof (this.signer as any).connect === 'function') {
      (this.signer as any).connect(client);
    }
    return this;
  }

  async signAndExecuteTransactionBlock(
    tx: TransactionBlock | TransactionBlockAdapter,
    options?: { 
      requestType?: 'WaitForLocalExecution'; 
      showEffects?: boolean; 
      showObjectChanges?: boolean;
      showEvents?: boolean;
      showContent?: boolean;
      showBalanceChanges?: boolean;
    }
  ): Promise<SuiTransactionBlockResponse> {
    if (!this.suiClient) {
      throw new Error('Signer is not connected to a SuiClient. Call connect() first.');
    }

    // Handle either direct TransactionBlock or our adapter
    const txBlock = tx instanceof TransactionBlock 
      ? tx 
      : (tx as TransactionBlockAdapter).getUnderlyingBlock();
    
    // If the underlying signer has signAndExecuteTransactionBlock, use it directly
    if ('signAndExecuteTransactionBlock' in this.signer && 
        typeof (this.signer as any).signAndExecuteTransactionBlock === 'function') {
      return (this.signer as any).signAndExecuteTransactionBlock(txBlock, options);
    }
    
    // Otherwise, implement it with the available methods
    const bytes = await txBlock.build();
    const signature = await this.signer.signTransaction(txBlock);
    
    return this.suiClient.executeTransactionBlock({
      transactionBlock: bytes,
      signature: signature.signature,
      options: {
        showEffects: options?.showEffects ?? true,
        showEvents: options?.showEvents,
        showObjectChanges: options?.showObjectChanges,
        showBalanceChanges: options?.showBalanceChanges,
        showContent: options?.showContent
      }
    });
  }
}

/**
 * Factory function to create a SignerAdapter from an existing Signer
 */
export function createSignerAdapter(signer: Signer): SignerAdapter {
  return new SignerAdapterImpl(signer);
}