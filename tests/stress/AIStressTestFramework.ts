/**
 * AI Stress Test Framework
 * 
 * This framework provides tools to test AI operations under load, simulating
 * concurrent requests, rate limits, timeouts, and other edge cases.
 */

import { EventEmitter } from 'events';
import { AIService } from '../../src/services/ai/aiService';
import { AIProvider, AIModelAdapter } from '../../src/types/adapters/AIModelAdapter';
import { Todo } from '../../src/types/todo';
import { MockErrorType } from '../../src/__mocks__/ai/types';
import { simulateAILatency, simulateAIError } from '../helpers/ai-mock-helper';

export enum StressTestMode {
  SIMULATED = 'simulated',  // Uses mock adapters with configured behavior
  REAL = 'real',            // Uses real API calls (be careful with rate limits)
  HYBRID = 'hybrid'         // Uses real API calls but with circuit breakers
}

export interface StressTestMetrics {
  operation: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  timeouts: number;
  rateLimitHits: number;
  networkErrors: number;
  otherErrors: number;
  minResponseTime: number;
  maxResponseTime: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p90ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  startTime: number;
  endTime: number;
  totalDuration: number;
  concurrentRequestsMax: number;
  requestsPerSecond: number;
}

export interface StressTestOptions {
  mode: StressTestMode;
  concurrentRequests: number;
  requestCount: number;
  rampUpPeriodMs?: number;
  maxDurationMs?: number;
  timeoutMs?: number;
  retryCount?: number;
  backoffMultiplier?: number;
  jitterMs?: number;
  rateLimitThreshold?: number; // Requests per minute
  errorProbability?: number;
  simulatedLatencyRangeMs?: [number, number]; // [min, max]
  useCircuitBreaker?: boolean;
  measureResourceUsage?: boolean;
  abortOnFailureThreshold?: number; // e.g., 0.5 = abort if 50% of requests fail
  operationsToTest?: string[]; // e.g., ['summarize', 'categorize']
}

export interface RequestResult {
  operation: string;
  success: boolean;
  error?: Error;
  errorType?: string;
  duration: number;
  retryCount: number;
  timestamp: number;
}

export class AIStressTestFramework extends EventEmitter {
  private options: StressTestOptions;
  private service: AIService;
  private metrics: Record<string, StressTestMetrics> = {};
  private activeRequests: number = 0;
  private completedRequests: number = 0;
  private isRunning: boolean = false;
  private startTime: number = 0;
  private abortController: AbortController;
  private resourceUsageIntervalId?: NodeJS.Timeout;
  private resourceMeasurements: any[] = [];
  private requestResults: RequestResult[] = [];
  private rateLimitCounter: number = 0;
  private rateLimitTimestamp: number = Date.now();
  private circuitBreakerOpen: boolean = false;
  private circuitBreakerResetTimeout?: NodeJS.Timeout;

  constructor(service: AIService, options: StressTestOptions) {
    super();
    this.service = service;
    this.options = {
      concurrentRequests: 5,
      requestCount: 50,
      rampUpPeriodMs: 1000,
      maxDurationMs: 60000,
      timeoutMs: 10000,
      retryCount: 3,
      backoffMultiplier: 1.5,
      jitterMs: 100,
      rateLimitThreshold: 60,
      errorProbability: 0,
      simulatedLatencyRangeMs: [100, 2000],
      useCircuitBreaker: true,
      measureResourceUsage: true,
      abortOnFailureThreshold: 0.5,
      ...options
    };
    this.abortController = new AbortController();
    
    this.initializeMetrics();
    this.setupRateLimitResetInterval();
  }

  /**
   * Initialize metrics for each operation to be tested
   */
  private initializeMetrics(): void {
    const operations = this.options.operationsToTest || [
      'summarize', 'categorize', 'prioritize', 'suggest', 'analyze'
    ];
    
    for (const operation of operations) {
      this.metrics[operation] = {
        operation,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        timeouts: 0,
        rateLimitHits: 0,
        networkErrors: 0,
        otherErrors: 0,
        minResponseTime: Number.MAX_SAFE_INTEGER,
        maxResponseTime: 0,
        avgResponseTime: 0,
        p50ResponseTime: 0,
        p90ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        startTime: 0,
        endTime: 0,
        totalDuration: 0,
        concurrentRequestsMax: 0,
        requestsPerSecond: 0
      };
    }
  }

  /**
   * Set up the interval to reset rate limit counters
   */
  private setupRateLimitResetInterval(): void {
    // Reset rate limit counter every minute
    setInterval(() => {
      this.rateLimitCounter = 0;
      this.rateLimitTimestamp = Date.now();
    }, 60000);
  }

  /**
   * Start resource usage monitoring
   */
  private startResourceMonitoring(): void {
    if (!this.options.measureResourceUsage) {
      return;
    }
    
    this.resourceMeasurements = [];
    this.resourceUsageIntervalId = setInterval(() => {
      const usage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.resourceMeasurements.push({
        timestamp: Date.now(),
        memory: {
          rss: usage.rss,
          heapTotal: usage.heapTotal,
          heapUsed: usage.heapUsed,
          external: usage.external
        },
        cpu: cpuUsage
      });
    }, 200); // Measure every 200ms
  }

  /**
   * Stop resource usage monitoring
   */
  private stopResourceMonitoring(): void {
    if (this.resourceUsageIntervalId) {
      clearInterval(this.resourceUsageIntervalId);
      this.resourceUsageIntervalId = undefined;
    }
  }

  /**
   * Check if we should trigger the circuit breaker
   */
  private checkCircuitBreaker(): boolean {
    if (!this.options.useCircuitBreaker) {
      return false;
    }
    
    // Simple circuit breaker based on failure threshold
    const totalRequests = this.completedRequests;
    const totalFailures = Object.values(this.metrics).reduce(
      (sum, m) => sum + m.failedRequests, 0
    );
    
    const failureRate = totalRequests > 0 ? totalFailures / totalRequests : 0;
    
    if (failureRate > (this.options.abortOnFailureThreshold || 0.5) && totalRequests >= 10) {
      if (!this.circuitBreakerOpen) {
        this.circuitBreakerOpen = true;
        this.emit('circuitBreakerOpen', { failureRate, totalRequests, totalFailures });
        
        // Reset circuit breaker after a delay
        this.circuitBreakerResetTimeout = setTimeout(() => {
          this.circuitBreakerOpen = false;
          this.emit('circuitBreakerClosed');
        }, 5000);
      }
      return true;
    }
    
    return this.circuitBreakerOpen;
  }

  /**
   * Check rate limit and decide if we should proceed with the request
   */
  private checkRateLimit(): boolean {
    if (this.options.mode === StressTestMode.SIMULATED) {
      return true; // No real rate limit in simulated mode
    }
    
    this.rateLimitCounter++;
    
    if (this.rateLimitCounter > (this.options.rateLimitThreshold || 60)) {
      return false;
    }
    
    return true;
  }

  /**
   * Execute a single operation with retries and timeout
   */
  private async executeOperation(
    operation: string, 
    todos: Todo[], 
    retryCount: number = 0
  ): Promise<any> {
    if (this.abortController.signal.aborted) {
      throw new Error('Operation aborted');
    }
    
    if (this.checkCircuitBreaker()) {
      throw new Error('Circuit breaker open');
    }
    
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded');
    }
    
    const startTime = Date.now();
    this.activeRequests++;
    this.metrics[operation].concurrentRequestsMax = Math.max(
      this.metrics[operation].concurrentRequestsMax,
      this.activeRequests
    );
    
    try {
      // Create an abort controller for this specific request
      const requestController = new AbortController();
      const timeoutId = setTimeout(() => {
        requestController.abort();
      }, this.options.timeoutMs);
      
      // Execute the appropriate operation
      let result;
      switch (operation) {
        case 'summarize':
          result = await this.service.summarize(todos);
          break;
        case 'categorize':
          result = await this.service.categorize(todos);
          break;
        case 'prioritize':
          result = await this.service.prioritize(todos);
          break;
        case 'suggest':
          result = await this.service.suggest(todos);
          break;
        case 'analyze':
          result = await this.service.analyze(todos);
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
      
      clearTimeout(timeoutId);
      
      const duration = Date.now() - startTime;
      this.updateMetrics(operation, true, duration);
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Handle retries
      if (retryCount < (this.options.retryCount || 3)) {
        // Calculate backoff with jitter
        const backoff = Math.pow(this.options.backoffMultiplier || 1.5, retryCount);
        const delay = (200 * backoff) + 
          Math.floor(Math.random() * (this.options.jitterMs || 100));
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Recursive retry
        return this.executeOperation(operation, todos, retryCount + 1);
      }
      
      // Classify errors by type
      let errorType = 'other';
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        errorType = 'timeout';
      } else if (error.message.includes('rate limit') || 
                error.message.includes('too many requests')) {
        errorType = 'rateLimit';
      } else if (error.message.includes('network') || 
                error.message.includes('connection')) {
        errorType = 'network';
      }
      
      this.updateMetrics(operation, false, duration, errorType);
      throw error;
    } finally {
      this.activeRequests--;
      this.completedRequests++;
    }
  }

  /**
   * Update metrics for an operation
   */
  private updateMetrics(
    operation: string, 
    success: boolean, 
    duration: number,
    errorType?: string
  ): void {
    if (!this.metrics[operation]) {
      return;
    }
    
    const metrics = this.metrics[operation];
    metrics.totalRequests++;
    
    if (success) {
      metrics.successfulRequests++;
      metrics.minResponseTime = Math.min(metrics.minResponseTime, duration);
      metrics.maxResponseTime = Math.max(metrics.maxResponseTime, duration);
      
      // Simple running average
      metrics.avgResponseTime = (
        (metrics.avgResponseTime * (metrics.successfulRequests - 1)) + duration
      ) / metrics.successfulRequests;
    } else {
      metrics.failedRequests++;
      
      if (errorType === 'timeout') {
        metrics.timeouts++;
      } else if (errorType === 'rateLimit') {
        metrics.rateLimitHits++;
      } else if (errorType === 'network') {
        metrics.networkErrors++;
      } else {
        metrics.otherErrors++;
      }
    }
    
    // Store result for percentile calculations later
    this.requestResults.push({
      operation,
      success,
      duration,
      errorType: errorType as string,
      retryCount: 0,
      timestamp: Date.now()
    });
  }

  /**
   * Calculate percentiles for response times
   */
  private calculatePercentiles(): void {
    for (const operation of Object.keys(this.metrics)) {
      const operationResults = this.requestResults
        .filter(r => r.operation === operation && r.success)
        .map(r => r.duration)
        .sort((a, b) => a - b);
      
      if (operationResults.length === 0) {
        continue;
      }
      
      const metrics = this.metrics[operation];
      
      const p50Index = Math.floor(operationResults.length * 0.5);
      const p90Index = Math.floor(operationResults.length * 0.9);
      const p95Index = Math.floor(operationResults.length * 0.95);
      const p99Index = Math.floor(operationResults.length * 0.99);
      
      metrics.p50ResponseTime = operationResults[p50Index] || 0;
      metrics.p90ResponseTime = operationResults[p90Index] || 0;
      metrics.p95ResponseTime = operationResults[p95Index] || 0;
      metrics.p99ResponseTime = operationResults[p99Index] || 0;
      
      metrics.requestsPerSecond = metrics.totalRequests / (metrics.totalDuration / 1000);
    }
  }

  /**
   * Configure the service for stress testing
   */
  private configureService(): void {
    if (this.options.mode === StressTestMode.SIMULATED) {
      // Configure latency simulation
      const [minLatency, maxLatency] = this.options.simulatedLatencyRangeMs || [100, 2000];
      simulateAILatency(
        this.service, 
        minLatency, 
        maxLatency, 
        this.options.errorProbability || 0
      );
      
      // Configure error simulation if probability > 0
      if ((this.options.errorProbability || 0) > 0) {
        simulateAIError(
          this.service,
          MockErrorType.RATE_LIMIT,
          this.options.errorProbability || 0
        );
      }
    }
  }

  /**
   * Run a stress test with the given options
   */
  async runTest(todos: Todo[]): Promise<Record<string, StressTestMetrics>> {
    if (this.isRunning) {
      throw new Error('Test is already running');
    }
    
    this.isRunning = true;
    this.startTime = Date.now();
    this.abortController = new AbortController();
    this.configureService();
    this.startResourceMonitoring();
    
    for (const operation of Object.keys(this.metrics)) {
      this.metrics[operation].startTime = Date.now();
    }
    
    // Register an abort handler
    const abortHandler = () => {
      this.isRunning = false;
      this.emit('aborted');
    };
    this.abortController.signal.addEventListener('abort', abortHandler);
    
    try {
      // Set a timeout for the overall test
      const testTimeout = setTimeout(() => {
        this.abortController.abort();
      }, this.options.maxDurationMs || 60000);
      
      // Execute operations based on the request count and concurrency
      const operations = Object.keys(this.metrics);
      const totalOperations = operations.length;
      const requestsPerOperation = Math.ceil(this.options.requestCount / totalOperations);
      
      // Create all requests but throttle them based on concurrency
      const allRequests: Promise<any>[] = [];
      
      for (const operation of operations) {
        for (let i = 0; i < requestsPerOperation; i++) {
          // Create a promise that will execute the operation when allowed
          const requestPromise = new Promise<void>(async (resolve, reject) => {
            try {
              // Wait for concurrency slot to become available
              while (this.activeRequests >= this.options.concurrentRequests) {
                if (this.abortController.signal.aborted) {
                  throw new Error('Operation aborted');
                }
                await new Promise(r => setTimeout(r, 50));
              }
              
              // If we have a ramp-up period, delay accordingly
              if (this.options.rampUpPeriodMs && this.options.rampUpPeriodMs > 0) {
                const rampUpDelay = Math.floor(
                  (i / requestsPerOperation) * this.options.rampUpPeriodMs
                );
                await new Promise(r => setTimeout(r, rampUpDelay));
              }
              
              await this.executeOperation(operation, todos);
              resolve();
            } catch (error) {
              // Don't reject the main promise, just record the error
              this.emit('error', { operation, error });
              resolve();
            }
          });
          
          allRequests.push(requestPromise);
        }
      }
      
      // Wait for all requests to complete
      await Promise.all(allRequests);
      
      clearTimeout(testTimeout);
    } finally {
      this.abortController.signal.removeEventListener('abort', abortHandler);
      this.isRunning = false;
      this.stopResourceMonitoring();
      
      // Update final metrics
      const endTime = Date.now();
      for (const operation of Object.keys(this.metrics)) {
        this.metrics[operation].endTime = endTime;
        this.metrics[operation].totalDuration = 
          this.metrics[operation].endTime - this.metrics[operation].startTime;
      }
      
      this.calculatePercentiles();
      this.emit('completed', this.metrics);
    }
    
    return this.metrics;
  }

  /**
   * Abort a running test
   */
  abortTest(): void {
    if (this.isRunning) {
      this.abortController.abort();
    }
  }

  /**
   * Get the current metrics
   */
  getMetrics(): Record<string, StressTestMetrics> {
    return this.metrics;
  }

  /**
   * Get resource usage measurements
   */
  getResourceUsage(): any[] {
    return this.resourceMeasurements;
  }

  /**
   * Get request results for detailed analysis
   */
  getRequestResults(): RequestResult[] {
    return this.requestResults;
  }
}