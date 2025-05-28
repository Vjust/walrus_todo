import { FuzzGenerator } from '../helpers/fuzz-generator';
import { 
  safeStringify, 
  createMemoryEfficientMock, 
  forceGC, 
  getMemoryUsage, 
  logMemoryUsage,
  createLimitedArray 
} from '../../apps/cli/src/__tests__/helpers/memory-utils';

describe('Memory Management Tests', () => {
  let initialMemory: NodeJS.MemoryUsage;
  
  beforeAll(() => {
    forceGC();
    initialMemory = getMemoryUsage();
    logMemoryUsage('Initial');
  });

  afterAll(() => {
    forceGC();
    const finalMemory = getMemoryUsage();
    logMemoryUsage('Final');
    
    // Check that we haven't leaked too much memory
    const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
    const maxAcceptableGrowth = 50 * 1024 * 1024; // 50MB
    
    if (heapGrowth > maxAcceptableGrowth) {
      console.warn(`Heap grew by ${Math.round(heapGrowth / 1024 / 1024)}MB, which is more than the ${Math.round(maxAcceptableGrowth / 1024 / 1024)}MB threshold`);
    }
  });

  describe('safeStringify', () => {
    it('should handle circular references without throwing', () => {
      const obj: any = { name: 'test' };
      obj.self = obj; // Create circular reference
      
      const result = safeStringify(obj);
      expect(result).toContain('[CIRCULAR_REFERENCE]');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should limit depth to prevent stack overflow', () => {
      const deepObj: any = {};
      let current = deepObj;
      
      // Create deep nesting
      for (let i = 0; i < 20; i++) {
        current.nested = { level: i };
        current = current.nested;
      }
      
      const result = safeStringify(deepObj, 5);
      expect(result).toContain('[MAX_DEPTH_EXCEEDED]');
    });

    it('should limit size to prevent memory overflow', () => {
      const largeObj = {
        data: 'x'.repeat(1000000) // 1MB string
      };
      
      const result = safeStringify(largeObj, 10, 500000); // 500KB limit
      expect(result).toContain('[SIZE_LIMIT_EXCEEDED]');
    });

    it('should truncate large arrays', () => {
      const largeArray = Array.from({ length: 200 }, (_, i) => i);
      
      const result = safeStringify(largeArray);
      expect(result).toContain('[ARRAY_TRUNCATED]');
    });

    it('should truncate objects with many properties', () => {
      const largeObj: any = {};
      for (let i = 0; i < 100; i++) {
        largeObj[`prop${i}`] = `value${i}`;
      }
      
      const result = safeStringify(largeObj);
      expect(result).toContain('[OBJECT_TRUNCATED]');
    });
  });

  describe('createMemoryEfficientMock', () => {
    it('should limit call history to prevent memory buildup', () => {
      const mock = createMemoryEfficientMock('test', { maxCallHistory: 5 });
      
      // Make many calls
      for (let i = 0; i < 10; i++) {
        mock(`call${i}`);
      }
      
      // Should only keep last 5 calls
      expect(mock.mock.calls.length).toBeLessThanOrEqual(5);
      expect(mock.mock.results.length).toBeLessThanOrEqual(5);
    });

    it('should handle large return values gracefully', () => {
      const largeValue = 'x'.repeat(2000);
      const mock = createMemoryEfficientMock(largeValue, { maxReturnSize: 1000 });
      
      const result = mock();
      expect(result).toBe('[MOCK_VALUE_TOO_LARGE]');
    });
  });

  describe('createLimitedArray', () => {
    it('should respect maximum size limits', () => {
      const generator = () => 'test';
      const result = createLimitedArray(generator, 2000, 100);
      
      expect(result.length).toBe(100);
    });

    it('should not exceed memory when creating large arrays', () => {
      const generator = () => ({ data: 'x'.repeat(100) });
      
      const beforeMemory = getMemoryUsage().heapUsed;
      const result = createLimitedArray(generator, 10000, 50);
      const afterMemory = getMemoryUsage().heapUsed;
      
      expect(result.length).toBe(50);
      
      // Should not use excessive memory
      const memoryGrowth = afterMemory - beforeMemory;
      const maxExpectedGrowth = 1024 * 1024; // 1MB
      expect(memoryGrowth).toBeLessThan(maxExpectedGrowth);
    });
  });

  describe('FuzzGenerator memory efficiency', () => {
    it('should respect string length limits', () => {
      const fuzzer = new FuzzGenerator();
      
      // Try to generate a huge string, should be capped
      const result = fuzzer.string({ 
        minLength: 50000, 
        maxLength: 100000 
      });
      
      // Should be capped at 10k
      expect(result.length).toBeLessThanOrEqual(10000);
    });

    it('should respect array size limits', () => {
      const fuzzer = new FuzzGenerator();
      
      // Try to generate a huge array, should be capped
      const result = fuzzer.array(
        () => 'test',
        { minLength: 5000, maxLength: 10000 }
      );
      
      // Should be capped at 1000
      expect(result.length).toBeLessThanOrEqual(1000);
    });

    it('should respect buffer size limits', () => {
      const fuzzer = new FuzzGenerator();
      
      // Try to generate a huge buffer, should be capped
      const result = fuzzer.buffer({ 
        minLength: 100000, 
        maxLength: 1000000 
      });
      
      // Should be capped at 64KB
      expect(result.length).toBeLessThanOrEqual(65536);
    });
  });

  describe('Memory leak prevention', () => {
    it('should not accumulate memory across multiple operations', () => {
      const fuzzer = new FuzzGenerator();
      
      const beforeMemory = getMemoryUsage().heapUsed;
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        const obj = {
          id: fuzzer.string(),
          data: fuzzer.array(() => fuzzer.string(), { maxLength: 10 }),
          buffer: fuzzer.buffer({ maxLength: 1024 })
        };
        
        // Stringify and discard
        safeStringify(obj);
        
        // Force cleanup every 10 iterations
        if (i % 10 === 0) {
          forceGC();
        }
      }
      
      forceGC();
      const afterMemory = getMemoryUsage().heapUsed;
      
      // Memory growth should be reasonable
      const memoryGrowth = afterMemory - beforeMemory;
      const maxAcceptableGrowth = 10 * 1024 * 1024; // 10MB
      
      expect(memoryGrowth).toBeLessThan(maxAcceptableGrowth);
    });
  });
});