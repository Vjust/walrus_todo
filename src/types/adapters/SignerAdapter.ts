/**
 * SignerAdapter
 *
 * This adapter reconciles differences between the Signer interfaces
 * in different versions of @mysten/sui and @mysten/sui libraries.
 *
 * It provides a consistent interface that both mock implementations and actual
 * code can use without worrying about version-specific differences.
 */

import {
  Signer as SignerSuiJs,
  IntentScope,
  PublicKey
} from '@mysten/sui/cryptography';
import { Transaction, TransactionType } from '../transaction';
import { SuiTransactionBlockResponse, type SuiTransactionBlockResponseOptions, SuiClient } from '@mysten/sui/client';
import { BaseAdapter, isBaseAdapter } from './BaseAdapter';
import { BaseError } from '../errors/BaseError';

/**
 * Adapter interface that defines the required methods for a signer
 */
export interface SignerAdapter extends BaseAdapter<SignerSuiJs> {
  // Core signing methods
  signData(data: Uint8Array): Promise<Uint8Array>;
  signTransaction(transaction: TransactionType): Promise<SignatureWithBytes>;
  signPersonalMessage(message: Uint8Array): Promise<SignatureWithBytes>;
  signWithIntent(message: Uint8Array, intent: IntentScope): Promise<SignatureWithBytes>;

  // Information methods
  getKeyScheme(): 'ED25519' | 'Secp256k1' | 'Secp256r1' | 'MultiSig' | 'ZkLogin' | 'Passkey';
  toSuiAddress(): string;
  getPublicKey(): PublicKey;

  // Advanced methods
  connect(client: SuiClient): SignerAdapter;
  getClient(): SuiClient;
  getAddress(): Promise<string>;
  signAndExecuteTransaction(
    tx: TransactionType,
    options?: SuiTransactionBlockResponseOptions
  ): Promise<SuiTransactionBlockResponse>;

  // Version information
  getSDKVersion(): SuiSDKVersion;
}

// Define our own SignatureWithBytes interface to match Sui SDK
export interface SignatureWithBytes {
  signature: string;
  bytes: string;
}

/**
 * Error class for SignerAdapter operations
 */
export class SignerAdapterError extends BaseError {
  constructor(message: string, cause?: Error) {
    super({
      message: `SignerAdapter Error: ${message}`,
      code: 'SIGNER_ADAPTER_ERROR',
      cause
    });
    this.name = 'SignerAdapterError';
  }
}

/**
 * SDK Version Detection Types
 */
export enum SuiSDKVersion {
  UNKNOWN = 'unknown',
  VERSION_1 = 'v1',      // Legacy Sui.js without TransactionBlock
  VERSION_2 = 'v2',      // Early TransactionBlock implementation
  VERSION_2_5 = 'v2.5',  // Enhanced TransactionBlock with multiple sign methods
  VERSION_3 = 'v3'       // Modern Sui.js with comprehensive sign methods and execute
}

/**
 * Base Signer interface with methods common to all SDK versions
 */
export interface BaseSigner {
  /**
   * Signs a personal message
   */
  signPersonalMessage(message: Uint8Array): Promise<{ signature: Uint8Array; bytes?: Uint8Array; }>;
  
  /**
   * Signs with intent
   */
  signWithIntent(message: Uint8Array, intent: IntentScope): Promise<{ signature: Uint8Array; bytes?: Uint8Array; }>;
  
  /**
   * Gets the key scheme used
   */
  getKeyScheme(): 'ED25519' | 'Secp256k1' | 'Secp256r1' | 'MultiSig' | 'ZkLogin' | 'Passkey';
  
  /**
   * Gets the Sui address associated with this signer
   */
  toSuiAddress(): string;
}

/**
 * Unified Signer interface that accommodates both Signer implementation variants
 */
export interface UnifiedSigner extends BaseSigner {
  /**
   * Signs a transaction block
   */
  signTransactionBlock?(bytes: Uint8Array): Promise<SignatureWithBytes>;
  
  /**
   * Signs transaction data
   */
  signData?(data: Uint8Array): Promise<Uint8Array>;
  
  /**
   * Signs a transaction
   */
  signTransaction?(transaction: TransactionType): Promise<SignatureWithBytes>;
  
  /**
   * Gets the public key
   */
  getPublicKey?(): PublicKey;
  
  /**
   * Signs and executes a transaction
   */
  signAndExecuteTransaction?(
    tx: TransactionType,
    options?: SuiTransactionBlockResponseOptions
  ): Promise<SuiTransactionBlockResponse>;
}

/**
 * Type guards for Signer implementations
 */

/**
 * Checks if the input is a valid base signer object
 * with the minimum required methods
 */
export function isValidBaseSigner(signer: unknown): signer is BaseSigner {
  return signer !== null && 
         typeof signer === 'object' && 
         signer !== undefined &&
         // Core required methods
         'signPersonalMessage' in signer && typeof (signer as any).signPersonalMessage === 'function' &&
         'signWithIntent' in signer && typeof (signer as any).signWithIntent === 'function' &&
         'getKeyScheme' in signer && typeof (signer as any).getKeyScheme === 'function' &&
         'toSuiAddress' in signer && typeof (signer as any).toSuiAddress === 'function';
}

/**
 * Checks if the input is a valid signer object
 */
export function isValidSigner(signer: unknown): signer is SignerSuiJs {
  return isValidBaseSigner(signer);
}

/**
 * Checks if the signer has signTransactionBlock method
 */
export function hasSignTransactionBlock(signer: unknown): signer is BaseSigner & { signTransactionBlock: Function } {
  return isValidBaseSigner(signer) && 
         'signTransactionBlock' in signer && 
         typeof (signer as any).signTransactionBlock === 'function';
}

/**
 * Checks if the signer has signTransaction method
 */
export function hasSignTransaction(signer: unknown): signer is BaseSigner & { signTransaction: Function } {
  return isValidBaseSigner(signer) && 
         'signTransaction' in signer && 
         typeof (signer as any).signTransaction === 'function';
}

/**
 * Checks if the signer has getPublicKey method
 */
export function hasGetPublicKey(signer: unknown): signer is BaseSigner & { getPublicKey: Function } {
  return isValidBaseSigner(signer) && 
         'getPublicKey' in signer && 
         typeof (signer as any).getPublicKey === 'function';
}

/**
 * Checks if the signer has signAndExecuteTransaction method
 */
export function hasSignAndExecuteTransaction(signer: unknown): signer is BaseSigner & { signAndExecuteTransaction: Function } {
  return isValidBaseSigner(signer) && 
         'signAndExecuteTransaction' in signer && 
         typeof (signer as any).signAndExecuteTransaction === 'function';
}

/**
 * Checks if the signer has signData method
 */
export function hasSignData(signer: unknown): signer is BaseSigner & { signData: Function } {
  return isValidBaseSigner(signer) && 
         'signData' in signer && 
         typeof (signer as any).signData === 'function';
}

/**
 * Checks if the signer has signPersonalMessage
 */
export function hasSignPersonalMessage(signer: unknown): signer is BaseSigner & { signPersonalMessage: Function } {
  return isValidBaseSigner(signer) && 
         'signPersonalMessage' in signer && 
         typeof (signer as any).signPersonalMessage === 'function';
}

/**
 * Checks if a signer supports connect to client
 */
export function hasConnect(signer: unknown): signer is BaseSigner & { connect: Function } {
  return isValidBaseSigner(signer) && 
         'connect' in signer && 
         typeof (signer as any).connect === 'function';
}

/**
 * SignerFeatures to track capability detection with boolean flags
 */
export interface SignerFeatures {
  hasSignTransactionBlock: boolean;
  hasSignTransaction: boolean;
  hasSignData: boolean;
  hasGetPublicKey: boolean;
  hasSignAndExecuteTransaction: boolean;
  hasConnect: boolean;
}

/**
 * Function to detect and capture all available features of a signer
 */
export function detectSignerFeatures(signer: unknown): SignerFeatures | null {
  if (!isValidBaseSigner(signer)) {
    return null;
  }
  
  return {
    hasSignTransactionBlock: hasSignTransactionBlock(signer),
    hasSignTransaction: hasSignTransaction(signer),
    hasSignData: hasSignData(signer),
    hasGetPublicKey: hasGetPublicKey(signer),
    hasSignAndExecuteTransaction: hasSignAndExecuteTransaction(signer),
    hasConnect: hasConnect(signer)
  };
}

/**
 * Detect SDK version based on signer features
 * This provides more accurate version detection than checking individual methods
 */
export function detectSDKVersion(signer: unknown): SuiSDKVersion {
  const features = detectSignerFeatures(signer);
  
  if (!features) {
    return SuiSDKVersion.UNKNOWN;
  }
  
  const {
    hasSignTransactionBlock,
    hasSignTransaction,
    hasSignAndExecuteTransaction
  } = features;
  
  // Version detection based on feature combinations
  if (hasSignTransactionBlock && hasSignTransaction && hasSignAndExecuteTransaction) {
    return SuiSDKVersion.VERSION_3;
  } else if (hasSignTransactionBlock && hasSignTransaction) {
    return SuiSDKVersion.VERSION_2_5;
  } else if (hasSignTransactionBlock) {
    return SuiSDKVersion.VERSION_2;
  } else if (hasSignTransaction) {
    return SuiSDKVersion.VERSION_1;
  }
  
  return SuiSDKVersion.UNKNOWN;
}

/**
 * A utility function to convert various signature formats to our consistent SignatureWithBytes type
 */
export function normalizeSignature(signature: unknown): SignatureWithBytes {
  if (signature === null || signature === undefined) {
    throw new SignerAdapterError('Signature is null or undefined');
  }
  
  // Handle string signatures (base64 or hex)
  if (typeof signature === 'string') {
    // Convert Uint8Array to base64 string to match the return type expected
    return {
      signature: signature,
      bytes: "" // Empty bytes when only signature string is provided
    };
  }
  
  // Handle direct Uint8Array signatures
  if (signature instanceof Uint8Array) {
    // Convert Uint8Array to base64 string to match the return type expected
    return {
      signature: Buffer.from(signature).toString('base64'),
      bytes: "" // Empty bytes when only signature Uint8Array is provided
    };
  }
  
  // Handle object format signatures
  if (typeof signature === 'object') {
    if (!('signature' in signature)) {
      throw new SignerAdapterError('Invalid signature object: missing signature property');
    }
    
    // Extract signature
    const sigProp = signature.signature;
    let signatureResult: string;
    
    if (typeof sigProp === 'string') {
      signatureResult = sigProp;
    } else if (sigProp instanceof Uint8Array) {
      signatureResult = Buffer.from(sigProp).toString('base64');
    } else if (sigProp && typeof sigProp === 'object' && 'data' in sigProp) {
      const data = sigProp.data;
      if (data instanceof Uint8Array) {
        signatureResult = Buffer.from(data).toString('base64');
      } else if (typeof data === 'string') {
        signatureResult = data;
      } else {
        throw new SignerAdapterError(`Invalid signature data format: ${JSON.stringify(sigProp)}`);
      }
    } else {
      throw new SignerAdapterError(`Invalid signature property format: ${JSON.stringify(sigProp)}`);
    }
    
    // Extract bytes if present
    let bytesResult: string = "";
    if ('bytes' in signature) {
      const bytesProp = signature.bytes;
      if (typeof bytesProp === 'string') {
        bytesResult = bytesProp;
      } else if (bytesProp instanceof Uint8Array) {
        bytesResult = Buffer.from(bytesProp).toString('base64');
      } else if (bytesProp && typeof bytesProp === 'object' && 'data' in bytesProp) {
        const data = bytesProp.data;
        if (data instanceof Uint8Array) {
          bytesResult = Buffer.from(data).toString('base64');
        } else if (typeof data === 'string') {
          bytesResult = data;
        }
      }
    }
    
    return { signature: signatureResult, bytes: bytesResult };
  }
  
  throw new SignerAdapterError(`Unsupported signature format: ${typeof signature}`);
}

/**
 * Utility function to convert string to Uint8Array
 * Handles base64, hex, and UTF-8 text
 */
export function stringToBytes(str: string): Uint8Array {
  // Check if it looks like base64
  if (/^[A-Za-z0-9+/=]+$/.test(str) && str.length % 4 === 0) {
    try {
      return base64ToBytes(str);
    } catch (e) {
      // Fall through to next conversion method
    }
  }
  
  // Check if it looks like hex
  if (/^[0-9A-Fa-f]+$/.test(str) && str.length % 2 === 0) {
    try {
      return hexToBytes(str);
    } catch (e) {
      // Fall through to next conversion method
    }
  }
  
  // Fall back to UTF-8 text encoding
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToBytes(base64: string): Uint8Array {
  try {
    // Using atob for browser environments or Buffer for Node.js
    const binString = typeof atob === 'function' 
      ? atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
    
    const bytes = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) {
      bytes[i] = binString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    throw new SignerAdapterError(`Invalid base64 string: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  // Ensure even number of characters
  if (hex.length % 2 !== 0) {
    throw new SignerAdapterError('Hex string must have an even number of characters');
  }
  
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Checks if an object is a SignerAdapter implementation
 */
export function isSignerAdapter(obj: unknown): obj is BaseAdapter<SignerSuiJs> {
  return isBaseAdapter(obj) && obj !== null && 
         typeof obj === 'object' && 
         'signWithIntent' in obj && typeof (obj as Record<string, unknown>).signWithIntent === 'function' &&
         'toSuiAddress' in obj && typeof (obj as Record<string, unknown>).toSuiAddress === 'function';
}