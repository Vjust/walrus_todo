/**
 * SuiClient Compatibility Adapter
 *
 * This module provides compatibility wrappers for SuiClient import changes
 * between different versions of @mysten/sui library.
 */
import {
  SuiClient as SuiClientClass,
  getFullnodeUrl as getFullnodeUrlFn,
} from '@mysten/sui/client';
export declare const SuiClient: typeof SuiClientClass;
export declare const getFullnodeUrl: typeof getFullnodeUrlFn;
export interface CompatibleSuiClientOptions {
  url?: string;
  transport?: unknown;
  headers?: Record<string, string>;
}
import type {
  SuiTransactionBlockResponse,
  SuiObjectResponse,
  SuiObjectData,
  SuiMoveObject,
  PaginatedObjectsResponse,
} from '@mysten/sui/client';
export type {
  SuiTransactionBlockResponse,
  SuiObjectResponse,
  SuiObjectData,
  SuiMoveObject,
  PaginatedObjectsResponse,
};
export declare function createCompatibleSuiClient(
  options?: CompatibleSuiClientOptions
): SuiClientClass;
export declare function isSuiClientAvailable(): boolean;
export declare function getCompatibleFullnodeUrl(
  network?: 'mainnet' | 'testnet' | 'devnet' | 'localnet'
): string;
export type SuiClientType = SuiClientClass;
export type SuiClientConstructorType = typeof SuiClient;
declare const _default: {
  SuiClient: typeof SuiClientClass;
  createCompatibleSuiClient: typeof createCompatibleSuiClient;
  isSuiClientAvailable: typeof isSuiClientAvailable;
  getCompatibleFullnodeUrl: typeof getCompatibleFullnodeUrl;
};
export default _default;
//# sourceMappingURL=sui-client-compatibility?.d?.ts.map
