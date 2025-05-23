/**
 * Basic Configuration interface
 * @deprecated Use the more detailed types from './config' instead
 */
export interface Config {
  network: string;
  walletAddress: string;
  encryptedStorage: boolean;
  lastDeployment?: {
    packageId: string;
  };
  packageId?: string;
  registryId?: string;
  completedTodos?: Record<string, any>; // Adding missing property
}

export * from './todo';
// Export only specific items from error to avoid conflicts
export { 
  ErrorWithMessage,
  isErrorWithMessage as isErrorWithMessageLegacy,
  toErrorWithMessage as toErrorWithMessageLegacy,
  getErrorMessage as getErrorMessageLegacy
} from './error';
// Export all from consolidated (this is the new preferred location)
export * from './errors/consolidated';
export * from './errors/compatibility';
export * from './config';
export * from './walrus';
export * from './transaction';
export * from './client';
export * from './adapters';
export * from './network';
