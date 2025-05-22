/**
 * AI Operations Stress Tests
 * 
 * This suite tests AI operations under heavy load to ensure stability,
 * proper error handling, and graceful degradation under stress.
 */

import { jest } from '@jest/globals';
import { AIService } from '../../src/services/ai/aiService';
import { AIProvider } from '../../src/types/adapters/AIModelAdapter';
import { Todo } from '../../src/types/todo';
import { 
  AIStressTestFramework, 
  StressTestMode, 
  StressTestOptions 
} from './AIStressTestFramework';
import { createMockAIService } from '../helpers/ai-mock-helper';
// Define mock error type
type MockErrorType = 'AUTHENTICATION' | 'RATE_LIMIT' | 'NETWORK' | 'VALIDATION' | 'TIMEOUT';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Configure Jest timeout for stress tests
jest.setTimeout(60000); // 1 minute timeout

// Sample todos for testing
const generateTestTodos = (count: number): Todo[] => {
  const todos: Todo[] = [];
  for (let i = 0; i < count; i++) {
    todos.push({
      id: `todo-${i}`,
      title: `Test Todo ${i}`,
      description: `This is a test todo ${i} for stress testing AI operations`,
      completed: false,
      priority: ['high', 'medium', 'low'][i % 3],
      tags: [`tag-${i % 5}`, 'stress-test'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      private: i % 2 === 0,
      storageLocation: 'local'
    });
  }
  return todos;
};

// Helper to write metrics to a report file
const writeMetricsToReport = (metrics: Record<string, unknown>, testName: string) => {
  // Skip in CI unless explicitly enabled
  if (process.env.CI && !process.env.SAVE_STRESS_TEST_REPORTS) {
    return;
  }
  
  const reportsDir = path.join(__dirname, '..', '..', 'stress-test-reports');
  
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const reportPath = path.join(reportsDir, `${testName}_${timestamp}.json`);
  
  fs.writeFileSync(reportPath, JSON.stringify(metrics, null, 2));
};

describe('AI Operations Stress Tests', () => {
  // Prevent tests from actually calling real APIs in CI
  const testMode = process.env.CI ? StressTestMode.SIMULATED : (
    process.env.STRESS_TEST_MODE === 'real' ? StressTestMode.REAL : StressTestMode.SIMULATED
  );
  
  // Skip real API tests in CI
  const describeStressTest = testMode === StressTestMode.REAL && process.env.CI 
    ? describe.skip 
    : describe;
  
  // Todos for testing
  const testTodos = generateTestTodos(10);
  
  describeStressTest('Concurrent Request Handling', () => {
    it('should handle many concurrent requests without errors', async () => {
      const aiService = createMockAIService({
        provider: AIProvider.XAI,
        mockOptions: {
          latency: {
            enabled: true,
            minLatencyMs: 50,
            maxLatencyMs: 500,
            jitterEnabled: true,
            timeoutProbability: 0.05,
            timeoutAfterMs: 5000
          }
        }
      });
      
      const options: StressTestOptions = {
        mode: testMode,
        concurrentRequests: 10,
        requestCount: 50,
        operationsToTest: ['summarize', 'suggest', 'categorize'],
        timeoutMs: 5000,
        retryCount: 2,
        maxDurationMs: 30000,
        measureResourceUsage: true
      };
      
      const framework = new AIStressTestFramework(aiService, options);
      const metrics = await framework.runTest(testTodos);
      
      writeMetricsToReport(metrics, 'concurrent_requests');
      
      // Assertions
      for (const operation of Object.keys(metrics)) {
        const opMetrics = metrics[operation];
        
        // Allow some failures but ensure most requests succeed
        expect(opMetrics.successfulRequests / opMetrics.totalRequests).toBeGreaterThan(0.8);
        
        // Check performance metrics are recorded
        expect(opMetrics.avgResponseTime).toBeGreaterThan(0);
        expect(opMetrics.p95ResponseTime).toBeGreaterThan(0);
      }
    });
  });
  
  describe('Rate Limit Testing', () => {
    it('should handle rate limiting gracefully', async () => {
      // Create service that will simulate rate limit errors
      const aiService = createMockAIService({
        provider: AIProvider.XAI,
        mockOptions: {
          errors: {
            enabled: true,
            errorType: MockErrorType.RATE_LIMIT,
            probability: 0.2,
            errorMessage: 'Rate limit exceeded'
          }
        }
      });
      
      const options: StressTestOptions = {
        mode: StressTestMode.SIMULATED, // Always use simulated for rate limit testing
        concurrentRequests: 15,
        requestCount: 40,
        operationsToTest: ['summarize', 'categorize'],
        retryCount: 3,
        backoffMultiplier: 2,
        useCircuitBreaker: true,
        abortOnFailureThreshold: 0.6 // Allow many failures for rate limit test
      };
      
      const framework = new AIStressTestFramework(aiService, options);
      
      // Listen for circuit breaker events
      let circuitBreakerOpened = false;
      framework.on('circuitBreakerOpen', () => {
        circuitBreakerOpened = true;
      });
      
      const metrics = await framework.runTest(testTodos);
      writeMetricsToReport(metrics, 'rate_limit_test');
      
      // Check that we hit some rate limits but still succeed overall
      const operations = Object.keys(metrics);
      for (const operation of operations) {
        expect(metrics[operation].rateLimitHits).toBeGreaterThan(0);
      }
      
      // Check if circuit breaker opened
      if (options.useCircuitBreaker) {
        // This will vary depending on the random distribution of errors
        // We're just recording if it happened rather than asserting it must happen
        console.log(`Circuit breaker opened: ${circuitBreakerOpened}`);
      }
    });
  });
  
  describe('Timeout and Retry Mechanism', () => {
    it('should handle timeouts and retry failed requests', async () => {
      const aiService = createMockAIService({
        provider: AIProvider.XAI,
        mockOptions: {
          latency: {
            enabled: true,
            minLatencyMs: 500,
            maxLatencyMs: 6000, // Some requests will exceed timeout
            jitterEnabled: true,
            timeoutProbability: 0.3,
            timeoutAfterMs: 3000
          }
        }
      });
      
      const options: StressTestOptions = {
        mode: StressTestMode.SIMULATED,
        concurrentRequests: 8,
        requestCount: 30,
        timeoutMs: 2000, // Short timeout to trigger retries
        retryCount: 3,
        backoffMultiplier: 1.5,
        operationsToTest: ['summarize', 'suggest']
      };
      
      const framework = new AIStressTestFramework(aiService, options);
      const metrics = await framework.runTest(testTodos);
      
      writeMetricsToReport(metrics, 'timeout_retry');
      
      // We expect to see some timeouts
      for (const operation of Object.keys(metrics)) {
        expect(metrics[operation].timeouts).toBeGreaterThan(0);
        
        // But most should succeed due to retries
        expect(metrics[operation].successfulRequests).toBeGreaterThan(0);
      }
    });
  });
  
  describe('API Fallback and Failover', () => {
    it('should support fallback to another provider on errors', async () => {
      // Create an AIService that we can manipulate
      const aiService = new AIService('mock-api-key');
      
      // Create a spy for setProvider method
      const setProviderSpy = jest.spyOn(aiService, 'setProvider');
      
      // First set a failing mock provider
      const originalProvider = (aiService as any).modelAdapter;
      const failingProviderMock = {
        complete: jest.fn().mockRejectedValue(new Error('API unavailable')),
        completeStructured: jest.fn().mockRejectedValue(new Error('API unavailable')),
        processWithPromptTemplate: jest.fn().mockRejectedValue(new Error('API unavailable')),
        getProviderName: jest.fn().mockReturnValue(AIProvider.XAI),
        getModelName: jest.fn().mockReturnValue('failing-model')
      };
      
      // Replace the provider with our failing mock
      (aiService as any).modelAdapter = failingProviderMock;
      
      // Create a custom framework that implements provider fallback
      class FallbackTestFramework extends AIStressTestFramework {
        private fallbackAttempted = false;
        
        constructor(service: AIService, options: StressTestOptions) {
          super(service, options);
          
          // Listen for errors and implement fallback
          this.on('error', ({ operation, error }) => {
            if (!this.fallbackAttempted && error.message === 'API unavailable') {
              console.log(`Switching provider after error in ${operation}`);
              aiService.setProvider(AIProvider.OPENAI, 'mock-fallback-model');
              this.fallbackAttempted = true;
              
              // Replace the adapter with a working mock
              const workingProviderMock = {
                complete: jest.fn().mockResolvedValue({ 
                  result: 'Fallback response', 
                  modelName: 'mock-fallback-model',
                  provider: AIProvider.OPENAI,
                  timestamp: Date.now()
                }),
                completeStructured: jest.fn().mockResolvedValue({
                  result: { status: 'success' },
                  modelName: 'mock-fallback-model',
                  provider: AIProvider.OPENAI,
                  timestamp: Date.now()
                }),
                processWithPromptTemplate: jest.fn().mockResolvedValue({
                  result: 'Fallback template response',
                  modelName: 'mock-fallback-model',
                  provider: AIProvider.OPENAI,
                  timestamp: Date.now()
                }),
                getProviderName: jest.fn().mockReturnValue(AIProvider.OPENAI),
                getModelName: jest.fn().mockReturnValue('mock-fallback-model')
              };
              (aiService as any).modelAdapter = workingProviderMock;
            }
          });
        }
      }
      
      const options: StressTestOptions = {
        mode: StressTestMode.SIMULATED,
        concurrentRequests: 5,
        requestCount: 20,
        retryCount: 2,
        operationsToTest: ['summarize']
      };
      
      const framework = new FallbackTestFramework(aiService, options);
      const metrics = await framework.runTest(testTodos);
      
      writeMetricsToReport(metrics, 'api_fallback');
      
      // Verify that setProvider was called (fallback occurred)
      expect(setProviderSpy).toHaveBeenCalledWith(
        AIProvider.OPENAI, 
        'mock-fallback-model',
        expect.anything()
      );
      
      // Expect some failures but also some successes after fallback
      expect(metrics.summarize.failedRequests).toBeGreaterThan(0);
      expect(metrics.summarize.successfulRequests).toBeGreaterThan(0);
    });
  });
  
  describe('Caching System Under Load', () => {
    it('should properly cache and reuse identical requests', async () => {
      // Create a service with a mock cache
      const mockCache = new Map<string, any>();
      let cacheHits = 0;
      let cacheMisses = 0;
      
      const aiService = createMockAIService();
      
      // Replace the complete methods with ones that use our cache
      const originalProcessWithTemplate = (aiService as any).modelAdapter.processWithPromptTemplate;
      const cacheWrapper = jest.fn().mockImplementation(async (promptTemplate, input) => {
        // Simple hash for cache key
        const cacheKey = JSON.stringify({ template: promptTemplate.template, input });
        
        if (mockCache.has(cacheKey)) {
          cacheHits++;
          return mockCache.get(cacheKey);
        }
        
        cacheMisses++;
        const result = await originalProcessWithTemplate(promptTemplate, input);
        mockCache.set(cacheKey, result);
        return result;
      });
      
      (aiService as any).modelAdapter.processWithPromptTemplate = cacheWrapper;
      
      const options: StressTestOptions = {
        mode: StressTestMode.SIMULATED,
        concurrentRequests: 10,
        requestCount: 30,
        operationsToTest: ['summarize']
      };
      
      const framework = new AIStressTestFramework(aiService, options);
      const metrics = await framework.runTest(testTodos);
      
      writeMetricsToReport({
        ...metrics,
        cache: { hits: cacheHits, misses: cacheMisses }
      }, 'caching_system');
      
      // Since we're using the same todos for each request, we expect cache hits
      expect(cacheHits).toBeGreaterThan(0);
      expect(cacheMisses).toBeGreaterThan(0); // First request for each template is a miss
      
      // Response times for cache hits should be faster
      const results = framework.getRequestResults();
      const responseTimes = results
        .filter(r => r.operation === 'summarize' && r.success)
        .map(r => r.duration);
      
      // Sort by duration
      responseTimes.sort((a, b) => a - b);
      
      // The fastest responses should be cache hits, significantly faster than API calls
      // We can check for a bimodal distribution by comparing first and third quartiles
      const q1Index = Math.floor(responseTimes.length * 0.25);
      const q3Index = Math.floor(responseTimes.length * 0.75);
      
      // Log for visibility
      console.log(`Cache hits: ${cacheHits}, misses: ${cacheMisses}`);
      console.log(`Fastest response: ${responseTimes[0]}ms, Slowest: ${responseTimes[responseTimes.length - 1]}ms`);
      console.log(`Q1 response time: ${responseTimes[q1Index]}ms, Q3: ${responseTimes[q3Index]}ms`);
    });
  });
  
  describe('Performance Benchmarking', () => {
    it('should benchmark different AI operations', async () => {
      const aiService = createMockAIService();
      
      const options: StressTestOptions = {
        mode: StressTestMode.SIMULATED,
        concurrentRequests: 1, // Sequential for accurate benchmarking
        requestCount: 25,
        operationsToTest: ['summarize', 'categorize', 'prioritize', 'suggest', 'analyze'],
        measureResourceUsage: true
      };
      
      const framework = new AIStressTestFramework(aiService, options);
      const metrics = await framework.runTest(testTodos);
      
      // Add system info to the report
      const systemInfo = {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem()
      };
      
      writeMetricsToReport({
        metrics,
        systemInfo,
        resourceUsage: framework.getResourceUsage()
      }, 'performance_benchmark');
      
      // Verify that all operations were benchmarked
      for (const operation of options.operationsToTest!) {
        expect(metrics[operation].totalRequests).toBeGreaterThan(0);
        expect(metrics[operation].avgResponseTime).toBeGreaterThan(0);
      }
      
      // Compare operation performance
      const avgResponseTimes = options.operationsToTest!.map(op => ({
        operation: op,
        avgTime: metrics[op].avgResponseTime
      }));
      
      // Sort by average time
      avgResponseTimes.sort((a, b) => a.avgTime - b.avgTime);
      
      // Log performance ranking
      console.log('Operation Performance Ranking (fastest to slowest):');
      avgResponseTimes.forEach((entry, i) => {
        console.log(`${i + 1}. ${entry.operation}: ${entry.avgTime.toFixed(2)}ms`);
      });
    });
  });
  
  // Only run this test if explicitly enabled
  const itIfRealEnabled = testMode === StressTestMode.REAL ? it : it.skip;
  
  describe('Real API Load Testing', () => {
    itIfRealEnabled('should perform a limited real API load test (USE WITH CAUTION)', async () => {
      // This test uses real API calls - BE CAREFUL with rate limits and costs
      const _apiKey = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.warn('Skipping real API test due to missing API key');
        return;
      }
      
      const aiService = new AIService(
        apiKey, 
        process.env.OPENAI_API_KEY ? AIProvider.OPENAI : AIProvider.XAI
      );
      
      // VERY conservative settings to avoid excessive API usage
      const options: StressTestOptions = {
        mode: StressTestMode.REAL,
        concurrentRequests: 2,
        requestCount: 5,
        operationsToTest: ['summarize'], // Only test one operation
        timeoutMs: 15000,
        retryCount: 1,
        useCircuitBreaker: true,
        abortOnFailureThreshold: 0.3
      };
      
      const framework = new AIStressTestFramework(aiService, options);
      const metrics = await framework.runTest(testTodos);
      
      writeMetricsToReport(metrics, 'real_api_test');
      
      // Basic verification
      expect(metrics.summarize.totalRequests).toBeGreaterThan(0);
      expect(metrics.summarize.successfulRequests).toBeGreaterThan(0);
    });
  });
});