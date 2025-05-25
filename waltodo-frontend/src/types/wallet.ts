/**
 * Wallet type definitions for the WalTodo application
 */

// Define supported wallet types
export type WalletType = 'sui' | 'phantom' | 'slush' | 'backpack' | null;

// Define network types
export type NetworkType = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

// Re-export from existing context to maintain compatibility
export type { WalletContextValue } from '@/contexts/WalletContext';

// Slush wallet account interface (based on StashedWalletAdapter)
export interface SlushAccount {
  address: string;
  publicKey: Uint8Array;
  chains: string[];
  features: string[];
}

// Backpack wallet account interface (via Solana Wallet Standard)
export interface BackpackAccount {
  address: string;
  publicKey: Uint8Array | string;
  chains: string[];
  features?: string[];
  network?: NetworkType;
}

// Extended Backpack wallet capabilities interface
export interface BackpackWalletCapabilities {
  supportedChains: string[];
  supportedFeatures: string[];
  multiChain: boolean;
  isBackpack: boolean;
}

// Generic transaction result interface
export interface TransactionResult {
  digest?: string;
  signature?: string | Uint8Array;
  status?: 'success' | 'failure';
  error?: string;
  timestamp?: number;
  blockHeight?: number;
}

// Network configuration interface
export interface NetworkConfig {
  name: NetworkType;
  endpoint: string;
  chainId?: string;
  displayName: string;
  explorer: string;
  explorerTemplate: string; // URL template for explorer links with {address} and {tx} placeholders
  active?: boolean;
}

// Common wallet feature flags
export interface WalletFeatures {
  supportsNetworkSwitching: boolean;
  supportsSignMessage: boolean;
  supportsTransactionSigning: boolean;
  supportsMultipleChains: boolean;
  supportsDappInteraction: boolean;
}
