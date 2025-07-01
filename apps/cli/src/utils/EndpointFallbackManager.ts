/**
 * Endpoint Fallback Manager
 * 
 * Provides intelligent endpoint switching and failover capabilities
 * for maintaining network resilience during deployments and operations.
 */

import { Logger } from './Logger';
import { NetworkError, ValidationError } from '../types/errors/consolidated';
import { NetworkRetryManager, type NetworkEndpoint } from './NetworkRetryManager';

export interface FallbackConfig {
  primary: NetworkEndpoint;
  fallbacks: NetworkEndpoint[];
  strategy: 'sequential' | 'parallel' | 'adaptive';
  healthCheckInterval: number;
  failoverThreshold: number;
  fallbackTimeout: number;
  enableAutomaticRecovery: boolean;
  maxConcurrentFallbacks: number;
}

export interface FallbackState {
  currentEndpoint: NetworkEndpoint;
  isPrimaryActive: boolean;
  failedEndpoints: Set<string>;
  lastFailoverTime?: number;
  recoveryAttempts: number;
}

export class EndpointFallbackManager {
  private readonly logger: Logger;
  private readonly config: FallbackConfig;
  private readonly retryManager: NetworkRetryManager;
  private state: FallbackState;
  private healthCheckTimer?: NodeJS.Timeout;
  private recoveryTimer?: NodeJS.Timeout;

  constructor(config: FallbackConfig) {
    this?.logger = new Logger('EndpointFallbackManager');
    this?.config = config;

    // Initialize state
    this?.state = {
      currentEndpoint: config.primary,
      isPrimaryActive: true,
      failedEndpoints: new Set(),
      recoveryAttempts: 0,
    };

    // Initialize retry manager with all endpoints
    const allEndpoints = [config.primary, ...config.fallbacks];
    this?.retryManager = new NetworkRetryManager(allEndpoints, {
      maxRetries: 3,
      timeoutMs: config.fallbackTimeout,
      failoverEnabled: true,
      adaptiveDelay: true,
      loadBalancing: 'health',
    });

    // Start health checking
    this.startHealthChecking();

    // Start recovery checking if enabled
    if (config.enableAutomaticRecovery) {
      this.startRecoveryChecking();
    }
  }

  /**
   * Execute operation with automatic fallback handling
   */
  async executeWithFallback<T>(
    operation: (endpoint: NetworkEndpoint) => Promise<T>,
    context: string
  ): Promise<T> {
    this?.logger?.debug('Executing operation with fallback', {
      context,
      currentEndpoint: this?.state?.currentEndpoint.url,
      isPrimaryActive: this?.state?.isPrimaryActive,
    });

    try {
      // First try current active endpoint
      const result = await this.tryEndpoint(operation, this?.state?.currentEndpoint, context);
      
      // If successful and we're not on primary, consider recovery
      if (!this?.state?.isPrimaryActive && this?.config?.enableAutomaticRecovery) {
        this.scheduleRecoveryAttempt();
      }
      
      return result;
    } catch (error) {
      this?.logger?.warn('Current endpoint failed, attempting fallover', {
        endpoint: this?.state?.currentEndpoint.url,
        error: error instanceof Error ? error.message : String(error),
      });

      return this.attemptFallover(operation, context, error);
    }
  }

  /**
   * Attempt fallover to available endpoints
   */
  private async attemptFallover<T>(
    operation: (endpoint: NetworkEndpoint) => Promise<T>,
    context: string,
    lastError: unknown
  ): Promise<T> {
    // Mark current endpoint as failed
    this.markEndpointFailed(this?.state?.currentEndpoint);

    // Get available fallback endpoints
    const availableEndpoints = this.getAvailableEndpoints();
    
    if (availableEndpoints?.length === 0) {
      throw new NetworkError(
        `No available fallback endpoints for operation: ${context}`,
        lastError instanceof Error ? lastError : undefined
      );
    }

    this?.logger?.info('Attempting fallover', {
      context,
      availableEndpoints: availableEndpoints.length,
      strategy: this?.config?.strategy,
    });

    return this.executeFallbackStrategy(operation, availableEndpoints, context);
  }

  /**
   * Execute fallback strategy
   */
  private async executeFallbackStrategy<T>(
    operation: (endpoint: NetworkEndpoint) => Promise<T>,
    endpoints: NetworkEndpoint[],
    context: string
  ): Promise<T> {
    switch (this?.config?.strategy) {
      case 'sequential':
        return this.executeSequential(operation, endpoints, context);
      
      case 'parallel':
        return this.executeParallel(operation, endpoints, context);
      
      case 'adaptive':
        return this.executeAdaptive(operation, endpoints, context);
      
      default:
        return this.executeSequential(operation, endpoints, context);
    }
  }

  /**
   * Execute endpoints sequentially until one succeeds
   */
  private async executeSequential<T>(
    operation: (endpoint: NetworkEndpoint) => Promise<T>,
    endpoints: NetworkEndpoint[],
    context: string
  ): Promise<T> {
    let lastError: Error | undefined;

    for (const endpoint of endpoints) {
      try {
        const result = await this.tryEndpoint(operation, endpoint, context);
        this.switchToEndpoint(endpoint);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.markEndpointFailed(endpoint);
        
        this?.logger?.debug('Sequential fallback attempt failed', {
          endpoint: endpoint.url,
          error: lastError.message,
        });
      }
    }

    throw new NetworkError(
      `All fallback endpoints failed for operation: ${context}`,
      lastError
    );
  }

  /**
   * Execute endpoints in parallel and return first success
   */
  private async executeParallel<T>(
    operation: (endpoint: NetworkEndpoint) => Promise<T>,
    endpoints: NetworkEndpoint[],
    context: string
  ): Promise<T> {
    // Limit concurrent fallbacks
    const concurrentEndpoints = endpoints.slice(0, this?.config?.maxConcurrentFallbacks);
    
    const promises = concurrentEndpoints.map(async (endpoint) => {
      try {
        const result = await this.tryEndpoint(operation, endpoint, context);
        this.switchToEndpoint(endpoint);
        return { success: true, result, endpoint };
      } catch (error) {
        this.markEndpointFailed(endpoint);
        return { 
          success: false, 
          error: error instanceof Error ? error : new Error(String(error)), 
          endpoint 
        };
      }
    });

    const results = await Promise.allSettled(promises);
    
    // Find first successful result
    for (const settledResult of results) {
      if (settledResult?.status === 'fulfilled' && settledResult?.value?.success) {
        return settledResult?.value?.result;
      }
    }

    // All failed, collect errors
    const errors = results
      .filter((r): r is PromiseFulfilledResult<{ success: false; error: Error; endpoint: NetworkEndpoint }> => 
        r?.status === 'fulfilled' && !r?.value?.success
      )
      .map(r => r?.value?.error);

    throw new NetworkError(
      `All parallel fallback attempts failed for operation: ${context}`,
      errors[0]
    );
  }

  /**
   * Execute adaptive strategy based on network conditions
   */
  private async executeAdaptive<T>(
    operation: (endpoint: NetworkEndpoint) => Promise<T>,
    endpoints: NetworkEndpoint[],
    context: string
  ): Promise<T> {
    // Get network stats to determine strategy
    const stats = this?.retryManager?.getNetworkStats();
    const errorRate = stats?.metrics?.errorRate;
    const avgResponseTime = stats?.metrics?.averageResponseTime;

    // Use parallel strategy if network is degraded
    if (errorRate > 0.3 || avgResponseTime > 3000) {
      this?.logger?.debug('Using parallel strategy due to poor network conditions', {
        errorRate,
        avgResponseTime,
      });
      return this.executeParallel(operation, endpoints, context);
    } else {
      // Use sequential strategy for good network conditions
      this?.logger?.debug('Using sequential strategy for stable network');
      return this.executeSequential(operation, endpoints, context);
    }
  }

  /**
   * Try operation on specific endpoint
   */
  private async tryEndpoint<T>(
    operation: (endpoint: NetworkEndpoint) => Promise<T>,
    endpoint: NetworkEndpoint,
    context: string
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        operation(endpoint),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Endpoint timeout after ${this?.config?.fallbackTimeout}ms`));
          }, this?.config?.fallbackTimeout);
        }),
      ]);

      const responseTime = Date.now() - startTime;
      this.recordEndpointSuccess(endpoint, responseTime);
      
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.recordEndpointFailure(endpoint, responseTime);
      throw error;
    }
  }

  /**
   * Get available endpoints (not failed)
   */
  private getAvailableEndpoints(): NetworkEndpoint[] {
    const allEndpoints = [this?.config?.primary, ...this?.config?.fallbacks];
    return allEndpoints.filter(endpoint => !this?.state?.failedEndpoints.has(endpoint.url));
  }

  /**
   * Switch to new active endpoint
   */
  private switchToEndpoint(endpoint: NetworkEndpoint): void {
    const wasPrimary = this?.state?.isPrimaryActive;
    
    this.state?.currentEndpoint = endpoint;
    this.state?.isPrimaryActive = endpoint?.url === this?.config?.primary.url;
    this.state?.lastFailoverTime = Date.now();

    if (wasPrimary && !this?.state?.isPrimaryActive) {
      this?.logger?.warn('Switched from primary to fallback endpoint', {
        from: this?.config?.primary.url,
        to: endpoint.url,
      });
    } else if (!wasPrimary && this?.state?.isPrimaryActive) {
      this?.logger?.info('Recovered to primary endpoint', {
        endpoint: endpoint.url,
      });
    }
  }

  /**
   * Mark endpoint as failed
   */
  private markEndpointFailed(endpoint: NetworkEndpoint): void {
    this?.state?.failedEndpoints.add(endpoint.url);
    
    this?.logger?.debug('Marked endpoint as failed', {
      url: endpoint.url,
      totalFailed: this?.state?.failedEndpoints.size,
    });
  }

  /**
   * Record endpoint success
   */
  private recordEndpointSuccess(endpoint: NetworkEndpoint, responseTime: number): void {
    // Remove from failed set if it was there
    this?.state?.failedEndpoints.delete(endpoint.url);
    
    this?.logger?.debug('Endpoint success recorded', {
      url: endpoint.url,
      responseTime,
    });
  }

  /**
   * Record endpoint failure
   */
  private recordEndpointFailure(endpoint: NetworkEndpoint, responseTime: number): void {
    this?.logger?.debug('Endpoint failure recorded', {
      url: endpoint.url,
      responseTime,
    });
  }

  /**
   * Start health checking
   */
  private startHealthChecking(): void {
    this?.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this?.config?.healthCheckInterval);
  }

  /**
   * Perform health checks on failed endpoints
   */
  private async performHealthChecks(): Promise<void> {
    if (this?.state?.failedEndpoints?.size === 0) {
      return;
    }

    this?.logger?.debug('Performing health checks on failed endpoints', {
      failedCount: this?.state?.failedEndpoints.size,
    });

    const failedUrls = Array.from(this?.state?.failedEndpoints);
    const allEndpoints = [this?.config?.primary, ...this?.config?.fallbacks];
    
    const checkPromises = failedUrls.map(async (url) => {
      const endpoint = allEndpoints.find(e => e?.url === url);
      if (!endpoint) return;

      try {
        // Simple health check
        const response = await fetch(endpoint.url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          this?.state?.failedEndpoints.delete(url);
          this?.logger?.info('Endpoint recovered', { url });
        }
      } catch (error) {
        // Still failed, keep in failed set
        this?.logger?.debug('Endpoint still failing health check', {
          url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.allSettled(checkPromises);
  }

  /**
   * Start recovery checking for primary endpoint
   */
  private startRecoveryChecking(): void {
    this?.recoveryTimer = setInterval(() => {
      this.attemptPrimaryRecovery();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Schedule recovery attempt
   */
  private scheduleRecoveryAttempt(): void {
    // Don't schedule if already on primary or if attempted recently
    if (this?.state?.isPrimaryActive) {
      return;
    }

    const timeSinceLastFailover = this?.state?.lastFailoverTime 
      ? Date.now() - this?.state?.lastFailoverTime 
      : 0;

    if (timeSinceLastFailover < 60000) { // Wait at least 1 minute
      return;
    }

    setTimeout(() => {
      this.attemptPrimaryRecovery();
    }, 10000); // Attempt recovery in 10 seconds
  }

  /**
   * Attempt to recover to primary endpoint
   */
  private async attemptPrimaryRecovery(): Promise<void> {
    if (this?.state?.isPrimaryActive || this?.state?.failedEndpoints.has(this?.config?.primary.url)) {
      return;
    }

    this?.state?.recoveryAttempts++;
    
    try {
      // Simple health check on primary
      const response = await fetch(this?.config?.primary.url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        this.switchToEndpoint(this?.config?.primary);
        this.state?.recoveryAttempts = 0;
        this?.logger?.info('Successfully recovered to primary endpoint');
      }
    } catch (error) {
      this?.logger?.debug('Primary recovery attempt failed', {
        attempt: this?.state?.recoveryAttempts,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get current fallback status
   */
  getStatus(): {
    currentEndpoint: string;
    isPrimaryActive: boolean;
    failedEndpoints: string[];
    availableEndpoints: string[];
    lastFailoverTime?: number;
    recoveryAttempts: number;
  } {
    const available = this.getAvailableEndpoints();
    
    return {
      currentEndpoint: this?.state?.currentEndpoint.url,
      isPrimaryActive: this?.state?.isPrimaryActive,
      failedEndpoints: Array.from(this?.state?.failedEndpoints),
      availableEndpoints: available.map(e => e.url),
      lastFailoverTime: this?.state?.lastFailoverTime,
      recoveryAttempts: this?.state?.recoveryAttempts,
    };
  }

  /**
   * Force switch to specific endpoint
   */
  forceSwitchTo(endpointUrl: string): void {
    const allEndpoints = [this?.config?.primary, ...this?.config?.fallbacks];
    const endpoint = allEndpoints.find(e => e?.url === endpointUrl);
    
    if (!endpoint) {
      throw new ValidationError(`Endpoint not found: ${endpointUrl}`);
    }

    this.switchToEndpoint(endpoint);
    this?.state?.failedEndpoints.delete(endpointUrl); // Clear any failure status
  }

  /**
   * Reset failed endpoints
   */
  resetFailedEndpoints(): void {
    this?.state?.failedEndpoints.clear();
    this?.logger?.info('Reset all failed endpoints');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this?.healthCheckTimer = undefined;
    }

    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this?.recoveryTimer = undefined;
    }

    this?.retryManager?.destroy();
  }
}