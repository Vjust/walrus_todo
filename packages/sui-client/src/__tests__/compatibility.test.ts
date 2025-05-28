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
      const version = parseVersion('1.30.1');
      expect(version).toEqual({
        major: 1,
        minor: 30,
        patch: 1,
        full: '1.30.1',
      });
    });

    it('should handle version strings with pre-release tags', () => {
      const version = parseVersion('1.30.1-beta.1');
      expect(version.major).toBe(1);
      expect(version.minor).toBe(30);
      expect(version.patch).toBe(1);
    });

    it('should throw error for invalid version strings', () => {
      expect(() => parseVersion('invalid')).toThrow('Invalid version string');
    });
  });

  describe('isVersionAtLeast', () => {
    it('should return true when current version is higher', () => {
      const current = { major: 1, minor: 30, patch: 1, full: '1.30.1' };
      const required = { major: 1, minor: 30, patch: 0, full: '1.30.0' };
      expect(isVersionAtLeast(current, required)).toBe(true);
    });

    it('should return false when current version is lower', () => {
      const current = { major: 1, minor: 29, patch: 1, full: '1.29.1' };
      const required = { major: 1, minor: 30, patch: 0, full: '1.30.0' };
      expect(isVersionAtLeast(current, required)).toBe(false);
    });

    it('should return true when versions are equal', () => {
      const current = { major: 1, minor: 30, patch: 0, full: '1.30.0' };
      const required = { major: 1, minor: 30, patch: 0, full: '1.30.0' };
      expect(isVersionAtLeast(current, required)).toBe(true);
    });
  });

  describe('createCompatibleSuiClientOptions', () => {
    it('should create compatible options with required fields', () => {
      const options = { url: 'https://fullnode.testnet.sui.io:443' };
      const compatOptions = createCompatibleSuiClientOptions(options);
      
      expect(compatOptions.url).toBe(options.url);
      expect(compatOptions.rpcTimeout).toBe(30000);
      expect(compatOptions.websocketTimeout).toBe(30000);
    });

    it('should preserve custom timeout values', () => {
      const options = { 
        url: 'https://fullnode.testnet.sui.io:443',
        rpcTimeout: 60000 
      };
      const compatOptions = createCompatibleSuiClientOptions(options);
      
      expect(compatOptions.rpcTimeout).toBe(60000);
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

      const normalized = normalizeTransactionResult(result);
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

      const normalized = normalizeTransactionResult(result);
      expect(normalized.digest).toBe('test-digest');
      expect(normalized.events).toEqual([]);
      expect(normalized.objectChanges).toEqual([]);
      expect(normalized.balanceChanges).toEqual([]);
    });

    it('should return null for null input', () => {
      expect(normalizeTransactionResult(null)).toBeNull();
    });
  });

  describe('normalizeOwnedObjectsResponse', () => {
    it('should normalize response with data', () => {
      const response = {
        data: [{ objectId: 'test' }],
        nextCursor: 'cursor',
        hasNextPage: true,
      };

      const normalized = normalizeOwnedObjectsResponse(response);
      expect(normalized.data).toEqual([{ objectId: 'test' }]);
      expect(normalized.nextCursor).toBe('cursor');
      expect(normalized.hasNextPage).toBe(true);
    });

    it('should handle missing data', () => {
      const response = {};
      const normalized = normalizeOwnedObjectsResponse(response);
      
      expect(normalized.data).toEqual([]);
      expect(normalized.hasNextPage).toBe(false);
    });

    it('should handle null response', () => {
      const normalized = normalizeOwnedObjectsResponse(null);
      expect(normalized.data).toEqual([]);
    });
  });

  describe('normalizeObjectResponse', () => {
    it('should return response as-is when valid', () => {
      const response = { data: { objectId: 'test' } };
      expect(normalizeObjectResponse(response)).toBe(response);
    });

    it('should return null for null input', () => {
      expect(normalizeObjectResponse(null)).toBeNull();
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
      expect(capabilities.hasObjectChanges).toBe(false);
      expect(capabilities.hasBalanceChanges).toBe(false);
      expect(capabilities.hasEvents).toBe(true);
    });
  });

  describe('safeAccess', () => {
    it('should access nested properties safely', () => {
      const obj = { a: { b: { c: 'value' } } };
      expect(safeAccess(obj, 'a.b.c', 'default')).toBe('value');
    });

    it('should return fallback for missing properties', () => {
      const obj = { a: { b: {} } };
      expect(safeAccess(obj, 'a.b.c', 'default')).toBe('default');
    });

    it('should handle null objects', () => {
      expect(safeAccess(null, 'a.b.c', 'default')).toBe('default');
    });

    it('should handle undefined values', () => {
      const obj = { a: { b: { c: undefined } } };
      expect(safeAccess(obj, 'a.b.c', 'default')).toBe('default');
    });
  });

  describe('Environment', () => {
    it('should detect Node.js environment', () => {
      expect(Environment.isNode()).toBe(true);
      expect(Environment.isBrowser()).toBe(false);
    });

    it('should check localStorage support', () => {
      // In Node.js, localStorage is not available
      expect(Environment.supportsLocalStorage()).toBe(false);
    });

    it('should check WebSocket support', () => {
      // In Node.js, WebSocket may or may not be available
      const hasWebSocket = Environment.supportsWebSocket();
      expect(typeof hasWebSocket).toBe('boolean');
    });
  });
});