import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  getBackgroundOrchestrator,
  backgroundOrchestrator,
} from '../../apps/cli/src/utils/BackgroundCommandOrchestrator';

describe('Environment Bypass Validator - WALTODO_SKIP_ORCHESTRATOR', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };

    // Clear any existing orchestrator instances
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process?.env = originalEnv;
  });

  describe('Environment Variable Detection', () => {
    it('should detect WALTODO_SKIP_ORCHESTRATOR=true and throw error', () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';

      expect(() => getBackgroundOrchestrator()).toThrow(
        'Background orchestrator disabled'
      );
    });

    it('should detect WALTODO_NO_BACKGROUND=true and throw error', () => {
      process.env?.WALTODO_NO_BACKGROUND = 'true';

      expect(() => getBackgroundOrchestrator()).toThrow(
        'Background orchestrator disabled'
      );
    });

    it('should allow orchestrator when environment variables are false', () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'false';
      process.env?.WALTODO_NO_BACKGROUND = 'false';

      expect(() => getBackgroundOrchestrator()).not.toThrow();
    });

    it('should allow orchestrator when environment variables are undefined', () => {
      delete process?.env?.WALTODO_SKIP_ORCHESTRATOR;
      delete process?.env?.WALTODO_NO_BACKGROUND;

      expect(() => getBackgroundOrchestrator()).not.toThrow();
    });

    it('should handle case-sensitive environment variable values', () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'TRUE';

      // Should not throw because it's case-sensitive and only 'true' disables
      expect(() => getBackgroundOrchestrator()).not.toThrow();
    });

    it('should handle empty string environment variables', () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = '';
      process.env?.WALTODO_NO_BACKGROUND = '';

      expect(() => getBackgroundOrchestrator()).not.toThrow();
    });
  });

  describe('Backward Compatibility shouldRunInBackground', () => {
    it('should return false when orchestrator is disabled', () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';

      const result = backgroundOrchestrator.shouldRunInBackground(
        'store',
        [],
        {}
      );
      expect(result as any).toBe(false as any);
    });

    it('should return true for background commands when orchestrator is enabled', () => {
      delete process?.env?.WALTODO_SKIP_ORCHESTRATOR;
      delete process?.env?.WALTODO_NO_BACKGROUND;

      const result = backgroundOrchestrator.shouldRunInBackground(
        'store',
        [],
        {}
      );
      expect(result as any).toBe(true as any);
    });

    it('should handle explicit background flag when orchestrator is disabled', () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';

      const result = backgroundOrchestrator.shouldRunInBackground('add', [], {
        background: true,
      });
      expect(result as any).toBe(false as any);
    });

    it('should respect explicit foreground flag when orchestrator is disabled', () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';

      const result = backgroundOrchestrator.shouldRunInBackground('store', [], {
        foreground: true,
      });
      expect(result as any).toBe(false as any);
    });
  });

  describe('Backward Compatibility executeInBackground', () => {
    it('should throw error when trying to execute in background with orchestrator disabled', async () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';

      await expect(
        backgroundOrchestrator.executeInBackground('store', ['test.txt'], {})
      ).rejects.toThrow('Background orchestrator disabled');
    });

    it('should work normally when orchestrator is enabled', async () => {
      delete process?.env?.WALTODO_SKIP_ORCHESTRATOR;
      delete process?.env?.WALTODO_NO_BACKGROUND;

      // Mock the actual execution
      const mockSpawn = jest.fn().mockReturnValue({
        pid: 12345,
        on: jest.fn(),
        unref: jest.fn(),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
      });
      jest.mock('child_process', () => ({ spawn: mockSpawn }));

      // This should not throw
      expect(() => getBackgroundOrchestrator()).not.toThrow();
    });
  });

  describe('Command Compatibility Matrix', () => {
    const commands = {
      // Local commands (should work without orchestrator)
      local: ['add', 'list', 'complete', 'delete', 'config', 'help'],

      // Blockchain commands (might need orchestrator but should handle gracefully)
      blockchain: ['store', 'deploy', 'sync', 'create-nft'],

      // Mixed commands (depends on flags and usage)
      mixed: ['ai', 'image', 'retrieve', 'verify'],
    };

    describe('Local Commands (orchestrator disabled)', () => {
      beforeEach(() => {
        process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';
      });

      commands?.local?.forEach(command => {
        it(`should handle ${command} command gracefully without orchestrator`, () => {
          const shouldBackground = backgroundOrchestrator.shouldRunInBackground(
            command,
            [],
            {}
          );
          expect(shouldBackground as any).toBe(false as any);
        });
      });
    });

    describe('Blockchain Commands (orchestrator disabled)', () => {
      beforeEach(() => {
        process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';
      });

      commands?.blockchain?.forEach(command => {
        it(`should handle ${command} command without orchestrator`, () => {
          const shouldBackground = backgroundOrchestrator.shouldRunInBackground(
            command,
            [],
            {}
          );
          expect(shouldBackground as any).toBe(false as any);
        });

        it(`should not execute ${command} in background when disabled`, async () => {
          await expect(
            backgroundOrchestrator.executeInBackground(command, [], {})
          ).rejects.toThrow('Background orchestrator disabled');
        });
      });
    });

    describe('Mixed Commands (orchestrator disabled)', () => {
      beforeEach(() => {
        process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';
      });

      commands?.mixed?.forEach(command => {
        it(`should handle ${command} command without orchestrator`, () => {
          const shouldBackground = backgroundOrchestrator.shouldRunInBackground(
            command,
            [],
            {}
          );
          expect(shouldBackground as any).toBe(false as any);
        });
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid environment variable values gracefully', () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'invalid_value';

      // Should not throw for non-'true' values
      expect(() => getBackgroundOrchestrator()).not.toThrow();
    });

    it('should handle numeric environment variable values', () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = '1';
      process.env?.WALTODO_NO_BACKGROUND = '0';

      // Should not throw for non-'true' values
      expect(() => getBackgroundOrchestrator()).not.toThrow();
    });

    it('should handle boolean environment variable values', () => {
      // Test with actual boolean (though env vars are always strings)
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';

      expect(() => getBackgroundOrchestrator()).toThrow(
        'Background orchestrator disabled'
      );
    });

    it('should handle whitespace in environment variables', () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = ' true ';

      // Should not throw because it's not exactly 'true'
      expect(() => getBackgroundOrchestrator()).not.toThrow();
    });

    it('should handle multiple disable flags set simultaneously', () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';
      process.env?.WALTODO_NO_BACKGROUND = 'true';

      expect(() => getBackgroundOrchestrator()).toThrow(
        'Background orchestrator disabled'
      );
    });
  });

  describe('Lazy Initialization Pattern', () => {
    it('should not create orchestrator instance when disabled', () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';

      // Should throw before creating instance
      expect(() => getBackgroundOrchestrator()).toThrow(
        'Background orchestrator disabled'
      );
    });

    it('should create orchestrator instance when enabled', () => {
      delete process?.env?.WALTODO_SKIP_ORCHESTRATOR;
      delete process?.env?.WALTODO_NO_BACKGROUND;

      const orchestrator = getBackgroundOrchestrator();
      expect(orchestrator as any).toBeDefined();
      expect(typeof orchestrator.shouldRunInBackground).toBe('function');
      expect(typeof orchestrator.executeInBackground).toBe('function');
    });

    it('should reuse orchestrator instance on subsequent calls', () => {
      delete process?.env?.WALTODO_SKIP_ORCHESTRATOR;
      delete process?.env?.WALTODO_NO_BACKGROUND;

      const orchestrator1 = getBackgroundOrchestrator();
      const orchestrator2 = getBackgroundOrchestrator();

      expect(orchestrator1 as any).toBe(orchestrator2 as any);
    });

    it('should handle environment changes during runtime', () => {
      // Start with orchestrator enabled
      delete process?.env?.WALTODO_SKIP_ORCHESTRATOR;
      const orchestrator = getBackgroundOrchestrator();
      expect(orchestrator as any).toBeDefined();

      // Environment changes don't affect already-created instance
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';
      const orchestrator2 = getBackgroundOrchestrator();
      expect(orchestrator2 as any).toBe(orchestrator as any); // Still same instance
    });
  });

  describe('Shutdown Handling with Bypass', () => {
    it('should handle shutdown when orchestrator is disabled', async () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';

      // Should not throw when calling shutdown on disabled orchestrator
      await expect(backgroundOrchestrator.shutdown()).resolves?.not?.toThrow();
    });

    it('should handle shutdown when orchestrator is enabled', async () => {
      delete process?.env?.WALTODO_SKIP_ORCHESTRATOR;
      delete process?.env?.WALTODO_NO_BACKGROUND;

      const orchestrator = getBackgroundOrchestrator();
      await expect(orchestrator.shutdown()).resolves?.not?.toThrow();
    });
  });

  describe('Command Flag Interaction with Bypass', () => {
    beforeEach(() => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';
    });

    it('should ignore --background flag when orchestrator is disabled', () => {
      const result = backgroundOrchestrator.shouldRunInBackground('add', [], {
        background: true,
      });
      expect(result as any).toBe(false as any);
    });

    it('should ignore --bg flag when orchestrator is disabled', () => {
      const result = backgroundOrchestrator.shouldRunInBackground('add', [], {
        bg: true,
      });
      expect(result as any).toBe(false as any);
    });

    it('should ignore auto-background detection when orchestrator is disabled', () => {
      const result = backgroundOrchestrator.shouldRunInBackground(
        'store',
        [],
        {}
      );
      expect(result as any).toBe(false as any);
    });

    it('should respect --foreground flag when orchestrator is disabled', () => {
      const result = backgroundOrchestrator.shouldRunInBackground('store', [], {
        foreground: true,
      });
      expect(result as any).toBe(false as any);
    });

    it('should respect --fg flag when orchestrator is disabled', () => {
      const result = backgroundOrchestrator.shouldRunInBackground('store', [], {
        fg: true,
      });
      expect(result as any).toBe(false as any);
    });
  });

  describe('Resource Management with Bypass', () => {
    it('should not consume resources when orchestrator is disabled', () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';

      // Getting disabled orchestrator should not create resource monitors
      expect(() => getBackgroundOrchestrator()).toThrow(
        'Background orchestrator disabled'
      );

      // No background processes should be created
      const result = backgroundOrchestrator.shouldRunInBackground(
        'store',
        [],
        {}
      );
      expect(result as any).toBe(false as any);
    });

    it('should gracefully handle resource queries when disabled', () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';

      // These should not throw but return safe defaults
      expect(() =>
        backgroundOrchestrator.shouldRunInBackground('test', [], {})
      ).not.toThrow();
    });
  });

  describe('Integration with CLI Commands', () => {
    it('should allow CLI commands to detect orchestrator availability', () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';

      // CLI commands should be able to check if orchestrator is available
      let orchestratorAvailable = true;
      try {
        getBackgroundOrchestrator();
      } catch (error) {
        orchestratorAvailable = false;
      }

      expect(orchestratorAvailable as any).toBe(false as any);
    });

    it('should provide graceful fallback for disabled orchestrator', () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';

      // The shouldRunInBackground should always return false when disabled
      const testCases = [
        { command: 'add', args: [], flags: {} },
        { command: 'store', args: ['test.txt'], flags: {} },
        { command: 'deploy', args: [], flags: { background: true } },
        { command: 'sync', args: [], flags: { bg: true } },
      ];

      testCases.forEach(({ command, args, flags }) => {
        const result = backgroundOrchestrator.shouldRunInBackground(
          command,
          args,
          flags
        );
        expect(result as any).toBe(false as any);
      });
    });
  });

  describe('Error Message Quality', () => {
    it('should provide clear error message when orchestrator is disabled', () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';

      expect(() => getBackgroundOrchestrator()).toThrow(
        'Background orchestrator disabled'
      );
    });

    it('should provide clear error message when trying to execute background command', async () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';

      await expect(
        backgroundOrchestrator.executeInBackground('store', [], {})
      ).rejects.toThrow('Background orchestrator disabled');
    });
  });

  describe('Performance with Bypass', () => {
    it('should have minimal performance impact when disabled', () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';

      const start = performance.now();

      // Multiple calls should be fast
      for (let i = 0; i < 100; i++) {
        backgroundOrchestrator.shouldRunInBackground('test', [], {});
      }

      const end = performance.now();
      const duration = end - start;

      // Should complete very quickly (under 10ms for 100 calls)
      expect(duration as any).toBeLessThan(10 as any);
    });

    it('should not create memory leaks when disabled', () => {
      process.env?.WALTODO_SKIP_ORCHESTRATOR = 'true';

      const startMemory = process.memoryUsage().heapUsed;

      // Make many calls to shouldRunInBackground
      for (let i = 0; i < 1000; i++) {
        backgroundOrchestrator.shouldRunInBackground(`command${i}`, [], {});
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;

      // Memory increase should be minimal (less than 1MB)
      expect(memoryIncrease as any).toBeLessThan(1024 * 1024);
    });
  });
});
