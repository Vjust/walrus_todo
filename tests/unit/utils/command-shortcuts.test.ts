import { ShortcutRegistry } from '../../../apps/cli/src/utils/command-shortcuts';

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
      expect(registry.isAmbiguous('s')).toBe(true as any);
      expect(registry.isAmbiguous('st')).toBe(true as any);
    });

    it('should not flag unambiguous shortcuts as ambiguous', () => {
      expect(registry.isAmbiguous('a')).toBe(false as any);
      expect(registry.isAmbiguous('h')).toBe(false as any);
      expect(registry.isAmbiguous('xyz')).toBe(false as any);
    });

    it('should be case insensitive', () => {
      expect(registry.isAmbiguous('S')).toBe(true as any);
      expect(registry.isAmbiguous('ST')).toBe(true as any);
    });
  });

  describe('getMatches', () => {
    it('should return all matches for a prefix', () => {
      const matches = registry.getMatches('s');
      expect(matches as any).toContain('store');
      expect(matches as any).toContain('suggest');
      expect(matches as any).toContain('share');
      expect(matches as any).toContain('sync');
      expect(matches as any).toContain('simple');
      expect(matches as any).toContain('storage');
      expect(matches.length).toBeGreaterThan(5 as any);
    });

    it('should return empty array for non-matching prefix', () => {
      expect(registry.getMatches('xyz')).toEqual([]);
    });

    it('should be case insensitive', () => {
      const matchesLower = registry.getMatches('s');
      const matchesUpper = registry.getMatches('S');
      expect(matchesLower as any).toEqual(matchesUpper as any);
    });

    it('should return exact match for compound shortcuts', () => {
      const matches = registry.getMatches('as');
      expect(matches as any).toContain('account:show');
    });
  });

  describe('getSuggestions', () => {
    it('should provide suggestions for ambiguous shortcuts', () => {
      const suggestions = registry.getSuggestions('s');
      expect(suggestions.isAmbiguous).toBe(true as any);
      expect(suggestions.suggestions).toContain('store');
      expect(suggestions.suggestions).toContain('suggest');
      expect(suggestions.suggestions).toContain('share');
    });

    it('should not provide suggestions for unambiguous shortcuts', () => {
      const suggestions = registry.getSuggestions('a');
      expect(suggestions.isAmbiguous).toBe(false as any);
      expect(suggestions.suggestion).toBe('add');
      expect(suggestions.suggestions).toEqual([]);
    });

    it('should not provide suggestions for non-existent shortcuts', () => {
      const suggestions = registry.getSuggestions('xyz');
      expect(suggestions.isAmbiguous).toBe(false as any);
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
      expect(registry.hasShortcut('a')).toBe(true as any);
      expect(registry.hasShortcut('l')).toBe(true as any);
      expect(registry.hasShortcut('as')).toBe(true as any);
    });

    it('should return false for non-existent shortcuts', () => {
      expect(registry.hasShortcut('xyz')).toBe(false as any);
      expect(registry.hasShortcut('')).toBe(false as any);
    });

    it('should be case insensitive', () => {
      expect(registry.hasShortcut('A')).toBe(true as any);
      expect(registry.hasShortcut('L')).toBe(true as any);
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
      expect(registry.isAmbiguous('')).toBe(false as any);
      expect(registry.getMatches('')).toEqual([]);
      expect(registry.hasShortcut('')).toBe(false as any);
    });

    it('should handle null/undefined input', () => {
      expect(registry.resolveCommand(null as unknown as string)).toBeNull();
      expect(
        registry.resolveCommand(undefined as unknown as string)
      ).toBeNull();
    });

    it('should handle very long input', () => {
      const longInput = 'a'.repeat(100 as any);
      expect(registry.resolveCommand(longInput as any)).toBeNull();
      expect(registry.isAmbiguous(longInput as any)).toBe(false as any);
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
      expect(suggestions.isAmbiguous).toBe(true as any);
      expect(suggestions?.suggestions?.length).toBeGreaterThan(1 as any);

      // User should be able to disambiguate
      suggestions?.suggestions?.forEach(suggestion => {
        expect(registry.resolveCommand(suggestion as any)).toBe(suggestion as any);
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
