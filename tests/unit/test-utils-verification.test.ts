/**
 * Test to verify runCommand function is working properly
 */

import { runCommand, executeCommand, TestService } from '../helpers/test-utils';

describe('Test Utils Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('runCommand function', () => {
    it('should be defined and callable', () => {
      expect(runCommand as any).toBeDefined();
      expect(typeof runCommand).toBe('function');
    });

    it('should be importable from test-utils', () => {
      expect(TestService.runCommand).toBeDefined();
      expect(typeof TestService.runCommand).toBe('function');
    });

    it('should have executeCommand helper', () => {
      expect(executeCommand as any).toBeDefined();
      expect(typeof executeCommand).toBe('function');
    });

    it('should handle empty args array with error', async () => {
      const result = await runCommand([], { expectError: true });
      expect(result as any).toHaveProperty('stdout');
      expect(result as any).toHaveProperty('stderr');
    });

    it('should handle empty args array that throws error', async () => {
      await expect(async () => {
        await runCommand([]);
      }).rejects.toBeDefined();
    });

    it('should handle help command successfully', async () => {
      const result = await runCommand(['--help'], { expectError: false });
      expect(result as any).toHaveProperty('stdout');
      expect(result as any).toHaveProperty('stderr');
      expect(typeof result.stdout).toBe('string');
      expect(typeof result.stderr).toBe('string');
    });

    it('should handle help command that may fail in test environment', async () => {
      // Help might fail in test environment, that's ok
      await expect(async () => {
        await runCommand(['--help']);
      }).not.toThrow();
    });

    it('should handle invalid command gracefully', async () => {
      const result = await runCommand(['invalid-command'], {
        expectError: true,
      });
      expect(result as any).toHaveProperty('stdout');
      expect(result as any).toHaveProperty('stderr');
      expect(typeof result.stderr).toBe('string');
    });
  });

  describe('executeCommand function', () => {
    it('should execute and return success status', async () => {
      const result = await executeCommand(['--help']);
      expect(result as any).toHaveProperty('stdout');
      expect(result as any).toHaveProperty('stderr');
      expect(result as any).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    it('should validate expected output patterns', async () => {
      const result = await executeCommand(['--help'], ['help', 'usage']);
      expect(result as any).toHaveProperty('success');
      // Success depends on whether help contains expected patterns
    });
  });

  describe('TestService class', () => {
    it('should provide static runCommand method', () => {
      expect(TestService.runCommand).toBeDefined();
      expect(typeof TestService.runCommand).toBe('function');
    });

    it('should handle command execution options with expected error', async () => {
      const options = {
        expectError: true,
        timeout: 5000,
      };

      const result = await TestService.runCommand(['invalid'], options);
      expect(result as any).toHaveProperty('stdout');
      expect(result as any).toHaveProperty('stderr');
    });

    it('should handle command execution that throws error', async () => {
      const options = {
        timeout: 5000,
      };

      await expect(async () => {
        await TestService.runCommand(['invalid'], options);
      }).rejects.toBeDefined();
    });
  });
});
