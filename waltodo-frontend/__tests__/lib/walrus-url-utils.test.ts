/**
 * Tests for Walrus URL utility functions
 */

import {
  isValidBlobId,
  validateBlobId,
  extractBlobIdFromWalrusUrl,
  walrusToHttpUrl,
  generateHttpUrl,
  generateWalrusUrl,
  extractBlobId,
  getNetworkFromUrl,
  isWalrusUrl,
  WalrusUrlManager,
  WalrusUrlError,
  type BlobId,
  type WalrusUrl,
  type WalrusNetwork
} from '@/lib/walrus-url-utils';

describe('walrus-url-utils', () => {
  const validBlobId = 'a'.repeat(64);
  const invalidBlobId = 'invalid';

  describe('isValidBlobId', () => {
    it('should return true for valid 64 character hex string', () => {
      expect(isValidBlobId(validBlobId)).toBe(true);
      expect(isValidBlobId('0123456789abcdef' + 'f'.repeat(48))).toBe(true);
      expect(isValidBlobId('ABCDEF' + '0'.repeat(58))).toBe(true);
    });

    it('should return false for invalid blob IDs', () => {
      expect(isValidBlobId(invalidBlobId)).toBe(false);
      expect(isValidBlobId('a'.repeat(63))).toBe(false);
      expect(isValidBlobId('a'.repeat(65))).toBe(false);
      expect(isValidBlobId('g'.repeat(64))).toBe(false); // 'g' is not hex
      expect(isValidBlobId('')).toBe(false);
    });
  });

  describe('validateBlobId', () => {
    it('should return the blob ID if valid', () => {
      const result = validateBlobId(validBlobId);
      expect(result).toBe(validBlobId);
    });

    it('should throw WalrusUrlError for invalid blob ID', () => {
      expect(() => validateBlobId(invalidBlobId)).toThrow(WalrusUrlError);
      expect(() => validateBlobId(invalidBlobId)).toThrow('Invalid blob ID format');
    });
  });

  describe('extractBlobIdFromWalrusUrl', () => {
    it('should extract blob ID from valid walrus:// URL', () => {
      const walrusUrl = `walrus://${validBlobId}`;
      expect(extractBlobIdFromWalrusUrl(walrusUrl)).toBe(validBlobId);
    });

    it('should throw for invalid protocol', () => {
      expect(() => extractBlobIdFromWalrusUrl(`https://${validBlobId}`)).toThrow(WalrusUrlError);
      expect(() => extractBlobIdFromWalrusUrl(`http://${validBlobId}`)).toThrow('Invalid walrus URL format');
    });

    it('should throw for invalid blob ID in URL', () => {
      expect(() => extractBlobIdFromWalrusUrl(`walrus://${invalidBlobId}`)).toThrow(WalrusUrlError);
    });
  });

  describe('walrusToHttpUrl', () => {
    it('should convert walrus:// to testnet HTTP URL by default', () => {
      const walrusUrl = `walrus://${validBlobId}`;
      const httpUrl = walrusToHttpUrl(walrusUrl);
      expect(httpUrl).toBe(`https://testnet.wal.app/blob/${validBlobId}`);
    });

    it('should convert walrus:// to mainnet HTTP URL when specified', () => {
      const walrusUrl = `walrus://${validBlobId}`;
      const httpUrl = walrusToHttpUrl(walrusUrl, 'mainnet');
      expect(httpUrl).toBe(`https://mainnet.wal.app/blob/${validBlobId}`);
    });

    it('should throw for invalid walrus URL', () => {
      expect(() => walrusToHttpUrl('invalid://url')).toThrow(WalrusUrlError);
    });
  });

  describe('generateHttpUrl', () => {
    it('should generate testnet wal.app URL by default', () => {
      const url = generateHttpUrl(validBlobId);
      expect(url).toBe(`https://testnet.wal.app/blob/${validBlobId}`);
    });

    it('should generate mainnet wal.app URL when specified', () => {
      const url = generateHttpUrl(validBlobId, 'mainnet');
      expect(url).toBe(`https://mainnet.wal.app/blob/${validBlobId}`);
    });

    it('should generate walrus.space URL when useWalrusSpace is true', () => {
      const url = generateHttpUrl(validBlobId, 'testnet', true);
      expect(url).toBe(`https://aggregator-testnet.walrus.space/v1/${validBlobId}`);
    });

    it('should generate mainnet walrus.space URL', () => {
      const url = generateHttpUrl(validBlobId, 'mainnet', true);
      expect(url).toBe(`https://aggregator-mainnet.walrus.space/v1/${validBlobId}`);
    });

    it('should throw for invalid blob ID', () => {
      expect(() => generateHttpUrl(invalidBlobId)).toThrow(WalrusUrlError);
    });
  });

  describe('generateWalrusUrl', () => {
    it('should generate walrus:// URL from blob ID', () => {
      const url = generateWalrusUrl(validBlobId);
      expect(url).toBe(`walrus://${validBlobId}`);
    });

    it('should throw for invalid blob ID', () => {
      expect(() => generateWalrusUrl(invalidBlobId)).toThrow(WalrusUrlError);
    });
  });

  describe('extractBlobId', () => {
    it('should extract from walrus:// URL', () => {
      expect(extractBlobId(`walrus://${validBlobId}`)).toBe(validBlobId);
    });

    it('should extract from testnet wal.app URL', () => {
      expect(extractBlobId(`https://testnet.wal.app/blob/${validBlobId}`)).toBe(validBlobId);
    });

    it('should extract from mainnet wal.app URL', () => {
      expect(extractBlobId(`https://mainnet.wal.app/blob/${validBlobId}`)).toBe(validBlobId);
    });

    it('should extract from testnet walrus.space URL', () => {
      expect(extractBlobId(`https://aggregator-testnet.walrus.space/v1/${validBlobId}`)).toBe(validBlobId);
    });

    it('should extract from mainnet walrus.space URL', () => {
      expect(extractBlobId(`https://aggregator-mainnet.walrus.space/v1/${validBlobId}`)).toBe(validBlobId);
    });

    it('should throw for unsupported URL format', () => {
      expect(() => extractBlobId('https://example.com/blob/123')).toThrow(WalrusUrlError);
      expect(() => extractBlobId('https://example.com/blob/123')).toThrow('Unsupported URL format');
    });

    it('should throw for invalid blob ID in URL', () => {
      expect(() => extractBlobId(`https://testnet.wal.app/blob/${invalidBlobId}`)).toThrow(WalrusUrlError);
    });
  });

  describe('getNetworkFromUrl', () => {
    it('should detect testnet from URL', () => {
      expect(getNetworkFromUrl('https://testnet.wal.app/blob/123')).toBe('testnet');
      expect(getNetworkFromUrl('https://aggregator-testnet.walrus.space/v1/123')).toBe('testnet');
    });

    it('should detect mainnet from URL', () => {
      expect(getNetworkFromUrl('https://mainnet.wal.app/blob/123')).toBe('mainnet');
      expect(getNetworkFromUrl('https://aggregator-mainnet.walrus.space/v1/123')).toBe('mainnet');
    });

    it('should return null for unknown network', () => {
      expect(getNetworkFromUrl('https://example.com')).toBe(null);
      expect(getNetworkFromUrl('walrus://123')).toBe(null);
    });
  });

  describe('isWalrusUrl', () => {
    it('should return true for valid Walrus URLs', () => {
      expect(isWalrusUrl(`walrus://${validBlobId}`)).toBe(true);
      expect(isWalrusUrl(`https://testnet.wal.app/blob/${validBlobId}`)).toBe(true);
      expect(isWalrusUrl(`https://mainnet.wal.app/blob/${validBlobId}`)).toBe(true);
      expect(isWalrusUrl(`https://aggregator-testnet.walrus.space/v1/${validBlobId}`)).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isWalrusUrl('https://example.com')).toBe(false);
      expect(isWalrusUrl('walrus://invalid')).toBe(false);
      expect(isWalrusUrl('not-a-url')).toBe(false);
    });
  });

  describe('WalrusUrlManager', () => {
    let manager: WalrusUrlManager;

    beforeEach(() => {
      manager = new WalrusUrlManager();
    });

    it('should default to testnet', () => {
      expect(manager.getNetwork()).toBe('testnet');
    });

    it('should allow network changes', () => {
      manager.setNetwork('mainnet');
      expect(manager.getNetwork()).toBe('mainnet');
    });

    it('should generate URLs using the set network', () => {
      const url = manager.generateHttpUrl(validBlobId);
      expect(url).toBe(`https://testnet.wal.app/blob/${validBlobId}`);

      manager.setNetwork('mainnet');
      const mainnetUrl = manager.generateHttpUrl(validBlobId);
      expect(mainnetUrl).toBe(`https://mainnet.wal.app/blob/${validBlobId}`);
    });

    it('should convert walrus URLs using the set network', () => {
      const walrusUrl = `walrus://${validBlobId}`;
      
      const testnetUrl = manager.walrusToHttpUrl(walrusUrl);
      expect(testnetUrl).toBe(`https://testnet.wal.app/blob/${validBlobId}`);

      manager.setNetwork('mainnet');
      const mainnetUrl = manager.walrusToHttpUrl(walrusUrl);
      expect(mainnetUrl).toBe(`https://mainnet.wal.app/blob/${validBlobId}`);
    });

    it('should support walrus.space URLs', () => {
      const url = manager.generateHttpUrl(validBlobId, true);
      expect(url).toBe(`https://aggregator-testnet.walrus.space/v1/${validBlobId}`);
    });
  });

  describe('Type safety', () => {
    it('should properly type BlobId', () => {
      const blobId: BlobId = validateBlobId(validBlobId);
      // This should compile without errors
      expect(blobId).toBe(validBlobId);
    });

    it('should properly type WalrusUrl', () => {
      const walrusUrl: WalrusUrl = generateWalrusUrl(validBlobId);
      // This should compile without errors
      expect(walrusUrl).toContain('walrus://');
    });

    it('should properly type WalrusNetwork', () => {
      const network: WalrusNetwork = 'testnet';
      // This should compile without errors
      expect(network).toBe('testnet');
    });
  });
});