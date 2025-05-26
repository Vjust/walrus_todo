import { ShortcutRegistry } from '../../../src/utils/command-shortcuts';

describe('ShortcutRegistry', () => {
  let registry: ShortcutRegistry;

  beforeEach(() => {
    registry = new ShortcutRegistry();
  });

  describe('resolveCommand', () => {
    it('should return null for non-existent shortcuts', () => {
      expect(registry.resolveCommand('xyz')).toBeNull();
    });

    it('should resolve exact matches', () => {
      expect(registry.resolveCommand('a')).toBe('add');
      expect(registry.resolveCommand('l')).toBe('list');
      expect(registry.resolveCommand('c')).toBe('complete');
    });

    it('should resolve partial matches', () => {
      expect(registry.resolveCommand('co')).toBe('complete');
      expect(registry.resolveCommand('comp')).toBe('complete');
      expect(registry.resolveCommand('del')).toBe('delete');
    });

    it('should be case insensitive', () => {
      expect(registry.resolveCommand('A')).toBe('add');
      expect(registry.resolveCommand('COMP')).toBe('complete');
      expect(registry.resolveCommand('DeLeTe')).toBe('delete');
    });

    it('should return null for ambiguous shortcuts', () => {
      expect(registry.resolveCommand('s')).toBeNull(); // store, suggest, share, etc
      expect(registry.resolveCommand('st')).toBeNull(); // store, storage
    });

    it('should resolve compound shortcuts', () => {
      expect(registry.resolveCommand('as')).toBe('account:show');
      expect(registry.resolveCommand('asw')).toBe('account:switch');
      expect(registry.resolveCommand('acc:sw')).toBe('account:switch');
    });

    it('should handle colon notation for subcommands', () => {
      expect(registry.resolveCommand('ai:enhance')).toBe(
        'ai:enhance-credentials'
      );
      expect(registry.resolveCommand('img:upload')).toBe('image:upload');
      expect(registry.resolveCommand('img:nft')).toBe('image:create-nft');
    });
  });

  describe('isAmbiguous', () => {
    it('should detect ambiguous shortcuts', () => {
      expect(registry.isAmbiguous('s')).toBe(true);
      expect(registry.isAmbiguous('st')).toBe(true);
    });

    it('should not flag unambiguous shortcuts as ambiguous', () => {
      expect(registry.isAmbiguous('a')).toBe(false);
      expect(registry.isAmbiguous('h')).toBe(false);
      expect(registry.isAmbiguous('xyz')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(registry.isAmbiguous('S')).toBe(true);
      expect(registry.isAmbiguous('ST')).toBe(true);
    });
  });

  describe('getMatches', () => {
    it('should return all matches for a prefix', () => {
      const matches = registry.getMatches('s');
      expect(matches).toContain('store');
      expect(matches).toContain('suggest');
      expect(matches).toContain('share');
      expect(matches).toContain('sync');
      expect(matches).toContain('simple');
      expect(matches).toContain('storage');
      expect(matches.length).toBeGreaterThan(5);
    });

    it('should return empty array for non-matching prefix', () => {
      expect(registry.getMatches('xyz')).toEqual([]);
    });

    it('should be case insensitive', () => {
      const matchesLower = registry.getMatches('s');
      const matchesUpper = registry.getMatches('S');
      expect(matchesLower).toEqual(matchesUpper);
    });

    it('should return exact match for compound shortcuts', () => {
      const matches = registry.getMatches('as');
      expect(matches).toContain('account:show');
    });
  });

  describe('getSuggestions', () => {
    it('should provide suggestions for ambiguous shortcuts', () => {
      const suggestions = registry.getSuggestions('s');
      expect(suggestions.isAmbiguous).toBe(true);
      expect(suggestions.suggestions).toContain('store');
      expect(suggestions.suggestions).toContain('suggest');
      expect(suggestions.suggestions).toContain('share');
    });

    it('should not provide suggestions for unambiguous shortcuts', () => {
      const suggestions = registry.getSuggestions('a');
      expect(suggestions.isAmbiguous).toBe(false);
      expect(suggestions.suggestion).toBe('add');
      expect(suggestions.suggestions).toEqual([]);
    });

    it('should not provide suggestions for non-existent shortcuts', () => {
      const suggestions = registry.getSuggestions('xyz');
      expect(suggestions.isAmbiguous).toBe(false);
      expect(suggestions.suggestion).toBeNull();
      expect(suggestions.suggestions).toEqual([]);
    });

    it('should be case insensitive', () => {
      const suggestionsLower = registry.getSuggestions('s');
      const suggestionsUpper = registry.getSuggestions('S');
      expect(suggestionsLower.suggestions).toEqual(
        suggestionsUpper.suggestions
      );
    });
  });

  describe('hasShortcut', () => {
    it('should return true for existing shortcuts', () => {
      expect(registry.hasShortcut('a')).toBe(true);
      expect(registry.hasShortcut('l')).toBe(true);
      expect(registry.hasShortcut('as')).toBe(true);
    });

    it('should return false for non-existent shortcuts', () => {
      expect(registry.hasShortcut('xyz')).toBe(false);
      expect(registry.hasShortcut('')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(registry.hasShortcut('A')).toBe(true);
      expect(registry.hasShortcut('L')).toBe(true);
    });
  });

  describe('custom shortcuts', () => {
    beforeEach(() => {
      registry = new ShortcutRegistry({
        custom: 'test:custom',
        foo: 'bar:baz',
      });
    });

    it('should register custom shortcuts', () => {
      expect(registry.resolveCommand('custom')).toBe('test:custom');
      expect(registry.resolveCommand('foo')).toBe('bar:baz');
    });

    it('should override default shortcuts', () => {
      registry = new ShortcutRegistry({
        a: 'test:override',
      });
      expect(registry.resolveCommand('a')).toBe('test:override');
    });

    it('should work with partial matches', () => {
      expect(registry.resolveCommand('cus')).toBe('test:custom');
      expect(registry.resolveCommand('fo')).toBe('bar:baz');
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      expect(registry.resolveCommand('')).toBeNull();
      expect(registry.isAmbiguous('')).toBe(false);
      expect(registry.getMatches('')).toEqual([]);
      expect(registry.hasShortcut('')).toBe(false);
    });

    it('should handle null/undefined input', () => {
      expect(registry.resolveCommand(null as unknown as string)).toBeNull();
      expect(registry.resolveCommand(undefined as unknown as string)).toBeNull();
    });

    it('should handle very long input', () => {
      const longInput = 'a'.repeat(100);
      expect(registry.resolveCommand(longInput)).toBeNull();
      expect(registry.isAmbiguous(longInput)).toBe(false);
    });

    it('should handle special characters', () => {
      expect(registry.resolveCommand('a:b:c')).toBeNull();
      expect(registry.resolveCommand('--add')).toBeNull();
      expect(registry.resolveCommand('add!')).toBeNull();
    });
  });

  describe('integration scenarios', () => {
    it('should handle real CLI command sequence', () => {
      // Simulate a user typing progressively
      expect(registry.resolveCommand('s')).toBeNull(); // ambiguous
      expect(registry.resolveCommand('st')).toBeNull(); // still ambiguous
      expect(registry.resolveCommand('sto')).toBe('store'); // resolved
    });

    it('should provide helpful suggestions for ambiguous shortcuts', () => {
      const suggestions = registry.getSuggestions('s');
      expect(suggestions.isAmbiguous).toBe(true);
      expect(suggestions.suggestions.length).toBeGreaterThan(1);

      // User should be able to disambiguate
      suggestions.suggestions.forEach(suggestion => {
        expect(registry.resolveCommand(suggestion)).toBe(suggestion);
      });
    });

    it('should handle subcommand navigation', () => {
      expect(registry.resolveCommand('ai')).toBe('ai'); // main command
      expect(registry.resolveCommand('ai:v')).toBe('ai:verify'); // subcommand
      expect(registry.resolveCommand('account')).toBe('account'); // main command
      expect(registry.resolveCommand('account:s')).toBeNull(); // ambiguous (show/switch)
      expect(registry.resolveCommand('account:sh')).toBe('account:show'); // resolved
    });
  });
});
