/**
 * ErrorSimulator - Utility for injecting controlled errors in tests
 *
 * This simulator allows injection of various error types into components
 * for testing error handling behavior.
 */

import {
  WalrusError,
  NetworkError,
  BlockchainError,
  StorageError,
  ValidationError,
  TransactionError,
} from '../../src/types/errors';

/**
 * Available error types that can be simulated
 */
export enum ErrorType {
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  STORAGE = 'storage',
  BLOCKCHAIN = 'blockchain',
  TRANSACTION = 'transaction',
  RATE_LIMIT = 'rateLimit',
  SERVER = 'server',
  RESOURCE_EXHAUSTED = 'resourceExhausted',
  DATA_CORRUPTION = 'dataCorruption',
  PERMISSION_DENIED = 'permissionDenied',
  CERTIFICATION = 'certification',
  NOT_FOUND = 'notFound',
  CONFLICT = 'conflict',
}

/**
 * Configuration options for the error simulator
 */
export interface ErrorSimulationConfig {
  enabled: boolean;
  errorType: ErrorType;
  probability?: number; // 0.0 to 1.0, default 1.0 (100%)
  operationTargets?: string[]; // Specific operations to affect
  errorMessage?: string; // Custom error message
  errorCode?: string; // Custom error code
  shouldRetry?: boolean; // Should the error be retryable
  delay?: number; // Delay in ms before error occurs
  additionalContext?: Record<string, any>; // Extra context data
  recoveryProbability?: number; // Chance of recovery in 0.0 to 1.0, default 0.0
  recoveryDelay?: number; // How long until recovery in ms
  errorFactory?: () => Error; // Custom error factory
}

/**
 * Error simulation utility that can be injected into components
 */
export class ErrorSimulator {
  private config: ErrorSimulationConfig;
  private simulatedMethods: Map<
    string,
    {
      object: any;
      methodName: string;
      originalMethod: (...args: any[]) => any;
    }
  > = new Map();

  constructor(config: ErrorSimulationConfig) {
    this.config = {
      probability: 1.0,
      shouldRetry: false,
      recoveryProbability: 0.0,
      ...config,
    };
  }

  /**
   * Update simulator configuration
   */
  updateConfig(config: Partial<ErrorSimulationConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    // If disabled, restore original methods
    if (config.hasOwnProperty('enabled') && !config.enabled) {
      this.restoreAllMethods();
    }
  }

  /**
   * Create error based on configured type
   */
  createError(): Error {
    if (this.config.errorFactory) {
      return this.config.errorFactory();
    }

    const message =
      this.config.errorMessage || `Simulated ${this.config.errorType} error`;

    switch (this.config.errorType) {
      case ErrorType.NETWORK:
        return new NetworkError(message, {
          network: 'test',
          operation: 'connect',
          recoverable: !!this.config.shouldRetry,
          cause: new Error('Simulated underlying network error'),
        });

      case ErrorType.TIMEOUT:
        return new NetworkError(`Request timed out after 10000ms`, {
          network: 'test',
          operation: 'request',
          recoverable: true,
        });

      case ErrorType.AUTHENTICATION:
        return new WalrusError(message, 'AUTHENTICATION_ERROR');

      case ErrorType.VALIDATION:
        return new ValidationError(message, {
          field: this.config.additionalContext?.field,
          constraint: this.config.additionalContext?.constraint,
          recoverable: !!this.config.shouldRetry,
        });

      case ErrorType.STORAGE:
        return new StorageError(message, {
          operation: this.config.additionalContext?.operation || 'write',
          blobId: this.config.additionalContext?.blobId,
          recoverable: !!this.config.shouldRetry,
        });

      case ErrorType.BLOCKCHAIN:
        return new BlockchainError(message, {
          operation: this.config.additionalContext?.operation || 'execute',
          transactionId: this.config.additionalContext?.transactionId,
          recoverable: !!this.config.shouldRetry,
        });

      case ErrorType.TRANSACTION:
        return new TransactionError(message, {
          operation: this.config.additionalContext?.operation || 'submit',
          transactionId: this.config.additionalContext?.transactionId,
          recoverable: !!this.config.shouldRetry,
        });

      case ErrorType.RATE_LIMIT: {
        const rateLimitError = new Error(
          '429 Too Many Requests: Rate limit exceeded'
        );
        (rateLimitError as any).status = 429;
        return rateLimitError;
      }

      case ErrorType.SERVER: {
        const serverError = new Error(
          '500 Internal Server Error: Something went wrong'
        );
        (serverError as any).status = 500;
        return serverError;

      case ErrorType.RESOURCE_EXHAUSTED:
        return new StorageError('Insufficient storage allocation', {
          operation: 'allocate',
          recoverable: false,
        });

      case ErrorType.DATA_CORRUPTION:
        return new ValidationError('Data integrity check failed', {
          recoverable: false,
        });

      case ErrorType.PERMISSION_DENIED:
        return new WalrusError('Permission denied', 'PERMISSION_DENIED');

      case ErrorType.CERTIFICATION:
        return new BlockchainError('Certification failed', {
          operation: 'certify',
          recoverable: false,
        });

      case ErrorType.NOT_FOUND: {
        const notFoundError = new Error(
          '404 Not Found: Resource does not exist'
        );
        (notFoundError as any).status = 404;
        return notFoundError;
      }

      case ErrorType.CONFLICT: {
        const conflictError = new Error(
          '409 Conflict: Resource already exists or version conflict'
        );
        (conflictError as any).status = 409;
        return conflictError;

      default:
        return new Error(message);
    }
  }

  /**
   * Determine if an error should be triggered based on configuration
   */
  private shouldTriggerError(operationName?: string): boolean {
    if (!this.config.enabled) return false;

    // Check operation targeting
    if (this.config.operationTargets && operationName) {
      if (!this.config.operationTargets.includes(operationName)) {
        return false;
      }
    }

    // Check probability
    return Math.random() < (this.config.probability || 1.0);
  }

  /**
   * Determine if error should recover
   */
  private shouldRecover(): boolean {
    return Math.random() < (this.config.recoveryProbability || 0.0);
  }

  /**
   * Simulate error on a specific method
   */
  simulateErrorOnMethod<T>(
    object: any,
    methodName: string,
    operationName?: string
  ): void {
    const originalMethod = object[methodName];
    const methodKey = `${object.constructor?.name || 'unknown'}.${methodName}`;

    // Save original method for restoration
    this.simulatedMethods.set(methodKey, {
      object,
      methodName,
      originalMethod,
    });

    // Replace method with error-injecting version using arrow function
    object[methodName] = async (...args: any[]) => {
      if (this.shouldTriggerError(operationName)) {
        if (this.config.delay) {
          await new Promise(resolve => setTimeout(resolve, this.config.delay));
        }

        if (this.shouldRecover()) {
          // Delay then proceed with original method
          if (this.config.recoveryDelay) {
            await new Promise(resolve =>
              setTimeout(resolve, this.config.recoveryDelay)
            );
          }
          return originalMethod.call(object, ...args);
        }

        throw this.createError();
      }

      return originalMethod.call(object, ...args);
    };
  }

  /**
   * Simulate error on multiple methods
   */
  simulateErrorOnMethods(
    methods: Array<{
      object: any;
      methodName: string;
      operationName?: string;
    }>
  ): void {
    for (const method of methods) {
      this.simulateErrorOnMethod(
        method.object,
        method.methodName,
        method.operationName
      );
    }
  }

  /**
   * Restore original method implementation
   */
  restoreMethod(object: any, methodName: string): void {
    const methodKey = `${object.constructor?.name || 'unknown'}.${methodName}`;
    const savedMethod = this.simulatedMethods.get(methodKey);

    if (savedMethod) {
      object[methodName] = savedMethod.originalMethod;
      this.simulatedMethods.delete(methodKey);
    }
  }

  /**
   * Restore all overridden methods
   */
  restoreAllMethods(): void {
    for (const [_, method] of this.simulatedMethods.entries()) {
      method.object[method.methodName] = method.originalMethod;
    }
    this.simulatedMethods.clear();
  }
}

/**
 * Create preconfigured error simulators for specific scenarios
 */
export const ErrorSimulators = {
  networkDisconnection(): ErrorSimulator {
    return new ErrorSimulator({
      enabled: true,
      errorType: ErrorType.NETWORK,
      errorMessage: 'Network connection lost',
      shouldRetry: true,
      probability: 1.0,
    });
  },

  intermittentNetwork(): ErrorSimulator {
    return new ErrorSimulator({
      enabled: true,
      errorType: ErrorType.NETWORK,
      errorMessage: 'Network connection interrupted',
      shouldRetry: true,
      probability: 0.5,
      recoveryProbability: 0.5,
      recoveryDelay: 1000,
    });
  },

  timeout(): ErrorSimulator {
    return new ErrorSimulator({
      enabled: true,
      errorType: ErrorType.TIMEOUT,
      shouldRetry: true,
      probability: 1.0,
    });
  },

  rateLimiting(): ErrorSimulator {
    return new ErrorSimulator({
      enabled: true,
      errorType: ErrorType.RATE_LIMIT,
      shouldRetry: true,
      probability: 0.7,
    });
  },

  authenticationFailure(): ErrorSimulator {
    return new ErrorSimulator({
      enabled: true,
      errorType: ErrorType.AUTHENTICATION,
      errorMessage: 'Authentication failed: Invalid credentials',
      shouldRetry: false,
      probability: 1.0,
    });
  },

  storageExhausted(): ErrorSimulator {
    return new ErrorSimulator({
      enabled: true,
      errorType: ErrorType.RESOURCE_EXHAUSTED,
      shouldRetry: false,
      probability: 1.0,
    });
  },

  progressiveFailure(): ErrorSimulator {
    // Starts reliable, then gradually fails more often
    let failureRate = 0;

    const simulator = new ErrorSimulator({
      enabled: true,
      errorType: ErrorType.NETWORK,
      probability: 0,
      errorFactory: () => {
        failureRate += 0.2; // Increase failure rate by 20% each time
        if (failureRate > 1) failureRate = 1;

        // Update probability for next call
        simulator.updateConfig({ probability: failureRate });

        return new NetworkError('Progressive network degradation', {
          network: 'test',
          operation: 'request',
          recoverable: true,
        });
      },
    });

    return simulator;
  },
};
