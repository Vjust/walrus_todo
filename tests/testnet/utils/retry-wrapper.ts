import { RetryManager } from '../../../src/utils/retry-manager';
import { CLIError } from '../../../src/types/error';

describe('Testnet Retry Wrapper - Network Resilience', () => {
  // Testnet configuration with realistic URLs
  const testnetNodes = [
    'https://walrus-testnet.devnet.sui.io',
    'https://walrus-testnet-2.devnet.sui.io',
    'https://walrus-testnet-3.devnet.sui.io',
    'https://testnet.walrus.network',
  ];

  // Configuration optimized for testnet conditions
  const testnetConfig = {
    initialDelay: 1000,      // 1 second initial delay
    maxDelay: 30000,         // 30 seconds max delay
    maxRetries: 7,           // More retries for testnet
    maxDuration: 120000,     // 2 minutes total timeout
    timeout: 20000,          // 20 seconds per attempt
    minNodes: 2,             // Need at least 2 working nodes
    healthThreshold: 0.4,    // Lower threshold for testnet
    adaptiveDelay: true,
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeout: 60000,   // 1 minute reset
    },
    loadBalancing: 'health' as const,
  };

  let retryManager: RetryManager;

  beforeEach(() => {
    retryManager = new RetryManager(testnetNodes, testnetConfig);
  });

  describe('Network Resilience Patterns', () => {
    it('should handle intermittent network failures', async () => {
      let attempts = 0;
      const operation = jest.fn(async (node) => {
        attempts++;
        if (attempts <= 3) {
          throw new Error('ECONNRESET');
        }
        return { success: true, node: node.url };
      });

      const result = await retryManager.execute(operation, 'network-test');
      expect(result.success).toBe(true);
      expect(attempts).toBe(4);
    });

    it('should rotate through nodes on failures', async () => {
      const usedNodes = new Set<string>();
      const operation = jest.fn(async (node) => {
        usedNodes.add(node.url);
        if (usedNodes.size < 3) {
          throw new Error('network timeout');
        }
        return { success: true, nodesUsed: Array.from(usedNodes) };
      });

      const result = await retryManager.execute(operation, 'rotation-test');
      expect(result.success).toBe(true);
      expect(usedNodes.size).toBeGreaterThanOrEqual(3);
    });

    it('should handle rate limiting gracefully', async () => {
      let attempts = 0;
      const startTime = Date.now();
      const operation = jest.fn(async (node) => {
        attempts++;
        if (attempts <= 2) {
          const error = new Error('Too Many Requests');
          (error as any).status = 429;
          throw error;
        }
        return { 
          success: true, 
          duration: Date.now() - startTime,
          attempts 
        };
      });

      const result = await retryManager.execute(operation, 'rate-limit-test');
      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(2000); // Should have delays
    });

    it('should open circuit breaker after repeated failures', async () => {
      const failures = new Map<string, number>();
      const operation = jest.fn(async (node) => {
        const count = (failures.get(node.url) || 0) + 1;
        failures.set(node.url, count);
        
        // Always fail for the first node after 5 attempts
        if (node.url === testnetNodes[0] && count >= 5) {
          // Circuit should be open, shouldn't reach here
          throw new Error('Should not reach - circuit should be open');
        }
        
        // Fail a few times, then succeed
        if (count <= 3) {
          throw new Error('connection failed');
        }
        
        return { success: true, node: node.url };
      });

      const result = await retryManager.execute(operation, 'circuit-breaker-test');
      expect(result.success).toBe(true);
      
      // First node should have been tried up to circuit threshold
      const firstNodeFailures = failures.get(testnetNodes[0]) || 0;
      expect(firstNodeFailures).toBeLessThanOrEqual(testnetConfig.circuitBreaker.failureThreshold);
    });
  });

  describe('Testnet-Specific Error Handling', () => {
    it('should handle storage allocation errors', async () => {
      let attempts = 0;
      const operation = jest.fn(async (node) => {
        attempts++;
        if (attempts <= 2) {
          throw new Error('insufficient storage allocation');
        }
        return { success: true, attempts };
      });

      const result = await retryManager.execute(operation, 'storage-test');
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });

    it('should handle blob certification timeouts', async () => {
      let attempts = 0;
      const operation = jest.fn(async (node) => {
        attempts++;
        if (attempts === 1) {
          throw new Error('certification pending');
        }
        return { success: true, certified: true };
      });

      const result = await retryManager.execute(operation, 'certification-test');
      expect(result.certified).toBe(true);
    });

    it('should handle temporary blob unavailability', async () => {
      let attempts = 0;
      const operation = jest.fn(async (node) => {
        attempts++;
        if (attempts <= 2) {
          const error = new Error('blob not found');
          (error as any).statusCode = 460;
          throw error;
        }
        return { success: true, blob: 'available' };
      });

      const result = await retryManager.execute(operation, 'blob-availability-test');
      expect(result.blob).toBe('available');
    });
  });

  describe('Adaptive Delay Strategies', () => {
    it('should increase delay for persistent errors', async () => {
      const delays: number[] = [];
      const startTimes: number[] = [];
      
      const retryManager = new RetryManager(testnetNodes, {
        ...testnetConfig,
        onRetry: (error, attempt, delay) => {
          delays.push(delay);
        }
      });

      let attempts = 0;
      const operation = jest.fn(async (node) => {
        startTimes.push(Date.now());
        attempts++;
        if (attempts <= 3) {
          throw new Error('network error');
        }
        return { success: true };
      });

      await retryManager.execute(operation, 'adaptive-delay-test');
      
      // Delays should generally increase
      expect(delays[2]).toBeGreaterThan(delays[0]);
    });

    it('should adapt delays based on error types', async () => {
      const delays: number[] = [];
      const retryManager = new RetryManager(testnetNodes, {
        ...testnetConfig,
        onRetry: (error, attempt, delay) => {
          delays.push(delay);
        }
      });

      let attempts = 0;
      const operation = jest.fn(async (node) => {
        attempts++;
        if (attempts === 1) {
          throw new Error('timeout error');
        } else if (attempts === 2) {
          const error = new Error('rate limit exceeded');
          (error as any).status = 429;
          throw error;
        } else if (attempts === 3) {
          throw new Error('insufficient storage');
        }
        return { success: true };
      });

      await retryManager.execute(operation, 'error-type-delay-test');
      
      // Rate limit errors should have longer delays
      expect(delays[1]).toBeGreaterThan(delays[0]);
      // Storage errors should have even longer delays
      expect(delays[2]).toBeGreaterThan(delays[1]);
    });
  });

  describe('Node Health Tracking', () => {
    it('should update node health scores', async () => {
      let failCount = 0;
      const operation = jest.fn(async (node) => {
        if (node.url === testnetNodes[0] && failCount < 3) {
          failCount++;
          throw new Error('connection failed');
        }
        return { success: true };
      });

      await retryManager.execute(operation, 'health-tracking-test');
      
      const nodesHealth = retryManager.getNodesHealth();
      const firstNode = nodesHealth.find(n => n.url === testnetNodes[0]);
      const otherNode = nodesHealth.find(n => n.url !== testnetNodes[0]);
      
      // First node should have lower health
      expect(firstNode!.health).toBeLessThan(otherNode!.health);
      expect(firstNode!.consecutiveFailures).toBeGreaterThan(0);
    });

    it('should prefer healthy nodes', async () => {
      const nodeUsage = new Map<string, number>();
      
      // Poison first node
      let poisonedAttempts = 0;
      const poisonOperation = jest.fn(async (node) => {
        if (node.url === testnetNodes[0]) {
          poisonedAttempts++;
          throw new Error('always fails');
        }
        return { success: true };
      });

      // Try to execute and fail a few times on first node
      try {
        await retryManager.execute(poisonOperation, 'poison-test');
      } catch {
        // Expected to fail
      }

      // Now do normal operations and track node usage
      let successCount = 0;
      const normalOperation = jest.fn(async (node) => {
        const count = (nodeUsage.get(node.url) || 0) + 1;
        nodeUsage.set(node.url, count);
        successCount++;
        return { success: true, node: node.url };
      });

      // Execute multiple times
      for (let i = 0; i < 5; i++) {
        await retryManager.execute(normalOperation, `healthy-preference-${i}`);
      }

      // First node should be used less frequently
      const firstNodeUsage = nodeUsage.get(testnetNodes[0]) || 0;
      const totalUsage = Array.from(nodeUsage.values()).reduce((a, b) => a + b, 0);
      const firstNodePercentage = firstNodeUsage / totalUsage;
      
      expect(firstNodePercentage).toBeLessThan(0.2); // Should be avoided
    });
  });

  describe('Load Balancing Strategies', () => {
    it('should support round-robin balancing', async () => {
      const roundRobinManager = new RetryManager(testnetNodes, {
        ...testnetConfig,
        loadBalancing: 'round-robin'
      });

      const nodeUsage: string[] = [];
      const operation = jest.fn(async (node) => {
        nodeUsage.push(node.url);
        return { success: true };
      });

      // Execute multiple times
      for (let i = 0; i < testnetNodes.length * 2; i++) {
        await roundRobinManager.execute(operation, `round-robin-${i}`);
      }

      // Should cycle through all nodes
      for (const node of testnetNodes) {
        expect(nodeUsage).toContain(node);
      }

      // Usage should be relatively balanced
      const usageCount = testnetNodes.map(node => 
        nodeUsage.filter(url => url === node).length
      );
      const maxUsage = Math.max(...usageCount);
      const minUsage = Math.min(...usageCount);
      expect(maxUsage - minUsage).toBeLessThanOrEqual(1);
    });

    it('should support priority-based balancing', async () => {
      const priorityManager = new RetryManager(testnetNodes, {
        ...testnetConfig,
        loadBalancing: 'priority'
      });

      const nodeUsage: string[] = [];
      const operation = jest.fn(async (node) => {
        nodeUsage.push(node.url);
        return { success: true };
      });

      // Execute multiple times
      for (let i = 0; i < 5; i++) {
        await priorityManager.execute(operation, `priority-${i}`);
      }

      // Should mostly use first node (highest priority)
      const firstNodeUsage = nodeUsage.filter(url => url === testnetNodes[0]).length;
      expect(firstNodeUsage).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should recover from total network outage', async () => {
      let outageActive = true;
      setTimeout(() => { outageActive = false; }, 100);

      const operation = jest.fn(async (node) => {
        if (outageActive) {
          throw new Error('network unreachable');
        }
        return { success: true, recovered: true };
      });

      const result = await retryManager.execute(operation, 'outage-recovery');
      expect(result.recovered).toBe(true);
    });

    it('should handle cascading failures', async () => {
      const failureCount = new Map<string, number>();
      const operation = jest.fn(async (node) => {
        const count = (failureCount.get(node.url) || 0) + 1;
        failureCount.set(node.url, count);
        
        // Nodes fail progressively
        if (count <= testnetNodes.indexOf(node.url) + 1) {
          throw new Error('cascading failure');
        }
        
        return { success: true, recovered: node.url };
      });

      const result = await retryManager.execute(operation, 'cascade-test');
      expect(result.success).toBe(true);
      
      // Should have tried multiple nodes
      expect(failureCount.size).toBeGreaterThan(1);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout slow operations', async () => {
      const timeoutManager = new RetryManager(testnetNodes, {
        ...testnetConfig,
        timeout: 100,  // Very short timeout
        maxRetries: 2
      });

      const operation = jest.fn(async (node) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return { success: true };
      });

      await expect(timeoutManager.execute(operation, 'timeout-test'))
        .rejects.toThrow(/timed out/);
    });

    it('should retry after timeouts', async () => {
      let attempts = 0;
      const operation = jest.fn(async (node) => {
        attempts++;
        if (attempts === 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        return { success: true, attempts };
      });

      const timeoutManager = new RetryManager(testnetNodes, {
        ...testnetConfig,
        timeout: 100,
        maxRetries: 3
      });

      const result = await timeoutManager.execute(operation, 'timeout-retry-test');
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });
  });

  describe('Error Context and Reporting', () => {
    it('should maintain error context across retries', async () => {
      const errors: Error[] = [];
      const retryManager = new RetryManager(testnetNodes, {
        ...testnetConfig,
        onRetry: (error, attempt, delay) => {
          errors.push(error);
        }
      });

      let attempts = 0;
      const operation = jest.fn(async (node) => {
        attempts++;
        if (attempts === 1) {
          throw new Error('first error: connection reset');
        } else if (attempts === 2) {
          throw new Error('second error: timeout');
        } else if (attempts === 3) {
          throw new Error('third error: rate limit');
        }
        return { success: true };
      });

      await retryManager.execute(operation, 'error-context-test');
      
      expect(errors).toHaveLength(3);
      expect(errors[0].message).toContain('first error');
      expect(errors[1].message).toContain('second error');
      expect(errors[2].message).toContain('third error');
    });

    it('should provide comprehensive error summary', async () => {
      let errorSummary = '';
      const retryManager = new RetryManager(testnetNodes, {
        ...testnetConfig,
        maxRetries: 3
      });

      const operation = jest.fn(async (node) => {
        throw new Error(`consistent failure on ${node.url}`);
      });

      try {
        await retryManager.execute(operation, 'summary-test');
      } catch (error) {
        if (error instanceof CLIError) {
          errorSummary = error.message;
        }
      }

      expect(errorSummary).toContain('Maximum retries');
      expect(errorSummary).toContain('exceeded');
    });
  });
});