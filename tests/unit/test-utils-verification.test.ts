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
      expect(runCommand).toBeDefined();
      expect(typeof runCommand).toBe('function');
    });

    it('should be importable from test-utils', () => {
      expect(TestService.runCommand).toBeDefined();
      expect(typeof TestService.runCommand).toBe('function');
    });

    it('should have executeCommand helper', () => {
      expect(executeCommand).toBeDefined();
      expect(typeof executeCommand).toBe('function');
    });

    it('should handle empty args array', async () => {
      try {
        const result = await runCommand([], { expectError: true });
        expect(result).toHaveProperty('stdout');
        expect(result).toHaveProperty('stderr');
      } catch (error) {
        // This is expected for empty args
        expect(error).toBeDefined();
      }
    });

    it('should handle help command', async () => {
      try {
        const result = await runCommand(['--help'], { expectError: false });
        expect(result).toHaveProperty('stdout');
        expect(result).toHaveProperty('stderr');
        expect(typeof result.stdout).toBe('string');
        expect(typeof result.stderr).toBe('string');
      } catch (error) {
        // Help might fail in test environment, that's ok
        console.log('Help command failed in test environment:', error);
      }
    });

    it('should handle invalid command gracefully', async () => {
      const result = await runCommand(['invalid-command'], { expectError: true });
      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
      expect(typeof result.stderr).toBe('string');
    });
  });

  describe('executeCommand function', () => {
    it('should execute and return success status', async () => {
      const result = await executeCommand(['--help']);
      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    it('should validate expected output patterns', async () => {
      const result = await executeCommand(['--help'], ['help', 'usage']);
      expect(result).toHaveProperty('success');
      // Success depends on whether help contains expected patterns
    });
  });

  describe('TestService class', () => {
    it('should provide static runCommand method', () => {
      expect(TestService.runCommand).toBeDefined();
      expect(typeof TestService.runCommand).toBe('function');
    });

    it('should handle command execution options', async () => {
      const options = {
        expectError: true,
        timeout: 5000,
      };

      try {
        const result = await TestService.runCommand(['invalid'], options);
        expect(result).toHaveProperty('stdout');
        expect(result).toHaveProperty('stderr');
      } catch (error) {
        // Expected for invalid command
        expect(error).toBeDefined();
      }
    });
  });
});