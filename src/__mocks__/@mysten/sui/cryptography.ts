import type { TransactionBlock } from '@mysten/sui.js/transactions';
export * from './cryptography/ed25519';
export * from './cryptography/index';

export interface Signer {
  signData(data: Uint8Array): Promise<{ signature: Uint8Array; bytes: Uint8Array }>;
  signTransaction(transaction: TransactionBlock): Promise<{ signature: Uint8Array; bytes: Uint8Array }>;
  toSuiAddress(): string;
  getPublicKey(): {
    toSuiAddress(): string;
    verify(data: Uint8Array, signature: Uint8Array): Promise<boolean>;
  };
  signPersonalMessage(message: Uint8Array): Promise<{ signature: Uint8Array; bytes: Uint8Array }>;
  signWithIntent(message: Uint8Array, intent: string): Promise<{ signature: Uint8Array; bytes: Uint8Array }>;
  getKeyScheme(): 'ED25519' | 'Secp256k1';
}