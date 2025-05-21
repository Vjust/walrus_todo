This file is a merged representation of a subset of the codebase, containing specifically included files, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
4. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Only files matching these patterns are included: src/utils/retry-manager.ts, src/base-command.ts, src/utils/ConnectionManager.ts, src/commands/complete.ts, src/commands/fetch.ts
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

## Additional Info

# Directory Structure
```
src/
  commands/
    complete.ts
    fetch.ts
  utils/
    ConnectionManager.ts
    retry-manager.ts
  base-command.ts
```

# Files

## File: src/utils/ConnectionManager.ts
```typescript
/**
 * ConnectionManager - Manages network connections and ensures proper cleanup
 * 
 * Handles connection state, timeouts, and ensures proper resource release
 * for network connections, blockchain services, and external API clients.
 */

import { Logger } from './Logger';
import { RetryManager } from './retry-manager';
import { NetworkError } from '../types/errors';

// Logger instance
const logger = Logger.getInstance();

interface ConnectionOptions {
  timeout?: number;        // Connection timeout in ms
  keepAlive?: boolean;     // Whether to keep the connection alive
  maxIdleTime?: number;    // Maximum idle time before closing connection
  autoReconnect?: boolean; // Whether to auto-reconnect on failure
  retryConfig?: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
  };
}

const DEFAULT_OPTIONS: ConnectionOptions = {
  timeout: 30000,         // 30 seconds
  keepAlive: false,       // Default to no keep-alive
  maxIdleTime: 60000,     // 1 minute idle time
  autoReconnect: true,    // Auto-reconnect by default
  retryConfig: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000
  }
};

/**
 * Manages a connection with automatic cleanup
 */
export class ConnectionManager<T> {
  private connection: T | null = null;
  private lastUsed: number = Date.now();
  private connectionTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly options: ConnectionOptions;
  private readonly retryManager: RetryManager;
  private readonly connectFn: () => Promise<T>;
  private readonly disconnectFn: (connection: T) => Promise<void>;
  private readonly healthCheckFn?: (connection: T) => Promise<boolean>;
  
  /**
   * Create a new connection manager
   * 
   * @param connectFn Function to create a new connection
   * @param disconnectFn Function to properly close a connection
   * @param healthCheckFn Optional function to check connection health
   * @param options Connection options
   */
  constructor(
    connectFn: () => Promise<T>,
    disconnectFn: (connection: T) => Promise<void>,
    healthCheckFn?: (connection: T) => Promise<boolean>,
    options: Partial<ConnectionOptions> = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.connectFn = connectFn;
    this.disconnectFn = disconnectFn;
    this.healthCheckFn = healthCheckFn;
    
    // Create a retry manager instance
    this.retryManager = new RetryManager(['default'], {
      maxRetries: this.options.retryConfig?.maxRetries || 3,
      initialDelay: this.options.retryConfig?.baseDelay || 1000,
      maxDelay: this.options.retryConfig?.maxDelay || 10000
    });
    
    // Set up idle connection monitoring if not using keep-alive
    if (!this.options.keepAlive && this.options.maxIdleTime) {
      this.startIdleMonitoring();
    }
  }
  
  /**
   * Get a connection, creating one if needed
   */
  async getConnection(): Promise<T> {
    try {
      // Check if we have a valid connection
      if (this.connection !== null) {
        // Update last used time
        this.lastUsed = Date.now();
        
        // Verify connection health if health check is available
        if (this.healthCheckFn) {
          const isHealthy = await this.healthCheckFn(this.connection);
          if (isHealthy) {
            return this.connection;
          }
          
          // Connection is not healthy, close it and create a new one
          logger.warn('Connection health check failed, reconnecting...');
          await this.closeConnection();
        } else {
          // No health check, assume connection is valid
          return this.connection;
        }
      }
      
      // Create a new connection with retry logic
      this.connection = await RetryManager.retry(
        () => this.connectFn(),
        {
          maxRetries: this.options.retryConfig?.maxRetries || 3,
          onRetry: (attempt, error) => {
            logger.debug(`Retry attempt ${attempt} connecting after error: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      );
      
      this.lastUsed = Date.now();
      return this.connection;
    } catch (error) {
      logger.error('Failed to establish connection',
        error instanceof Error ? error : new Error(String(error)),
        { network: 'unknown' } as Record<string, unknown>
      );
      throw new NetworkError('Connection failed', {
        network: 'unknown',
        operation: 'connect',
        recoverable: this.options.autoReconnect,
        cause: error instanceof Error ? error : new Error(String(error))
      } as Record<string, unknown>);
    }
  }
  
  /**
   * Execute an operation with a connection, ensuring proper cleanup
   * 
   * @param operation Function that receives the connection and performs operations
   * @returns The result of the operation
   */
  async withConnection<R>(operation: (connection: T) => Promise<R>): Promise<R> {
    try {
      const connection = await this.getConnection();
      return await operation(connection);
    } catch (error) {
      // If it's a connection error and auto-reconnect is enabled, schedule reconnection
      if (error instanceof NetworkError && this.options.autoReconnect) {
        this.scheduleReconnect();
      }
      throw error;
    } finally {
      // If not using keep-alive, close the connection after use
      if (!this.options.keepAlive) {
        await this.closeConnection();
      } else {
        // Update last used time for idle monitoring
        this.lastUsed = Date.now();
      }
    }
  }
  
  /**
   * Close the current connection if it exists
   */
  async closeConnection(): Promise<void> {
    if (this.connection !== null) {
      try {
        await this.disconnectFn(this.connection);
        logger.debug('Connection closed successfully');
      } catch (error) {
        logger.warn('Error closing connection',
          { error: String(error) }
        );
      } finally {
        this.connection = null;
      }
    }
    
    // Clear any pending timers
    this.clearTimers();
  }
  
  /**
   * Start monitoring for idle connections
   */
  private startIdleMonitoring(): void {
    // Clear any existing timer
    if (this.connectionTimer !== null) {
      clearInterval(this.connectionTimer);
    }
    
    // Set up a new timer to check for idle connections
    this.connectionTimer = setInterval(() => {
      this.checkIdleConnection();
    }, Math.min(30000, this.options.maxIdleTime || 60000)); // Check at most every 30 seconds
  }
  
  /**
   * Check if the connection has been idle for too long
   */
  private checkIdleConnection(): void {
    if (this.connection === null) return;
    
    const idleTime = Date.now() - this.lastUsed;
    if (idleTime > (this.options.maxIdleTime || 60000)) {
      logger.debug(`Closing idle connection (idle for ${idleTime}ms)`);
      this.closeConnection().catch(error => {
        logger.warn(
          'Error closing idle connection',
          { error: String(error) }
        );
      });
    }
  }
  
  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    // Clear any existing reconnect timer
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
    }
    
    // Set up a new reconnect timer
    this.reconnectTimer = setTimeout(() => {
      logger.debug('Attempting reconnection...');
      this.getConnection().catch(error => {
        logger.error('Reconnection failed',
          error instanceof Error ? error : new Error(String(error)),
          { network: 'unknown' } as Record<string, unknown>
        );
      });
    }, this.options.retryConfig?.baseDelay || 1000); // Start with base delay
  }
  
  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.connectionTimer !== null) {
      clearInterval(this.connectionTimer);
      this.connectionTimer = null;
    }
    
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  
  /**
   * Clean up all resources
   */
  async cleanup(): Promise<void> {
    await this.closeConnection();
    this.clearTimers();
  }
}
```

## File: src/utils/retry-manager.ts
```typescript
import { CLIError } from '../types/error';

interface RetryOptions {
  initialDelay?: number;
  maxDelay?: number;
  maxRetries?: number;
  maxDuration?: number;
  timeout?: number;
  retryableErrors?: Array<string | RegExp>;
  retryableStatuses?: number[];
  onRetry?: (error: Error, attempt: number, delay: number) => void;
  // New options for enhanced control
  minNodes?: number;           // Minimum healthy nodes required
  healthThreshold?: number;    // Minimum health score to consider a node healthy
  adaptiveDelay?: boolean;     // Use network conditions to adjust delay
  circuitBreaker?: {          // Circuit breaker configuration
    failureThreshold: number;  // Number of failures before opening circuit
    resetTimeout: number;      // Time to wait before attempting reset
  };
  loadBalancing?: 'health' | 'round-robin' | 'priority'; // Load balancing strategy
}

interface RetryContext {
  attempt: number;
  startTime: number;
  lastDelay: number;
  errors: Array<{ attempt: number; error: Error; timestamp: number }>;
}

export interface NetworkNode {
  url: string;
  priority: number;
  lastSuccess?: number;
  lastFailure?: number;
  consecutiveFailures: number;
  healthScore: number;
}

export class RetryManager {
  private static readonly DEFAULT_OPTIONS: Required<RetryOptions> = {
    initialDelay: 500,    // Start with 500ms
    maxDelay: 60000,      // Max 60 seconds between retries
    maxRetries: 5,        // Maximum 5 retries
    maxDuration: 300000,  // Total timeout of 5 minutes
    timeout: 15000,       // Individual attempt timeout
    retryableErrors: [
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'EPIPE',
      'network',
      'timeout',
      'connection',
      /^5\d{2}$/,         // 5xx errors
      '408',              // Request Timeout
      '429',              // Too Many Requests
      'insufficient storage',  // Walrus-specific errors
      'blob not found',
      'certification pending',
      'storage allocation',
    ],
    retryableStatuses: [
      408,  // Request Timeout
      429,  // Too Many Requests
      500,  // Internal Server Error
      502,  // Bad Gateway
      503,  // Service Unavailable
      504,  // Gateway Timeout
      449,  // Retry after storage allocation
      460,  // Temporary blob unavailable
    ],
    onRetry: () => {},
    // New options with defaults
    minNodes: 2,                     // Require at least 2 healthy nodes
    healthThreshold: 0.3,            // Node health must be above 30%
    adaptiveDelay: true,             // Use network conditions for delay
    circuitBreaker: {
      failureThreshold: 5,           // Open circuit after 5 failures
      resetTimeout: 30000            // Try reset after 30 seconds
    },
    loadBalancing: 'health'          // Default to health-based routing
  };

  private nodes: Map<string, NetworkNode> = new Map();
  private readonly HEALTH_DECAY = 0.1;  // Health score decay rate
  private readonly MIN_HEALTH = 0.1;    // Minimum health score
  private readonly MAX_HEALTH = 1.0;    // Maximum health score
  private readonly logger = console;
  private roundRobinIndex = 0;

  constructor(
    private baseUrls: string[],
    private options: RetryOptions = {}
  ) {
    // Initialize nodes with base URLs
    baseUrls.forEach((url, index) => {
      this.nodes.set(url, {
        url,
        priority: index,
        consecutiveFailures: 0,
        healthScore: 1.0
      });
    });
  }

  /**
   * Updates node health scores based on success/failure
   */
  private updateNodeHealth(
    nodeUrl: string,
    success: boolean,
    responseTime?: number
  ): void {
    const node = this.nodes.get(nodeUrl);
    if (!node) return;

    if (success) {
      node.lastSuccess = Date.now();
      node.consecutiveFailures = 0;
      node.healthScore = Math.min(
        node.healthScore + 0.2,
        this.MAX_HEALTH
      );
    } else {
      node.lastFailure = Date.now();
      node.consecutiveFailures++;
      node.healthScore = Math.max(
        node.healthScore - (0.3 * node.consecutiveFailures),
        this.MIN_HEALTH
      );
    }

    // Adjust for response time if available
    if (responseTime) {
      const timeScore = Math.max(0, 1 - (responseTime / 1000));
      node.healthScore = (node.healthScore * 0.7) + (timeScore * 0.3);
    }

    // Apply natural decay
    node.healthScore *= (1 - this.HEALTH_DECAY);
    node.healthScore = Math.max(node.healthScore, this.MIN_HEALTH);
  }

  /**
   * Gets the next best node to try
   */
  /**
   * Circuit breaker status for each node
   */
  private circuitBreakers: Map<string, {
    isOpen: boolean;
    failureCount: number;
    lastFailure: number;
    lastReset: number;
  }> = new Map();

  /**
   * Checks if a node's circuit breaker is open
   */
  private isCircuitOpen(node: NetworkNode): boolean {
    const options = { ...RetryManager.DEFAULT_OPTIONS, ...this.options };
    if (!options.circuitBreaker) return false;

    const breaker = this.circuitBreakers.get(node.url);
    if (!breaker) return false;

    if (!breaker.isOpen) return false;

    // Check if it's time to try reset
    if (Date.now() - breaker.lastFailure >= options.circuitBreaker.resetTimeout) {
      breaker.isOpen = false;
      breaker.failureCount = 0;
      breaker.lastReset = Date.now();
      return false;
    }

    return true;
  }

  /**
   * Updates circuit breaker state for a node
   */
  private updateCircuitBreaker(node: NetworkNode, success: boolean): void {
    const options = { ...RetryManager.DEFAULT_OPTIONS, ...this.options };
    if (!options.circuitBreaker) return;

    let breaker = this.circuitBreakers.get(node.url);
    if (!breaker) {
      breaker = {
        isOpen: false,
        failureCount: 0,
        lastFailure: 0,
        lastReset: Date.now()
      };
      this.circuitBreakers.set(node.url, breaker);
    }

    if (success) {
      breaker.failureCount = 0;
      breaker.isOpen = false;
    } else {
      breaker.failureCount++;
      breaker.lastFailure = Date.now();
      if (breaker.failureCount >= options.circuitBreaker.failureThreshold) {
        breaker.isOpen = true;
      }
    }
  }

  /**
   * Gets a weighted score for node selection
   */
  private getNodeScore(node: NetworkNode): number {
    const options = { ...RetryManager.DEFAULT_OPTIONS, ...this.options };
    let score = node.healthScore;

    // Penalize nodes below health threshold
    if (node.healthScore < options.healthThreshold) {
      score *= 0.5;
    }

    // Penalize nodes based on consecutive failures
    if (node.consecutiveFailures > 0) {
      score *= Math.pow(0.8, node.consecutiveFailures);
    }

    // Factor in response time if available
    if (node.lastSuccess) {
      const timeSinceSuccess = Date.now() - node.lastSuccess;
      if (timeSinceSuccess < 60000) { // Within last minute
        score *= 1.2; // Bonus for recent success
      }
    }

    // Circuit breaker penalty
    if (this.isCircuitOpen(node)) {
      score *= 0.1;
    }

    return score;
  }

  /**
   * Gets the next best node to try based on strategy
   */
  private getNextNode(): NetworkNode {
    const options = { ...RetryManager.DEFAULT_OPTIONS, ...this.options };
    const nodes = Array.from(this.nodes.values());

    // Filter out completely unhealthy nodes
    const availableNodes = nodes.filter(node => !this.isCircuitOpen(node));

    // Check if we have enough healthy nodes
    if (availableNodes.length < options.minNodes) {
      throw new CLIError(
        `Insufficient healthy nodes (found ${availableNodes.length}, need ${options.minNodes})`,
        'RETRY_INSUFFICIENT_NODES'
      );
    }

    switch (options.loadBalancing) {
      case 'round-robin':
        // Simple round-robin
        const node = availableNodes[this.roundRobinIndex % availableNodes.length];
        this.roundRobinIndex = (this.roundRobinIndex + 1) % availableNodes.length;
        return node;

      case 'priority':
        // Use node priority only
        return availableNodes.sort((a, b) => a.priority - b.priority)[0];

      case 'health':
      default:
        // Use weighted scoring
        return availableNodes.sort((a, b) => {
          const scoreA = this.getNodeScore(a);
          const scoreB = this.getNodeScore(b);
          return scoreB - scoreA;
        })[0];
    }
  }

  /**
   * Determines if an error is retryable
   */
  private isRetryableError(error: Error | any): boolean {
    const options = { ...RetryManager.DEFAULT_OPTIONS, ...this.options };

    // Check if it's a HTTP error with status code
    if (error.status || error.statusCode) {
      const status = error.status || error.statusCode;
      if (options.retryableStatuses.includes(status)) {
        return true;
      }
    }

    // Check error message against patterns
    const errorString = error.message || error.toString();
    return options.retryableErrors.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(errorString);
      }
      return errorString.toLowerCase().includes(pattern.toLowerCase());
    });
  }

  /**
   * Calculates the next retry delay using exponential backoff
   */
  /**
   * Calculates network conditions score based on recent errors
   */
  private getNetworkScore(context: RetryContext): number {
    if (context.errors.length === 0) return 1.0;

    const recentErrors = context.errors.filter(e => 
      Date.now() - e.timestamp < 60000 // Look at last minute
    );

    if (recentErrors.length === 0) return 0.8;

    // More errors = worse conditions
    return Math.max(0.2, 1 - (recentErrors.length * 0.2));
  }

  /**
   * Gets delay multiplier based on error type
   */
  private getErrorMultiplier(error: Error): number {
    const errorStr = error.message.toLowerCase();
    
    // Adjust delay based on error type
    if (errorStr.includes('timeout')) return 1.5;
    if (errorStr.includes('rate limit') || errorStr.includes('429')) return 2.0;
    if (errorStr.includes('insufficient storage')) return 2.5;
    if (errorStr.includes('certification pending')) return 1.2;
    
    return 1.0;
  }

  /**
   * Calculates next retry delay with adaptivity
   */
  private getNextDelay(context: RetryContext): number {
    const options = { ...RetryManager.DEFAULT_OPTIONS, ...this.options };
    
    // Base exponential delay
    let delay = options.initialDelay * Math.pow(2, context.attempt - 1);

    if (options.adaptiveDelay) {
      // Adjust based on network conditions
      const networkScore = this.getNetworkScore(context);
      delay *= (2 - networkScore); // Increase delay in poor conditions

      // Adjust based on last error
      if (context.errors.length > 0) {
        const lastError = context.errors[context.errors.length - 1].error;
        delay *= this.getErrorMultiplier(lastError);
      }

      // Add jitter based on network stability
      const jitterFactor = networkScore < 0.5 ? 0.5 : 0.3;
      const jitter = Math.random() * jitterFactor * delay;
      delay += jitter;
    } else {
      // Simple jitter for non-adaptive mode
      const jitter = Math.random() * 0.3 * delay;
      delay += jitter;
    }

    // Cap at maximum delay
    delay = Math.min(delay, options.maxDelay);

    // Ensure we don't exceed maxDuration
    const timeRemaining = options.maxDuration - (Date.now() - context.startTime);
    delay = Math.min(delay, timeRemaining);

    return Math.max(delay, options.initialDelay);
  }

  /**
   * Executes an operation with retry logic
   */
  async execute<T>(
    operation: (node: NetworkNode) => Promise<T>,
    context: string
  ): Promise<T> {
    return this.retry(operation, context);
  }

  /**
   * Alternative name for execute that matches the static API
   * This provides compatibility with code using RetryManager.retry static method
   */
  async retry<T>(
    operation: (node: NetworkNode) => Promise<T>,
    context: string | Record<string, any>
  ): Promise<T> {
    const options = { ...RetryManager.DEFAULT_OPTIONS, ...this.options };
    const retryContext: RetryContext = {
      attempt: 0,
      startTime: Date.now(),
      lastDelay: 0,
      errors: []
    };

    let lastNode: NetworkNode | null = null;

    while (true) {
      retryContext.attempt++;
      
      // Check if we've exceeded max retries or duration
      if (retryContext.attempt > options.maxRetries) {
        throw new CLIError(
          `Maximum retries (${options.maxRetries}) exceeded during ${context}`,
          'RETRY_MAX_ATTEMPTS'
        );
      }
      
      if (Date.now() - retryContext.startTime > options.maxDuration) {
        throw new CLIError(
          `Operation timed out after ${options.maxDuration}ms during ${context}`,
          'RETRY_TIMEOUT'
        );
      }

      try {
        // Get next node, ensuring we don't use the same failed node immediately
        let node: NetworkNode;
        do {
          node = this.getNextNode();
        } while (
          lastNode && 
          node.url === lastNode.url && 
          this.nodes.size > 1 && 
          retryContext.attempt <= 3
        );
        lastNode = node;

        const startTime = Date.now();
        let timeoutId: NodeJS.Timeout;

        // Execute with timeout and network quality monitoring
        try {
          const result = await Promise.race([
            operation(node),
            // Timeout promise
            new Promise<never>((_, reject) => {
              timeoutId = setTimeout(() => {
                const timeoutError = new Error(
                  `Operation timed out after ${options.timeout}ms during ${context} on node ${node.url}`
                );
                this.updateNodeHealth(node.url, false, options.timeout);
                reject(timeoutError);
              }, options.timeout);
            })
          ]);

          // Operation succeeded
          clearTimeout(timeoutId! as unknown as NodeJS.Timeout);
          const responseTime = Date.now() - startTime;

          // Update node health and circuit breaker
          this.updateNodeHealth(node.url, true, responseTime);
          this.updateCircuitBreaker(node, true);

          return result;
        } catch (error) {
          // Always clear timeout to prevent memory leaks
          clearTimeout(timeoutId! as unknown as NodeJS.Timeout);
          throw error;
        }
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        const node = lastNode!;

        // Update node health and circuit breaker
        this.updateNodeHealth(node.url, false);
        this.updateCircuitBreaker(node, false);

        // Record error with enhanced categorization
        const errorInfo = {
          attempt: retryContext.attempt,
          error: errorObj,
          timestamp: Date.now(),
          node: node.url,
          type: this.categorizeError(errorObj)
        };
        retryContext.errors.push(errorInfo);

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          throw new CLIError(
            `Non-retryable error during ${context} with node ${node.url}: ${errorObj.message}`,
            'RETRY_NON_RETRYABLE'
          );
        }

        // Check for circuit breaker conditions
        const circuit = this.circuitBreakers.get(node.url);
        if (circuit?.isOpen) {
          this.logger.warn(
            `Circuit breaker open for node ${node.url}. ` +
            `Will retry after ${options.circuitBreaker!.resetTimeout}ms`
          );
        }

        // Calculate next delay with adaptivity
        const delay = this.getNextDelay(retryContext);
        retryContext.lastDelay = delay;

        // Enhanced retry callback with more context
        options.onRetry(errorObj, retryContext.attempt, delay);

        // Wait before next attempt, logging if delay is significant
        if (delay > 5000) {
          this.logger.info(
            `Long delay of ${delay}ms before retry ${retryContext.attempt}/${options.maxRetries}`,
            {
              context,
              error: errorObj.message,
              networkScore: this.getNetworkScore(retryContext)
            }
          );
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Categorizes error for better handling
   */
  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('network')) return 'network';
    if (message.includes('rate limit') || message.includes('429')) return 'rate_limit';
    if (message.includes('storage')) return 'storage';
    if (message.includes('certification')) return 'certification';
    if (message.match(/^5\d{2}$/)) return 'server_error';
    
    return 'unknown';
  }

  /**
   * Gets a summary of retry attempts and errors
   */
  getErrorSummary(context: RetryContext): string {
    if (!context.errors.length) {
      return 'No errors recorded';
    }

    return context.errors
      .map(e => {
        // Format timestamps consistently and include error type if available
        const timestamp = new Date(e.timestamp).toISOString();
        const errorType = e.error.name || this.categorizeError(e.error);
        return `Attempt ${e.attempt} failed at ${timestamp}: [${errorType}] ${e.error.message}`;
      })
      .join('\n');
  }

  /**
   * Gets health status of all nodes
   */
  getNodesHealth(): Array<{
    url: string;
    health: number;
    consecutiveFailures: number;
    lastSuccess?: Date;
    lastFailure?: Date;
  }> {
    return Array.from(this.nodes.values()).map(node => ({
      url: node.url,
      health: node.healthScore,
      consecutiveFailures: node.consecutiveFailures,
      lastSuccess: node.lastSuccess ? new Date(node.lastSuccess) : undefined,
      lastFailure: node.lastFailure ? new Date(node.lastFailure) : undefined
    }));
  }

  /**
   * Static version of retry for backwards compatibility
   * This allows code to continue using RetryManager.retry
   * while we transition to the instance method version
   */
  static async retry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      initialDelay?: number;
      maxDelay?: number;
      retryableErrors?: Array<string | RegExp>;
      onRetry?: (error: Error, attempt: number, delay: number) => void;
    } = {}
  ): Promise<T> {
    // Create a temporary instance with a single default node
    const manager = new RetryManager(['default'], {
      maxRetries: options.maxRetries,
      initialDelay: options.initialDelay,
      maxDelay: options.maxDelay,
      retryableErrors: options.retryableErrors
    });

    // Wrap the operation to make it compatible with the instance method
    const wrappedOperation = (_node: NetworkNode) => operation();
    
    // Execute with the instance method
    return manager.execute(wrappedOperation, typeof options === 'string' ? options : 'static_operation');
  }
}
```

## File: src/commands/fetch.ts
```typescript
import { Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import { SuiClient } from '@mysten/sui/client';
import { TodoService } from '../services/todoService';
import { createWalrusStorage } from '../utils/walrus-storage';
import { SuiNftStorage } from '../utils/sui-nft-storage';
import { NETWORK_URLS } from '../constants';
import { CLIError } from '../types/error';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { configService } from '../services/config-service';
import chalk from 'chalk';
import { RetryManager } from '../utils/retry-manager';

/**
 * @class FetchCommand
 * @description This command retrieves todo items directly from blockchain storage (Sui NFT) or Walrus storage using their respective IDs.
 * It allows users to fetch todos that may not be in their local storage and save them to a specified list.
 * The command handles the connection to Walrus for blob data and Sui blockchain for NFT data, ensuring the todo is properly reconstructed and stored locally.
 *
 * @param {string} [blob-id] - The Walrus blob ID of the todo item to retrieve. (Optional flag: --blob-id)
 * @param {string} [object-id] - The NFT object ID on the Sui blockchain to retrieve. (Optional flag: --object-id)
 * @param {string} [list='default'] - The name of the local todo list to save the retrieved todo to. (Optional flag: -l, --list)
 */
export default class FetchCommand extends BaseCommand {
  static description = 'Fetch todos directly from blockchain or Walrus storage using IDs';

  static examples = [
    '<%= config.bin %> fetch --blob-id QmXyz --list my-todos',
    '<%= config.bin %> fetch --object-id 0x123 --list my-todos',
  ];

  static flags = {
    ...BaseCommand.flags,
    'blob-id': Flags.string({
      description: 'Walrus blob ID to retrieve',
      exclusive: ['object-id'],
    }),
    'object-id': Flags.string({
      description: 'NFT object ID to retrieve',
      exclusive: ['blob-id'],
    }),
    list: Flags.string({
      char: 'l',
      description: 'Save to this todo list',
      default: 'default'
    }),
  };

  private todoService = new TodoService();
  private walrusStorage = createWalrusStorage('testnet', true); // Use mock mode for testing

  async run(): Promise<void> {
    try {
      const { flags } = await this.parse(FetchCommand);
      // Removed unused configFetch variable

      // Validate input
      if (!flags['blob-id'] && !flags['object-id']) {
        throw new CLIError('Either --blob-id or --object-id must be specified', 'MISSING_PARAMETER');
      }

      // Get config for Sui client
      const configInner = await configService.getConfig();  // Changed to avoid redeclaration
      if (!configInner?.lastDeployment?.packageId) {
        throw new CLIError('Contract not deployed. Please run "waltodo deploy" first.', 'NOT_DEPLOYED');
      }

      if (flags['blob-id']) {
        // Initialize Walrus storage
        await this.walrusStorage.connect();

        // Retrieve todo from Walrus with retry
        this.log(chalk.blue(`Retrieving todo from Walrus (blob ID: ${flags['blob-id']})...`));
        const todo = await RetryManager.retry(
          () => this.walrusStorage.retrieveTodo(flags['blob-id']),
          {
            maxRetries: 3,
            retryableErrors: [/NETWORK_ERROR/, /CONNECTION_REFUSED/],
            onRetry: (attempt, error) => {
              this.log(chalk.yellow(`Retry attempt ${attempt} after error: ${error.message}`));
            }
          }
        );

        // Save to local list
        await this.todoService.addTodo(flags.list, todo); // Removed unused savedTodo variable

        this.log(chalk.green("✓ Todo retrieved successfully"));
        this.log(chalk.dim("Details:"));
        this.log(`  Title: ${todo.title}`);
        this.log(`  Status: ${todo.completed ? 'Completed' : 'Pending'}`);
        this.log(`  Priority: ${todo.priority}`);
        
        if (todo.tags?.length) {
          this.log(`  Tags: ${todo.tags.join(', ')}`);
        }

        // Cleanup
        await this.walrusStorage.disconnect();
      } else if (flags['object-id']) {
        // Initialize Sui client first
        const suiClient = {
          url: NETWORK_URLS[configInner.network as keyof typeof NETWORK_URLS],
          core: {},
          jsonRpc: {},
          signAndExecuteTransaction: async () => { },
          getEpochMetrics: async () => null,
          getObject: async () => null,
          getTransactionBlock: async () => null
        } as unknown as SuiClient;
        // Initialize Sui NFT storage
        if (!configInner.lastDeployment) {
          throw new CLIError('Contract not deployed. Please run "waltodo deploy" first.', 'NOT_DEPLOYED');
        }
        const signer = {} as Ed25519Keypair;
        const suiNftStorage = new SuiNftStorage(suiClient, signer, {
          address: configInner.lastDeployment.packageId,
          packageId: configInner.lastDeployment.packageId,
          collectionId: ''
        });
        
        // Retrieve NFT from blockchain
        this.log(chalk.blue(`Retrieving NFT from blockchain (object ID: ${flags['object-id']})...`));
        const nftData = await suiNftStorage.getTodoNft(flags['object-id']);
        
        if (!nftData.walrusBlobId) {
          throw new CLIError('NFT does not contain a Walrus blob ID', 'INVALID_NFT');
        }
        
        // Initialize Walrus storage
        await this.walrusStorage.connect();
        
        // Retrieve todo data from Walrus
        this.log(chalk.blue(`Retrieving todo data from Walrus (blob ID: ${nftData.walrusBlobId})...`));
        const todo = await this.walrusStorage.retrieveTodo(nftData.walrusBlobId);
        
        // Save to local list
        await this.todoService.addTodo(flags.list, { // Removed unused savedTodo variable
          ...todo,
          nftObjectId: flags['object-id'],
          walrusBlobId: nftData.walrusBlobId
        });
        
        this.log(chalk.green(`✓ Todo retrieved successfully from blockchain and Walrus`));
        this.log(chalk.dim('Details:'));
        this.log(`  Title: ${todo.title}`);
        this.log(`  Status: ${todo.completed ? 'Completed' : 'Pending'}`);
        this.log(`  Priority: ${todo.priority}`);
        this.log(`  NFT Object ID: ${flags['object-id']}`);
        this.log(`  Walrus Blob ID: ${nftData.walrusBlobId}`);
        
        if (todo.tags?.length) {
          this.log(`  Tags: ${todo.tags.join(', ')}`);
        }
        
        // Cleanup
        await this.walrusStorage.disconnect();
      }
      
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to retrieve todo: ${error instanceof Error ? error.message : String(error)}`,
        'RETRIEVE_FAILED'
      );
    }
  }
}
```

## File: src/base-command.ts
```typescript
import { Command, Flags, Hook } from '@oclif/core';
import { checkPermission } from './middleware/authorization';
import { ResourceType, ActionType } from './types/permissions';
import { authenticationService } from './services/authentication-service';
import { Logger } from './utils/Logger';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ux } from '@oclif/core';
import { CLIError } from './types/error';
import { WalrusError, NetworkError, ValidationError, TransactionError } from './types/errors';
import { withRetry } from './utils/error-handler';
import { commandRegistry, CommandMetadata } from './utils/CommandRegistry';
import { BatchProcessor } from './utils/batch-processor';
import { createCache, PerformanceCache } from './utils/performance-cache';
import { getGlobalLazyLoader } from './utils/lazy-loader';
import { displayFriendlyError, getErrorContext } from './utils/error-messages';
import { 
  SpinnerManager, 
  ProgressBar, 
  MultiProgress,
  createSpinner,
  createProgressBar,
  createMultiProgress,
  withSpinner,
  withProgressBar,
  SpinnerOptions,
  ProgressBarOptions
} from './utils/progress-indicators';
import stripAnsi from 'strip-ansi';
import * as cliProgress from 'cli-progress';
import { 
  SpinnerManager as CLISpinnerManager,
  ErrorHandler,
  FlagValidator,
  RetryManager,
  RetryOptions,
  Logger as CLILogger,
  Formatter
} from './utils/cli-helpers';

/**
 * Icons used throughout the CLI for consistent appearance
 */
export const ICONS = {
  // Status icons - more playful and fun
  SUCCESS: '🎉', // Celebration instead of checkmark
  ERROR: '💥',   // Explosion instead of X
  WARNING: '⚡️', // Lightning instead of warning
  INFO: '💡',    // Lightbulb instead of info
  PENDING: '🕐', // Clock instead of circle
  ACTIVE: '🟢',  // Green circle
  LOADING: '🔄', // Rotating arrows
  DEBUG: '🔮',   // Crystal ball instead of magnifying glass

  // Object icons - more vibrant
  TODO: '✨',    // Sparkles for todos
  LIST: '📋',    // Clipboard
  LISTS: '📚',   // Books
  TAG: '🏷️',     // Tag
  PRIORITY: '🔥', // Fire instead of lightning
  DATE: '📆',    // Calendar
  TIME: '⏰',    // Alarm clock

  // Feature icons - playful alternatives
  BLOCKCHAIN: '⛓️', // Chain
  WALRUS: '🦭',    // Actual walrus emoji
  LOCAL: '🏠',     // House instead of computer
  HYBRID: '🧩',    // Puzzle piece instead of arrows
  AI: '🧠',        // Brain instead of robot
  STORAGE: '📦',   // Box instead of disk
  CONFIG: '🛠️',    // Tools
  USER: '😎',      // Cool face instead of user
  SEARCH: '🔍',    // Magnifying glass
  SECURE: '🔐',    // Locked with key
  INSECURE: '🔓',  // Unlocked

  // UI elements - more unique
  BULLET: '•',
  ARROW: '➜',      // Different arrow
  BOX_V: '│',
  BOX_H: '─',
  BOX_TL: '┌',
  BOX_TR: '┐',
  BOX_BL: '└',
  BOX_BR: '┘',
  LINE: '·'
};

/**
 * Priority-related constants - with more fun styling
 */
export const PRIORITY = {
  high: {
    color: chalk.red.bold,
    icon: '🔥', // Fire for high priority
    label: 'HOT!',
    value: 3
  },
  medium: {
    color: chalk.yellow.bold,
    icon: '⚡', // Lightning for medium priority
    label: 'SOON',
    value: 2
  },
  low: {
    color: chalk.green,
    icon: '🍃', // Leaf for low priority
    label: 'CHILL',
    value: 1
  }
};

/**
 * Storage-related constants - with playful labels
 */
export const STORAGE = {
  local: {
    color: chalk.green.bold,
    icon: ICONS.LOCAL,
    label: 'Home Base'
  },
  blockchain: {
    color: chalk.blue.bold,
    icon: ICONS.BLOCKCHAIN,
    label: 'On Chain'
  },
  both: {
    color: chalk.magenta.bold,
    icon: ICONS.HYBRID,
    label: 'Everywhere!'
  }
};

/**
 * Base command class that all WalTodo CLI commands extend
 *
 * This class provides common functionality used across all commands including:
 * - Standardized flags (help, json, verbose, etc.)
 * - Authentication handling
 * - Permission checking
 * - Consistent UI elements (success/error messages, spinners, formatted output)
 * - JSON output support
 * - Logging utilities
 *
 * Commands should extend this class to ensure a consistent user experience
 * and avoid duplicating common functionality.
 */
export default abstract class BaseCommand extends Command {
  static flags = {
    help: Flags.help({ char: 'h' }),
    json: Flags.boolean({
      description: 'Format output as json',
    }),
    'no-color': Flags.boolean({
      description: 'Disable color output',
    }),
    quiet: Flags.boolean({
      char: 'q',
      description: 'Suppress all output except errors',
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show detailed output',
    }),
  };

  // No global hooks needed - using catch() method for error handling

  private logger: Logger = Logger.getInstance();
  protected tokenPath = path.join(os.homedir(), '.walrus', 'auth.json');
  
  // Performance tools
  protected configCache!: PerformanceCache<any>;
  protected todoListCache!: PerformanceCache<any>;
  protected blockchainQueryCache!: PerformanceCache<any>;
  protected aiResponseCache!: PerformanceCache<any>;
  protected batchProcessor!: BatchProcessor;
  private lazyLoader!: any;

  /**
   * Authenticate current user from stored token
   */
  protected async authenticate(): Promise<any> {
    if (!fs.existsSync(this.tokenPath)) {
      this.errorWithHelp(
        'Authentication required',
        'Not authenticated. Please login first with:',
        `walrus account:auth --login YOUR_USERNAME`
      );
      return null;
    }

    try {
      const data = fs.readFileSync(this.tokenPath, 'utf-8');
      const authInfo = JSON.parse(data);

      // Validate token
      const validation = await authenticationService.validateToken(authInfo.token);
      if (!validation.valid) {
        if (validation.expired) {
          this.errorWithHelp(
            'Session expired',
            'Your session has expired. Please login again with:',
            `walrus account:auth --login YOUR_USERNAME`
          );
        } else {
          this.errorWithHelp(
            'Invalid session',
            'Your session is invalid. Please login again with:',
            `walrus account:auth --login YOUR_USERNAME`
          );
        }
        return null;
      }

      return validation.user;
    } catch (error) {
      this.errorWithHelp(
        'Authentication failed',
        'Authentication failed. Please login again with:',
        `walrus account:auth --login YOUR_USERNAME`
      );
      return null;
    }
  }

  /**
   * Check if current user has permission to perform action on resource
   */
  protected async hasPermission(
    resource: string | ResourceType,
    resourceId: string | undefined,
    action: string | ActionType
  ): Promise<boolean> {
    return checkPermission(resource, resourceId, action);
  }

  /**
   * Display success message with celebration flair
   */
  protected success(message: string): void {
    if (this.shouldSuppressOutput()) return;
    const sparkles = chalk.magenta('✨');
    this.log(`${sparkles} ${chalk.green.bold(`${ICONS.SUCCESS} ${message}`)} ${sparkles}`);
  }

  /**
   * Display info message with lightbulb insight
   */
  protected info(message: string): void {
    if (this.shouldSuppressOutput()) return;
    this.log(chalk.cyan.bold(`${ICONS.INFO} ${message}`));
  }

  /**
   * Display warning message with attention-grabbing style
   */
  protected warning(message: string): void {
    if (this.shouldSuppressOutput()) return;
    this.log(`${chalk.yellow.bold(`${ICONS.WARNING} ${message}`)}`);
  }

  /**
   * Display error message with possible solution - with more personality
   */
  protected errorWithHelp(title: string, message: string, suggestion?: string): void {
    // Create an error to get enhanced messaging
    const error = new CLIError(message, 'CLI_ERROR');
    const context = getErrorContext(this, error);
    context.command = this.id || this.constructor.name.toLowerCase().replace('command', '');
    
    // Use enhanced error messaging system
    const friendlyError = displayFriendlyError(error, context);
    console.error(friendlyError);
    
    throw new CLIError(message, 'FORMATTED_ERROR');
  }

  /**
   * Display detailed error message with troubleshooting steps - with encouragement
   */
  protected detailedError(title: string, message: string, troubleshooting: string[]): void {
    // Create an error to get enhanced messaging
    const error = new CLIError(message, 'CLI_ERROR');
    const context = getErrorContext(this, error);
    context.command = this.id || this.constructor.name.toLowerCase().replace('command', '');
    
    // Use enhanced error messaging system
    const friendlyError = displayFriendlyError(error, context);
    console.error(friendlyError);
    
    throw new CLIError(message, 'DETAILED_ERROR');
  }

  /**
   * Display verbose output if verbose flag is set - with magical flair
   * (Named debugLog to avoid conflict with Command.debug property)
   */
  protected debugLog(message: string, data?: any): void {
    if (!this.isVerbose()) return;

    // A bit of magic and whimsy for debugging
    this.log(chalk.magenta(`${ICONS.DEBUG} ✧ ${message} ✧`));
    if (data) {
      // Add a fun prefix to JSON data
      this.log(chalk.dim(`🔎 Peeking under the hood:`));
      this.log(chalk.cyan(JSON.stringify(data, null, 2)));
    }
  }

  /**
   * Draw a fun titled section with a box around it
   * Creates a vibrant box with a title bar for structured content display.
   * The box automatically adjusts width based on content with playful styling.
   *
   * @param title Section title displayed in the box header
   * @param content Content to display inside the box (can be multi-line)
   */
  protected section(title: string, content: string): void {
    if (this.shouldSuppressOutput()) return;

    const lines = content.split('\n');
    const width = Math.max(...lines.map(line => this.stripAnsi(line).length), title.length + 4);

    // Pick a random fun color for the box
    const boxColors = [chalk.cyan, chalk.magenta, chalk.green, chalk.yellow, chalk.blue];
    const boxColor = boxColors[Math.floor(Math.random() * boxColors.length)];

    // Random decorative emoji for the section title
    const decorations = ['✨', '🌟', '💫', '🚀', '💥', '🔮', '🧩', '🎯'];
    const decoration = decorations[Math.floor(Math.random() * decorations.length)];

    // Top border with title and decoration
    this.log(boxColor(`${ICONS.BOX_TL}${ICONS.BOX_H}[ ${decoration} ${chalk.bold.white(title)} ${decoration} ]${ICONS.BOX_H.repeat(width - title.length - 8)}${ICONS.BOX_TR}`));

    // Content with colorful borders
    lines.forEach(line => {
      const rawLine = this.stripAnsi(line);
      const padding = width - rawLine.length;
      this.log(`${boxColor(ICONS.BOX_V)} ${line}${' '.repeat(padding)} ${boxColor(ICONS.BOX_V)}`);
    });

    // Bottom border
    this.log(boxColor(`${ICONS.BOX_BL}${ICONS.BOX_H.repeat(width + 2)}${ICONS.BOX_BR}`));
  }

  /**
   * Create a fun formatted list with title and varied bullet points
   */
  protected simpleList(title: string, items: string[]): void {
    if (this.shouldSuppressOutput()) return;

    // Fun bullet point variations
    const bullets = ['🔹', '🔸', '💠', '🔻', '🔶', '🔷', '🔸', '🔹'];

    // Title with fun decorations
    this.log(chalk.bold(`\n✧ ${chalk.underline(title)} ✧`));

    // List items with alternating bullets and subtle coloring
    items.forEach((item, index) => {
      const bullet = bullets[index % bullets.length];
      // Alternate text colors for adjacent items
      const itemText = index % 2 === 0
        ? chalk.cyan(item)
        : chalk.white(item);
      this.log(`  ${bullet} ${itemText}`);
    });

    this.log('');
  }

  /**
   * Format a todo item for display with playful styling
   * Creates a fun, visually appealing representation of a todo item with:
   * - Emoji status indicator (celebration for completed, clock for pending)
   * - Cool priority indicator with fun labels
   * - Title with subtle highlighting
   * - Optional details with playful icons and formatting
   *
   * @param todo Todo item to format
   * @param showDetail Whether to include detailed information (default: true)
   * @returns Formatted string ready for display
   */
  protected formatTodo(todo: any, showDetail: boolean = true): string {
    // Status indicators with more personality
    const status = todo.completed
      ? chalk.green.bold(`${ICONS.SUCCESS} `) // Celebration
      : chalk.yellow(`${ICONS.PENDING} `);    // Clock

    // Get priority with our new fun labels
    const priority = PRIORITY[todo.priority as keyof typeof PRIORITY]
      || PRIORITY.medium;

    // Construct the priority badge with the icon and label
    const priorityBadge = priority.color(`${priority.icon} ${priority.label}`);

    // Make the title pop with subtle formatting (but not too much)
    const titleFormatted = todo.completed
      ? chalk.dim.strikethrough(todo.title) // Strikethrough for completed todos
      : chalk.white.bold(todo.title);      // Bold for pending todos

    // Start building a fun output
    let output = `${status}${priorityBadge} ${titleFormatted}`;

    // Add fun details with more personality
    if (showDetail && (todo.dueDate || (todo.tags && todo.tags.length) || todo.private)) {
      const details = [
        todo.dueDate && chalk.blue(`${ICONS.DATE} ${todo.dueDate}`),
        todo.tags?.length && chalk.cyan(`${ICONS.TAG} ${todo.tags.join(', ')}`),
        todo.private && chalk.yellow(`${ICONS.SECURE} Eyes only!`)
      ].filter(Boolean);

      if (details.length) {
        output += `\n   ${details.join(' │ ')}`;
      }
    }

    return output;
  }

  /**
   * Format a storage icon and label with a fun twist
   */
  protected formatStorage(storageType: string): string {
    const storage = STORAGE[storageType as keyof typeof STORAGE] || STORAGE.local;

    // Add a playful animation-like effect with brackets
    return `[${storage.icon}] ${storage.color.bold(storage.label)} [${storage.icon}]`;
  }

  /**
   * Output JSON result if json flag is set
   */
  protected async jsonOutput(data: any): Promise<void> {
    if (await this.isJson()) {
      this.log(JSON.stringify(data, null, 2));
    }
  }

  /**
   * Check if output should be shown as JSON
   */
  protected async isJson(): Promise<boolean> {
    const { flags } = await this.parse(this.constructor as typeof BaseCommand);
    return flags.json as boolean;
  }

  /**
   * Get current flag values synchronously
   * This is safer than direct parsing which requires Promise handling
   */
  protected getCurrentFlags(): any {
    try {
      // Access parsed flags if already available
      return this.constructor.prototype.flags || {};
    } catch (e) {
      return {};
    }
  }

  /**
   * Check if color should be disabled
   */
  protected isNoColor(): boolean {
    // Use synchronous approach for init-time flag checking
    if (this.argv.includes('--no-color')) {
      return true;
    }
    return Boolean(this.getCurrentFlags()['no-color']);
  }

  /**
   * Check if output should be verbose
   */
  protected isVerbose(): boolean {
    if (this.argv.includes('--verbose') || this.argv.includes('-v')) {
      return true;
    }
    return Boolean(this.getCurrentFlags().verbose);
  }

  /**
   * Check if output should be suppressed
   */
  protected shouldSuppressOutput(): boolean {
    if (this.argv.includes('--quiet') || this.argv.includes('-q')) {
      return true;
    }
    return Boolean(this.getCurrentFlags().quiet);
  }

  /**
   * Start a loading spinner with a message
   */
  protected startSpinner(message: string): any {
    if (this.shouldSuppressOutput()) return null;
    return ux.action.start(message);
  }

  /**
   * Stop a loading spinner with a success message
   */
  protected stopSpinnerSuccess(spinner: any, message: string): void {
    if (!spinner) return;
    ux.action.stop(chalk.green(`${ICONS.SUCCESS} ${message}`));
  }

  /**
   * Strip ANSI color codes from a string
   */
  private stripAnsi(text: string): string {
    return stripAnsi(text);
  }

  /**
   * Initialize command
   */
  async init(): Promise<void> {
    await super.init();

    // Force colors to be enabled always, overriding any no-color flag
    // This ensures our playful styling always appears
    process.env.FORCE_COLOR = '1';
    chalk.level > 0 || (chalk.level = 1);

    // Only disable color if explicitly requested and in a non-demo environment
    if (this.isNoColor() && process.env.DEMO_MODE !== 'true') {
      chalk.level = 0;
    }
    
    // Initialize performance tools
    this.initializePerformanceTools();
    this.preloadCommonModules();
  }

  /**
   * Handle command errors
   */
  async catch(error: Error): Promise<any> {
    // Check if this might be a misspelled command
    const args = this.argv;
    if (error.message.includes('command not found') && args.length > 0) {
      const input = args[0];
      const suggestions = commandRegistry.suggestCommands(input, 3);
      
      if (suggestions.length > 0) {
        // Create a custom error with command suggestions
        const notFoundError = new CLIError(`'${input}' is not a valid command`, 'COMMAND_NOT_FOUND');
        const context = getErrorContext(this, notFoundError);
        context.command = input;
        
        // Display with enhanced error messaging
        const friendlyError = displayFriendlyError(notFoundError, context);
        console.error(friendlyError);
        
        throw notFoundError;
      }
    }
    
    // Use the enhanced error handling system
    return this.handleCommandError(error);
  }

  /**
   * Clean up after command finishes
   */
  async finally(error: Error | undefined): Promise<any> {
    // Save performance caches
    if (this.configCache) {
      await this.savePerformanceCaches();
    }
    
    // Any cleanup needed
    return super.finally(error);
  }

  /**
   * Override log method to ensure output is always visible
   * while avoiding duplicate console output
   *
   * This implementation resolves an issue with the base Command class
   * where using both super.log and console.log would cause duplicate output.
   *
   * @param message Message to log
   * @param args Additional arguments
   */
  log(message: string, ...args: any[]): void {
    // Call the original log method only - we don't need both super.log and console.log
    // which creates duplicate output
    super.log(message, ...args);
  }

  /**
   * Enhanced error handling with structured error types
   * Provides specialized handling for different error categories
   */
  protected async handleCommandError(error: Error): Promise<never> {
    this.logger.error(`Command error: ${error.message}`, error);

    // Get error context
    const context = getErrorContext(this, error);
    
    // Handle formatted CLIErrors without re-formatting
    if (error instanceof CLIError &&
        ((error as any).code === 'FORMATTED_ERROR' || (error as any).code === 'DETAILED_ERROR')) {
      throw error;  // Throw to satisfy 'never' return type
    }

    // Display friendly error message using enhanced system
    const friendlyError = displayFriendlyError(error, context);
    console.error(friendlyError);
    
    // Log stack trace if verbose
    if (this.isVerbose() && error.stack) {
      console.error('\nStack trace:');
      console.error(chalk.dim(error.stack));
    }
    
    // Exit with appropriate code
    if (error instanceof CLIError) {
      process.exit((error as any).exitCode || 1);
    } else {
      process.exit(1);
    }
  }

  /**
   * Handle structured WalrusError types with appropriate formatting
   */
  private handleStructuredError(error: WalrusError): never {
    const errorInfo = error.toPublicError();
    
    // Build troubleshooting steps based on error code
    const troubleshooting: string[] = [];
    
    // Ensure this function never returns by throwing
    throw new Error(error.message);
    
    switch (error.code) {
      case 'NETWORK_ERROR':
        troubleshooting.push('Check your internet connection');
        troubleshooting.push('Verify the service is accessible');
        break;
      case 'VALIDATION_ERROR':
        troubleshooting.push('Check input format and values');
        troubleshooting.push('Review command help for requirements');
        break;
      case 'AUTHORIZATION_ERROR':
        troubleshooting.push('Check your authentication status');
        troubleshooting.push('Verify your permissions');
        break;
      default:
        this.logger.warn(`Unrecognized error code: ${error.code}`);
        troubleshooting.push('Review the error message above');
        troubleshooting.push('Try running with --verbose flag');
        troubleshooting.push(`Error code: ${error.code}`);
    }
    
    if (errorInfo.shouldRetry) {
      troubleshooting.push('This operation can be retried');
    }
    
    this.detailedError(
      error.name,
      errorInfo.message,
      troubleshooting
    );
    // The detailedError method throws, so no return needed to satisfy 'never' type
  }

  /**
   * Execute an async operation with retry logic for transient errors
   * 
   * @param operation Function to execute
   * @param options Retry options
   * @returns Result of the operation
   * @throws NetworkError if all retries fail
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      baseDelay?: number;
      retryMessage?: string;
      operationName?: string;
    } = {}
  ): Promise<T> {
    const { 
      maxRetries = 3, 
      baseDelay = 1000, 
      retryMessage = 'Retrying operation...', 
      operationName = 'network_operation' 
    } = options;
    
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Check if error is retryable
        const isRetryable = this.isTransientError(error);
        
        if (!isRetryable || attempt === maxRetries) {
          // Wrap in NetworkError if not already wrapped
          if (!(error instanceof NetworkError)) {
            throw new NetworkError(
              error.message || 'Network operation failed',
              {
                operation: operationName,
                recoverable: isRetryable,
                cause: error
              }
            );
          }
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        this.debugLog(`${retryMessage} (attempt ${attempt}/${maxRetries}) - waiting ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Should never reach here, but for TypeScript
    throw new NetworkError(
      'Operation failed after all retries',
      {
        operation: operationName,
        recoverable: false,
        cause: lastError
      }
    );
  }
  
  /**
   * Check if an error is transient and should be retried
   */
  private isTransientError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    
    const message = (error as Error).message?.toLowerCase() || '';
    const code = (error as any).code?.toLowerCase() || '';
    
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('429') ||
      code.includes('network_error') ||
      code.includes('timeout') ||
      code === 'econnrefused' ||
      code === 'econnreset'
    );
  }

  /**
   * Validate command input with enhanced error messages
   * 
   * @param validator Validation function
   * @param value Value to validate
   * @param errorMessage Error message if validation fails
   * @throws ValidationError if validation fails
   */
  /**
   * Centralized file write method that can be mocked in tests
   * This provides a consistent interface for all file operations
   * and allows test code to mock file operations by replacing this method
   * 
   * @param filePath Path to the file to write
   * @param data Data to write to the file
   * @param options Write options
   */
  protected writeFileSafe(filePath: string, data: string, options?: fs.WriteFileOptions): void {
    // Create directory if it doesn't exist
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write file with proper error handling
    try {
      fs.writeFileSync(filePath, data, options);
    } catch (error) {
      this.warning(`Failed to write file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Get the base configuration directory for storing WalTodo's settings and data
   * This location can be customized via the WALRUS_TODO_CONFIG_DIR environment variable
   * The default location is ~/.waltodo
   * 
   * @returns Absolute path to the configuration directory
   */
  protected getConfigDir(): string {
    return process.env.WALRUS_TODO_CONFIG_DIR || path.join(os.homedir(), '.waltodo');
  }
  
  protected validateInput<T>(
    validator: (value: T) => boolean,
    value: T,
    errorMessage: string,
    field?: string
  ): void {
    if (!validator(value)) {
      throw new ValidationError(errorMessage, {
        field,
        value,
        recoverable: false
      });
    }
  }

  /**
   * Create a transaction context for blockchain operations
   * Provides rollback capability on failure
   * 
   * @param transactionFn Function to execute within transaction
   * @returns Result of transaction
   * @throws TransactionError if transaction fails
   */
  protected async executeTransaction<T>(
    transactionFn: () => Promise<T>,
    options: {
      operation: string;
      rollbackFn?: () => Promise<void>;
    }
  ): Promise<T> {
    const { operation, rollbackFn } = options;
    
    try {
      return await transactionFn();
    } catch (error: any) {
      // Attempt rollback if provided
      if (rollbackFn) {
        try {
          await rollbackFn();
          this.warning('Transaction rolled back successfully');
        } catch (rollbackError: any) {
          this.logger.error('Rollback failed', rollbackError);
          this.warning('Transaction rollback failed - manual intervention may be required');
        }
      }
      
      // Convert to TransactionError for consistent handling
      throw new TransactionError(
        error.message || `Transaction ${operation} failed`,
        {
          operation,
          recoverable: false,
          cause: error
        }
      );
    }
  }

  /**
   * Initialize performance caches and tools
   */
  private initializePerformanceTools(): void {
    const cacheDir = path.join(os.homedir(), '.walrus', 'cache');
    
    // Initialize caches with appropriate strategies
    this.configCache = createCache<any>('config', {
      strategy: 'TTL',
      ttlMs: 3600000, // 1 hour
      persistenceDir: path.join(cacheDir, 'config')
    });
    
    this.todoListCache = createCache<any>('todos', {
      strategy: 'LRU',
      maxSize: 100,
      persistenceDir: path.join(cacheDir, 'todos')
    });
    
    this.blockchainQueryCache = createCache<any>('blockchain', {
      strategy: 'TTL',
      ttlMs: 300000, // 5 minutes
      persistenceDir: path.join(cacheDir, 'blockchain')
    });
    
    this.aiResponseCache = createCache<any>('ai-responses', {
      strategy: 'TTL',
      ttlMs: 3600000, // 1 hour
      maxSize: 50,
      persistenceDir: path.join(cacheDir, 'ai')
    });
    
    // Initialize batch processor with default settings
    this.batchProcessor = new BatchProcessor({
      batchSize: 10,
      concurrencyLimit: 5,
      retryAttempts: 3,
      retryDelayMs: 1000
    });
    
    // Initialize lazy loader
    this.lazyLoader = getGlobalLazyLoader({
      cacheModules: true,
      preloadHints: [
        '@mysten/sui/client',
        '@mysten/walrus',
        'chalk',
        'ora',
        '../services/todoService',
        '../services/ai/aiService'
      ]
    });
  }
  
  /**
   * Preload commonly used modules in the background
   */
  private async preloadCommonModules(): Promise<void> {
    // Only preload essential modules needed by most commands
    setTimeout(async () => {
      try {
        // Only preload todoService which is used by most commands
        await this.lazyLoader.preload([
          '../services/todoService'
        ]);
        
        // Preload other modules based on command type (defer this to command-specific init)
        const cmdName = this.id || '';
        if (cmdName.includes('store') || cmdName.includes('retrieve')) {
          await this.lazyLoader.preload([
            '../utils/walrus-storage',
            '../utils/sui-nft-storage'
          ]);
        }
        
        if (cmdName.includes('ai') || cmdName.includes('suggest')) {
          await this.lazyLoader.preload([
            '../services/ai/AIVerificationService'
          ]);
        }
      } catch (error) {
        this.logger.warn('Failed to preload some modules', error);
      }
    }, 100);
  }
  
  /**
   * Save performance caches to disk
   */
  private async savePerformanceCaches(): Promise<void> {
    try {
      await Promise.all([
        this.configCache.shutdown(),
        this.todoListCache.shutdown(),
        this.blockchainQueryCache.shutdown(),
        this.aiResponseCache.shutdown()
      ]);
    } catch (error) {
      this.logger.warn('Failed to save some caches', error);
    }
  }
  
  /**
   * Get cached configuration or load it
   */
  protected async getCachedConfig<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = await this.configCache.get(key);
    if (cached) {
      this.debugLog(`Config cache hit: ${key}`);
      return cached;
    }
    
    const value = await loader();
    await this.configCache.set(key, value);
    return value;
  }
  
  /**
   * Update cached configuration
   */
  protected async setCachedConfig<T>(key: string, value: T): Promise<void> {
    await this.configCache.set(key, value);
    this.debugLog(`Config cache updated: ${key}`);
  }
  
  /**
   * Get cached todo list or load it
   */
  protected async getCachedTodos<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = await this.todoListCache.get(key);
    if (cached) {
      this.debugLog(`Todo cache hit: ${key}`);
      return cached;
    }
    
    const value = await loader();
    await this.todoListCache.set(key, value);
    return value;
  }
  
  /**
   * Update cached todo list
   */
  protected async setCachedTodos<T>(key: string, value: T): Promise<void> {
    await this.todoListCache.set(key, value);
    this.debugLog(`Todo cache updated: ${key}`);
  }
  
  /**
   * Process operations in batches
   */
  protected async processBatch<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    options?: Partial<{
      batchSize: number;
      concurrencyLimit: number;
      progressCallback?: (progress: any) => void;
    }>
  ): Promise<R[]> {
    const batchOptions = {
      batchSize: options?.batchSize || 10,
      concurrencyLimit: options?.concurrencyLimit || 5,
      progressCallback: options?.progressCallback
    };
    
    const processor_ = new BatchProcessor(batchOptions);
    const result = await processor_.process(items, processor);
    
    if (result.failed.length > 0) {
      this.warning(`Batch processing completed with ${result.failed.length} failures`);
    }
    
    return result.successful;
  }
  
  /**
   * Lazy load heavy dependencies
   */
  protected async lazyLoad<T = any>(modulePath: string): Promise<T> {
    try {
      return await this.lazyLoader.load(modulePath) as T;
    } catch (error) {
      this.logger.error(`Failed to lazy load module: ${modulePath}`, error);
      throw error;
    }
  }

  /**
   * Create a spinner with command defaults
   */
  protected createSpinner(text: string, options: SpinnerOptions = {}): SpinnerManager {
    if (this.shouldSuppressOutput()) {
      // Return a no-op spinner when output is suppressed
      return {
        start: () => this,
        stop: () => this,
        succeed: () => this,
        fail: () => this,
        warn: () => this,
        info: () => this,
        text: () => this,
        color: () => this,
        style: () => this,
        nested: () => this.createSpinner(''),
        removeNested: () => {},
        clear: () => this,
        isSpinning: () => false,
      } as any;
    }

    return createSpinner(text, {
      color: 'cyan',
      style: 'dots',
      ...options
    });
  }

  /**
   * Create a progress bar with command defaults
   */
  protected createProgressBar(options: ProgressBarOptions = {}): ProgressBar {
    if (this.shouldSuppressOutput()) {
      // Return a no-op progress bar when output is suppressed
      return {
        start: () => {},
        update: () => {},
        increment: () => {},
        stop: () => {},
        getProgress: () => 0,
        getETA: () => 0,
        setFormat: () => {},
      } as any;
    }

    return createProgressBar({
      format: ' {spinner} {bar} {percentage}% | ETA: {eta}s | {value}/{total}',
      barCompleteChar: '█',
      barIncompleteChar: '░',
      ...options
    });
  }

  /**
   * Create a multi-progress manager
   */
  protected createMultiProgress(options: ProgressBarOptions = {}): MultiProgress {
    if (this.shouldSuppressOutput()) {
      // Return a no-op multi-progress when output is suppressed
      return {
        create: () => ({} as any),
        update: () => {},
        remove: () => {},
        stop: () => {},
        getBar: () => undefined,
      } as any;
    }

    return createMultiProgress(options);
  }

  /**
   * Run an async operation with a spinner
   */
  protected async withSpinner<T>(
    text: string,
    operation: () => Promise<T>,
    options: SpinnerOptions = {}
  ): Promise<T> {
    if (this.shouldSuppressOutput()) {
      return operation();
    }

    return withSpinner(text, operation, {
      color: 'cyan',
      style: 'dots',
      ...options
    });
  }

  /**
   * Run an async operation with a progress bar
   */
  protected async withProgressBar<T>(
    total: number,
    operation: (progress: ProgressBar) => Promise<T>,
    options: ProgressBarOptions = {}
  ): Promise<T> {
    if (this.shouldSuppressOutput()) {
      const noopProgress = this.createProgressBar();
      return operation(noopProgress);
    }

    return withProgressBar(total, operation, options);
  }

  /**
   * Create a fun animated spinner for special operations
   */
  protected createFunSpinner(
    text: string,
    style: 'walrus' | 'sparkle' | 'moon' | 'star' = 'walrus'
  ): SpinnerManager {
    return this.createSpinner(text, {
      style: style as any,
      color: style === 'walrus' ? 'blue' : style === 'sparkle' ? 'magenta' : 'yellow'
    });
  }

  /**
   * Create a gradient progress bar
   */
  protected createGradientProgressBar(options: ProgressBarOptions = {}): ProgressBar {
    return this.createProgressBar({
      ...options,
      format: ' {spinner} {bar} {percentage}% | ETA: {eta}s | {value}/{total}',
      // The gradient is handled by the formatBar function in ProgressBar
    });
  }

  /**
   * Run multiple operations with a multi-progress display
   */
  protected async runWithMultiProgress<T>(
    operations: Array<{
      name: string;
      total: number;
      operation: (progress: cliProgress.SingleBar) => Promise<T>;
    }>
  ): Promise<T[]> {
    if (this.shouldSuppressOutput()) {
      // Run operations without progress display
      return Promise.all(
        operations.map(({ operation }) => operation({} as any))
      );
    }

    const multiProgress = this.createMultiProgress();
    const results: T[] = [];

    try {
      const promises = operations.map(async ({ name, total, operation }) => {
        const bar = multiProgress.create(name, total);
        const result = await operation(bar);
        multiProgress.remove(name);
        return result;
      });

      const allResults = await Promise.all(promises);
      results.push(...allResults);
    } finally {
      multiProgress.stop();
    }

    return results;
  }

  /**
   * Start a unified spinner with consistent styling
   */
  protected startUnifiedSpinner(message: string): CLISpinnerManager {
    return new CLISpinnerManager(message);
  }

  /**
   * Validate flags using unified validators
   */
  protected validateFlag = {
    positiveNumber: (value: string, name: string) => 
      FlagValidator.validatePositiveNumber(value, name),
    nonEmpty: (value: string, name: string) => 
      FlagValidator.validateNonEmpty(value, name),
    enum: <T extends string>(value: string, validValues: T[], name: string) =>
      FlagValidator.validateEnum(value, validValues, name),
    path: (value: string, name: string) =>
      FlagValidator.validatePath(value, name),
  };

  /**
   * Execute with retry using unified retry manager
   */
  protected async retryOperation<T>(
    operation: () => Promise<T>,
    context: string,
    options?: RetryOptions
  ): Promise<T> {
    try {
      // Use the static retry method for now since it's a simple operation
      // This avoids having to create a fake NetworkNode just for compatibility
      return await RetryManager.retry(
        operation,
        {
          ...options,
          onRetry: (attempt: number, error: Error) => {
            this.warning(`${context}: Retry attempt ${attempt} after error: ${error.message}`);
            if (options?.onRetry) {
              (options.onRetry as any)(attempt, error);
            }
          }
        }
      );
    } catch (error) {
      ErrorHandler.handle(error, context);  // This throws, so function always returns
      // TypeScript doesn't know ErrorHandler.handle() always throws, so add this
      throw new Error('Should never reach here');
    }
  }

  /**
   * Log messages using unified logger utilities
   */
  protected logUtils = {
    success: (message: string) => CLILogger.success(message),
    error: (message: string) => CLILogger.error(message),
    warning: (message: string) => CLILogger.warning(message),
    info: (message: string) => CLILogger.info(message),
    debug: (message: string) => CLILogger.debug(message),
    step: (step: number, total: number, message: string) => 
      CLILogger.step(step, total, message),
  };

  /**
   * Format output using unified formatters
   */
  protected format = {
    table: (data: Record<string, unknown>) => Formatter.table(data),
    list: (items: string[], bullet?: string) => Formatter.list(items, bullet),
    code: (text: string) => Formatter.code(text),
    highlight: (text: string) => Formatter.highlight(text),
    dim: (text: string) => Formatter.dim(text),
  };

  /**
   * Handle errors consistently across all commands
   */
  protected handleError(error: unknown, context: string): never {
    ErrorHandler.handle(error, context);
  }

  /**
   * Format errors consistently
   */
  protected formatError(error: unknown): string {
    return ErrorHandler.formatError(error);
  }

  /**
   * Flag to indicate if command is running in interactive mode
   */
  protected isInteractiveMode: boolean = false;

  /**
   * Set interactive mode flag
   */
  setInteractiveMode(value: boolean): void {
    this.isInteractiveMode = value;
  }

  /**
   * Get interactive mode flag
   */
  getInteractiveMode(): boolean {
    return this.isInteractiveMode;
  }

  /**
   * Helper method for handling output in interactive mode
   * In interactive mode, we don't want to exit the process
   */
  protected output(message: string, isError: boolean = false): void {
    if (this.isInteractiveMode) {
      if (isError) {
        console.error(message);
      } else {
        console.log(message);
      }
    } else {
      if (isError) {
        this.error(message);
      } else {
        this.log(message);
      }
    }
  }

  /**
   * Override error handling for interactive mode
   * In interactive mode, we don't want to exit the process on errors
   */
  protected async handleInteractiveError(error: Error): Promise<void> {
    if (this.isInteractiveMode) {
      console.error(chalk.red(`Error: ${error.message}`));
      if (this.isVerbose()) {
        console.error(chalk.gray(error.stack || ''));
      }
    } else {
      throw error;
    }
  }
}

// Add named export for commands that use it
export { BaseCommand };
```

## File: src/commands/complete.ts
```typescript
import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../base-command';
import { SuiClient } from '@mysten/sui/client';
import { TransactionBlock } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { TodoService } from '../services/todoService';
import { createWalrusStorage } from '../utils/walrus-storage';
import { SuiNftStorage } from '../utils/sui-nft-storage';
import { NETWORK_URLS, TODO_NFT_CONFIG } from '../constants';
import { CLIError } from '../types/error';
import { configService } from '../services/config-service';
import chalk from 'chalk';
import { RetryManager } from '../utils/retry-manager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Todo } from '../types/todo';

/**
 * @class CompleteCommand
 * @description Marks a todo item as completed. This command handles updates for todos stored locally,
 * on the Walrus blockchain, and as NFTs on the Sui blockchain.
 *
 * Key functionalities:
 * - Marks a local todo item as complete.
 * - If the todo has an associated Sui NFT, it updates the NFT's 'completed' status on-chain.
 *   This requires the smart contract to be deployed and may incur gas fees.
 * - If the todo has an associated Walrus blob ID, it updates the blob on Walrus storage.
 * - Provides feedback on the success of local, NFT, and Walrus updates.
 * - Includes retries and error handling for blockchain operations.
 *
 * @param {string} [list='default'] - The name of the todo list. (Argument)
 * @param {string} id - The ID or title of the todo item to mark as complete. (Required flag: -i, --id)
 * @param {string} [network] - The blockchain network to use (e.g., 'localnet', 'devnet', 'testnet', 'mainnet').
 *                             Defaults to the network configured globally or 'testnet'. (Optional flag: -n, --network)
 */
export default class CompleteCommand extends BaseCommand {
  static description = `Mark a todo as completed.
  If the todo has an associated NFT or Walrus blob, updates blockchain storage as well.
  NFT updates may require gas tokens on the configured network.`;

  static examples = [
    '<%= config.bin %> complete my-list -i todo-123',
    '<%= config.bin %> complete my-list -i "Buy groceries"'
  ];

  static flags = {
    ...BaseCommand.flags,
    id: Flags.string({
      char: 'i',
      description: 'Todo ID or title to mark as completed',
      required: true
    }),
    network: Flags.string({
      char: 'n',
      description: 'Network to use (defaults to configured network)',
      options: ['localnet', 'devnet', 'testnet', 'mainnet'],
    })
  };

  static args = {
    list: Args.string({
      name: 'list',
      description: 'List name',
      default: 'default'
    })
  };

  private todoService = new TodoService();
  private walrusStorage = createWalrusStorage('testnet', false); // Use real Walrus storage

  /**
   * Validates the specified network against allowed network options
   * and retrieves the corresponding network URL.
   * 
   * @param network The network name to validate
   * @returns The network URL for the specified network
   * @throws CLIError if the network is invalid
   */
  private validateNetwork(network: string): string {
    const validNetworks = ['localnet', 'devnet', 'testnet', 'mainnet'];
    if (!validNetworks.includes(network)) {
      throw new CLIError(
        `Invalid network: ${network}. Valid networks are: ${validNetworks.join(', ')}`,
        'INVALID_NETWORK'
      );
    }
    return NETWORK_URLS[network as keyof typeof NETWORK_URLS] || '';
  }

  /**
   * Checks that the smart contract has been deployed to the specified network.
   * This is required before we can interact with NFTs on the blockchain.
   * 
   * @param network The network to validate deployment on
   * @throws CLIError if the contract is not deployed
   */
  private async validateBlockchainConfig(network: string): Promise<void> {
    const config = await configService.getConfig();
    if (!config.lastDeployment?.packageId) {
      throw new CLIError(
        'Contract not deployed. Run "waltodo deploy --network ' + network + '" first.',
        'NOT_DEPLOYED'
      );
    }
  }

  /**
   * Checks that we can connect to the specified network and retrieves
   * the current protocol version for informational purposes.
   * 
   * @param suiClient Connected Sui client instance
   * @returns Protocol version string
   * @throws CLIError if connection fails
   */
  private async getNetworkStatus(suiClient: SuiClient): Promise<string> {
    try {
      const state = await suiClient.getLatestSuiSystemState();
      return state.protocolVersion?.toString() || 'unknown';
    } catch (error) {
      throw new CLIError(
        `Failed to connect to network: ${error instanceof Error ? error.message : String(error)}`,
        'NETWORK_CONNECTION_FAILED'
      );
    }
  }

  /**
   * Validates that the NFT exists and is in a valid state for completion.
   * Performs several checks:
   * 1. Verifies the NFT exists and can be fetched
   * 2. Confirms the NFT has the expected type/structure
   * 3. Checks that the NFT is not already marked as completed
   * 
   * @param suiClient Connected Sui client instance
   * @param nftObjectId ID of the NFT object to validate
   * @throws CLIError for various NFT-related validation failures
   */
  private async validateNftState(suiClient: SuiClient, nftObjectId: string): Promise<void> {
    try {
      const result = await suiClient.getObject({
        id: nftObjectId,
        options: { showContent: true }
      });
      
      if (result.error) {
        throw new CLIError(
          `Failed to fetch NFT: ${result.error.code}`,
          'NFT_FETCH_FAILED'
        );
      }

      if (!result.data?.content) {
        throw new CLIError(
          'NFT data not found or inaccessible',
          'NFT_NOT_FOUND'
        );
      }

      // Check if NFT is already completed
      const content = result.data.content as { type?: string; fields?: { completed?: boolean } };
      
      // Verify NFT type
      const expectedType = `${TODO_NFT_CONFIG.MODULE_ADDRESS}::${TODO_NFT_CONFIG.MODULE_NAME}::${TODO_NFT_CONFIG.STRUCT_NAME}`;
      if (content.type !== expectedType) {
        throw new CLIError(
          `Invalid NFT type. Expected ${expectedType}`,
          'INVALID_NFT_TYPE'
        );
      }

      if (content.fields?.completed) {
        throw new CLIError(
          'NFT is already marked as completed',
          'NFT_ALREADY_COMPLETED'
        );
      }
    } catch (error) {
      if (error instanceof CLIError) throw error;
      throw new CLIError(
        `Failed to validate NFT state: ${error instanceof Error ? error.message : String(error)}`,
        'NFT_VALIDATION_FAILED'
      );
    }
  }

  /**
   * Performs a dry run of the NFT completion transaction to estimate
   * gas costs before actual execution. This allows users to see expected
   * costs before proceeding with the transaction.
   * 
   * @param suiClient Connected Sui client instance
   * @param nftObjectId ID of the NFT object to update
   * @param packageId ID of the deployed smart contract package
   * @returns Object containing computation and storage gas costs
   * @throws CLIError if gas estimation fails
   */
  private async estimateGasForNftUpdate(suiClient: SuiClient, nftObjectId: string, packageId: string): Promise<{ computationCost: string; storageCost: string; }> {
    try {
      const txb = new TransactionBlock();
      txb.moveCall({
        target: `${packageId}::${TODO_NFT_CONFIG.MODULE_NAME}::complete_todo`,
        arguments: [txb.object(nftObjectId)]
      });

      const dryRunResult = await suiClient.dryRunTransactionBlock({
        transactionBlock: txb.serialize().toString()
      });

      return {
        computationCost: dryRunResult.effects.gasUsed.computationCost,
        storageCost: dryRunResult.effects.gasUsed.storageCost
      };
    } catch (error) {
      throw new CLIError(
        `Failed to estimate gas: ${error instanceof Error ? error.message : String(error)}`,
        'GAS_ESTIMATION_FAILED'
      );
    }
  }

  /**
   * Updates configuration with information about completed todos.
   * Tracks completion statistics for reporting and analytics purposes.
   * 
   * @param todo The todo item being marked as completed
   * @returns Promise that resolves when config update is complete
   */
  private async updateConfigWithCompletion(todo: Todo): Promise<void> {
    try {
      const config = await configService.getConfig();
      
      // Initialize completed todos tracking if not exists
      if (!config.completedTodos) {
        config.completedTodos = {
          count: 0,
          lastCompleted: null,
          history: [],
          byCategory: {}
        };
      }
      
      // Update statistics
      config.completedTodos.count++;
      config.completedTodos.lastCompleted = new Date().toISOString();
      
      // Add to history with proper metadata for tracking
      config.completedTodos.history = config.completedTodos.history || [];
      config.completedTodos.history.push({
        id: todo.id,
        title: todo.title,
        completedAt: new Date().toISOString(),
        listName: todo.listName || 'default'
      });
      
      // Limit history size to prevent config file growth
      if (config.completedTodos.history.length > 100) {
        config.completedTodos.history = config.completedTodos.history.slice(-100);
      }
      
      // Track by category if available
      if (todo.category) {
        config.completedTodos.byCategory[todo.category] = 
          (config.completedTodos.byCategory[todo.category] || 0) + 1;
      }
      
      // Add tags tracking if available
      if (todo.tags && todo.tags.length > 0) {
        config.completedTodos.byTag = config.completedTodos.byTag || {};
        for (const tag of todo.tags) {
          config.completedTodos.byTag[tag] = (config.completedTodos.byTag[tag] || 0) + 1;
        }
      }
      
      // Write the config, using our custom wrapper to allow mocking in tests
      await this.writeConfigSafe(config);
    } catch (error) {
      // Non-blocking error - log but don't fail the command
      this.warning(`Failed to update completion statistics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Write configuration safely with ability to mock in tests
   * This allows test code to count the number of calls to fs.writeFileSync
   * 
   * @param config Configuration to write
   */
  private async writeConfigSafe(config: any): Promise<void> {
    try {
      // First try the standard config service method
      if (typeof configService.saveConfig === 'function') {
        await configService.saveConfig(config);
        return;
      }
      
      // Fallback to direct file writing with wrapper
      const configDir = this.getConfigDir();
      const configPath = path.join(configDir, 'config.json');
      
      // Write config using our wrapper that can be mocked
      // ALWAYS use writeFileSafe to ensure consistent behavior
      this.writeFileSafe(configPath, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
      throw new Error(`Failed to save config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Wrapper for fs.writeFileSync that can be mocked in tests
   * Always delegates to writeFileSafe method for consistent behavior and testability
   * 
   * @param filePath Path to file
   * @param data Data to write
   * @param options Write options
   */
  private writeFileSyncWrapper(filePath: string, data: string, options: any): void {
    // Only use the centralized writeFileSafe method from BaseCommand
    // DO NOT call fs.writeFileSync directly to allow proper mocking in tests
    this.writeFileSafe(filePath, data, options);
  }
  
  /**
   * Save a mapping between todo ID and blob ID
   * This method uses the writeFileSafe method for consistent behavior
   * @param todoId Todo ID
   * @param blobId Blob ID
   */
  private saveBlobMapping(todoId: string, blobId: string): void {
    try {
      // Use the centralized getConfigDir method from BaseCommand
      const configDir = this.getConfigDir();
      const blobMappingsFile = path.join(configDir, 'blob-mappings.json');
      
      // Read existing mappings or create empty object
      let mappings: Record<string, string> = {};
      if (fs.existsSync(blobMappingsFile)) {
        try {
          const content = fs.readFileSync(blobMappingsFile, 'utf8');
          mappings = JSON.parse(content);
        } catch (error) {
          this.warning(`Error reading blob mappings file: ${error instanceof Error ? error.message : String(error)}`);
          // Continue with empty mappings
        }
      }
      
      // Add or update mapping
      mappings[todoId] = blobId;
      
      // Write mappings back to file using our centralized method
      // This ensures directory creation and consistent error handling
      this.writeFileSafe(blobMappingsFile, JSON.stringify(mappings, null, 2), 'utf8');
      this.debugLog(`Saved blob mapping: ${todoId} -> ${blobId}`);
    } catch (error) {
      this.warning(`Failed to save blob mapping: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Main command execution method. Handles the complete workflow for marking
   * a todo as completed across all relevant storage systems.
   * 
   * Execution flow:
   * 1. Parse and validate command arguments
   * 2. Find the specified todo in the specified list
   * 3. Check if the todo is already completed
   * 4. For blockchain operations, validate network and NFT state
   * 5. Update local storage first (atomic operation)
   * 6. If NFT exists, update it on the blockchain with verification
   * 7. If Walrus blob exists, update it with retry logic
   * 8. Present summary information to the user
   */
  async run(): Promise<void> {
    // Track non-blocking errors like Walrus blob update failure
    let lastWalrusError: Error | null = null;

    try {
      const { args, flags } = await this.parse<typeof CompleteCommand>(CompleteCommand);
      
      // Get config once to avoid redeclaration issues
      const config = await configService.getConfig();
      
      // Validate network
      const network = flags.network || config.network || 'testnet';
      const networkUrl = this.validateNetwork(network);

      // Check list exists
      const list = await this.todoService.getList(args.list);
      if (!list) {
        throw new CLIError(`List "${args.list}" not found`, 'LIST_NOT_FOUND');
      }

      // Find todo by ID or title
      const todo = await this.todoService.getTodoByTitleOrId(flags.id, args.list);
      if (!todo) {
        throw new CLIError(`Todo "${flags.id}" not found in list "${args.list}"`, 'TODO_NOT_FOUND');
      }

      // Verify not already completed
      if (todo.completed) {
        this.log(chalk.yellow(`Todo "${todo.title}" is already marked as completed`));
        return;
      }

      // Initialize blockchain clients if needed
      let suiClient: SuiClient | undefined;
      let suiNftStorage: SuiNftStorage | undefined;
      
      if (todo.nftObjectId || todo.walrusBlobId) {
        // Validate deployment config first
        await this.validateBlockchainConfig(network);

        // Initialize and check network connection
        suiClient = new SuiClient({ url: networkUrl });
        const protocolVersion = await this.getNetworkStatus(suiClient);
        this.log(chalk.dim(`Connected to ${network} (protocol version ${protocolVersion})`));

        // Validate NFT state and estimate gas if NFT exists
        if (todo.nftObjectId) {
          await this.validateNftState(suiClient, todo.nftObjectId);
          
          // Initialize NFT storage
          const signer = {} as Ed25519Keypair;
          suiNftStorage = new SuiNftStorage(
            suiClient,
            signer,
            { address: config.lastDeployment!.packageId, packageId: config.lastDeployment!.packageId }
          );

          // Estimate gas for the operation
          const gasEstimate = await this.estimateGasForNftUpdate(suiClient, todo.nftObjectId, config.lastDeployment!.packageId);
          this.log(chalk.dim(`Estimated gas cost: ${Number(gasEstimate.computationCost) + Number(gasEstimate.storageCost)} MIST`));
        }
      }

      // Update local todo first
      this.log(chalk.blue(`Marking todo "${todo.title}" as completed...`));
      await this.todoService.toggleItemStatus(args.list, todo.id, true);
      this.log(chalk.green('\u2713 Local update successful'));
      
      // Update configuration to record completion
      await this.updateConfigWithCompletion(todo);

      // Update NFT if exists
      if (todo.nftObjectId && suiNftStorage) {
        try {
          this.log(chalk.blue('Updating NFT on blockchain...'));
          const txDigest = await RetryManager.retry(
            () => suiNftStorage.updateTodoNftCompletionStatus(todo.nftObjectId!),
            {
              maxRetries: 3,
              initialDelay: 1000,
              onRetry: (attempt, error) => {
                this.log(chalk.yellow(`Retry attempt ${attempt} after error: ${error.message}`));
              }
            }
          );
          this.log(chalk.green('\u2713 Todo NFT updated on blockchain'));
          this.log(chalk.dim(`Transaction: ${txDigest}`));
          
          // Verify NFT update with proper error handling
          await RetryManager.retry(async () => {
            try {
              // Add timeout for verification to prevent hanging
              let timeoutId: NodeJS.Timeout;
              const verificationPromise = suiClient!.getObject({
                id: todo.nftObjectId!,
                options: { showContent: true }
              });

              const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutId = setTimeout(() => {
                  reject(new Error('NFT verification timed out after 10 seconds'));
                }, 10000);
              });

              const result = await Promise.race([verificationPromise, timeoutPromise]);
              clearTimeout(timeoutId);

              const content = result.data?.content as { fields?: { completed?: boolean } };
              if (!content?.fields?.completed) {
                throw new Error('NFT update verification failed: completed flag not set');
              }
            } catch (verifyError) {
              const error = verifyError instanceof Error
                ? verifyError
                : new Error(String(verifyError));

              throw new Error(
                `NFT verification error: ${error.message}`
              );
            }
          }, {
            maxRetries: 3,
            initialDelay: 2000,
            onRetry: (attempt, error) => {
              this.log(chalk.yellow(`Verification retry ${attempt} after error: ${error.message}`));
            }
          });
        } catch (blockchainError) {
          // Keep local update but throw error for blockchain update
          throw new CLIError(
            `Failed to update NFT on blockchain: ${blockchainError instanceof Error ? blockchainError.message : String(blockchainError)}\nLocal update was successful, but blockchain state may be out of sync.`,
            'BLOCKCHAIN_UPDATE_FAILED'
          );
        }

        // If the todo has a Walrus blob ID, update it
        if (todo.walrusBlobId) {
          try {
            this.log(chalk.blue('Connecting to Walrus storage...'));
            await this.walrusStorage.connect();

            // Add proper timeout handling for Walrus operations with cleanup
            let timeoutId: NodeJS.Timeout;
            const timeout = new Promise<never>((_, reject) => {
              timeoutId = setTimeout(() => {
                reject(new Error('Walrus operation timed out after 30 seconds'));
              }, 30000);
            });

            // Update todo on Walrus with retries
            this.log(chalk.blue('Updating todo on Walrus...'));

            const updatedTodo = { 
              ...todo, 
              completed: true, 
              completedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            // Try update with retries
            const maxRetries = 3;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                // Use Promise.race with proper cleanup in both success and error cases
                let newBlobId: string | undefined;
                try {
                  newBlobId = await Promise.race([
                    this.walrusStorage.updateTodo(todo.walrusBlobId || '', updatedTodo),
                    timeout
                  ]) as string | undefined;
                  clearTimeout(timeoutId); // Clear timeout on success
                } catch (raceError) {
                  clearTimeout(timeoutId); // Always clear timeout
                  throw raceError; // Re-throw for outer catch to handle
                }

                if (typeof newBlobId === 'string') {
                  // Update local todo with new blob ID
                  await this.todoService.updateTodo(args.list, todo.id, {
                    walrusBlobId: newBlobId,
                    completedAt: updatedTodo.completedAt,
                    updatedAt: updatedTodo.updatedAt
                  });
                  
                  // Save blob mapping for future reference
                  this.saveBlobMapping(todo.id, newBlobId);

                  this.log(chalk.green('\u2713 Todo updated on Walrus'));
                  this.log(chalk.dim(`New blob ID: ${newBlobId}`));
                  this.log(chalk.dim(`Public URL: https://testnet.wal.app/blob/${newBlobId}`));
                  break;
                } else {
                  throw new Error('Invalid blob ID returned from Walrus');
                }
              } catch (error) {
                lastWalrusError = error instanceof Error ? error : new Error(String(error));
                if (attempt === maxRetries) {
                  this.log(chalk.yellow('\u26a0\ufe0f Failed to update Walrus storage after all retries'));
                  this.log(chalk.yellow('The todo has been marked as completed locally and on-chain, but Walrus blob is out of sync.'));
                  break;
                }
                this.log(chalk.yellow(`Attempt ${attempt} failed, retrying...`));
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              }
            }
          } finally {
            // Always try to disconnect
            try {
              await this.walrusStorage.disconnect();
            } catch (disconnectError) {
              // Just log this error, it's not critical
              this.warn('Warning: Failed to disconnect from Walrus');
            }
          }
        }
      }

      // Show final success message with appropriate details
      this.log(chalk.green('\n\u2713 Todo completion summary:'));
      this.log(chalk.dim('Title:'));
      this.log(`  ${chalk.bold(todo.title)}`);
      
      this.log(chalk.dim('\nUpdates:'));
      this.log(`  ${chalk.green('\u2713')} Local storage`);
      if (todo.nftObjectId) {
        this.log(`  ${chalk.green('\u2713')} Blockchain NFT`);
        this.log(chalk.blue('\nView your updated NFT:'));
        this.log(chalk.cyan(`  https://explorer.sui.io/object/${todo.nftObjectId}?network=${network}`));
      }
      if (todo.walrusBlobId) {
        const walrusUpdateStatus = lastWalrusError ? chalk.yellow('\u26a0\ufe0f') : chalk.green('\u2713');
        this.log(`  ${walrusUpdateStatus} Walrus storage`);
      }

    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to complete todo: ${error instanceof Error ? error.message : String(error)}`,
        'COMPLETE_FAILED'
      );
    }
  }
}
```
