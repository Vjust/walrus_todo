import { CLIError } from '../types/error';
import { RETRY_CONFIG } from '../constants';
import { Logger } from './Logger';

/**
 * Options for retry behavior
 */
interface RetryOptions {
  initialDelay?: number;
  maxDelay?: number;
  maxRetries?: number;
  maxDuration?: number;
  timeout?: number;
  retryableErrors?: Array<string | RegExp>;
  retryableStatuses?: number[];
  /**
   * Callback invoked on each retry
   * @param error - The error that caused the retry
   * @param attempt - The retry attempt number (1-based)
   * @param delay - The delay before the next retry attempt in milliseconds
   */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
  // New options for enhanced control
  minNodes?: number; // Minimum healthy nodes required
  healthThreshold?: number; // Minimum health score to consider a node healthy
  adaptiveDelay?: boolean; // Use network conditions to adjust delay
  circuitBreaker?: {
    // Circuit breaker configuration
    failureThreshold: number; // Number of failures before opening circuit
    resetTimeout: number; // Time to wait before attempting reset
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
    initialDelay: Number(RETRY_CONFIG.DELAY_MS),
    maxDelay: Number(RETRY_CONFIG.MAX_DELAY_MS),
    maxRetries: Number(RETRY_CONFIG.ATTEMPTS),
    maxDuration: Number(RETRY_CONFIG.MAX_DURATION_MS),
    timeout: Number(RETRY_CONFIG.TIMEOUT_MS),
    retryableErrors: [...RETRY_CONFIG.RETRYABLE_ERRORS] as string[],
    retryableStatuses: [...RETRY_CONFIG.RETRYABLE_STATUSES] as number[],
    onRetry: () => {},
    // New options with defaults
    minNodes: Number(RETRY_CONFIG.MIN_NODES),
    healthThreshold: Number(RETRY_CONFIG.HEALTH_THRESHOLD),
    adaptiveDelay: Boolean(RETRY_CONFIG.ADAPTIVE_DELAY),
    circuitBreaker: {
      failureThreshold: Number(RETRY_CONFIG.CIRCUIT_BREAKER.FAILURE_THRESHOLD),
      resetTimeout: Number(RETRY_CONFIG.CIRCUIT_BREAKER.RESET_TIMEOUT_MS),
    },
    loadBalancing: RETRY_CONFIG.LOAD_BALANCING,
  };

  private nodes: Map<string, NetworkNode> = new Map();
  private readonly HEALTH_DECAY = 0.1; // Health score decay rate
  private readonly MIN_HEALTH = 0.1; // Minimum health score
  private readonly MAX_HEALTH = 1.0; // Maximum health score
  private readonly logger: Logger;
  private roundRobinIndex = 0;

  constructor(
    private baseUrls: string[],
    private options: RetryOptions = {}
  ) {
    this.logger = new Logger('RetryManager');

    // Initialize nodes with base URLs
    baseUrls.forEach((url, index) => {
      this.nodes.set(url, {
        url,
        priority: index,
        consecutiveFailures: 0,
        healthScore: 1.0,
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
      node.healthScore = Math.min(node.healthScore + 0.2, this.MAX_HEALTH);
    } else {
      node.lastFailure = Date.now();
      node.consecutiveFailures++;
      node.healthScore = Math.max(
        node.healthScore - 0.3 * node.consecutiveFailures,
        this.MIN_HEALTH
      );
    }

    // Adjust for response time if available
    if (responseTime) {
      const timeScore = Math.max(0, 1 - responseTime / 1000);
      node.healthScore = node.healthScore * 0.7 + timeScore * 0.3;
    }

    // Apply natural decay
    node.healthScore *= 1 - this.HEALTH_DECAY;
    node.healthScore = Math.max(node.healthScore, this.MIN_HEALTH);
  }

  /**
   * Gets the next best node to try
   */
  /**
   * Circuit breaker status for each node in this instance
   */
  private circuitBreakers: Map<
    string,
    {
      isOpen: boolean;
      failureCount: number;
      lastFailure: number;
      lastReset: number;
    }
  > = new Map();

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
    if (
      Date.now() - breaker.lastFailure >=
      options.circuitBreaker.resetTimeout
    ) {
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
        lastReset: Date.now(),
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
      if (timeSinceSuccess < 60000) {
        // Within last minute
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
      case 'round-robin': {
        // Simple round-robin
        const node =
          availableNodes[this.roundRobinIndex % availableNodes.length];
        this.roundRobinIndex =
          (this.roundRobinIndex + 1) % availableNodes.length;
        return node;
      }

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
  private isRetryableError(error: Error | unknown): boolean {
    const options = { ...RetryManager.DEFAULT_OPTIONS, ...this.options };

    // Check if it's a HTTP error with status code
    if (
      error &&
      typeof error === 'object' &&
      ('status' in error || 'statusCode' in error)
    ) {
      const status =
        (error as { status?: number; statusCode?: number }).status ||
        (error as { status?: number; statusCode?: number }).statusCode;
      if (status && options.retryableStatuses.includes(status)) {
        return true;
      }
    }

    // Check error message against patterns
    const errorString = error instanceof Error ? error.message : String(error);
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

    const recentErrors = context.errors.filter(
      e => Date.now() - e.timestamp < 60000 // Look at last minute
    );

    if (recentErrors.length === 0) return 0.8;

    // More errors = worse conditions
    return Math.max(0.2, 1 - recentErrors.length * 0.2);
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
   * Calculates the base delay for exponential backoff
   * Exported as a static method to allow for unit testing
   */
  static computeDelay(
    attempt: number,
    initialDelay: number,
    maxDelay: number
  ): number {
    // Base exponential backoff: initialDelay * 2^(attempt-1)
    const baseDelay = initialDelay * Math.pow(2, attempt - 1);

    // Cap at maximum delay
    const cappedDelay = Math.min(baseDelay, maxDelay);

    // Add jitter (±20%)
    const jitterRange = cappedDelay * 0.2; // 20% jitter
    const jitter = Math.random() * jitterRange * 2 - jitterRange; // Random value between -jitterRange and +jitterRange

    return Math.max(initialDelay, cappedDelay + jitter);
  }

  /**
   * Calculates next retry delay with adaptivity
   */
  private getNextDelay(context: RetryContext): number {
    const options = { ...RetryManager.DEFAULT_OPTIONS, ...this.options };

    // Get base delay with exponential backoff and jitter
    let delay = RetryManager.computeDelay(
      context.attempt,
      options.initialDelay,
      options.maxDelay
    );

    if (options.adaptiveDelay) {
      // Apply network condition multiplier (capped)
      const networkScore = this.getNetworkScore(context);
      const networkMultiplier = Math.min(2.0, 2 - networkScore);
      delay *= networkMultiplier;

      // Apply error-specific multiplier if available
      if (context.errors.length > 0) {
        const lastError = context.errors[context.errors.length - 1].error;
        const errorMultiplier = this.getErrorMultiplier(lastError);
        delay *= Math.min(2.0, errorMultiplier); // Cap multiplier
      }
    }

    // Final cap at maximum delay
    delay = Math.min(delay, options.maxDelay);

    // Ensure we don't exceed maxDuration
    const timeRemaining =
      options.maxDuration - (Date.now() - context.startTime);
    if (timeRemaining < delay) {
      delay = Math.max(0, timeRemaining);
    }

    return Math.max(options.initialDelay, delay);
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
    context: string | Record<string, unknown>
  ): Promise<T> {
    const options = { ...RetryManager.DEFAULT_OPTIONS, ...this.options };
    const retryContext: RetryContext = {
      attempt: 0,
      startTime: Date.now(),
      lastDelay: 0,
      errors: [],
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
            }),
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
        const errorObj =
          error instanceof Error ? error : new Error(String(error));
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
          type: this.categorizeError(errorObj),
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
              `Will retry after ${options.circuitBreaker.resetTimeout}ms`
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
              networkScore: this.getNetworkScore(retryContext),
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
    if (message.includes('rate limit') || message.includes('429'))
      return 'rate_limit';
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
      lastFailure: node.lastFailure ? new Date(node.lastFailure) : undefined,
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
      onRetry?: (attempt: number, error: Error, delay?: number) => void;
    } = {}
  ): Promise<T> {
    // Create a temporary instance with a single default node
    const manager = new RetryManager(['default'], {
      maxRetries: options.maxRetries,
      initialDelay: options.initialDelay,
      maxDelay: options.maxDelay,
      retryableErrors: options.retryableErrors,
      // Adapt the onRetry callback to match instance method's parameter order
      onRetry: options.onRetry
        ? (error: Error, attempt: number, delay: number) => {
            options.onRetry!(attempt, error, delay);
          }
        : undefined,
    });

    // Wrap the operation to make it compatible with the instance method
    const wrappedOperation = (_node: NetworkNode) => operation();

    // Execute with the instance method
    return manager.execute(
      wrappedOperation,
      typeof options === 'string' ? options : 'static_operation'
    );
  }
}
