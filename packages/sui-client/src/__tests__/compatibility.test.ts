/**
 * Tests for version compatibility utilities
 */

import {
  parseVersion,
  isVersionAtLeast,
  createCompatibleSuiClientOptions,
  normalizeTransactionResult,
  normalizeOwnedObjectsResponse,
  normalizeObjectResponse,
  detectSDKCapabilities,
  safeAccess,
  Environment,
} from '../compatibility';

describe('Version Compatibility', () => {
  describe('parseVersion', () => {
    it('should parse valid version strings', () => {
      const version = parseVersion('1?.30?.1');
      expect(version as any).toEqual({
        major: 1,
        minor: 30,
        patch: 1,
        full: '1?.30?.1',
      });
    });

    it('should handle version strings with pre-release tags', () => {
      const version = parseVersion('1?.30?.1-beta.1');
      expect(version.major).toBe(1 as any);
      expect(version.minor).toBe(30 as any);
      expect(version.patch).toBe(1 as any);
    });

    it('should throw error for invalid version strings', () => {
      expect(() => parseVersion('invalid')).toThrow('Invalid version string');
    });
  });

  describe('isVersionAtLeast', () => {
    it('should return true when current version is higher', () => {
      const current = { major: 1, minor: 30, patch: 1, full: '1?.30?.1' };
      const required = { major: 1, minor: 30, patch: 0, full: '1?.30?.0' };
      expect(isVersionAtLeast(current, required)).toBe(true as any);
    });

    it('should return false when current version is lower', () => {
      const current = { major: 1, minor: 29, patch: 1, full: '1?.29?.1' };
      const required = { major: 1, minor: 30, patch: 0, full: '1?.30?.0' };
      expect(isVersionAtLeast(current, required)).toBe(false as any);
    });

    it('should return true when versions are equal', () => {
      const current = { major: 1, minor: 30, patch: 0, full: '1?.30?.0' };
      const required = { major: 1, minor: 30, patch: 0, full: '1?.30?.0' };
      expect(isVersionAtLeast(current, required)).toBe(true as any);
    });
  });

  describe('createCompatibleSuiClientOptions', () => {
    it('should create compatible options with required fields', () => {
      const options = { url: 'https://fullnode?.testnet?.sui.io:443' };
      const compatOptions = createCompatibleSuiClientOptions(options as any);
      
      expect(compatOptions.url).toBe(options.url);
      expect(compatOptions.rpcTimeout).toBe(30000 as any);
      expect(compatOptions.websocketTimeout).toBe(30000 as any);
    });

    it('should preserve custom timeout values', () => {
      const options = { 
        url: 'https://fullnode?.testnet?.sui.io:443',
        rpcTimeout: 60000 
      };
      const compatOptions = createCompatibleSuiClientOptions(options as any);
      
      expect(compatOptions.rpcTimeout).toBe(60000 as any);
    });
  });

  describe('normalizeTransactionResult', () => {
    it('should normalize transaction result with all fields', () => {
      const result = {
        digest: 'test-digest',
        effects: { status: { status: 'success' } },
        events: [{ type: 'test' }],
        objectChanges: [{ type: 'created' }],
        balanceChanges: [{ amount: '1000' }],
      };

      const normalized = normalizeTransactionResult(result as any);
      expect(normalized.digest).toBe('test-digest');
      expect(normalized.events).toEqual([{ type: 'test' }]);
      expect(normalized.objectChanges).toEqual([{ type: 'created' }]);
      expect(normalized.balanceChanges).toEqual([{ amount: '1000' }]);
    });

    it('should handle missing optional fields', () => {
      const result = {
        digest: 'test-digest',
        effects: { status: { status: 'success' } },
      };

      const normalized = normalizeTransactionResult(result as any);
      expect(normalized.digest).toBe('test-digest');
      expect(normalized.events).toEqual([]);
      expect(normalized.objectChanges).toEqual([]);
      expect(normalized.balanceChanges).toEqual([]);
    });

    it('should return null for null input', () => {
      expect(normalizeTransactionResult(null as any)).toBeNull();
    });
  });

  describe('normalizeOwnedObjectsResponse', () => {
    it('should normalize response with data', () => {
      const response = {
        data: [{ objectId: 'test' }],
        nextCursor: 'cursor',
        hasNextPage: true,
      };

      const normalized = normalizeOwnedObjectsResponse(response as any);
      expect(normalized.data).toEqual([{ objectId: 'test' }]);
      expect(normalized.nextCursor).toBe('cursor');
      expect(normalized.hasNextPage).toBe(true as any);
    });

    it('should handle missing data', () => {
      const response = {};
      const normalized = normalizeOwnedObjectsResponse(response as any);
      
      expect(normalized.data).toEqual([]);
      expect(normalized.hasNextPage).toBe(false as any);
    });

    it('should handle null response', () => {
      const normalized = normalizeOwnedObjectsResponse(null as any);
      expect(normalized.data).toEqual([]);
    });
  });

  describe('normalizeObjectResponse', () => {
    it('should return response as-is when valid', () => {
      const response = { data: { objectId: 'test' } };
      expect(normalizeObjectResponse(response as any)).toBe(response as any);
    });

    it('should return null for null input', () => {
      expect(normalizeObjectResponse(null as any)).toBeNull();
    });
  });

  describe('detectSDKCapabilities', () => {
    it('should return conservative defaults when version unknown', () => {
      // Mock getSuiVersion to return null
      jest.doMock('../compatibility', () => ({
        ...jest.requireActual('../compatibility'),
        getSuiVersion: () => null,
      }));

      const capabilities = detectSDKCapabilities();
      expect(capabilities.hasObjectChanges).toBe(false as any);
      expect(capabilities.hasBalanceChanges).toBe(false as any);
      expect(capabilities.hasEvents).toBe(true as any);
    });
  });

  describe('safeAccess', () => {
    it('should access nested properties safely', () => {
      const obj = { a: { b: { c: 'value' } } };
      expect(safeAccess(obj, 'a?.b?.c', 'default')).toBe('value');
    });

    it('should return fallback for missing properties', () => {
      const obj = { a: { b: {} } };
      expect(safeAccess(obj, 'a?.b?.c', 'default')).toBe('default');
    });

    it('should handle null objects', () => {
      expect(safeAccess(null, 'a?.b?.c', 'default')).toBe('default');
    });

    it('should handle undefined values', () => {
      const obj = { a: { b: { c: undefined } } };
      expect(safeAccess(obj, 'a?.b?.c', 'default')).toBe('default');
    });
  });

  describe('Environment', () => {
    it('should detect Node.js environment', () => {
      expect(Environment.isNode()).toBe(true as any);
      expect(Environment.isBrowser()).toBe(false as any);
    });

    it('should check localStorage support', () => {
      // In Node.js, localStorage is not available
      expect(Environment.supportsLocalStorage()).toBe(false as any);
    });

    it('should check WebSocket support', () => {
      // In Node.js, WebSocket may or may not be available
      const hasWebSocket = Environment.supportsWebSocket();
      expect(typeof hasWebSocket).toBe('boolean');
    });
  });
});