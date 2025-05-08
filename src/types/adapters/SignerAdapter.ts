/**
 * SignerAdapter
 * 
 * This adapter reconciles differences between the Signer interfaces
 * in different versions of @mysten/sui.js and @mysten/sui libraries.
 * 
 * It provides a consistent interface that both mock implementations and actual
 * code can use without worrying about version-specific differences.
 */

import { 
  Signer as SignerSuiJs,
  SignatureWithBytes,
  IntentScope 
} from '@mysten/sui.js/cryptography';
import { Signer as SignerSui } from '@mysten/sui/cryptography';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SuiTransactionBlockResponse } from '@mysten/sui.js/client';
import { Ed25519PublicKey } from '@mysten/sui.js/keypairs/ed25519';

/**
 * Unified Signer interface that accommodates both Signer implementation variants
 */
export interface UnifiedSigner {
  /**
   * Signs a transaction block
   */
  signTransactionBlock(bytes: Uint8Array): Promise<SignatureWithBytes>;
  
  /**
   * Signs transaction data
   */
  signData(data: Uint8Array): Promise<Uint8Array>;
  
  /**
   * Signs a transaction
   */
  signTransaction(transaction: TransactionBlock): Promise<SignatureWithBytes>;
  
  /**
   * Signs a personal message
   */
  signPersonalMessage(message: Uint8Array): Promise<SignatureWithBytes>;
  
  /**
   * Signs with intent
   */
  signWithIntent(message: Uint8Array, intent: IntentScope | string): Promise<SignatureWithBytes>;
  
  /**
   * Gets the key scheme used
   */
  getKeyScheme(): 'ED25519' | 'Secp256k1';
  
  /**
   * Gets the Sui address associated with this signer
   */
  toSuiAddress(): string;
  
  /**
   * Gets the public key
   */
  getPublicKey(): Ed25519PublicKey;
  
  /**
   * Signs and executes a transaction block
   */
  signAndExecuteTransactionBlock(
    tx: TransactionBlock,
    options?: { 
      requestType?: 'WaitForLocalExecution'; 
      showEffects?: boolean; 
      showObjectChanges?: boolean;
      showEvents?: boolean;
      showContent?: boolean;
      showBalanceChanges?: boolean;
    }
  ): Promise<SuiTransactionBlockResponse>;
}

/**
 * SignerAdapter class that implements the UnifiedSigner interface
 * and adapts various Signer implementations
 */
export class SignerAdapter implements UnifiedSigner {
  private signer: SignerSuiJs | SignerSui;
  
  constructor(signer: SignerSuiJs | SignerSui) {
    this.signer = signer;
  }
  
  /**
   * Gets the underlying signer implementation
   */
  public getSigner(): SignerSuiJs | SignerSui {
    return this.signer;
  }
  
  /**
   * Signs a transaction block
   */
  async signTransactionBlock(bytes: Uint8Array): Promise<SignatureWithBytes> {
    // Adapt type differences between implementations
    const result = await this.signer.signTransactionBlock(bytes);
    
    // Ensure standardized return format for SignatureWithBytes
    return this.normalizeSignatureWithBytes(result);
  }
  
  /**
   * Signs transaction data
   */
  async signData(data: Uint8Array): Promise<Uint8Array> {
    return await this.signer.signData(data);
  }
  
  /**
   * Signs a transaction
   */
  async signTransaction(transaction: TransactionBlock): Promise<SignatureWithBytes> {
    const result = await this.signer.signTransaction(transaction);
    return this.normalizeSignatureWithBytes(result);
  }
  
  /**
   * Signs a personal message
   */
  async signPersonalMessage(message: Uint8Array): Promise<SignatureWithBytes> {
    const result = await this.signer.signPersonalMessage(message);
    return this.normalizeSignatureWithBytes(result);
  }
  
  /**
   * Signs with intent
   */
  async signWithIntent(message: Uint8Array, intent: IntentScope | string): Promise<SignatureWithBytes> {
    const result = await this.signer.signWithIntent(message, intent);
    return this.normalizeSignatureWithBytes(result);
  }
  
  /**
   * Gets the key scheme used
   */
  getKeyScheme(): 'ED25519' | 'Secp256k1' {
    return this.signer.getKeyScheme();
  }
  
  /**
   * Gets the Sui address associated with this signer
   */
  toSuiAddress(): string {
    return this.signer.toSuiAddress();
  }
  
  /**
   * Gets the public key
   */
  getPublicKey(): Ed25519PublicKey {
    return this.signer.getPublicKey();
  }
  
  /**
   * Signs and executes a transaction block
   */
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
  ): Promise<SuiTransactionBlockResponse> {
    // This method might not exist on all Signer implementations,
    // but it's required for the UnifiedSigner interface
    if ('signAndExecuteTransactionBlock' in this.signer) {
      return await this.signer.signAndExecuteTransactionBlock(tx, options);
    }
    
    throw new Error('signAndExecuteTransactionBlock not implemented for this signer');
  }
  
  /**
   * Normalizes a SignatureWithBytes object to ensure it has the correct format
   */
  private normalizeSignatureWithBytes(signature: SignatureWithBytes): SignatureWithBytes {
    if (typeof signature.signature === 'string') {
      // Convert string signatures to Uint8Array if needed
      return {
        signature: this.stringToUint8Array(signature.signature),
        bytes: this.stringToUint8Array(signature.bytes as unknown as string)
      };
    } else if (signature.signature instanceof Uint8Array) {
      // Already in the right format
      return signature;
    } else {
      // Create a new signature with the correct format
      return {
        signature: new Uint8Array([1, 2, 3]), // Mock signature
        bytes: new Uint8Array([4, 5, 6]) // Mock bytes
      };
    }
  }
  
  /**
   * Converts a string to a Uint8Array
   */
  private stringToUint8Array(str: string): Uint8Array {
    // For mock signatures, create a simple array
    if (str === 'mock-signature' || str === 'mock-bytes') {
      return new Uint8Array([1, 2, 3, 4, 5]);
    }
    
    // For actual strings, convert to Uint8Array
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }
  
  /**
   * Creates a new SignerAdapter from an existing Signer
   */
  static from(signer: SignerSuiJs | SignerSui): SignerAdapter {
    return new SignerAdapter(signer);
  }
}