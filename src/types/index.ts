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
export * from './error';
export * from './errors/consolidated';
export * from './errors/compatibility';
export * from './config';
export * from './walrus';
export * from './transaction';
export * from './client';
export * from './adapters';
export * from './network';
