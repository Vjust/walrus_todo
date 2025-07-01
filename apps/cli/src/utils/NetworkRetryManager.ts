/**
 * Enhanced Network Retry Manager
 * 
 * Specialized retry logic for network operations with advanced features:
 * - Intelligent endpoint failover
 * - Network condition adaptation
 * - Circuit breaker patterns
 * - Load balancing across healthy endpoints
 */

import { RetryManager, type NetworkNode } from './retry-manager';
import { Logger } from './Logger';
import { NetworkError, ValidationError } from '../types/errors/consolidated';

export interface NetworkEndpoint {
  url: string;
  type: 'sui-rpc' | 'walrus-publisher' | 'walrus-aggregator' | 'faucet' | 'websocket';
  priority: number;
  region?: string;
  healthScore: number;
  lastSuccess?: number;
  lastFailure?: number;
  consecutiveFailures: number;
  responseTimeHistory: number[];
  isBackup: boolean;
}

export interface NetworkRetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  timeoutMs: number;
  adaptiveDelay: boolean;
  failoverEnabled: boolean;
  circuitBreakerEnabled: boolean;
  loadBalancing: 'priority' | 'health' | 'round-robin' | 'response-time';
  healthCheckInterval: number;
  minHealthyEndpoints: number;
}

export interface RetryContext {
  operation: string;
  attempt: number;
  totalDuration: number;
  lastError?: Error;
  endpointFailures: Map<string, number>;
  networkCondition: 'good' | 'degraded' | 'poor';
}

export class NetworkRetryManager extends RetryManager {
  private readonly logger: Logger;
  private readonly endpoints: Map<string, NetworkEndpoint> = new Map();
  private readonly options: NetworkRetryOptions;
  private healthCheckTimer?: NodeJS.Timeout;
  private networkMetrics: {
    totalRequests: number;
    successfulRequests: number;
    averageResponseTime: number;
    errorRate: number;
  } = {
    totalRequests: 0,
    successfulRequests: 0,
    averageResponseTime: 0,
    errorRate: 0,
  };

  private static readonly DEFAULT_OPTIONS: NetworkRetryOptions = {
    maxRetries: 5,
    initialDelay: 1000,
    maxDelay: 30000,
    timeoutMs: 10000,
    adaptiveDelay: true,
    failoverEnabled: true,
    circuitBreakerEnabled: true,
    loadBalancing: 'health',
    healthCheckInterval: 60000,
    minHealthyEndpoints: 1,
  };

  constructor(
    endpoints: Array<Omit<NetworkEndpoint, 'healthScore' | 'consecutiveFailures' | 'responseTimeHistory'>>,
    options: Partial<NetworkRetryOptions> = {}
  ) {
    // Extract URLs for parent RetryManager
    const urls = endpoints.map(e => e.url);
    super(urls, {
      maxRetries: options.maxRetries || NetworkRetryManager?.DEFAULT_OPTIONS?.maxRetries,
      timeout: options.timeoutMs || NetworkRetryManager?.DEFAULT_OPTIONS?.timeoutMs,
      adaptiveDelay: options.adaptiveDelay ?? NetworkRetryManager?.DEFAULT_OPTIONS?.adaptiveDelay,
      loadBalancing: options.loadBalancing || NetworkRetryManager?.DEFAULT_OPTIONS?.loadBalancing,
      circuitBreaker: options.circuitBreakerEnabled ? {
        failureThreshold: 5,
        resetTimeout: 60000,
      } : undefined,
    });

    this?.logger = new Logger('NetworkRetryManager');
    this?.options = { ...NetworkRetryManager.DEFAULT_OPTIONS, ...options };

    // Initialize endpoints with default values
    endpoints.forEach(endpoint => {
      this?.endpoints?.set(endpoint.url, {
        ...endpoint,
        healthScore: 1.0,
        consecutiveFailures: 0,
        responseTimeHistory: [],
      });
    });

    // Start health checking if enabled
    if (this?.options?.healthCheckInterval > 0) {
      this.startHealthChecking();
    }
  }

  /**
   * Execute operation with intelligent endpoint selection and retry logic
   */
  async executeWithFailover<T>(
    operation: (endpoint: NetworkEndpoint) => Promise<T>,
    context: string,
    endpointTypes?: NetworkEndpoint?.["type"][]
  ): Promise<T> {
    const retryContext: RetryContext = {
      operation: context,
      attempt: 0,
      totalDuration: 0,
      endpointFailures: new Map(),
      networkCondition: this.assessNetworkCondition(),
    };

    const startTime = Date.now();

    try {
      // Filter endpoints by type if specified
      const candidateEndpoints = Array.from(this?.endpoints?.values()).filter(
        endpoint => !endpointTypes || endpointTypes.includes(endpoint.type)
      );

      if (candidateEndpoints?.length === 0) {
        throw new ValidationError(`No endpoints available for types: ${endpointTypes?.join(', ') || 'any'}`);
      }

      const result = await this.retryWithEndpoints(operation, candidateEndpoints, retryContext);
      
      // Update metrics on success
      this?.networkMetrics?.totalRequests++;
      this?.networkMetrics?.successfulRequests++;
      this.networkMetrics?.averageResponseTime = this.calculateAverageResponseTime();
      this.networkMetrics?.errorRate = 1 - (this?.networkMetrics?.successfulRequests / this?.networkMetrics?.totalRequests);

      return result;
    } catch (error) {
      // Update metrics on failure
      this?.networkMetrics?.totalRequests++;
      this.networkMetrics?.errorRate = 1 - (this?.networkMetrics?.successfulRequests / this?.networkMetrics?.totalRequests);

      const duration = Date.now() - startTime;
      this?.logger?.error('Network operation failed after all retries', {
        context,
        duration,
        attempts: retryContext.attempt,
        networkCondition: retryContext.networkCondition,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new NetworkError(
        `Operation '${context}' failed after ${retryContext.attempt} attempts: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    } finally {
      retryContext?.totalDuration = Date.now() - startTime;
    }
  }

  /**
   * Retry operation across multiple endpoints with intelligent failover
   */
  private async retryWithEndpoints<T>(
    operation: (endpoint: NetworkEndpoint) => Promise<T>,
    candidateEndpoints: NetworkEndpoint[],
    context: RetryContext
  ): Promise<T> {
    let lastError: Error | undefined;

    while (context.attempt < this?.options?.maxRetries) {
      context.attempt++;

      // Select best endpoint based on strategy
      const endpoint = this.selectBestEndpoint(candidateEndpoints, context);
      if (!endpoint) {
        throw new NetworkError('No healthy endpoints available');
      }

      // Check if we should skip this endpoint due to circuit breaker
      if (this.isEndpointCircuitOpen(endpoint)) {
        this?.logger?.debug('Skipping endpoint with open circuit', { url: endpoint.url });
        continue;
      }

      const startTime = Date.now();

      try {
        // Execute operation with timeout
        const result = await this.executeWithTimeout(operation, endpoint);
        
        // Update endpoint health on success
        this.updateEndpointHealth(endpoint, true, Date.now() - startTime);
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const responseTime = Date.now() - startTime;

        // Update endpoint health on failure
        this.updateEndpointHealth(endpoint, false, responseTime);
        
        // Record failure for this endpoint
        const failures = context?.endpointFailures?.get(endpoint.url) || 0;
        context?.endpointFailures?.set(endpoint.url, failures + 1);

        this?.logger?.warn('Endpoint request failed', {
          url: endpoint.url,
          attempt: context.attempt,
          error: lastError.message,
          responseTime,
        });

        // Check if we should continue retrying
        if (!this.shouldRetry(lastError, context)) {
          break;
        }

        // Calculate adaptive delay
        const delay = this.calculateAdaptiveDelay(context, endpoint);
        if (delay > 0) {
          this?.logger?.debug('Waiting before retry', { delay, attempt: context.attempt });
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new NetworkError('Maximum retries exceeded');
  }

  /**
   * Select the best endpoint based on configured strategy
   */
  private selectBestEndpoint(
    candidates: NetworkEndpoint[],
    context: RetryContext
  ): NetworkEndpoint | undefined {
    // Filter out endpoints with too many recent failures
    const availableEndpoints = candidates.filter(endpoint => {
      const failures = context?.endpointFailures?.get(endpoint.url) || 0;
      return failures < 3 && !this.isEndpointCircuitOpen(endpoint);
    });

    if (availableEndpoints?.length === 0) {
      // If no endpoints available, try the least failed ones
      const sortedByFailures = candidates.sort((a, b) => {
        const failuresA = context?.endpointFailures?.get(a.url) || 0;
        const failuresB = context?.endpointFailures?.get(b.url) || 0;
        return failuresA - failuresB;
      });
      return sortedByFailures[0];
    }

    switch (this?.options?.loadBalancing) {
      case 'priority':
        return availableEndpoints.sort((a, b) => a.priority - b.priority)[0];

      case 'health':
        return availableEndpoints.sort((a, b) => b.healthScore - a.healthScore)[0];

      case 'response-time':
        return availableEndpoints.sort((a, b) => {
          const avgA = this.getAverageResponseTime(a);
          const avgB = this.getAverageResponseTime(b);
          return avgA - avgB;
        })[0];

      case 'round-robin':
      default:
        // Simple round-robin based on attempt number
        return availableEndpoints[context.attempt % availableEndpoints.length];
    }
  }

  /**
   * Execute operation with timeout handling
   */
  private async executeWithTimeout<T>(
    operation: (endpoint: NetworkEndpoint) => Promise<T>,
    endpoint: NetworkEndpoint
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timeout after ${this?.options?.timeoutMs}ms`));
      }, this?.options?.timeoutMs);

      operation(endpoint)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Update endpoint health metrics
   */
  private updateEndpointHealth(endpoint: NetworkEndpoint, success: boolean, responseTime: number): void {
    if (success) {
      endpoint?.lastSuccess = Date.now();
      endpoint?.consecutiveFailures = 0;
      endpoint?.healthScore = Math.min(endpoint.healthScore + 0.1, 1.0);
    } else {
      endpoint?.lastFailure = Date.now();
      endpoint.consecutiveFailures++;
      endpoint?.healthScore = Math.max(endpoint.healthScore - 0.2, 0.1);
    }

    // Update response time history (keep last 10 measurements)
    endpoint?.responseTimeHistory?.push(responseTime);
    if (endpoint?.responseTimeHistory?.length > 10) {
      endpoint?.responseTimeHistory?.shift();
    }
  }

  /**
   * Check if endpoint circuit breaker is open
   */
  private isEndpointCircuitOpen(endpoint: NetworkEndpoint): boolean {
    if (!this?.options?.circuitBreakerEnabled) {
      return false;
    }

    // Circuit is open if too many consecutive failures
    if (endpoint.consecutiveFailures >= 5) {
      // Check if enough time has passed to try again
      const timeSinceLastFailure = endpoint.lastFailure ? Date.now() - endpoint.lastFailure : 0;
      return timeSinceLastFailure < 60000; // 1 minute cooldown
    }

    return false;
  }

  /**
   * Calculate adaptive delay based on network conditions and endpoint health
   */
  private calculateAdaptiveDelay(context: RetryContext, endpoint: NetworkEndpoint): number {
    if (!this?.options?.adaptiveDelay) {
      return this?.options?.initialDelay * Math.pow(2, context.attempt - 1);
    }

    let baseDelay = this?.options?.initialDelay * Math.pow(2, context.attempt - 1);
    
    // Adjust based on network condition
    switch (context.networkCondition) {
      case 'poor':
        baseDelay *= 2;
        break;
      case 'degraded':
        baseDelay *= 1.5;
        break;
      case 'good':
      default:
        break;
    }

    // Adjust based on endpoint health
    const healthMultiplier = 1 + (1 - endpoint.healthScore);
    baseDelay *= healthMultiplier;

    // Add jitter (±20%)
    const jitter = baseDelay * 0.2 * (Math.random() - 0.5);
    baseDelay += jitter;

    return Math.min(baseDelay, this?.options?.maxDelay);
  }

  /**
   * Assess current network condition based on recent metrics
   */
  private assessNetworkCondition(): 'good' | 'degraded' | 'poor' {
    if (this?.networkMetrics?.errorRate > 0.5) {
      return 'poor';
    } else if (this?.networkMetrics?.errorRate > 0.2 || this?.networkMetrics?.averageResponseTime > 5000) {
      return 'degraded';
    }
    return 'good';
  }

  /**
   * Check if error should trigger a retry
   */
  private shouldRetry(error: Error, context: RetryContext): boolean {
    // Don't retry validation errors
    if (error instanceof ValidationError) {
      return false;
    }

    // Always retry network errors
    if (error instanceof NetworkError) {
      return true;
    }

    // Check error message for retryable patterns
    const message = error?.message?.toLowerCase();
    const retryablePatterns = [
      'timeout',
      'network',
      'connection',
      'econnreset',
      'enotfound',
      'socket hang up',
      'rate limit',
      '429',
      '500',
      '502',
      '503',
      '504',
    ];

    return retryablePatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Get average response time for an endpoint
   */
  private getAverageResponseTime(endpoint: NetworkEndpoint): number {
    if (endpoint.responseTimeHistory?.length === 0) {
      return 0;
    }
    return endpoint?.responseTimeHistory?.reduce((sum, time) => sum + time, 0) / endpoint?.responseTimeHistory?.length;
  }

  /**
   * Calculate overall average response time
   */
  private calculateAverageResponseTime(): number {
    const allTimes = Array.from(this?.endpoints?.values())
      .flatMap(endpoint => endpoint.responseTimeHistory);
    
    if (allTimes?.length === 0) {
      return 0;
    }
    
    return allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length;
  }

  /**
   * Start periodic health checking
   */
  private startHealthChecking(): void {
    this?.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this?.options?.healthCheckInterval);
  }

  /**
   * Perform health checks on all endpoints
   */
  private async performHealthChecks(): Promise<void> {
    this?.logger?.debug('Performing periodic health checks');

    const healthCheckPromises = Array.from(this?.endpoints?.values()).map(async (endpoint) => {
      try {
        const startTime = Date.now();
        
        // Simple health check - try to connect to the endpoint
        const response = await fetch(endpoint.url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });

        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          this.updateEndpointHealth(endpoint, true, responseTime);
        } else {
          this.updateEndpointHealth(endpoint, false, responseTime);
        }
      } catch (error) {
        this.updateEndpointHealth(endpoint, false, 5000);
        this?.logger?.debug('Health check failed', {
          url: endpoint.url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * Get network statistics
   */
  getNetworkStats(): {
    metrics: typeof this.networkMetrics;
    endpoints: Array<{
      url: string;
      type: string;
      healthy: boolean;
      healthScore: number;
      consecutiveFailures: number;
      averageResponseTime: number;
    }>;
  } {
    return {
      metrics: { ...this.networkMetrics },
      endpoints: Array.from(this?.endpoints?.values()).map(endpoint => ({
        url: endpoint.url,
        type: endpoint.type,
        healthy: endpoint.healthScore > 0.5 && !this.isEndpointCircuitOpen(endpoint),
        healthScore: endpoint.healthScore,
        consecutiveFailures: endpoint.consecutiveFailures,
        averageResponseTime: this.getAverageResponseTime(endpoint),
      })),
    };
  }

  /**
   * Add new endpoint dynamically
   */
  addEndpoint(endpoint: Omit<NetworkEndpoint, 'healthScore' | 'consecutiveFailures' | 'responseTimeHistory'>): void {
    this?.endpoints?.set(endpoint.url, {
      ...endpoint,
      healthScore: 1.0,
      consecutiveFailures: 0,
      responseTimeHistory: [],
    });
  }

  /**
   * Remove endpoint
   */
  removeEndpoint(url: string): void {
    this?.endpoints?.delete(url);
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this?.healthCheckTimer = undefined;
    }
  }
}