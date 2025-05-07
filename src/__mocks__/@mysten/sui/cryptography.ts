import type { TransactionBlock } from '@mysten/sui.js/transactions';
export * from './cryptography/ed25519';
export * from './cryptography/index';

export interface Signer {
  signData(data: Uint8Array): Promise<{ signature: string; bytes: string }>;
  signTransaction(transaction: TransactionBlock): Promise<{ signature: string; bytes: string }>;
  toSuiAddress(): string;
  getPublicKey(): {
    toSuiAddress(): string;
    verify(data: Uint8Array, signature: Uint8Array): Promise<boolean>;
  };
  signPersonalMessage(message: Uint8Array): Promise<{ signature: string; bytes: string }>;
  signWithIntent(message: Uint8Array, intent: string): Promise<{ signature: string; bytes: string }>;
  getKeyScheme(): 'ED25519' | 'Secp256k1';
}