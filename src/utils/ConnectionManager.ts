/**
 * ConnectionManager - Manages network connections and ensures proper cleanup
 * 
 * Handles connection state, timeouts, and ensures proper resource release
 * for network connections, blockchain services, and external API clients.
 */

import { Logger } from './Logger';
import { withRetry } from './promise-utils';
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
  private readonly retryManager: {
    withRetry: <T>(fn: () => Promise<T>, context: string) => Promise<T>;
  };
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
    
    // Create a custom retry manager that uses promise-utils's withRetry function
    this.retryManager = {
      withRetry: (fn: () => Promise<any>, context: string) => {
        // Import the withRetry function from promise-utils
        const { withRetry } = require('./promise-utils');

        return withRetry(
          fn,
          this.options.retryConfig?.maxRetries || 3,
          this.options.retryConfig?.baseDelay || 1000,
          context
        );
      }
    };
    
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
      this.connection = await this.retryManager.withRetry(
        this.connectFn,
        'Create connection'
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