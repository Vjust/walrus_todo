/**
 * Signer Adapter Implementation
 *
 * This module provides a concrete implementation of the SignerAdapter
 * interface for the @mysten/sui library. It handles the complexities of
 * working with different Sui SDK versions in a type-safe manner.
 *
 * Key features:
 * - Strong type-checking with custom type guards
 * - Consistent error handling with specific error types
 * - Protection against API changes in underlying libraries
 * - Robust fallback mechanisms for version compatibility
 */

import { Logger } from '../Logger';

const logger = new Logger('signer-adapter');

/**
 * - Proper detection of SDK versions for optimized method selection
 * - Resource management with proper cleanup
 */

import { IntentScope, Signer, PublicKey } from '@mysten/sui/cryptography';
// Import from the type definition file
import {
  SignatureWithBytes,
  hasSignTransactionBlock,
  hasSignTransaction,
  hasGetPublicKey,
  hasSignAndExecuteTransaction,
  hasSignData,
  hasSignPersonalMessage,
  hasConnect,
  SignerAdapterError,
  isValidSigner,
  detectSDKVersion,
  normalizeSignature,
  isSignerAdapter,
  SuiSDKVersion,
} from '../../types/adapters/SignerAdapter';
import { Transaction } from '@mysten/sui/transactions';
import { type SuiClientType } from './sui-client-compatibility';
// Use compatible type to match SignerAdapter interface
type SuiTransactionBlockResponse = Record<string, unknown>;

// SuiTransactionBlockResponseOptions type definition
export type SuiTransactionBlockResponseOptions = {
  showInput?: boolean;
  showEffects?: boolean;
  showEvents?: boolean;
  showObjectChanges?: boolean;
  showBalanceChanges?: boolean;
};
import { TransactionType } from '../../types/transaction';
import { isTransactionSui } from '../../types/adapters/TransactionBlockAdapter';
import { SignerAdapter } from '../../types/adapters/SignerAdapter';

/**
 * Extract the actual TransactionBlock from different possible input types
 */
function extractTransactionBlock(tx: TransactionType): Transaction {
  if (isTransactionSui(tx)) {
    return tx;
  } else if (
    tx &&
    typeof tx === 'object' &&
    'getUnderlyingImplementation' in tx &&
    typeof (tx as { getUnderlyingImplementation?: () => unknown }).getUnderlyingImplementation === 'function'
  ) {
    try {
      const block = (tx as { getUnderlyingImplementation: () => unknown }).getUnderlyingImplementation();
      if (isTransactionSui(block)) {
        return block;
      }
    } catch (error) {
      throw new SignerAdapterError(
        `Failed to extract a valid Transaction from adapter: ${error instanceof Error ? error.message : String(error)}`,
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
  private suiClient: SuiClientType | null = null;
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
      if (typeof (this.signer as { disconnect?: () => Promise<void> }).disconnect === 'function') {
        try {
          await (this.signer as { disconnect: () => Promise<void> }).disconnect();
        } catch (error: unknown) {
          const typedError = error instanceof Error ? error : new Error(String(error));
          logger.warn('Error during signer disconnect:', typedError);
        }
      }

      this._isDisposed = true;
    } catch (error: unknown) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      throw new SignerAdapterError(
        `Failed to dispose SignerAdapter: ${typedError.message}`,
        typedError
      );
    }
  }

  /**
   * Utility method to check if the adapter is disposed and throw if it is
   * @throws SignerAdapterError if the adapter has been disposed
   */
  private checkDisposed(): void {
    if (this._isDisposed) {
      throw new SignerAdapterError(
        'Cannot perform operations on a disposed adapter'
      );
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
        // Use proper type assertion with validation
        if (!('signData' in this.signer) || typeof (this.signer as Record<string, unknown>).signData !== 'function') {
          throw new SignerAdapterError('signData method not available on signer');
        }
        const signDataFn = (this.signer as { signData: (data: Uint8Array) => Promise<unknown> }).signData;
        const result = await signDataFn(data);

        // Handle different return types based on SDK version
        if (result instanceof Uint8Array) {
          return result;
        }

        // If it returned an object with signature information, extract the signature
        const normalized = normalizeSignature(result);
        // Convert string signature to Uint8Array if needed
        return typeof normalized.signature === 'string' 
          ? new TextEncoder().encode(normalized.signature)
          : normalized.signature as Uint8Array;
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));

        // Try alternative signing methods as fallback
        if (hasSignTransactionBlock(this.signer)) {
          logger.warn('Falling back to signTransactionBlock for data signing');
          try {
            // Use proper type assertion with validation
            if (!('signTransactionBlock' in this.signer) || typeof (this.signer as Record<string, unknown>).signTransactionBlock !== 'function') {
              throw new SignerAdapterError('signTransactionBlock method not available on signer');
            }
            const signTxBlockFn = (this.signer as { signTransactionBlock: (data: Uint8Array) => Promise<unknown> }).signTransactionBlock;
            const result = await signTxBlockFn(data);
            return normalizeSignature(result)
              .signature as Uint8Array;
          } catch (fallbackErr: unknown) {
            const typedFallbackErr = fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr));
            throw new SignerAdapterError(
              `Fallback signing also failed: ${typedFallbackErr.message}`,
              typedFallbackErr
            );
          }
        }

        throw new SignerAdapterError(
          `Failed to sign data: ${error.message}`,
          error
        );
      }
    } else if (hasSignPersonalMessage(this.signer)) {
      // Fallback to signPersonalMessage if signData is not available
      logger.warn(
        'signData not available, falling back to signPersonalMessage'
      );
      try {
        const result = await this.signer.signPersonalMessage(data);
        const normalized = normalizeSignature(result);
        // Convert string signature to Uint8Array if needed
        return typeof normalized.signature === 'string'
          ? new TextEncoder().encode(normalized.signature)
          : normalized.signature as Uint8Array;
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        throw new SignerAdapterError(
          `Failed to sign data using fallback method: ${error.message}`,
          error
        );
      }
    }

    throw new SignerAdapterError(
      'signData method not available on this signer implementation'
    );
  }

  /**
   * Signs a transaction with the appropriate method based on the detected SDK version
   * @throws SignerAdapterError if the adapter has been disposed or signing fails
   */
  async signTransaction(
    transaction: TransactionType
  ): Promise<SignatureWithBytes> {
    this.checkDisposed();

    try {
      // First extract the actual transaction
      let txBlock: Transaction;

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
            // Use explicit type casting for legacy code
            const signFn = (this.signer as { signTransaction: (txBlock: Transaction) => Promise<unknown> }).signTransaction;
            const result = await signFn(txBlock);
            return normalizeSignature(result);
          } else {
            // For version 2+ with a standardized API, use explicit type assertions
            const signFn = this.signer.signTransaction as unknown as (
              txBlock: Transaction
            ) => Promise<{ signature: Uint8Array; bytes?: Uint8Array }>;
            const result = await signFn(txBlock);
            return normalizeSignature(result);
          }
        } catch (err: unknown) {
          const error = err instanceof Error ? err : new Error(String(err));
          throw new SignerAdapterError(
            `Failed to sign transaction: ${error.message}`,
            error
          );
        }
      } else if (hasSignTransactionBlock(this.signer)) {
        // Try to build the transaction block and sign the bytes
        try {
          const bytes = await txBlock.build();
          // Call the function directly with proper typing
          const result = await (this.signer as { signTransactionBlock: (bytes: Uint8Array) => Promise<unknown> }).signTransactionBlock(bytes);
          return normalizeSignature(result);
        } catch (err: unknown) {
          const error = err instanceof Error ? err : new Error(String(err));
          throw new SignerAdapterError(
            `Failed to sign transaction block: ${error.message}`,
            error
          );
        }
      } else {
        throw new SignerAdapterError(
          'No suitable transaction signing method available'
        );
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
      throw new SignerAdapterError(
        'signPersonalMessage not available on this signer implementation'
      );
    }

    try {
      const result = await this.signer.signPersonalMessage(message);
      return normalizeSignature(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new SignerAdapterError(
        `Failed to sign personal message: ${error.message}`,
        error
      );
    }
  }

  /**
   * Signs a message with intent scope
   * @throws SignerAdapterError if the adapter has been disposed or signing fails
   */
  async signWithIntent(
    message: Uint8Array,
    intent: IntentScope
  ): Promise<SignatureWithBytes> {
    this.checkDisposed();

    if (!this.signer || typeof this.signer.signWithIntent !== 'function') {
      throw new SignerAdapterError(
        'signWithIntent not available on this signer implementation'
      );
    }

    try {
      const result = await this.signer.signWithIntent(message, intent);
      return normalizeSignature(result);
    } catch (err) {
      // Try fallback to personal message signing
      if (hasSignPersonalMessage(this.signer)) {
        logger.warn('Falling back to signPersonalMessage due to error:', err);
        try {
          const result = await this.signer.signPersonalMessage(message);
          return normalizeSignature(result);
        } catch (fallbackErr) {
          const error =
            fallbackErr instanceof Error
              ? fallbackErr
              : new Error(String(fallbackErr));
          throw new SignerAdapterError(
            `Both signing methods failed: ${error.message}`,
            error
          );
        }
      }

      const error = err instanceof Error ? err : new Error(String(err));
      throw new SignerAdapterError(
        `Failed to sign with intent: ${error.message}`,
        error
      );
    }
  }

  /**
   * Gets the key scheme used by the signer
   * @throws SignerAdapterError if the adapter has been disposed or the operation fails
   */
  getKeyScheme():
    | 'ED25519'
    | 'Secp256k1'
    | 'Secp256r1'
    | 'MultiSig'
    | 'ZkLogin'
    | 'Passkey' {
    this.checkDisposed();

    if (!this.signer || typeof this.signer.getKeyScheme !== 'function') {
      throw new SignerAdapterError(
        'getKeyScheme not available on this signer implementation'
      );
    }

    try {
      return this.signer.getKeyScheme();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new SignerAdapterError(
        `Failed to get key scheme: ${error.message}`,
        error
      );
    }
  }

  /**
   * Gets the Sui address associated with this signer
   * @throws SignerAdapterError if the adapter has been disposed or the operation fails
   */
  toSuiAddress(): string {
    this.checkDisposed();

    if (!this.signer || typeof this.signer.toSuiAddress !== 'function') {
      throw new SignerAdapterError(
        'toSuiAddress not available on this signer implementation'
      );
    }

    try {
      return this.signer.toSuiAddress();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw new SignerAdapterError(
        `Failed to get Sui address: ${error.message}`,
        error
      );
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
        throw new SignerAdapterError(
          `Failed to get public key: ${error.message}`,
          error
        );
      }
    }

    // Fallback for signers without getPublicKey method
    // This can happen in some SDK versions where the public key isn't directly accessible
    throw new SignerAdapterError(
      'getPublicKey not available on this signer implementation'
    );
  }

  /**
   * Connects the signer to a SuiClient for transaction execution
   * @throws SignerAdapterError if the adapter has been disposed or the operation fails
   */
  connect(client: SuiClientType): SignerAdapter {
    this.checkDisposed();

    if (!client) {
      throw new SignerAdapterError(
        'Invalid SuiClient provided to connect method'
      );
    }

    this.suiClient = client;

    // If the underlying signer has a connect method, call it
    if (hasConnect(this.signer)) {
      try {
        // Type is already validated by hasConnect guard
        const connectableSigner = this.signer as BaseSigner & { connect: (client: SuiClientType) => void };
        connectableSigner.connect(client);
      } catch (err) {
        logger.warn(
          'Failed to connect underlying signer, but continuing:',
          err
        );
      }
    }

    return this;
  }

  /**
   * Get the Sui client associated with this signer
   * @returns The SuiClient instance
   * @throws SignerAdapterError if the adapter has been disposed
   */
  getClient(): SuiClientType {
    this.checkDisposed();

    if (!this.suiClient) {
      throw new SignerAdapterError(
        'No SuiClient available - call connect() first'
      );
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
  async signAndExecuteTransaction(
    tx: TransactionType,
    options?: SuiTransactionBlockResponseOptions
  ): Promise<SuiTransactionBlockResponse> {
    this.checkDisposed();

    if (!this.suiClient) {
      throw new SignerAdapterError(
        'Signer is not connected to a SuiClient. Call connect() first.'
      );
    }

    try {
      // Extract the transaction
      let txBlock: Transaction;

      try {
        txBlock = extractTransactionBlock(tx);
      } catch (err) {
        throw new SignerAdapterError(
          `Failed to extract transaction block: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err : undefined
        );
      }

      // If the native method is available, use it directly
      if (hasSignAndExecuteTransaction(this.signer)) {
        try {
          // Handle different API versions safely
          if (this.sdkVersion === SuiSDKVersion.VERSION_3) {
            // Modern version with standard API
            // Use explicit cast to the expected function signature
            const signAndExecuteFn = this.signer
              .signAndExecuteTransaction as unknown as (
              txBlock: Transaction,
              options?: SuiTransactionBlockResponseOptions
            ) => Promise<SuiTransactionBlockResponse>;
            return await signAndExecuteFn(txBlock, options);
          } else {
            // Older versions with different parameter types
            return await (this.signer as { signAndExecuteTransaction: (txBlock: Transaction, options?: SuiTransactionBlockResponseOptions) => Promise<SuiTransactionBlockResponse> }).signAndExecuteTransaction(
              txBlock,
              options
            );
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          throw new SignerAdapterError(
            `Native signAndExecuteTransaction failed: ${error.message}`,
            error
          );
        }
      }

      // Otherwise implement it manually using available methods and SuiClient
      try {
        const bytes = await txBlock.build();

        // Sign the transaction using the appropriate method
        let signature: SignatureWithBytes;

        if (hasSignTransaction(this.signer)) {
          // Call the function directly without type assertion
          // Use proper typing to bridge the type mismatch between TransactionBlock and Transaction
          const sigResult = await this.signer.signTransaction(txBlock as unknown as Parameters<typeof this.signer.signTransaction>[0]);
          signature = normalizeSignature(sigResult);
        } else if (hasSignTransactionBlock(this.signer)) {
          // Call the function directly without type assertion
          const sigResult = await (this.signer as { signTransactionBlock: (bytes: Uint8Array) => Promise<unknown> }).signTransactionBlock(
            bytes
          );
          signature = normalizeSignature(sigResult);
        } else {
          throw new SignerAdapterError(
            'No suitable signature method available'
          );
        }

        // Execute the transaction using the SuiClient
        return await (this.suiClient as { executeTransactionBlock: (params: { transactionBlock: Uint8Array; signature: string; options?: { showEffects?: boolean } }) => Promise<SuiTransactionBlockResponse> }).executeTransactionBlock({
          transactionBlock: bytes,
          signature: Buffer.from(signature.signature).toString('base64'),
          options: options || {
            showEffects: true,
          },
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        throw new SignerAdapterError(
          `Manual sign and execute implementation failed: ${error.message}`,
          error
        );
      }
    } catch (err) {
      if (err instanceof SignerAdapterError) {
        throw err;
      }
      throw new SignerAdapterError(
        `Error in signAndExecuteTransaction: ${err instanceof Error ? err.message : String(err)}`,
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
    throw new SignerAdapterError(
      'Invalid signer provided to createSignerAdapter()'
    );
  }
  return new SignerAdapterImpl(signer);
}
