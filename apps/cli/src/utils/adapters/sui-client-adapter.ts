// SuiClient Compatibility Adapter
// Provides a unified SuiClient interface across different SDK versions

// Import the modules using ES6 syntax
import {
  SuiClient as SuiClientClass,
  getFullnodeUrl as getFullnodeUrlFn,
} from '@mysten/sui/client';
import { Ed25519Keypair as Ed25519KeypairClass } from '@mysten/sui/keypairs/ed25519';

// Define proper interface for SUI client options
export interface SuiClientOptions {
  url?: string;
  transport?: unknown;
  rpcTimeout?: number;
  websocketTimeout?: number;
  requestTimeout?: number;
  faucetURL?: string;
}

// Export the actual SuiClient constructor
export const SuiClient = SuiClientClass;
export const getFullnodeUrl = getFullnodeUrlFn;

// Create factory function for compatibility
export function createSuiClient(options: SuiClientOptions): SuiClientClass {
  return new SuiClient(options as any);
}

// Alias for compatibility
export const createCompatibleSuiClient = createSuiClient;

// Re-export Ed25519Keypair
export const Ed25519Keypair = Ed25519KeypairClass;

// Export the correct instance type - this is what should be used for type annotations
export type SuiClientType = SuiClientClass;

// Export SuiClient as both value and type for compatibility
export { SuiClient as SuiClientConstructor };
export type SuiClientInterface = SuiClientClass;
