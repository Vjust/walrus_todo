/**
 * Signer Adapter Implementation
 *
 * This module provides a concrete implementation of the SignerAdapter
 * interface for the @mysten/sui.js library. It handles the complexities of
 * working with different Sui SDK versions in a type-safe manner.
 *
 * Key features:
 * - Strong type-checking with custom type guards
 * - Consistent error handling with specific error types
 * - Protection against API changes in underlying libraries
 * - Robust fallback mechanisms for version compatibility
 * - Proper detection of SDK versions for optimized method selection
 * - Resource management with proper cleanup
 */

import {
  IntentScope,
  Signer,
  PublicKey
} from '@mysten/sui.js/cryptography';
// Import from the type definition file
import {
  SignatureWithBytes,
  hasSignTransactionBlock,
  hasSignTransaction,
  hasGetPublicKey,
  hasSignAndExecuteTransactionBlock,
  hasSignData,
  hasSignPersonalMessage,
  hasConnect,
  SignerAdapterError,
  isValidSigner,
  detectSDKVersion,
  normalizeSignature,
  stringToBytes,
  isSignerAdapter,
  SuiSDKVersion
} from '../../types/adapters/SignerAdapter';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import {
  SuiClient,
  SuiTransactionBlockResponse,
  SuiTransactionBlockResponseOptions
} from '@mysten/sui.js/client';
import { TransactionType } from '../../types/transaction';
import {
  isTransactionBlockSui
} from '../../types/adapters/TransactionBlockAdapter';
import { BaseAdapter } from '../../types/adapters/BaseAdapter';
import { SignerAdapter } from '../../types/adapters/SignerAdapter';

/**
 * Extract the actual TransactionBlock from different possible input types
 */
function extractTransactionBlock(tx: TransactionType): TransactionBlock {
  if (isTransactionBlockSui(tx)) {
    return tx;
  } else if (tx && typeof tx === 'object' && 'getUnderlyingImplementation' in tx &&
            typeof (tx as any).getUnderlyingImplementation === 'function') {
    try {
      const block = (tx as any).getUnderlyingImplementation();
      if (isTransactionBlockSui(block)) {
        return block;
      }
    } catch (error) {
      throw new SignerAdapterError(
        `Failed to extract a valid TransactionBlock from adapter: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }
  throw new SignerAdapterError(`Unsupported transaction type: ${typeof tx}`);
}

/**
 * Implementation of the SignerAdapter that wraps a real Signer
 */
export class SignerAdapterImpl implements SignerAdapter {
  private signer: Signer;
  private suiClient: SuiClient | null = null;
  private sdkVersion: SuiSDKVersion;
  private _isDisposed = false;

  constructor(signer: Signer) {
    if (!isValidSigner(signer)) {
      throw new SignerAdapterError('Invalid signer provided to SignerAdapter');
    }
    this.signer = signer;
    this.sdkVersion = detectSDKVersion(signer);
  }

  /**
   * Gets the detected SDK version
   * @throws SignerAdapterError if the adapter has been disposed
   */
  getSDKVersion(): SuiSDKVersion {
    this.checkDisposed();
    return this.sdkVersion;
  }

  /**
   * Returns the underlying signer implementation
   * @throws SignerAdapterError if the adapter has been disposed
   */
  getUnderlyingImplementation(): Signer {
    this.checkDisposed();
    return this.signer;
  }
  
  /**
   * Alias for getUnderlyingImplementation to maintain backward compatibility
   * @deprecated Use getUnderlyingImplementation() instead
   */
  getUnderlyingSigner(): Signer {
    return this.getUnderlyingImplementation();
  }
  
  /**
   * Checks if the adapter has been disposed
   * @returns true if the adapter has been disposed
   */
  isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Disposes the adapter, releasing any resources
   * This method is idempotent and can be called multiple times
   */
  async dispose(): Promise<void> {
    if (this._isDisposed) return;
    
    try {
      // Release any connections or clean up resources
      this.suiClient = null;
      
      // Any signer-specific cleanup
      if (typeof (this.signer as any).disconnect === 'function') {
        try {
          await (this.signer as any).disconnect();
        } catch (error) {
          console.warn('Error during signer disconnect:', error);
        }
      }
      
      this._isDisposed = true;
    } catch (error) {
      throw new SignerAdapterError(
        `Failed to dispose SignerAdapter: ${error instanceof Error ? error.message : String(error)}`, 
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Utility method to check if the adapter is disposed and throw if it is
   * @throws SignerAdapterError if the adapter has been disposed
   */
  private checkDisposed(): void {
    if (this._isDisposed) {
      throw new SignerAdapterError('Cannot perform operations on a disposed adapter');
    }
  }

  /**
   * Signs data with the appropriate method based on the detected SDK version
   * @throws SignerAdapterError if the adapter has been disposed or signing fails
   */
  async signData(data: Uint8Array): Promise<Uint8Array> {
    this.checkDisposed();
    
    if (hasSignData(this.signer)) {
      try {
        const result = await this.signer.signData(data);
        
        // Handle different return types based on SDK version
        if (result instanceof Uint8Array) {
          return result;
        }
        
        // If it returned an object with signature information, extract the signature
        const normalized = normalizeSignature(result);
        return normalized.signature;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        
        // Try alternative signing methods as fallback
        if (hasSignTransactionBlock(this.signer)) {
          console.warn('Falling back to signTransactionBlock for data signing');
          try {
            const result = await this.signer.signTransactionBlock(data);
            return normalizeSignature(result).signature;
          } catch (fallbackErr) {
            throw new SignerAdapterError(
              `Fallback signing also failed: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`,
              fallbackErr instanceof Error ? fallbackErr : undefined
            );
          }
        }
        
        throw new SignerAdapterError(`Failed to sign data: ${error.message}`, error);
      }
    } else if (hasSignPersonalMessage(this.signer)) {
      // Fallback to signPersonalMessage if signData is not available
      console.warn('signData not available, falling back to signPersonalMessage');
      try {
        const result = await this.signer.signPersonalMessage(data);
        return normalizeSignature(result).signature;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        throw new SignerAdapterError(`Failed to sign data using fallback method: ${error.message}`, error);
      }
    }
    
    throw new SignerAdapterError('signData method not available on this signer implementation');
  }

  /**
   * Signs a transaction with the appropriate method based on the detected SDK version
   * @throws SignerAdapterError if the adapter has been disposed or signing fails
   */
  async signTransaction(transaction: TransactionType): Promise<SignatureWithBytes> {
    this.checkDisposed();

    try {
      // First extract the actual transaction block
      let txBlock: TransactionBlock;

      try {
        txBlock = extractTransactionBlock(transaction);
      } catch (err) {
        throw new SignerAdapterError(
          `Failed to extract transaction block: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err : undefined
        );
      }

      // Use the appropriate signing method based on SDK version
      if (hasSignTransaction(this.signer)) {
        try {
          // Use conditional type checking to handle different versions safely
          if (this.sdkVersion === SuiSDKVersion.VERSION_1) {
            // In version 1, the API might be different
            // Use explicit 'any' type casting for legacy code
            const signFn = (this.signer as any).signTransaction;
            const result = await signFn(txBlock);
            return normalizeSignature(result);
          } else {
            // For version 2+ with a standardized API, use explicit type assertions
            const signFn = this.signer.signTransaction as unknown as
              (txBlock: TransactionBlock) => Promise<{ signature: Uint8Array; bytes?: Uint8Array }>;
            const result = await signFn(txBlock);
            return normalizeSignature(result);
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          throw new SignerAdapterError(`Failed to sign transaction: ${error.message}`, error);
        }
      } else if (hasSignTransactionBlock(this.signer)) {
        // Try to build the transaction block and sign the bytes
        try {
          const bytes = await txBlock.build();
          // Call the function directly without type assertion
          const result = await this.signer.signTransactionBlock(bytes);
          return normalizeSignature(result);
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          throw new SignerAdapterError(`Failed to sign transaction block: ${error.message}`, error);
        }
      } else {
        throw new SignerAdapterError('No suitable transaction signing method available');
      }
    } catch (err) {
      if (err instanceof SignerAdapterError) {
        throw err;
      }
      throw new SignerAdapterError(
        `Error in signTransaction: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err : undefined
      );
    }
  }

  /**
   * Signs a personal message
   * @throws SignerAdapterError if the adapter has been disposed or signing fails
   */
  async signPersonalMessage(message: Uint8Array): Promise<SignatureWithBytes> {
    this.checkDisposed();
    
    if (!hasSignPersonalMessage(this.signer)) {
      throw new SignerAdapterError('signPersonalMessage not available on this signer implementation');
    }
    
    try {
      const result = await this.signer.signPersonalMessage(message);
      return normalizeSignature(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new SignerAdapterError(`Failed to sign personal message: ${error.message}`, error);
    }
  }
  
  /**
   * Signs a message with intent scope
   * @throws SignerAdapterError if the adapter has been disposed or signing fails
   */
  async signWithIntent(message: Uint8Array, intent: IntentScope): Promise<SignatureWithBytes> {
    this.checkDisposed();
    
    if (!this.signer || typeof this.signer.signWithIntent !== 'function') {
      throw new SignerAdapterError('signWithIntent not available on this signer implementation');
    }
    
    try {
      const result = await this.signer.signWithIntent(message, intent);
      return normalizeSignature(result);
    } catch (err) {
      // Try fallback to personal message signing
      if (hasSignPersonalMessage(this.signer)) {
        console.warn('Falling back to signPersonalMessage due to error:', err);
        try {
          const result = await this.signer.signPersonalMessage(message);
          return normalizeSignature(result);
        } catch (fallbackErr) {
          const error = fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr));
          throw new SignerAdapterError(`Both signing methods failed: ${error.message}`, error);
        }
      }
      
      const error = err instanceof Error ? err : new Error(String(err));
      throw new SignerAdapterError(`Failed to sign with intent: ${error.message}`, error);
    }
  }

  /**
   * Gets the key scheme used by the signer
   * @throws SignerAdapterError if the adapter has been disposed or the operation fails
   */
  getKeyScheme(): 'ED25519' | 'Secp256k1' | 'Secp256r1' | 'MultiSig' | 'ZkLogin' | 'Passkey' {
    this.checkDisposed();
    
    if (!this.signer || typeof this.signer.getKeyScheme !== 'function') {
      throw new SignerAdapterError('getKeyScheme not available on this signer implementation');
    }
    
    try {
      return this.signer.getKeyScheme();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new SignerAdapterError(`Failed to get key scheme: ${error.message}`, error);
    }
  }

  /**
   * Gets the Sui address associated with this signer
   * @throws SignerAdapterError if the adapter has been disposed or the operation fails
   */
  toSuiAddress(): string {
    this.checkDisposed();
    
    if (!this.signer || typeof this.signer.toSuiAddress !== 'function') {
      throw new SignerAdapterError('toSuiAddress not available on this signer implementation');
    }
    
    try {
      return this.signer.toSuiAddress();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new SignerAdapterError(`Failed to get Sui address: ${error.message}`, error);
    }
  }

  /**
   * Gets the public key if available
   * @throws SignerAdapterError if the adapter has been disposed or the operation fails
   */
  getPublicKey(): PublicKey {
    this.checkDisposed();
    
    if (hasGetPublicKey(this.signer)) {
      try {
        return this.signer.getPublicKey();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        throw new SignerAdapterError(`Failed to get public key: ${error.message}`, error);
      }
    }
    
    // Fallback for signers without getPublicKey method
    // This can happen in some SDK versions where the public key isn't directly accessible
    throw new SignerAdapterError('getPublicKey not available on this signer implementation');
  }

  /**
   * Connects the signer to a SuiClient for transaction execution
   * @throws SignerAdapterError if the adapter has been disposed or the operation fails
   */
  connect(client: SuiClient): SignerAdapter {
    this.checkDisposed();

    if (!client) {
      throw new SignerAdapterError('Invalid SuiClient provided to connect method');
    }

    this.suiClient = client;

    // If the underlying signer has a connect method, call it
    if (hasConnect(this.signer)) {
      try {
        this.signer.connect(client);
      } catch (err) {
        console.warn('Failed to connect underlying signer, but continuing:', err);
      }
    }

    return this;
  }

  /**
   * Get the Sui client associated with this signer
   * @returns The SuiClient instance
   * @throws SignerAdapterError if the adapter has been disposed
   */
  getClient(): SuiClient {
    this.checkDisposed();

    if (!this.suiClient) {
      throw new SignerAdapterError('No SuiClient available - call connect() first');
    }

    return this.suiClient;
  }

  /**
   * Get the address of this signer
   * @returns A promise that resolves to the address as a string
   * @throws SignerAdapterError if the adapter has been disposed
   */
  async getAddress(): Promise<string> {
    this.checkDisposed();
    return this.toSuiAddress();
  }

  /**
   * Signs and executes a transaction using the appropriate method based on SDK version
   * @throws SignerAdapterError if the adapter has been disposed or the operation fails
   */
  async signAndExecuteTransactionBlock(
    tx: TransactionType,
    options?: SuiTransactionBlockResponseOptions
  ): Promise<SuiTransactionBlockResponse> {
    this.checkDisposed();

    if (!this.suiClient) {
      throw new SignerAdapterError('Signer is not connected to a SuiClient. Call connect() first.');
    }

    try {
      // Extract the transaction block
      let txBlock: TransactionBlock;

      try {
        txBlock = extractTransactionBlock(tx);
      } catch (err) {
        throw new SignerAdapterError(
          `Failed to extract transaction block: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err : undefined
        );
      }

      // If the native method is available, use it directly
      if (hasSignAndExecuteTransactionBlock(this.signer)) {
        try {
          // Handle different API versions safely
          if (this.sdkVersion === SuiSDKVersion.VERSION_3) {
            // Modern version with standard API
            // Use explicit cast to the expected function signature
            const signAndExecuteFn = this.signer.signAndExecuteTransactionBlock as unknown as
              (txBlock: TransactionBlock, options?: SuiTransactionBlockResponseOptions) => Promise<SuiTransactionBlockResponse>;
            return await signAndExecuteFn(txBlock, options);
          } else {
            // Older versions with different parameter types
            return await (this.signer as any).signAndExecuteTransactionBlock(txBlock, options);
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          throw new SignerAdapterError(`Native signAndExecuteTransactionBlock failed: ${error.message}`, error);
        }
      }

      // Otherwise implement it manually using available methods and SuiClient
      try {
        const bytes = await txBlock.build();

        // Sign the transaction using the appropriate method
        let signature: SignatureWithBytes;

        if (hasSignTransaction(this.signer)) {
          // Call the function directly without type assertion
          const sigResult = await this.signer.signTransaction(txBlock);
          signature = normalizeSignature(sigResult);
        } else if (hasSignTransactionBlock(this.signer)) {
          // Call the function directly without type assertion
          const sigResult = await this.signer.signTransactionBlock(bytes);
          signature = normalizeSignature(sigResult);
        } else {
          throw new SignerAdapterError('No suitable signature method available');
        }

        // Execute the transaction using the SuiClient
        return await this.suiClient.executeTransactionBlock({
          transactionBlock: bytes,
          signature: Buffer.from(signature.signature).toString('base64'),
          options: options || {
            showEffects: true
          }
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        throw new SignerAdapterError(`Manual sign and execute implementation failed: ${error.message}`, error);
      }
    } catch (err) {
      if (err instanceof SignerAdapterError) {
        throw err;
      }
      throw new SignerAdapterError(
        `Error in signAndExecuteTransactionBlock: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err : undefined
      );
    }
  }
  
  /**
   * Type guard to check if an object is a SignerAdapterImpl
   * @param obj Object to check
   * @returns true if the object is a SignerAdapterImpl
   */
  static isSignerAdapter(obj: unknown): obj is SignerAdapterImpl {
    return isSignerAdapter(obj) && obj instanceof SignerAdapterImpl;
  }
}

/**
 * Factory function to create a SignerAdapter from an existing Signer
 * @throws SignerAdapterError if the provided signer is invalid
 */
export function createSignerAdapter(signer: Signer): SignerAdapter {
  if (!isValidSigner(signer)) {
    throw new SignerAdapterError('Invalid signer provided to createSignerAdapter()');
  }
  return new SignerAdapterImpl(signer);
}