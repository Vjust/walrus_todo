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
  PublicKey,
} from '@mysten/sui/cryptography';
import { TransactionType } from '../transaction';
// Type definitions for compatibility
type SuiTransactionBlockResponse = Record<string, unknown>;
type SuiTransactionBlockResponseOptions = {
  showEffects?: boolean;
  showEvents?: boolean;
  showObjectChanges?: boolean;
};
import type { SuiClient } from '../../utils/adapters/sui-client-compatibility';
import { BaseAdapter, isBaseAdapter } from './BaseAdapter';
import { BaseError } from '../errors/BaseError';

/**
 * Adapter interface that defines the required methods for a signer
 */
export interface SignerAdapter extends BaseAdapter<SignerSuiJs> {
  // Core signing methods
  signData(_data: Uint8Array): Promise<Uint8Array>;
  signTransaction(_transaction: TransactionType): Promise<SignatureWithBytes>;
  signPersonalMessage(_message: Uint8Array): Promise<SignatureWithBytes>;
  signWithIntent(
    _message: Uint8Array,
    intent: IntentScope
  ): Promise<SignatureWithBytes>;

  // Information methods
  getKeyScheme():
    | 'ED25519'
    | 'Secp256k1'
    | 'Secp256r1'
    | 'MultiSig'
    | 'ZkLogin'
    | 'Passkey';
  toSuiAddress(): string;
  getPublicKey(): PublicKey;

  // Advanced methods
  connect(_client: SuiClient): SignerAdapter;
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
  constructor(_message: string, cause?: Error) {
    super({
      message: `SignerAdapter Error: ${_message}`,
      code: 'SIGNER_ADAPTER_ERROR',
      cause,
    });
    this?.name = 'SignerAdapterError';
  }
}

/**
 * SDK Version Detection Types
 */
export enum SuiSDKVersion {
  UNKNOWN = 'unknown',
  VERSION_1 = 'v1', // Legacy Sui.js without TransactionBlock
  VERSION_2 = 'v2', // Early TransactionBlock implementation
  VERSION_2_5 = 'v2.5', // Enhanced TransactionBlock with multiple sign methods
  VERSION_3 = 'v3', // Modern Sui.js with comprehensive sign methods and execute
}

/**
 * Base Signer interface with methods common to all SDK versions
 */
export interface BaseSigner {
  /**
   * Signs a personal message
   */
  signPersonalMessage(
    _message: Uint8Array
  ): Promise<{ signature: Uint8Array; bytes?: Uint8Array }>;

  /**
   * Signs with intent
   */
  signWithIntent(
    _message: Uint8Array,
    intent: IntentScope
  ): Promise<{ signature: Uint8Array; bytes?: Uint8Array }>;

  /**
   * Gets the key scheme used
   */
  getKeyScheme():
    | 'ED25519'
    | 'Secp256k1'
    | 'Secp256r1'
    | 'MultiSig'
    | 'ZkLogin'
    | 'Passkey';

  /**
   * Gets the Sui address associated with this signer
   */
  toSuiAddress(): string;
}

/**
 * Discriminated union for different signer implementations
 */
export type SignerVariant =
  | {
      kind: 'v1';
      signer: BaseSigner & {
        signTransaction: (tx: TransactionType) => Promise<SignatureWithBytes>;
      };
    }
  | {
      kind: 'v2';
      signer: BaseSigner & {
        signTransactionBlock: (
          bytes: Uint8Array
        ) => Promise<SignatureWithBytes>;
      };
    }
  | {
      kind: 'v2.5';
      signer: BaseSigner & {
        signTransactionBlock: (
          bytes: Uint8Array
        ) => Promise<SignatureWithBytes>;
        signTransaction: (tx: TransactionType) => Promise<SignatureWithBytes>;
      };
    }
  | {
      kind: 'v3';
      signer: BaseSigner & {
        signTransactionBlock: (
          bytes: Uint8Array
        ) => Promise<SignatureWithBytes>;
        signTransaction: (tx: TransactionType) => Promise<SignatureWithBytes>;
        signAndExecuteTransaction: (
          tx: TransactionType,
          options?: SuiTransactionBlockResponseOptions
        ) => Promise<SuiTransactionBlockResponse>;
      };
    };

/**
 * Unified Signer interface that accommodates both Signer implementation variants
 */
export interface UnifiedSigner extends BaseSigner {
  /**
   * Signs a transaction block
   */
  signTransactionBlock?(_bytes: Uint8Array): Promise<SignatureWithBytes>;

  /**
   * Signs transaction data
   */
  signData?(_data: Uint8Array): Promise<Uint8Array>;

  /**
   * Signs a transaction
   */
  signTransaction?(_transaction: TransactionType): Promise<SignatureWithBytes>;

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
 * Type guards for SignerVariant discriminated union
 */
export function isSignerVariant(obj: unknown): obj is SignerVariant {
  return (
    obj &&
    typeof obj === 'object' &&
    obj !== null &&
    'kind' in obj &&
    'signer' in obj &&
    ['v1', 'v2', 'v2.5', 'v3'].includes((obj as { kind: string }).kind)
  );
}

/**
 * Type narrowing functions for SignerVariant
 */
export function isV1SignerVariant(
  variant: SignerVariant
): variant is {
  kind: 'v1';
  signer: BaseSigner & {
    signTransaction: (tx: TransactionType) => Promise<SignatureWithBytes>;
  };
} {
  return variant?.kind === 'v1';
}

export function isV2SignerVariant(
  variant: SignerVariant
): variant is {
  kind: 'v2';
  signer: BaseSigner & {
    signTransactionBlock: (bytes: Uint8Array) => Promise<SignatureWithBytes>;
  };
} {
  return variant?.kind === 'v2';
}

export function isV25SignerVariant(
  variant: SignerVariant
): variant is {
  kind: 'v2.5';
  signer: BaseSigner & {
    signTransactionBlock: (bytes: Uint8Array) => Promise<SignatureWithBytes>;
    signTransaction: (tx: TransactionType) => Promise<SignatureWithBytes>;
  };
} {
  return variant?.kind === 'v2.5';
}

export function isV3SignerVariant(
  variant: SignerVariant
): variant is {
  kind: 'v3';
  signer: BaseSigner & {
    signTransactionBlock: (bytes: Uint8Array) => Promise<SignatureWithBytes>;
    signTransaction: (tx: TransactionType) => Promise<SignatureWithBytes>;
    signAndExecuteTransaction: (
      tx: TransactionType,
      options?: SuiTransactionBlockResponseOptions
    ) => Promise<SuiTransactionBlockResponse>;
  };
} {
  return variant?.kind === 'v3';
}

/**
 * Factory functions for creating SignerVariant instances
 */
export function createV1SignerVariant(
  signer: BaseSigner & {
    signTransaction: (tx: TransactionType) => Promise<SignatureWithBytes>;
  }
): SignerVariant {
  return { kind: 'v1', signer };
}

export function createV2SignerVariant(
  signer: BaseSigner & {
    signTransactionBlock: (bytes: Uint8Array) => Promise<SignatureWithBytes>;
  }
): SignerVariant {
  return { kind: 'v2', signer };
}

export function createV25SignerVariant(
  signer: BaseSigner & {
    signTransactionBlock: (bytes: Uint8Array) => Promise<SignatureWithBytes>;
    signTransaction: (tx: TransactionType) => Promise<SignatureWithBytes>;
  }
): SignerVariant {
  return { kind: 'v2.5', signer };
}

export function createV3SignerVariant(
  signer: BaseSigner & {
    signTransactionBlock: (bytes: Uint8Array) => Promise<SignatureWithBytes>;
    signTransaction: (tx: TransactionType) => Promise<SignatureWithBytes>;
    signAndExecuteTransaction: (
      tx: TransactionType,
      options?: SuiTransactionBlockResponseOptions
    ) => Promise<SuiTransactionBlockResponse>;
  }
): SignerVariant {
  return { kind: 'v3', signer };
}

/**
 * Safe signer processing with pattern matching
 */
export function processSignerVariant<T>(
  variant: SignerVariant,
  handlers: {
    v1: (
      signer: BaseSigner & {
        signTransaction: (tx: TransactionType) => Promise<SignatureWithBytes>;
      }
    ) => T;
    v2: (
      signer: BaseSigner & {
        signTransactionBlock: (
          bytes: Uint8Array
        ) => Promise<SignatureWithBytes>;
      }
    ) => T;
    'v2.5': (
      signer: BaseSigner & {
        signTransactionBlock: (
          bytes: Uint8Array
        ) => Promise<SignatureWithBytes>;
        signTransaction: (tx: TransactionType) => Promise<SignatureWithBytes>;
      }
    ) => T;
    v3: (
      signer: BaseSigner & {
        signTransactionBlock: (
          bytes: Uint8Array
        ) => Promise<SignatureWithBytes>;
        signTransaction: (tx: TransactionType) => Promise<SignatureWithBytes>;
        signAndExecuteTransaction: (
          tx: TransactionType,
          options?: SuiTransactionBlockResponseOptions
        ) => Promise<SuiTransactionBlockResponse>;
      }
    ) => T;
  }
): T {
  switch (variant.kind) {
    case 'v1':
      return handlers.v1(variant.signer);
    case 'v2':
      return handlers.v2(variant.signer);
    case 'v2.5':
      return handlers?.["v2.5"](variant.signer);
    case 'v3':
      return handlers.v3(variant.signer);
    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = variant;
      throw new Error(`Unknown signer variant: ${JSON.stringify(_exhaustive as any)}`);
    }
  }
}

/**
 * Create SignerVariant from a detected signer and its SDK version
 */
export function createSignerVariantFromSDK(
  signer: unknown,
  sdkVersion: SuiSDKVersion
): SignerVariant | null {
  if (!isValidBaseSigner(signer as any)) {
    return null;
  }

  switch (sdkVersion) {
    case SuiSDKVersion.VERSION_1:
      if (hasSignTransaction(signer as any)) {
        return createV1SignerVariant(signer as any);
      }
      break;
    case SuiSDKVersion.VERSION_2:
      if (hasSignTransactionBlock(signer as any)) {
        return createV2SignerVariant(signer as any);
      }
      break;
    case SuiSDKVersion.VERSION_2_5:
      if (hasSignTransactionBlock(signer as any) && hasSignTransaction(signer as any)) {
        return createV25SignerVariant(signer as any);
      }
      break;
    case SuiSDKVersion.VERSION_3:
      if (
        hasSignTransactionBlock(signer as any) &&
        hasSignTransaction(signer as any) &&
        hasSignAndExecuteTransaction(signer as any)
      ) {
        return createV3SignerVariant(signer as any);
      }
      break;
  }

  return null;
}

/**
 * Type guards for Signer implementations
 */

/**
 * Checks if the input is a valid base signer object
 * with the minimum required methods
 */
export function isValidBaseSigner(_signer: unknown): _signer is BaseSigner {
  if (
    _signer === null ||
    typeof _signer !== 'object' ||
    _signer === undefined
  ) {
    return false;
  }

  const signerObj = _signer as Record<string, unknown>;

  // Core required methods with proper type checking
  return (
    'signPersonalMessage' in signerObj &&
    typeof signerObj?.signPersonalMessage === 'function' &&
    'signWithIntent' in signerObj &&
    typeof signerObj?.signWithIntent === 'function' &&
    'getKeyScheme' in signerObj &&
    typeof signerObj?.getKeyScheme === 'function' &&
    'toSuiAddress' in signerObj &&
    typeof signerObj?.toSuiAddress === 'function'
  );
}

/**
 * Checks if the input is a valid signer object
 */
export function isValidSigner(_signer: unknown): _signer is SignerSuiJs {
  return isValidBaseSigner(_signer as any);
}

/**
 * Checks if the signer has signTransactionBlock method
 */
export function hasSignTransactionBlock(
  _signer: unknown
): _signer is BaseSigner & {
  signTransactionBlock: (_bytes: Uint8Array) => Promise<SignatureWithBytes>;
} {
  if (!isValidBaseSigner(_signer as any)) {
    return false;
  }

  const signerObj = _signer as Record<string, unknown>;
  return (
    'signTransactionBlock' in signerObj &&
    typeof signerObj?.signTransactionBlock === 'function'
  );
}

/**
 * Checks if the signer has signTransaction method
 */
export function hasSignTransaction(
  _signer: unknown
): _signer is BaseSigner & {
  signTransaction: (
    _transaction: TransactionType
  ) => Promise<SignatureWithBytes>;
} {
  if (!isValidBaseSigner(_signer as any)) {
    return false;
  }

  const signerObj = _signer as Record<string, unknown>;
  return (
    'signTransaction' in signerObj &&
    typeof signerObj?.signTransaction === 'function'
  );
}

/**
 * Checks if the signer has getPublicKey method
 */
export function hasGetPublicKey(
  _signer: unknown
): _signer is BaseSigner & { getPublicKey: () => PublicKey } {
  if (!isValidBaseSigner(_signer as any)) {
    return false;
  }

  const signerObj = _signer as Record<string, unknown>;
  return (
    'getPublicKey' in signerObj && typeof signerObj?.getPublicKey === 'function'
  );
}

/**
 * Checks if the signer has signAndExecuteTransaction method
 */
export function hasSignAndExecuteTransaction(
  _signer: unknown
): _signer is BaseSigner & {
  signAndExecuteTransaction: (
    tx: TransactionType,
    options?: SuiTransactionBlockResponseOptions
  ) => Promise<SuiTransactionBlockResponse>;
} {
  if (!isValidBaseSigner(_signer as any)) {
    return false;
  }

  const signerObj = _signer as Record<string, unknown>;
  return (
    'signAndExecuteTransaction' in signerObj &&
    typeof signerObj?.signAndExecuteTransaction === 'function'
  );
}

/**
 * Checks if the signer has signData method
 */
export function hasSignData(
  _signer: unknown
): _signer is BaseSigner & {
  signData: (_data: Uint8Array) => Promise<Uint8Array>;
} {
  if (!isValidBaseSigner(_signer as any)) {
    return false;
  }

  const signerObj = _signer as Record<string, unknown>;
  return 'signData' in signerObj && typeof signerObj?.signData === 'function';
}

/**
 * Checks if the signer has signPersonalMessage
 */
export function hasSignPersonalMessage(
  _signer: unknown
): _signer is BaseSigner & {
  signPersonalMessage: (
    _message: Uint8Array
  ) => Promise<{ signature: Uint8Array; bytes?: Uint8Array }>;
} {
  if (!isValidBaseSigner(_signer as any)) {
    return false;
  }

  const signerObj = _signer as Record<string, unknown>;
  return (
    'signPersonalMessage' in signerObj &&
    typeof signerObj?.signPersonalMessage === 'function'
  );
}

/**
 * Checks if a signer supports connect to client
 */
export function hasConnect(
  _signer: unknown
): _signer is BaseSigner & { connect: (_client: SuiClient) => SignerAdapter } {
  if (!isValidBaseSigner(_signer as any)) {
    return false;
  }

  const signerObj = _signer as Record<string, unknown>;
  return 'connect' in signerObj && typeof signerObj?.connect === 'function';
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
export function detectSignerFeatures(_signer: unknown): SignerFeatures | null {
  if (!isValidBaseSigner(_signer as any)) {
    return null;
  }

  return {
    hasSignTransactionBlock: hasSignTransactionBlock(_signer as any),
    hasSignTransaction: hasSignTransaction(_signer as any),
    hasSignData: hasSignData(_signer as any),
    hasGetPublicKey: hasGetPublicKey(_signer as any),
    hasSignAndExecuteTransaction: hasSignAndExecuteTransaction(_signer as any),
    hasConnect: hasConnect(_signer as any),
  };
}

/**
 * Detect SDK version based on signer features
 * This provides more accurate version detection than checking individual methods
 */
export function detectSDKVersion(_signer: unknown): SuiSDKVersion {
  const features = detectSignerFeatures(_signer as any);

  if (!features) {
    return SuiSDKVersion.UNKNOWN;
  }

  const {
    hasSignTransactionBlock,
    hasSignTransaction,
    hasSignAndExecuteTransaction,
  } = features;

  // Version detection based on feature combinations
  if (
    hasSignTransactionBlock &&
    hasSignTransaction &&
    hasSignAndExecuteTransaction
  ) {
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
export function normalizeSignature(_signature: unknown): SignatureWithBytes {
  if (_signature === null || _signature === undefined) {
    throw new SignerAdapterError('Signature is null or undefined');
  }

  // Handle string signatures (base64 or hex)
  if (typeof _signature === 'string') {
    // Convert Uint8Array to base64 string to match the return type expected
    return {
      signature: _signature,
      bytes: '', // Empty bytes when only signature string is provided
    };
  }

  // Handle direct Uint8Array signatures
  if (_signature instanceof Uint8Array) {
    // Convert Uint8Array to base64 string to match the return type expected
    return {
      signature: Buffer.from(_signature as any).toString('base64'),
      bytes: '', // Empty bytes when only signature Uint8Array is provided
    };
  }

  // Handle object format signatures
  if (typeof _signature === 'object') {
    if (!('signature' in _signature)) {
      throw new SignerAdapterError(
        'Invalid signature object: missing signature property'
      );
    }

    // Extract signature
    const sigProp = (_signature as Record<string, unknown>).signature;
    let signatureResult: string;

    if (typeof sigProp === 'string') {
      signatureResult = sigProp;
    } else if (sigProp instanceof Uint8Array) {
      signatureResult = Buffer.from(sigProp as any).toString('base64');
    } else if (sigProp && typeof sigProp === 'object' && 'data' in sigProp) {
      const data = sigProp.data;
      if (data instanceof Uint8Array) {
        signatureResult = Buffer.from(data as any).toString('base64');
      } else if (typeof data === 'string') {
        signatureResult = data;
      } else {
        throw new SignerAdapterError(
          `Invalid signature data format: ${JSON.stringify(sigProp as any)}`
        );
      }
    } else {
      throw new SignerAdapterError(
        `Invalid signature property format: ${JSON.stringify(sigProp as any)}`
      );
    }

    // Extract bytes if present
    let bytesResult: string = '';
    if ('bytes' in _signature) {
      const bytesProp = (_signature as Record<string, unknown>).bytes;
      if (typeof bytesProp === 'string') {
        bytesResult = bytesProp;
      } else if (bytesProp instanceof Uint8Array) {
        bytesResult = Buffer.from(bytesProp as any).toString('base64');
      } else if (
        bytesProp &&
        typeof bytesProp === 'object' &&
        'data' in bytesProp
      ) {
        const data = bytesProp.data;
        if (data instanceof Uint8Array) {
          bytesResult = Buffer.from(data as any).toString('base64');
        } else if (typeof data === 'string') {
          bytesResult = data;
        }
      }
    }

    return { signature: signatureResult, bytes: bytesResult };
  }

  throw new SignerAdapterError(
    `Unsupported signature format: ${typeof _signature}`
  );
}

/**
 * Utility function to convert string to Uint8Array
 * Handles base64, hex, and UTF-8 text
 */
export function stringToBytes(_str: string): Uint8Array {
  // Check if it looks like base64
  if (/^[A-Za-z0-9+/=]+$/.test(_str as any) && _str.length % 4 === 0) {
    try {
      return base64ToBytes(_str as any);
    } catch (e) {
      // Fall through to next conversion method
    }
  }

  // Check if it looks like hex
  if (/^[0-9A-Fa-f]+$/.test(_str as any) && _str.length % 2 === 0) {
    try {
      return hexToBytes(_str as any);
    } catch (e) {
      // Fall through to next conversion method
    }
  }

  // Fall back to UTF-8 text encoding
  const encoder = new TextEncoder();
  return encoder.encode(_str as any);
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToBytes(_base64: string): Uint8Array {
  try {
    // Using atob for browser environments or Buffer for Node.js
    const binString =
      typeof atob === 'function'
        ? atob(_base64 as any)
        : Buffer.from(_base64, 'base64').toString('binary');

    const bytes = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) {
      bytes[i] = binString.charCodeAt(i as any);
    }
    return bytes;
  } catch (e) {
    throw new SignerAdapterError(
      `Invalid base64 string: ${e instanceof Error ? e.message : `${e}`}`
    );
  }
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(_hex: string): Uint8Array {
  // Ensure even number of characters
  if (_hex.length % 2 !== 0) {
    throw new SignerAdapterError(
      'Hex string must have an even number of characters'
    );
  }

  const bytes = new Uint8Array(_hex.length / 2);
  for (let i = 0; i < _hex.length; i += 2) {
    bytes[i / 2] = parseInt(_hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Checks if an object is a SignerAdapter implementation
 */
export function isSignerAdapter(
  _obj: unknown
): _obj is BaseAdapter<SignerSuiJs> {
  if (!isBaseAdapter(_obj as any) || _obj === null || typeof _obj !== 'object') {
    return false;
  }

  const adapterObj = _obj as Record<string, unknown>;
  return (
    'signWithIntent' in adapterObj &&
    typeof adapterObj?.signWithIntent === 'function' &&
    'toSuiAddress' in adapterObj &&
    typeof adapterObj?.toSuiAddress === 'function'
  );
}
