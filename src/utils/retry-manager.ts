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
        const result = await Promise.race([
          operation(node),
          // Timeout promise
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              const timeoutError = new Error(
                `Operation timed out after ${options.timeout}ms`
              );
              this.updateNodeHealth(node.url, false, options.timeout);
              reject(timeoutError);
            }, options.timeout);
          })
        ]);

        // Operation succeeded
        clearTimeout(timeoutId!);
        const responseTime = Date.now() - startTime;

        // Update node health and circuit breaker
        this.updateNodeHealth(node.url, true, responseTime);
        this.updateCircuitBreaker(node, true);

        return result;
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
            `Non-retryable error during ${context}: ${errorObj.message}`,
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
    return context.errors
      .map(e => `Attempt ${e.attempt} failed at ${new Date(e.timestamp).toISOString()}: ${e.error.message}`)
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
}