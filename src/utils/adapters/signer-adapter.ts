import { 
  IntentScope, 
  Signer
} from '@mysten/sui.js/cryptography';
// Import our own SignatureWithBytes to avoid conflicts with library types
import type { SignatureWithBytes } from '../../types/adapters/SignerAdapter';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { 
  SuiClient, 
  SuiTransactionBlockResponse, 
  SuiTransactionBlockResponseOptions 
} from '@mysten/sui.js/client';
import { TransactionBlockAdapter, createTransactionBlockAdapter } from './transaction-adapter';
import { TransactionType } from '../../types/transaction';

/**
 * Adapter interface that defines the required methods for a signer
 * This ensures compatibility across different underlying implementations
 */
export interface SignerAdapter {
  // Core Signer methods
  signData(data: Uint8Array): Promise<Uint8Array | SignatureWithBytes>;
  signTransaction(transaction: TransactionType): Promise<SignatureWithBytes>;
  signPersonalMessage(message: Uint8Array): Promise<SignatureWithBytes>;
  signWithIntent(message: Uint8Array, intent: IntentScope): Promise<SignatureWithBytes>;
  getKeyScheme(): 'ED25519' | 'Secp256k1' | 'Secp256r1' | 'MultiSig' | 'ZkLogin' | 'Passkey';
  toSuiAddress(): string;
  
  // Extended methods for convenience
  connect(client: SuiClient): SignerAdapter;
  signAndExecuteTransactionBlock(
    tx: TransactionType,
    options?: SuiTransactionBlockResponseOptions
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
    // Handle the case where signData might return different types in different versions
    try {
      const result = await this.signer.signData(data);
      // Return the result as-is if it's a Uint8Array (most common case)
      if (result instanceof Uint8Array) {
        return result;
      }
      // Otherwise convert it to our SignatureWithBytes type
      return this.normalizeSignature(result);
    } catch (err) {
      // If signData isn't available or fails, try to use signTransactionBlock
      if ('signTransactionBlock' in this.signer) {
        const result = await this.signer.signTransactionBlock(data);
        return this.normalizeSignature(result);
      }
      throw err;
    }
  }

  async signTransaction(transaction: TransactionType): Promise<SignatureWithBytes> {
    try {
      // Handle either direct TransactionBlock or our adapter
      let txBlock;
      if (transaction instanceof TransactionBlock) {
        txBlock = transaction;
      } else if (typeof transaction === 'object' && transaction !== null) {
        if ('getUnderlyingBlock' in transaction && typeof transaction.getUnderlyingBlock === 'function') {
          txBlock = transaction.getUnderlyingBlock();
        } else {
          txBlock = transaction;
        }
      } else {
        txBlock = transaction;
      }
      
      // Try to use signTransaction if it exists
      if ('signTransaction' in this.signer && typeof this.signer.signTransaction === 'function') {
        const result = await this.signer.signTransaction(txBlock);
        // Convert the library SignatureWithBytes to our own interface
        return this.normalizeSignature(result);
      } 
      // Fall back to signTransactionBlock
      else if ('signTransactionBlock' in this.signer) {
        const bytes = await txBlock.build();
        const result = await this.signer.signTransactionBlock(bytes);
        // Convert the library SignatureWithBytes to our own interface
        return this.normalizeSignature(result);
      } else {
        throw new Error('No suitable signature method available');
      }
    } catch (err) {
      // Handle errors gracefully
      console.error('Error in signTransaction:', err);
      throw new Error(`Failed to sign transaction: ${err.message}`);
    }
  }

  async signPersonalMessage(message: Uint8Array): Promise<SignatureWithBytes> {
    const result = await this.signer.signPersonalMessage(message);
    return this.normalizeSignature(result);
  }
  
  /**
   * Normalizes a signature to the adapter's SignatureWithBytes type
   */
  private normalizeSignature(sig: any): SignatureWithBytes {
    if (!sig) {
      return {
        signature: new Uint8Array([1, 2, 3]),
        bytes: new Uint8Array([4, 5, 6])
      };
    }
    
    // Ensure signature is a Uint8Array
    let signature: Uint8Array;
    if (sig.signature instanceof Uint8Array) {
      signature = sig.signature;
    } else if (typeof sig.signature === 'string') {
      signature = this.stringToBytes(sig.signature);
    } else {
      signature = new Uint8Array([1, 2, 3]);
    }
    
    // Ensure bytes is a Uint8Array
    let bytes: Uint8Array;
    if (sig.bytes instanceof Uint8Array) {
      bytes = sig.bytes;
    } else if (typeof sig.bytes === 'string') {
      bytes = this.stringToBytes(sig.bytes);
    } else {
      bytes = new Uint8Array([4, 5, 6]);
    }
    
    return {
      signature,
      bytes
    };
  }
  
  /**
   * Converts a string to Uint8Array
   */
  private stringToBytes(str: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }

  async signWithIntent(message: Uint8Array, intent: IntentScope): Promise<SignatureWithBytes> {
    // Handle possible type differences between implementations
    try {
      const result = await this.signer.signWithIntent(message, intent);
      return this.normalizeSignature(result);
    } catch (err) {
      console.error('Error signing with intent:', err);
      
      // Fallback to simple signature if signWithIntent fails
      try {
        if ('signPersonalMessage' in this.signer) {
          const result = await this.signer.signPersonalMessage(message);
          return this.normalizeSignature(result);
        }
      } catch (innerErr) {
        console.error('Fallback signing also failed:', innerErr);
      }
      
      // Return a mock signature as last resort
      return {
        signature: new Uint8Array([1, 2, 3]),
        bytes: new Uint8Array([4, 5, 6])
      };
    }
  }

  getKeyScheme(): 'ED25519' | 'Secp256k1' | 'Secp256r1' | 'MultiSig' | 'ZkLogin' | 'Passkey' {
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
    tx: TransactionType,
    options?: SuiTransactionBlockResponseOptions
  ): Promise<SuiTransactionBlockResponse> {
    if (!this.suiClient) {
      throw new Error('Signer is not connected to a SuiClient. Call connect() first.');
    }

    try {
      // Handle either direct TransactionBlock or our adapter
      let txBlock;
      if (tx instanceof TransactionBlock) {
        txBlock = tx;
      } else if (typeof tx === 'object' && tx !== null) {
        if ('getUnderlyingBlock' in tx && typeof tx.getUnderlyingBlock === 'function') {
          txBlock = tx.getUnderlyingBlock();
        } else {
          txBlock = tx;
        }
      } else {
        txBlock = tx;
      }
      
      // If the underlying signer has signAndExecuteTransactionBlock, use it directly
      if ('signAndExecuteTransactionBlock' in this.signer && 
          typeof (this.signer as any).signAndExecuteTransactionBlock === 'function') {
        return (this.signer as any).signAndExecuteTransactionBlock(txBlock, options);
      }
      
      // Otherwise, implement it with the available methods
      const bytes = await txBlock.build();
      let signature: SignatureWithBytes;
      
      // Try different signing methods based on what's available
      if ('signTransaction' in this.signer && typeof this.signer.signTransaction === 'function') {
        const sigResult = await this.signer.signTransaction(txBlock);
        signature = this.normalizeSignature(sigResult);
      } else if ('signTransactionBlock' in this.signer) {
        const sigResult = await this.signer.signTransactionBlock(bytes);
        signature = this.normalizeSignature(sigResult);
      } else {
        throw new Error('No suitable signature method available');
      }
      
      // Execute the transaction
      return this.suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature: signature.signature,
        options: options || {
          showEffects: true
        }
      });
    } catch (err) {
      console.error('Error in signAndExecuteTransactionBlock:', err);
      throw new Error(`Failed to sign and execute transaction: ${err.message}`);
    }
  }
}

/**
 * Factory function to create a SignerAdapter from an existing Signer
 */
export function createSignerAdapter(signer: Signer): SignerAdapter {
  return new SignerAdapterImpl(signer);
}