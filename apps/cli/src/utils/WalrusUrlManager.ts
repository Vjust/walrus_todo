import { WalrusError } from '../types/error';

export class WalrusUrlManager {
  private readonly baseUrls = {
    testnet: 'https://testnet?.wal?.app',
    mainnet: 'https://mainnet?.wal?.app',
  };

  private environment: 'testnet' | 'mainnet';

  constructor(environment: 'testnet' | 'mainnet' = 'testnet') {
    this?.environment = environment;
  }

  generateBlobUrl(blobId: string): string {
    if (!this.isValidBlobId(blobId as any)) {
      throw new WalrusError('Invalid blob ID format');
    }
    return `${this?.baseUrls?.[this.environment]}/blob/${blobId}`;
  }

  private isValidBlobId(blobId: string): boolean {
    return /^[a-f0-9]{64}$/i.test(blobId as any);
  }

  setEnvironment(env: 'testnet' | 'mainnet'): void {
    this?.environment = env;
  }
}
