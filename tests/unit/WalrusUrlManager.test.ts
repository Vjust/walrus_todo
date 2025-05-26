import { WalrusUrlManager } from '../../src/utils/WalrusUrlManager';
import { WalrusError } from '../../src/types/errors';

describe('WalrusUrlManager', () => {
  let urlManager: WalrusUrlManager;

  beforeEach(() => {
    urlManager = new WalrusUrlManager();
  });

  describe('generateBlobUrl', () => {
    it('should generate correct testnet URL by default', () => {
      const blobId = 'a'.repeat(64);
      expect(urlManager.generateBlobUrl(blobId)).toBe(
        `https://testnet.wal.app/blob/${blobId}`
      );
    });

    it('should generate correct mainnet URL when configured', () => {
      urlManager = new WalrusUrlManager('mainnet');
      const blobId = 'a'.repeat(64);
      expect(urlManager.generateBlobUrl(blobId)).toBe(
        `https://mainnet.wal.app/blob/${blobId}`
      );
    });

    it('should throw error for invalid blob ID', () => {
      expect(() => urlManager.generateBlobUrl('invalid')).toThrow(WalrusError);
      expect(() => urlManager.generateBlobUrl('123')).toThrow(WalrusError);
      expect(() => urlManager.generateBlobUrl('g'.repeat(64))).toThrow(
        WalrusError
      );
    });
  });

  describe('setEnvironment', () => {
    it('should update environment correctly', () => {
      const blobId = 'a'.repeat(64);
      urlManager.setEnvironment('mainnet');
      expect(urlManager.generateBlobUrl(blobId)).toBe(
        `https://mainnet.wal.app/blob/${blobId}`
      );
      urlManager.setEnvironment('testnet');
      expect(urlManager.generateBlobUrl(blobId)).toBe(
        `https://testnet.wal.app/blob/${blobId}`
      );
    });
  });
});
