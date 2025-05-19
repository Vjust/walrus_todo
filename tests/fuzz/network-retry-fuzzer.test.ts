import { FuzzGenerator } from '../helpers/fuzz-generator';
import { RetryManager, NetworkNode } from '../../src/utils/retry-manager';
import { CLIError } from '../../src/types/error';

describe('Network Retry Fuzzing Tests', () => {
  const fuzzer = new FuzzGenerator();
  
  describe('Retry Manager Resilience', () => {
    it('should handle random network failures with various retry configurations', async () => {
      const baseUrls = fuzzer.array(() => `https://node${fuzzer.number(1, 100)}.example.com`, {
        minLength: 2,
        maxLength: 10
      });

      const retryConfigs = fuzzer.array(() => ({
        initialDelay: fuzzer.number(100, 2000),
        maxDelay: fuzzer.number(5000, 60000),
        maxRetries: fuzzer.number(1, 10),
        maxDuration: fuzzer.number(10000, 300000),
        timeout: fuzzer.number(1000, 30000),
        adaptiveDelay: fuzzer.boolean(0.7),
        loadBalancing: fuzzer.subset(['health', 'round-robin', 'priority'])[0] as 'health' | 'round-robin' | 'priority',
        minNodes: fuzzer.number(1, baseUrls.length),
        healthThreshold: Math.random() * 0.8 + 0.1,
        circuitBreaker: fuzzer.boolean(0.8) ? {
          failureThreshold: fuzzer.number(3, 10),
          resetTimeout: fuzzer.number(5000, 60000)
        } : undefined
      }), { minLength: 10, maxLength: 30 });

      for (const config of retryConfigs) {
        const manager = new RetryManager(baseUrls, config);
        
        // Create a complex operation with random failure patterns
        const operation = async (node: NetworkNode) => {
          const failureProbability = fuzzer.number(30, 90) / 100;
          const latency = fuzzer.number(10, 5000);
          
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, latency));
          
          if (Math.random() < failureProbability) {
            // Generate various types of errors
            const errorTypes = [
              () => new Error('ETIMEDOUT'),
              () => new Error('ECONNRESET'),
              () => new Error('ECONNREFUSED'),
              () => new Error('Network timeout'),
              () => { const e = new Error('HTTP Error'); (e as any).status = fuzzer.subset([408, 429, 500, 502, 503, 504])[0]; return e; },
              () => new Error('insufficient storage'),
              () => new Error('blob not found'),
              () => new Error('certification pending'),
              () => new Error('Rate limit exceeded'),
              () => new Error(`5${fuzzer.number(0, 9)}${fuzzer.number(0, 9)}`)
            ];
            
            throw errorTypes[Math.floor(Math.random() * errorTypes.length)]();
          }
          
          return { success: true, node: node.url, latency };
        };

        try {
          const result = await manager.execute(operation, 'fuzz-test');
          expect(result).toHaveProperty('success', true);
        } catch (error) {
          // Verify that final errors are meaningful
          expect(error).toBeInstanceOf(CLIError);
          expect(['RETRY_MAX_ATTEMPTS', 'RETRY_TIMEOUT', 'RETRY_INSUFFICIENT_NODES', 'RETRY_NON_RETRYABLE']).toContain((error as CLIError).code);
        }
      }
    });

    it('should handle concurrent operations with varying network conditions', async () => {
      const baseUrls = fuzzer.array(() => `https://node${fuzzer.number(1, 20)}.example.com`, {
        minLength: 5,
        maxLength: 15
      });

      const manager = new RetryManager(baseUrls, {
        maxRetries: 5,
        adaptiveDelay: true,
        circuitBreaker: {
          failureThreshold: 5,
          resetTimeout: 10000
        }
      });

      // Generate concurrent operations with different characteristics
      const operations = fuzzer.array(() => {
        const operationType = fuzzer.subset(['fast', 'slow', 'flaky', 'broken'])[0];
        
        return {
          name: `operation-${fuzzer.string({ maxLength: 10 })}`,
          execute: async (node: NetworkNode) => {
            const baseLatency = operationType === 'fast' ? 50 : operationType === 'slow' ? 2000 : 500;
            const latency = fuzzer.number(baseLatency * 0.5, baseLatency * 1.5);
            
            await new Promise(resolve => setTimeout(resolve, latency));
            
            switch (operationType) {
              case 'broken':
                throw new Error('Permanently broken');
              case 'flaky':
                if (Math.random() < 0.6) throw fuzzer.networkError();
                break;
              case 'slow':
                if (Math.random() < 0.2) throw new Error('Request timeout');
                break;
            }
            
            return { type: operationType, node: node.url, latency };
          }
        };
      }, { minLength: 10, maxLength: 50 });

      // Execute operations concurrently
      const results = await Promise.allSettled(
        operations.map(op => manager.execute(op.execute, op.name))
      );

      // Analyze results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      expect(successful + failed).toBe(operations.length);
      
      // Verify that broken operations failed appropriately
      const brokenOps = operations.filter(op => op.name.includes('broken')).length;
      expect(failed).toBeGreaterThanOrEqual(brokenOps * 0.8); // Allow some margin
    });

    it('should adapt retry behavior based on network health patterns', async () => {
      const baseUrls = ['http://primary.example.com', 'http://secondary.example.com', 'http://tertiary.example.com'];
      
      const manager = new RetryManager(baseUrls, {
        adaptiveDelay: true,
        loadBalancing: 'health',
        healthThreshold: 0.3,
        circuitBreaker: {
          failureThreshold: 3,
          resetTimeout: 5000
        }
      });

      // Simulate degrading network conditions
      const phases = [
        { duration: 5000, primaryFailRate: 0.1, secondaryFailRate: 0.2, tertiaryFailRate: 0.3 },
        { duration: 5000, primaryFailRate: 0.5, secondaryFailRate: 0.3, tertiaryFailRate: 0.2 },
        { duration: 5000, primaryFailRate: 0.9, secondaryFailRate: 0.1, tertiaryFailRate: 0.1 },
        { duration: 5000, primaryFailRate: 0.1, secondaryFailRate: 0.1, tertiaryFailRate: 0.9 },
      ];

      const startTime = Date.now();
      const operationResults: any[] = [];

      for (const phase of phases) {
        const phaseEnd = Date.now() + phase.duration;
        
        while (Date.now() < phaseEnd) {
          const operation = async (node: NetworkNode) => {
            const failRate = node.url.includes('primary') ? phase.primaryFailRate :
                           node.url.includes('secondary') ? phase.secondaryFailRate :
                           phase.tertiaryFailRate;
            
            const latency = fuzzer.number(50, 500);
            await new Promise(resolve => setTimeout(resolve, latency));
            
            if (Math.random() < failRate) {
              throw fuzzer.networkError();
            }
            
            return { node: node.url, timestamp: Date.now() - startTime };
          };

          try {
            const result = await manager.execute(operation, 'adaptive-test');
            operationResults.push({ ...result, success: true });
          } catch (error) {
            operationResults.push({ 
              error: error.message, 
              timestamp: Date.now() - startTime,
              success: false 
            });
          }
          
          // Add some delay between operations
          await new Promise(resolve => setTimeout(resolve, fuzzer.number(100, 300)));
        }
      }

      // Analyze node selection patterns
      const nodeUsage = operationResults.reduce((acc, result) => {
        if (result.node) {
          acc[result.node] = (acc[result.node] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Verify adaptive behavior
      const successRate = operationResults.filter(r => r.success).length / operationResults.length;
      expect(successRate).toBeGreaterThan(0.5); // Should maintain reasonable success rate
      
      // Check health scores
      const health = manager.getNodesHealth();
      expect(health.length).toBe(3);
      health.forEach(node => {
        expect(node.health).toBeGreaterThanOrEqual(0.1);
        expect(node.health).toBeLessThanOrEqual(1.0);
      });
    });

    it('should handle extreme network conditions and edge cases', async () => {
      const extremeCases = [
        // All nodes fail consistently
        {
          name: 'all-failing',
          urls: ['http://fail1.com', 'http://fail2.com'],
          operation: async () => { throw new Error('Network error'); },
          expectedError: 'RETRY_MAX_ATTEMPTS'
        },
        // Very slow responses
        {
          name: 'very-slow',
          urls: ['http://slow1.com', 'http://slow2.com'],
          operation: async () => {
            await new Promise(resolve => setTimeout(resolve, 20000));
            return 'success';
          },
          expectedError: 'RETRY_TIMEOUT',
          config: { timeout: 5000, maxDuration: 10000 }
        },
        // Insufficient healthy nodes
        {
          name: 'insufficient-nodes',
          urls: ['http://node1.com'],
          operation: async () => { throw new Error('Connection refused'); },
          expectedError: 'RETRY_INSUFFICIENT_NODES',
          config: { minNodes: 2 }
        },
        // Non-retryable errors
        {
          name: 'non-retryable',
          urls: ['http://node1.com', 'http://node2.com'],
          operation: async () => { throw new Error('Invalid credentials'); },
          expectedError: 'RETRY_NON_RETRYABLE'
        }
      ];

      for (const testCase of extremeCases) {
        const manager = new RetryManager(testCase.urls, testCase.config || {});
        
        try {
          await manager.execute(testCase.operation, testCase.name);
          fail(`Expected ${testCase.name} to throw ${testCase.expectedError}`);
        } catch (error) {
          expect(error).toBeInstanceOf(CLIError);
          expect((error as CLIError).code).toBe(testCase.expectedError);
        }
      }
    });

    it('should handle rapid node health fluctuations', async () => {
      const nodes = fuzzer.array(() => `http://node${fuzzer.number(1, 5)}.example.com`, {
        minLength: 3,
        maxLength: 7
      });

      const manager = new RetryManager(nodes, {
        adaptiveDelay: true,
        loadBalancing: 'health',
        circuitBreaker: {
          failureThreshold: 4,
          resetTimeout: 3000
        }
      });

      // Create operations that cause rapid health changes
      const operations = fuzzer.array(() => {
        let consecutiveFailures = 0;
        
        return async (node: NetworkNode) => {
          // Simulate bursty failures
          if (node.url.includes('node1')) {
            consecutiveFailures++;
            if (consecutiveFailures > 3 && consecutiveFailures < 7) {
              throw new Error('Temporary failure burst');
            }
          }
          
          // Random network conditions
          const conditions = fuzzer.subset([
            'normal',
            'slow',
            'timeout',
            'error',
            'rate_limit'
          ], { minSize: 1, maxSize: 1 })[0];

          switch (conditions) {
            case 'slow':
              await new Promise(resolve => setTimeout(resolve, fuzzer.number(1000, 3000)));
              break;
            case 'timeout':
              await new Promise(resolve => setTimeout(resolve, 10000));
              throw new Error('Request timeout');
            case 'error':
              throw new Error(`5${fuzzer.number(0, 9)}${fuzzer.number(0, 9)}`);
            case 'rate_limit':
              const e = new Error('Too many requests');
              (e as any).status = 429;
              throw e;
          }
          
          return { success: true, condition: conditions, node: node.url };
        };
      }, { minLength: 100, maxLength: 200 });

      // Execute operations and track results
      const results = await Promise.allSettled(
        operations.map((op, index) => 
          manager.execute(op, `health-flux-${index}`)
        )
      );

      // Analyze health patterns
      const healthSnapshots = [];
      for (let i = 0; i < 10; i++) {
        healthSnapshots.push(manager.getNodesHealth());
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Verify health system responds appropriately
      expect(healthSnapshots.length).toBeGreaterThan(0);
      healthSnapshots.forEach(snapshot => {
        snapshot.forEach(node => {
          expect(node.health).toBeGreaterThanOrEqual(0.1);
          expect(node.health).toBeLessThanOrEqual(1.0);
        });
      });
    });
  });
});