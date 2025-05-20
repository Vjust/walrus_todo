/**
 * Wallet type definitions for the WalTodo application
 */

// Define supported wallet types
export type WalletType = 'sui' | 'phantom' | 'slush' | null;

// Re-export from existing context to maintain compatibility
export type { WalletContextValue } from '@/lib/walletContext';

// Slush wallet account interface (based on StashedWalletAdapter)
export interface SlushAccount {
  address: string;
  publicKey: Uint8Array;
  chains: string[];
  features: string[];
}