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
}

export * from './todo';
export * from './error';
export * from './config';
export * from './walrus';
export * from './transaction';
export * from './client';
export * from './adapters';
export * from './network';
