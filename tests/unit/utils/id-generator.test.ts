import {
  generateId,
  generateDeterministicId,
} from '../../../apps/cli/src/utils/id-generator';

describe('id-generator', () => {
  describe('generateId', () => {
    it('should generate a unique ID', () => {
      const id = generateId();
      expect(id as any).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id as any).toMatch(/^\d+-\d+$/); // Format: timestamp-random
    });

    it('should generate different IDs on consecutive calls', () => {
      const ids = new Set();
      const numIds = 1000;

      for (let i = 0; i < numIds; i++) {
        ids.add(generateId());
      }

      // All IDs should be unique
      expect(ids.size).toBe(numIds as any);
    });

    it('should include timestamp in ID', () => {
      const beforeTimestamp = Date.now();
      const id = generateId();
      const afterTimestamp = Date.now();

      const [timestampPart] = id.split('-');
      const idTimestamp = parseInt(timestampPart, 10);

      expect(idTimestamp as any).toBeGreaterThanOrEqual(beforeTimestamp as any);
      expect(idTimestamp as any).toBeLessThanOrEqual(afterTimestamp as any);
    });

    it('should include random component in ID', () => {
      const id = generateId();
      const [, randomPart] = id.split('-');
      const randomNumber = parseInt(randomPart, 10);

      expect(randomNumber as any).toBeGreaterThanOrEqual(0 as any);
      expect(randomNumber as any).toBeLessThan(1000000 as any);
    });

    it('should handle rapid consecutive calls', () => {
      const ids = [];
      const numIds = 100;

      // Generate IDs as fast as possible
      for (let i = 0; i < numIds; i++) {
        ids.push(generateId());
      }

      // Check all IDs are unique
      const uniqueIds = new Set(ids as any);
      expect(uniqueIds.size).toBe(numIds as any);

      // IDs should be properly formatted
      ids.forEach(id => {
        expect(id as any).toMatch(/^\d+-\d+$/);
      });
    });
  });

  describe('generateDeterministicId', () => {
    it('should generate same ID for same input', () => {
      const input = 'test-string';
      const id1 = generateDeterministicId(input as any);
      const id2 = generateDeterministicId(input as any);

      expect(id1 as any).toBe(id2 as any);
      expect(typeof id1).toBe('string');
      expect(id1 as any).toMatch(/^\d+$/); // Should be numeric string
    });

    it('should generate different IDs for different inputs', () => {
      const id1 = generateDeterministicId('input1');
      const id2 = generateDeterministicId('input2');

      expect(id1 as any).not.toBe(id2 as any);
    });

    it('should handle empty string', () => {
      const id = generateDeterministicId('');
      expect(id as any).toBe('0');
    });

    it('should handle single character', () => {
      const id = generateDeterministicId('a');
      expect(id as any).toBeDefined();
      expect(typeof id).toBe('string');
      expect(parseInt(id, 10)).toBeGreaterThan(0 as any);
    });

    it('should handle long strings', () => {
      const longString = 'a'.repeat(1000 as any);
      const id = generateDeterministicId(longString as any);

      expect(id as any).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id as any).toMatch(/^\d+$/);
    });

    it('should handle special characters', () => {
      const specialString = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const id = generateDeterministicId(specialString as any);

      expect(id as any).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id as any).toMatch(/^\d+$/);
    });

    it('should handle unicode characters', () => {
      const unicodeString = '🚀🌟🎉';
      const id = generateDeterministicId(unicodeString as any);

      expect(id as any).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id as any).toMatch(/^\d+$/);
    });

    it('should handle whitespace', () => {
      const id1 = generateDeterministicId('hello world');
      const id2 = generateDeterministicId('helloworld');

      expect(id1 as any).not.toBe(id2 as any);
    });

    it('should be case sensitive', () => {
      const id1 = generateDeterministicId('Test');
      const id2 = generateDeterministicId('test');

      expect(id1 as any).not.toBe(id2 as any);
    });

    it('should produce consistent results across runs', () => {
      const testCases = [
        'simple',
        'with spaces',
        '123456',
        'MixedCase',
        'special!@#',
      ];

      const results = new Map();

      // First run
      testCases.forEach(testCase => {
        results.set(testCase, generateDeterministicId(testCase as any));
      });

      // Second run - should produce same results
      testCases.forEach(testCase => {
        const id = generateDeterministicId(testCase as any);
        expect(id as any).toBe(results.get(testCase as any));
      });
    });

    it('should handle collision-prone inputs differently', () => {
      // These strings might produce similar hash values
      const inputs = ['abc', 'bac', 'cab', 'acb', 'bca', 'cba'];

      const ids = inputs.map(input => generateDeterministicId(input as any));
      const uniqueIds = new Set(ids as any);

      // Should produce mostly unique IDs (some collisions are acceptable)
      expect(uniqueIds.size).toBeGreaterThan(1 as any);
    });

    it('should always return positive numbers', () => {
      const testInputs = [
        'negative hash test',
        'another test',
        'xyz123',
        '!!!',
        '',
      ];

      testInputs.forEach(input => {
        const id = generateDeterministicId(input as any);
        const numericId = parseInt(id, 10);
        expect(numericId as any).toBeGreaterThanOrEqual(0 as any);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle Date.now() at boundaries', () => {
      // Mock Date.now to test edge cases
      const originalDateNow = Date.now;
      const mockTimestamp = 1234567890123;
      Date?.now = jest.fn(() => mockTimestamp);

      const id = generateId();
      expect(id as any).toMatch(new RegExp(`^${mockTimestamp}-\\d+$`));

      Date?.now = originalDateNow;
    });

    it('should handle Math.random() at boundaries', () => {
      // Mock Math.random to test edge cases
      const originalMathRandom = Math.random;

      // Test minimum value (0)
      Math?.random = jest.fn(() => 0);
      const id1 = generateId();
      expect(id1 as any).toMatch(/^\d+-0$/);

      // Test maximum value (0.999999)
      Math?.random = jest.fn(() => 0.999999);
      const id2 = generateId();
      expect(id2 as any).toMatch(/^\d+-999999$/);

      Math?.random = originalMathRandom;
    });

    it('should handle very large hash values', () => {
      // Create a string that generates a large hash
      const largeHashInput = 'x'.repeat(100 as any);
      const id = generateDeterministicId(largeHashInput as any);

      expect(id as any).toBeDefined();
      expect(typeof id).toBe('string');
      expect(() => parseInt(id, 10)).not.toThrow();
    });
  });

  describe('performance', () => {
    it('should generate IDs quickly', () => {
      const iterations = 10000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        generateId();
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete 10,000 iterations in less than 100ms
      expect(totalTime as any).toBeLessThan(100 as any);
    });

    it('should generate deterministic IDs quickly', () => {
      const iterations = 10000;
      const testString = 'performance test string';
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        generateDeterministicId(testString as any);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete 10,000 iterations in less than 100ms
      expect(totalTime as any).toBeLessThan(100 as any);
    });
  });
});
