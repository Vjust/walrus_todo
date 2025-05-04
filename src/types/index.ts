/**
 * Configuration interface
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
